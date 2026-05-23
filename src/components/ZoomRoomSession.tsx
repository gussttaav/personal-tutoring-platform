"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ZoomRoomSession.tsx — Zoom Video SDK integration for Next.js
//
// This file uses @zoom/videosdk DIRECTLY instead of @zoom/videosdk-react.
// The React wrapper library (v0.0.2) has a critical bug: its useSession hook
// calls client.leave() in effect cleanup, which React Strict Mode triggers
// immediately — corrupting the SDK's WASM workers and making attachVideo()
// return elements that never render frames.
//
// This implementation:
//   1. Uses a joinedRef guard to prevent Strict Mode double-joins
//   2. NEVER calls client.leave() in effect cleanup (only on explicit action)
//   3. Waits for bVideoOn=true before calling attachVideo()
//   4. Creates video-player-container elements before startVideo()
//   5. Guards all async ops with a destroyedRef
//
// Layout note:
//   This component is rendered inside PreJoinSetup's "fixed inset-0 z-50"
//   wrapper. To take full control of the viewport (own header + bottom bar),
//   the root element uses "fixed inset-0 z-[60]" to escape that wrapper.
//   All layout elements (header, main, bottom bar) are regular flex children —
//   NOT themselves fixed — so there is no pt/pb offset fighting.
//
// Loaded ONLY on the client via dynamic() in ZoomRoom.tsx (ssr: false).
//
// Applied fixes:
//   REL-02: Client-side hard-stop enforcement. The server-side QStash
//           zoom-terminate job only deletes the session record (blocking new
//           JWTs) — the Zoom Video SDK has no server API to disconnect a live
//           participant, so the client must leave itself when the session's
//           grace window (startIso + durationWithGrace) elapses.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import SessionChat from "./SessionChat";
import SessionSettings from "./SessionSettings";
import PostClassReview from "./PostClassReview";
import BrandLogo from "@/components/BrandLogo";
import { useSessionChatStream } from "@/hooks/useSessionChatStream";
import { useZoomConnectionQuality } from "@/hooks/useZoomConnectionQuality";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  token:             string;
  sessionName:       string;
  passcode:          string;
  startIso:          string;
  durationWithGrace: number;
  expiresAt:         number;
}

export interface ZoomRoomInnerProps {
  eventId:           string;
  userName:          string;
  selectedMicId?:    string;
  selectedCameraId?: string;
  onReady?:          () => void;
  onError?:          (msg: string) => void;
  // Called with a leave fn once the SDK client is created, and null on unmount.
  // Lets the parent drain the server-side session before remounting on retry.
  onLeaveRef?:       (fn: (() => Promise<void>) | null) => void;
}

type RoomState = "loading" | "ready" | "joining" | "connected" | "ended" | "error";

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Shared AudioContext for the notification ding. A fresh AudioContext often
// starts in "suspended" state outside an explicit user gesture, which silently
// drops osc.start() — we resume() defensively before each use.
let notifyCtx: AudioContext | null = null;
function playMessageSound() {
  try {
    if (!notifyCtx) notifyCtx = new AudioContext();
    const ctx = notifyCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const t    = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.3);
  } catch { /* Web Audio unavailable */ }
}

function Spinner() {
  return (
    <div
      className="w-8 h-8 rounded-full border-2 border-transparent animate-spin"
      style={{ borderTopColor: "#4edea3" }}
      role="status"
      aria-label="Cargando"
    />
  );
}

// Waiting overlay — rendered ON TOP of the always-present remoteMountRef div.
// pointer-events-none so clicks fall through to the video element underneath.
function WaitingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      <div className="pulse-ring" />
      <div className="pulse-ring" />
      <div className="pulse-ring" />
      <div className="pulse-ring" />
      <div className="absolute w-24 h-24 rounded-full bg-[#10b981]/10 blur-2xl" />
      <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-container-high border border-[#10b981]/20 flex items-center justify-center shadow-inner">
          <span className="material-symbols-outlined text-[#10b981] text-3xl animate-pulse">
            person_search
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-on-surface font-headline font-bold text-sm tracking-wide animate-breath">
            Esperando conexión...
          </h4>
          <p className="text-on-surface-variant/60 text-[10px] uppercase tracking-[0.2em] font-medium">
            El participante se unirá pronto
          </p>
        </div>
      </div>
    </div>
  );
}

// Camera-off overlay — covers the frozen last-frame video when cam is disabled.
function CamOffOverlay() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3"
      style={{ background: "#0e0e10" }}
    >
      <span
        className="material-symbols-outlined text-5xl"
        style={{ color: "#3c4a42" }}
      >
        videocam_off
      </span>
      <p className="text-xs font-medium" style={{ color: "#3c4a42" }}>
        Cámara desactivada
      </p>
    </div>
  );
}

// 4-bar voice indicator matching classroom.html design.
// Active → animated teal bars; inactive → dimmed static dots.
function VoiceBars({ active }: { active: boolean }) {
  if (!active) {
    return (
      <div className="flex items-end gap-[3px] h-4 bg-black/40 px-2 py-1 rounded backdrop-blur-sm opacity-30">
        <div className="w-[2px] h-1 bg-white/40 rounded-full" />
        <div className="w-[2px] h-1 bg-white/40 rounded-full" />
        <div className="w-[2px] h-1 bg-white/40 rounded-full" />
        <div className="w-[2px] h-1 bg-white/40 rounded-full" />
      </div>
    );
  }
  return (
    <div className="flex items-end gap-[3px] h-4 bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
      <div className="voice-bar" />
      <div className="voice-bar" />
      <div className="voice-bar" />
      <div className="voice-bar" />
    </div>
  );
}

// Muted mic indicator for remote participant.
function MutedMicIndicator() {
  return (
    <div className="flex items-center h-4 bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
      <span
        className="material-symbols-outlined"
        style={{ fontSize: "14px", color: "#ffb4ab" }}
      >
        mic_off
      </span>
    </div>
  );
}

// Connection-lost overlay — shown on a remote panel when stats indicate the
// peer's stream has stalled (faster than the SDK's ~60 s heartbeat).
function ConnectionLostOverlay() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3"
      style={{ background: "#0e0e10" }}
    >
      <span
        className="material-symbols-outlined text-5xl"
        style={{ color: "#ffb4ab" }}
      >
        wifi_off
      </span>
      <p className="text-xs font-medium" style={{ color: "#ffb4ab" }}>
        Conexión perdida
      </p>
    </div>
  );
}

// Reconnecting overlay — shown on the local self-panel while the SDK reports
// state="Reconnecting".
function ReconnectingOverlay() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3"
      style={{ background: "#0e0e10" }}
    >
      <span
        className="material-symbols-outlined text-5xl animate-spin"
        style={{ color: "#f5c451" }}
      >
        sync_problem
      </span>
      <p className="text-xs font-medium" style={{ color: "#f5c451" }}>
        Reconectando...
      </p>
    </div>
  );
}

// Poor-connection badge — small corner indicator visible to BOTH sides on the
// affected user's panel (each side derives it independently from the SDK's
// network-quality-change event, which is broadcast to every client).
function PoorConnectionBadge() {
  return (
    <div className="flex items-center h-4 bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
      <span
        className="material-symbols-outlined"
        style={{ fontSize: "14px", color: "#f5c451" }}
        aria-label="Conexión inestable"
        title="Conexión inestable"
      >
        signal_cellular_alt_2_bar
      </span>
    </div>
  );
}

// ─── Video attachment helpers ──────────────────────────────────────────────────

async function attachRemoteVideo(stream: any, vpc: HTMLElement, userId: number, VQ: any) {
  const selector = `[data-user-id="${userId}"]`;
  if (vpc.querySelector(selector)) return;
  try {
    const el = await stream.attachVideo(userId, VQ.Video_360P);
    if (el && !(el instanceof Error)) {
      const node = el as unknown as HTMLElement;
      node.setAttribute("data-user-id", String(userId));
      node.style.cssText = "position:absolute;inset:0;";
      vpc.appendChild(node);
    }
  } catch (e) {
    console.warn("[ZoomRoom] attachRemoteVideo failed:", e);
  }
}

 
async function detachRemoteVideo(stream: any, vpc: HTMLElement, userId: number) {
  try {
    const els = await stream.detachVideo(userId);
    const arr = Array.isArray(els) ? els : [els];
    arr.forEach((el: unknown) => (el as HTMLElement).remove());
  } catch { /* already removed */ }
  vpc.querySelectorAll(`[data-user-id="${userId}"]`).forEach((el) => el.remove());
}

// ─── ZoomRoomInner ─────────────────────────────────────────────────────────────

export default function ZoomRoomInner({
  eventId,
  userName,
  selectedMicId,
  selectedCameraId,
  onReady,
  onError,
  onLeaveRef,
}: ZoomRoomInnerProps) {
  const [state, setState]             = useState<RoomState>("loading");
  const [errorMsg, setErrorMsg]       = useState("");
  const [elapsedSec, setElapsedSec]   = useState(0);
  const [isMuted, setIsMuted]         = useState(false);
  const [isCamOff, setIsCamOff]       = useState(false);
  const [isChatOpen, setIsChatOpen]   = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeSpeakers, setActiveSpeakers] = useState<number[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<
    Array<{ userId: number; displayName: string }>
  >([]);
  const [isSharingScreen, setIsSharingScreen]   = useState(false);
  const [isReceivingShare, setIsReceivingShare] = useState(false);
  const [isVideosPanelHidden, setIsVideosPanelHidden] = useState(false);
  // Mobile-only screen-share focus. "screen" → share fills the viewport with a
  // small remote PiP; "faces" → camera panels fill, share shrinks to the PiP.
  // Toggled by tapping. Desktop ignores this (uses the side focus-tab instead).
  const [mobileShareFocus, setMobileShareFocus] = useState<"screen" | "faces">("screen");
  const [remoteCamOffIds, setRemoteCamOffIds]   = useState<number[]>([]);
  const [remoteMutedIds,  setRemoteMutedIds]    = useState<number[]>([]);
  // Reactive copies of clientRef / selfUserIdRef / streamRef so consumers that
  // read them in render (useZoomConnectionQuality, SessionSettings) don't read
  // mutable refs during render.
  const [client,     setClient]     = useState<unknown | null>(null);
  const [selfUserId, setSelfUserId] = useState<number>(0);
  const [stream,     setStream]     = useState<unknown>(null);
  // True in the final minute before the session is force-ended. Drives the
  // "la sesión terminará pronto" banner.
  const [endingSoon, setEndingSoon] = useState(false);

  // Primary remote — prefer a user whose camera is on. Handles the rejoin
  // race where a stale userId (cam-off after the SDK detected a stalled
  // stream) lingers in the roster for ~60 s alongside the freshly-joined
  // userId. Without this, remoteUsers[0] would be the stale entry and
  // CamOffOverlay would cover the new user's actual video.
  const primaryRemote =
    remoteUsers.find((u) => !remoteCamOffIds.includes(u.userId)) ??
    remoteUsers[0] ??
    null;

  // Network quality + lost-connection detection. The returned `qos` object also
  // exposes raw QoS snapshots (rtt/jitter/loss/fps/bitrate/...) for a future
  // Settings panel — pass `qos` as a prop when that panel is built.
  // remoteHasVideo gates decode-stall detection so an intentional cam-off
  // on the remote side isn't misread as a connection loss.
  const remoteUserIdForQos = primaryRemote?.userId ?? null;
  const remoteHasVideo =
    primaryRemote !== null && !remoteCamOffIds.includes(primaryRemote.userId);
  const qos = useZoomConnectionQuality({
    client,
    selfUserId,
    remoteUserId: remoteUserIdForQos,
    remoteHasVideo,
  });

  const tokenRef       = useRef<TokenResponse | null>(null);
  const clientRef      = useRef<any>(null);
  const streamRef      = useRef<any>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  // Hard-stop enforcement timers (REL-02): the server-side QStash cleanup only
  // blocks new joins — it cannot disconnect a live Video SDK participant, so the
  // client must leave on its own when the session's grace window elapses.
  const hardStopRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedAtRef = useRef<number>(0);
  const selfUserIdRef  = useRef<number>(0);

  // Audio monitoring for local speaking indicator
  const audioRafRef    = useRef<number | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // ── Critical guards ────────────────────────────────────────────────────────
  const joinedRef    = useRef(false);
  const destroyedRef = useRef(false);

  // ── Mount divs — ALWAYS in the DOM so refs are never null when makeVPC runs ─
  const localMountRef  = useRef<HTMLDivElement>(null);
  const remoteMountRef = useRef<HTMLDivElement>(null);

  // ── Screen share elements — always in DOM so refs are valid before share operations ─
  // shareVideoRef  (HTMLVideoElement) → startShareScreen; video tolerates display:none/zero layout size.
  // shareCanvasRef (HTMLCanvasElement) → startShareView;  canvas needs intrinsic width/height attrs
  //   because the SDK reads canvas.width/height for codec setup — CSS layout size is irrelevant.
  const shareVideoRef  = useRef<HTMLVideoElement>(null);
  const shareCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Section refs and video aspect ratio for cover-fill ─
  const localSectionRef  = useRef<HTMLElement>(null);
  const remoteSectionRef = useRef<HTMLElement>(null);
  const videoARRef = useRef(16 / 9); // updated by SDK video-aspect-ratio-change event

  // ── Fetch JWT Token ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/zoom/token", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ eventId }),
        });
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          throw new Error(d.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as TokenResponse;
        if (!cancelled) { tokenRef.current = data; setState("ready"); }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setState("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  // ── Join Session ───────────────────────────────────────────────────────────
  const handleJoin = useCallback(async () => {
    const tok = tokenRef.current;
    if (!tok || joinedRef.current) return;
    joinedRef.current    = true;
    destroyedRef.current = false;
    setState("joining");

    try {
      const ZoomVideo        = (await import("@zoom/videosdk")).default;
      const { VideoQuality } = await import("@zoom/videosdk");

      const client      = ZoomVideo.createClient();
      clientRef.current = client;
      setClient(client);
      // Give parent a handle to drain the server-side session before any retry.
      onLeaveRef?.(() => clientRef.current?.leave() ?? Promise.resolve());

      const initResult = await client.init("en-US", "CDN");
      if (initResult instanceof Error) throw initResult;
      if (destroyedRef.current) return;

      const joinResult = await client.join(tok.sessionName, tok.token, userName, tok.passcode);
      if (joinResult instanceof Error) throw joinResult;
      if (destroyedRef.current) return;

      const stream      = client.getMediaStream();
      streamRef.current = stream;
      setStream(stream);
      const selfId      = client.getCurrentUserInfo().userId;
      selfUserIdRef.current = selfId;
      setSelfUserId(selfId);

      // Seed remote user list from current participants
      const allUsers = client.getAllUser() as Array<{ userId: number; displayName?: string; bVideoOn?: boolean; muted?: boolean }>;
      const others   = allUsers
        .filter((u) => u.userId !== selfId)
        .map((u) => ({ userId: u.userId, displayName: u.displayName ?? "Participante" }));
      if (others.length > 0) setRemoteUsers(others);

      // Seed per-user video/audio state from current participant list
      const initialCamOff = allUsers.filter((u) => u.userId !== selfId && !u.bVideoOn).map((u) => u.userId);
      const initialMuted  = allUsers.filter((u) => u.userId !== selfId &&  u.muted).map((u) => u.userId);
      if (initialCamOff.length > 0) setRemoteCamOffIds(initialCamOff);
      if (initialMuted.length  > 0) setRemoteMutedIds(initialMuted);

      // ── Prepare video-player-container elements BEFORE starting video ──
      // remoteMountRef is always in the DOM (WaitingOverlay is overlaid, not replacing it)
      const makeVPC = (mount: HTMLDivElement | null): HTMLElement | null => {
        if (!mount) return null;
        const existing = mount.querySelector("video-player-container");
        if (existing) return existing as HTMLElement;
        const vpc = document.createElement("video-player-container");
        vpc.style.cssText = "position:absolute;inset:0;overflow:hidden;";
        mount.replaceChildren(vpc);
        return vpc;
      };

      const localVPC  = makeVPC(localMountRef.current);
      const remoteVPC = makeVPC(remoteMountRef.current);

      // ── Start audio & video ──
      try {
        await stream.startAudio(selectedMicId ? { microphoneId: selectedMicId } : undefined);
      } catch { /* mic permission denied is non-fatal */ }

      const videoResult = await stream.startVideo(
        selectedCameraId ? { cameraId: selectedCameraId } : undefined
      );
      if (videoResult instanceof Error) {
        console.warn("[ZoomRoom] startVideo warning:", videoResult.message);
      }

      // The Zoom SDK requires explicit opt-in for *-statistic-data-change events.
      // Without these calls, useZoomConnectionQuality's decode-stall detection
      // (and the future Settings stats panel) never receive any data.
      try { await stream.subscribeVideoStatisticData(); } catch (e) { console.warn("[ZoomRoom] subscribeVideoStatisticData:", e); }
      try { await stream.subscribeAudioStatisticData(); } catch (e) { console.warn("[ZoomRoom] subscribeAudioStatisticData:", e); }
      if (destroyedRef.current) return;

      // ── CRITICAL: Wait for bVideoOn to become true ──
      await new Promise<void>((resolve) => {
        const tryAttach = () => {
          const me = client.getCurrentUserInfo();
          if (me?.bVideoOn) { resolve(); return true; }
          return false;
        };
        if (tryAttach()) return;
        const handler = () => { if (tryAttach()) client.off("user-updated", handler); };
        client.on("user-updated", handler);
        setTimeout(() => { client.off("user-updated", handler); resolve(); }, 5000);
      });
      if (destroyedRef.current) return;

      // ── Attach self video ──
      if (localVPC && stream.isCapturingVideo()) {
        try {
          const el = await stream.attachVideo(selfId, VideoQuality.Video_360P);
          if (el && !(el instanceof Error)) {
            const node = el as unknown as HTMLElement;
            node.style.cssText = "position:absolute;inset:0;";
            localVPC.replaceChildren(node);
          }
        } catch (e) {
          console.warn("[ZoomRoom] attachVideo(self) failed:", e);
        }
      }

      // ── Attach existing remote participants ──
      if (remoteVPC) {
        for (const p of client.getAllUser()) {
          if (p.userId !== selfId && p.bVideoOn) {
            await attachRemoteVideo(stream, remoteVPC, p.userId, VideoQuality);
          }
        }
      }

      // ── SDK event listeners ──
      client.on(
        "peer-video-state-change",
        async ({ action, userId }: { action: "Start" | "Stop"; userId: number }) => {
          if (!remoteVPC || destroyedRef.current) return;
          if (action === "Start") {
            // Sync state from the SDK BEFORE awaiting attachVideo so the render
            // that happens while attachVideo runs already has the correct user
            // list (otherwise WaitingOverlay would briefly overlap the video).
            // Also prunes stale entries from a previous session — when the same
            // person leaves and rejoins, Zoom assigns a new userId, and the old
            // userId left in remoteCamOffIds would otherwise win the cam-off
            // render check.
            const sdkOthers = (client.getAllUser() as Array<{ userId: number; displayName?: string }>)
              .filter((u) => u.userId !== selfUserIdRef.current);
            const validIds = new Set(sdkOthers.map((u) => u.userId));
            validIds.add(userId);
            setRemoteUsers(() => {
              const items = sdkOthers.map((u) => ({
                userId: u.userId,
                displayName: u.displayName ?? "Participante",
              }));
              if (!items.some((u) => u.userId === userId)) {
                items.push({ userId, displayName: "Participante" });
              }
              return items;
            });
            setRemoteCamOffIds((prev) => prev.filter((id) => validIds.has(id) && id !== userId));
            setRemoteMutedIds((prev) => prev.filter((id) => validIds.has(id)));

            await attachRemoteVideo(stream, remoteVPC, userId, VideoQuality);
          } else {
            await detachRemoteVideo(stream, remoteVPC, userId);
            setRemoteCamOffIds((prev) => prev.includes(userId) ? prev : [...prev, userId]);
          }
        }
      );

      client.on(
        "user-added",
        (users: Array<{ userId: number; displayName?: string }>) => {
          if (destroyedRef.current) return;
          const newOthers = users
            .filter((u) => u.userId !== selfUserIdRef.current)
            .map((u) => ({ userId: u.userId, displayName: u.displayName ?? "Participante" }));
          if (newOthers.length === 0) return;

          // Reconcile with the SDK's authoritative roster so state doesn't
          // accumulate ghost users from a previous session if `user-removed`
          // was delayed. Without this, a rejoin-before-heartbeat-expires
          // race would leave the stale userId in remoteUsers/camOff/muted.
          const sdkIds = new Set(
            (client.getAllUser() as Array<{ userId: number }>)
              .filter((u) => u.userId !== selfUserIdRef.current)
              .map((u) => u.userId)
          );

          // Idempotent: peer-video-state-change "Start" may have already added
          // the user via self-heal; merge instead of blindly appending.
          setRemoteUsers((prev) => {
            const byId = new Map<number, { userId: number; displayName: string }>();
            for (const u of prev) {
              if (sdkIds.has(u.userId)) byId.set(u.userId, u);
            }
            for (const u of newOthers) {
              const existing = byId.get(u.userId);
              if (!existing || existing.displayName === "Participante") {
                byId.set(u.userId, u);
              }
            }
            return Array.from(byId.values());
          });
          setRemoteCamOffIds((prev) => prev.filter((id) => sdkIds.has(id)));
          setRemoteMutedIds((prev) => prev.filter((id) => sdkIds.has(id)));
        }
      );

      client.on(
        "user-removed",
        async (users: Array<{ userId: number }>) => {
          if (destroyedRef.current) return;
          const removedIds = new Set(users.map((u) => u.userId));
          // Update state first so WaitingOverlay renders immediately;
          // peer-video-state-change "Stop" has typically already detached the video,
          // so the detach below is a defensive cleanup.
          setRemoteUsers((prev) => prev.filter((u) => !removedIds.has(u.userId)));
          setRemoteCamOffIds((prev) => prev.filter((id) => !removedIds.has(id)));
          setRemoteMutedIds((prev) => prev.filter((id) => !removedIds.has(id)));
          if (remoteVPC) {
            for (const u of users) {
              await detachRemoteVideo(stream, remoteVPC, u.userId);
            }
          }
        }
      );

      // Track remote mute state. The SDK fires user-updated with partial payloads
      // — only changed properties are present, so `muted` may be absent.
      // Camera state is owned by peer-video-state-change.
      client.on(
        "user-updated",
        (users: Array<{ userId: number; muted?: boolean }>) => {
          if (destroyedRef.current) return;
          users.forEach((u) => {
            if (u.userId === selfUserIdRef.current) return;
            if (u.muted === true) {
              setRemoteMutedIds((prev) => prev.includes(u.userId) ? prev : [...prev, u.userId]);
            } else if (u.muted === false) {
              setRemoteMutedIds((prev) => prev.filter((id) => id !== u.userId));
            }
          });
        }
      );

      // active-speaker fires for all users (including self) when audio level changes.
      // Works reliably in multi-participant sessions; supplemented by local
      // Web Audio analysis (below) for single-participant self-detection.
      client.on(
        "active-speaker",
        (speakers: Array<{ userId: number }>) => {
          if (destroyedRef.current) return;
          setActiveSpeakers(speakers.map((s) => s.userId));
        }
      );

      client.on("connection-change", ({ state: s }: { state: string }) => {
        if (s === "Closed" && !destroyedRef.current) setState("ended");
      });

      // Stop-share events fired when the browser's native "Stop sharing" bar is clicked
      // or when another participant takes over sharing.
      client.on("passively-stop-share", () => {
        if (!destroyedRef.current) setIsSharingScreen(false);
      });

      // Listen for aspect ratio changes to improve cover-fill accuracy
      client.on(
        "video-aspect-ratio-change",
        ({ aspectRatio }: { aspectRatio: number; userId: number }) => {
          if (!destroyedRef.current && aspectRatio > 0) {
            videoARRef.current = aspectRatio;
          }
        }
      );

      // ── Receive remote screen share ──
      // active-share-change fires on ALL clients when someone starts/stops sharing.
      // Without this, remote participants never see the shared screen because
      // startShareView() is never called to bind the incoming stream to the canvas.
      // shareCanvasRef has explicit width/height attrs so the SDK's codec setup
      // reads non-zero intrinsic dimensions even when the element is display:none.
      const shareCanvas = shareCanvasRef.current;
      client.on(
        "active-share-change",
        async ({ state: shareState, userId: sharingUserId }: { state: "Active" | "Inactive"; userId: number }) => {
          if (destroyedRef.current || !shareCanvas) return;
          if (shareState === "Active" && sharingUserId !== selfId) {
            try {
              await stream.startShareView(shareCanvas, sharingUserId);
              setIsReceivingShare(true);
            } catch (e) {
              console.warn("[ZoomRoom] startShareView failed:", e);
            }
          } else if (shareState === "Inactive" && sharingUserId !== selfId) {
            try { await stream.stopShareView(); } catch { /* ignore */ }
            setIsReceivingShare(false);
          }
        }
      );

      // ── Local audio analysis for self speaking indicator ──
      // Opens a monitoring-only MediaStream (never sent anywhere) so the
      // voice-bar animates even in single-participant sessions where
      // active-speaker may not fire.
      try {
        const monStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
          video: false,
        });
        if (!destroyedRef.current) {
          audioStreamRef.current = monStream;
          const audioCtx = new AudioContext();
          audioCtxRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          audioCtx.createMediaStreamSource(monStream).connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);

          const tick = () => {
            if (destroyedRef.current) return;
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            const sid = selfUserIdRef.current;
            if (avg > 8) {
              setActiveSpeakers((prev) => (prev.includes(sid) ? prev : [...prev, sid]));
            } else {
              setActiveSpeakers((prev) => (prev.includes(sid) ? prev.filter((id) => id !== sid) : prev));
            }
            audioRafRef.current = requestAnimationFrame(tick);
          };
          audioRafRef.current = requestAnimationFrame(tick);
        } else {
          monStream.getTracks().forEach((t) => t.stop());
        }
      } catch {
        // Monitor stream unavailable — voice bars rely on active-speaker only
      }

      // ── Connected! Start elapsed timer ──
      setState("connected");
      connectedAtRef.current = Date.now();
      const tick = () => setElapsedSec(Math.floor((Date.now() - connectedAtRef.current) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);

    } catch (err) {
      joinedRef.current = false;
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : typeof err === "object" && err !== null && "reason" in err
              ? String((err as { reason: unknown }).reason)
              : JSON.stringify(err);
      console.error("[ZoomRoom] join failed:", err);
      setErrorMsg(msg || "Error al unirse a la sesión");
      setState("error");
    }
    // onLeaveRef is intentionally omitted: it's a ref-backed inline function whose
    // identity changes every render. Including it would recreate handleJoin constantly
    // and break the joinedRef guard that prevents double-joins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, eventId, selectedMicId, selectedCameraId]);

  // ── Auto-join once the token is ready ─────────────────────────────────────
  useEffect(() => {
    // Kicks off the async join sequence (dynamic SDK import + init/join) when
    // the token becomes ready. handleJoin synchronously flips to "joining" as
    // its start-of-operation indicator; deferring that past the dynamic import
    // would briefly flash the "ready" UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional async side-effect on token readiness, not a derived-state cascade.
    if (state === "ready") void handleJoin();
  }, [state, handleJoin]);

  // ── Leave (explicit user action ONLY — never in effect cleanup) ────────────
  const handleLeave = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioRafRef.current !== null) cancelAnimationFrame(audioRafRef.current);
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    try { if (streamRef.current) await streamRef.current.stopShareScreen(); } catch { /* ignore */ }
    try { if (streamRef.current) await streamRef.current.stopShareView();   } catch { /* ignore */ }
    try { if (streamRef.current) await streamRef.current.unsubscribeVideoStatisticData(); } catch { /* ignore */ }
    try { if (streamRef.current) await streamRef.current.unsubscribeAudioStatisticData(); } catch { /* ignore */ }
    try { if (streamRef.current) await streamRef.current.stopVideo(); } catch { /* ignore */ }
    try { if (streamRef.current) await streamRef.current.stopAudio(); } catch { /* ignore */ }
    try { if (clientRef.current) await clientRef.current.leave();     } catch { /* ignore */ }
    setClient(null);
    setStream(null);
    setState("ended");
  }, []);

  // ── Toggle mute ────────────────────────────────────────────────────────────
  const toggleMute = useCallback(async () => {
    const s = streamRef.current;
    if (!s) return;
    try {
      if (isMuted) { await s.unmuteAudio(); setIsMuted(false); }
      else         { await s.muteAudio();   setIsMuted(true);  }
    } catch { /* ignore */ }
  }, [isMuted]);

  // ── Screen share ───────────────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    const s     = streamRef.current;
    const video = shareVideoRef.current;
    if (!s || !video) return;
    try {
      await s.startShareScreen(video);
      setIsSharingScreen(true);
    } catch (err) {
      // User cancelled the browser picker or permission was denied — no state change needed.
      console.warn("[ZoomRoom] startShareScreen:", err);
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    const s = streamRef.current;
    if (!s) return;
    try { await s.stopShareScreen(); } catch { /* ignore */ }
    setIsSharingScreen(false);
  }, []);

  // ── Toggle camera ──────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const s = streamRef.current;
    if (!s) return;
    try {
      if (isCamOff) { await s.startVideo(); setIsCamOff(false); }
      else          { await s.stopVideo();  setIsCamOff(true);  }
    } catch { /* ignore */ }
  }, [isCamOff]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  // IMPORTANT: Do NOT call client.leave() here — React Strict Mode triggers this
  // cleanup immediately, corrupting the SDK's WASM workers. Callers that need to
  // leave before remounting (retry) must use the onLeaveRef callback instead.
  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      onLeaveRef?.(null); // invalidate parent's leave handle
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRafRef.current !== null) cancelAnimationFrame(audioRafRef.current);
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.stopShareScreen().catch(() => {});
      streamRef.current?.stopShareView().catch(() => {});
      setClient(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reset focus mode when sharing ends ────────────────────────────────────
  // Ensures re-entering share mode always starts with the video column visible
  // and never leaves the non-share grid in a `hidden` state. Render-phase
  // "adjust state on input change" keyed on whether any share is active.
  const isAnyShareActive = isSharingScreen || isReceivingShare;
  const [prevAnyShareActive, setPrevAnyShareActive] = useState(isAnyShareActive);
  if (isAnyShareActive !== prevAnyShareActive) {
    setPrevAnyShareActive(isAnyShareActive);
    if (!isAnyShareActive) {
      setIsVideosPanelHidden(false);
      setMobileShareFocus("screen");
    }
  }

  // ── Video cover-fill ──────────────────────────────────────────────────────

  useEffect(() => {
    const applyFillToSection = (section: HTMLElement | null) => {
      if (!section) return;
      const players = section.querySelectorAll("video-player");
      if (players.length === 0) return;

      const cW = section.clientWidth;
      const cH = section.clientHeight;
      if (cW === 0 || cH === 0) return;

      const containerAR = cW / cH;
      const videoAR = videoARRef.current;

      // How much do we need to scale so the video inside covers the container?
      // The SDK fits the video inside the player with "contain" logic.
      // scale = max of (container dimension / rendered video dimension)
      let scale: number;
      if (containerAR > videoAR) {
        // Container is wider than video — SDK fits by height, adds left/right bars
        // Rendered video width = cH * videoAR, rendered video height = cH
        // Need to scale so rendered width fills container width
        scale = cW / (cH * videoAR);
      } else {
        // Container is taller than video — SDK fits by width, adds top/bottom bars
        // Rendered video width = cW, rendered video height = cW / videoAR
        // Need to scale so rendered height fills container height
        scale = (cH * videoAR) / cW;
      }

      // Only apply meaningful scaling
      if (scale > 1.01) {
        players.forEach((vp) => {
          const el = vp as HTMLElement;
          el.style.transform = `scale(${scale.toFixed(4)})`;
          el.style.transformOrigin = "center center";
        });
      } else {
        // Video already fills — remove any previous transform
        players.forEach((vp) => {
          const el = vp as HTMLElement;
          el.style.transform = "";
          el.style.transformOrigin = "";
        });
      }
    };

    // Poll to catch SDK element creation and container resizes
    const id = setInterval(() => {
      if (destroyedRef.current) return;
      applyFillToSection(localSectionRef.current);
      applyFillToSection(remoteSectionRef.current);
    }, 500);

    const onResize = () => {
      applyFillToSection(localSectionRef.current);
      applyFillToSection(remoteSectionRef.current);
    };
    window.addEventListener("resize", onResize);

    return () => {
      clearInterval(id);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // ── Chat stream — single SSE owner shared with SessionChat ────────────────
  // Lifting the SSE up here (instead of letting SessionChat own it) means a
  // single connection drives both the chat UI AND the badge/sound, so there's
  // no "second EventSource that mysteriously fails" failure mode.
  const { data: nextAuthSession } = useSession();
  const userEmail = nextAuthSession?.user?.email ?? undefined;
  const chat = useSessionChatStream(eventId, userEmail, state === "connected");

  // isChatOpenRef mirrors the live value so the lastIncoming reaction reads
  // the current chat-panel state without re-subscribing.
  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

  useEffect(() => {
    if (!chat.lastIncoming) return;
    playMessageSound();
    if (!isChatOpenRef.current) setUnreadCount((n) => n + 1);
  }, [chat.lastIncoming]);

  // ── Notify parent when session is fully connected ─────────────────────────
  // 500ms delay ensures the video element has had time to start rendering.
  useEffect(() => {
    if (state !== "connected" || !onReady) return;
    const t = setTimeout(onReady, 500);
    return () => clearTimeout(t);
  }, [state, onReady]);

  // ── Notify parent on error ─────────────────────────────────────────────────
  useEffect(() => {
    if (state === "error" && onError) onError(errorMsg || "Error al conectar con la sesión");
  }, [state, errorMsg, onError]);

  // ── Hard-stop enforcement (REL-02) ─────────────────────────────────────────
  // The QStash zoom-terminate job only deletes the session record (blocks new
  // JWTs); it cannot kick a participant who is already connected, and the Zoom
  // Video SDK has no server-side "end session" API. So enforce the cutoff here.
  // The deadline is anchored to startIso + durationWithGrace — the SAME value
  // the server schedules QStash with — so a late joiner still ends on schedule
  // rather than getting a fresh full duration.
  useEffect(() => {
    if (state !== "connected") return;
    const tok = tokenRef.current;
    if (!tok) return;

    setEndingSoon(false); // reset stale banner on rejoin/retry

    const startMs    = new Date(tok.startIso).getTime();
    const hardStopMs = startMs + tok.durationWithGrace * 60_000;
    const msLeft     = hardStopMs - Date.now();

    // Already past the grace window (e.g. joined very late) — end immediately.
    if (msLeft <= 0) { void handleLeave(); return; }

    const warnMs = msLeft - 60_000;
    if (warnMs <= 0) setEndingSoon(true);
    else warnRef.current = setTimeout(() => setEndingSoon(true), warnMs);

    hardStopRef.current = setTimeout(() => { void handleLeave(); }, msLeft);

    return () => {
      if (warnRef.current)     clearTimeout(warnRef.current);
      if (hardStopRef.current) clearTimeout(hardStopRef.current);
    };
  }, [state, handleLeave]);

  // ── Elapsed timer: HH:MM ──────────────────────────────────────────────────
  const hh           = String(Math.floor(elapsedSec / 3600)).padStart(2, "0");
  const mm           = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, "0");
  const elapsedLabel = `${hh}:${mm}`;

  const isConnected = state === "connected";
  const canShare    = typeof navigator.mediaDevices?.getDisplayMedia === "function";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── CSS animations ── */}
      <style>{`
        .voice-bar{width:2px;height:4px;background:#4edea3;border-radius:1px;animation:sound-wave 1s infinite ease-in-out}
        .voice-bar:nth-child(2){animation-delay:.2s}
        .voice-bar:nth-child(3){animation-delay:.4s}
        .voice-bar:nth-child(4){animation-delay:.1s}
        @keyframes sound-wave{0%,100%{height:4px}50%{height:16px}}
        .pulse-ring{position:absolute;width:200px;height:200px;border:1px solid rgba(16,185,129,.3);border-radius:50%;animation:ripple 4s cubic-bezier(0,.2,.8,1) infinite;box-shadow:0 0 15px rgba(16,185,129,.1)}
        .pulse-ring:nth-child(2){animation-delay:1s}
        .pulse-ring:nth-child(3){animation-delay:2s}
        .pulse-ring:nth-child(4){animation-delay:3s}
        @keyframes ripple{0%{transform:scale(.4);opacity:0}20%{opacity:.5}100%{transform:scale(1.8);opacity:0}}
        @keyframes breath{0%,100%{opacity:.4}50%{opacity:1}}
        .animate-breath{animation:breath 3s ease-in-out infinite}
        video-player-container{position:absolute!important;inset:0!important;overflow:hidden!important}
        video-player{position:absolute!important;inset:0!important;overflow:hidden!important}
        video-player canvas{position:absolute!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;aspect-ratio:16/9!important;min-width:100%!important;min-height:100%!important;width:auto!important;height:auto!important}
        video-player video{position:absolute!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;width:100%!important;height:100%!important;object-fit:cover!important}
        .mobile-chat-overlay aside{width:100%!important;height:100%!important}
      `}</style>

      {/*
        Root: fixed inset-0 z-[60] escapes PreJoinSetup's z-50 wrapper so this
        component owns the full viewport. Header and bottom bar are regular flex
        children (NOT fixed) — no pt/pb offset fighting.
      */}
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#131315] text-on-surface overflow-hidden">

        {/* ── Header ── */}
        <header className="shrink-0 bg-[#131315]/80 backdrop-blur-md border-b border-white/5 shadow-xl flex justify-between items-center w-full px-4 md:px-8 h-16">
          <div className="flex items-center gap-3 md:gap-6">
            <span
              className="flex items-center gap-2 text-xl font-black tracking-tighter"
              style={{ fontFamily: "var(--font-headline, Manrope), sans-serif", color: "#e5e1e4" }}
            >
              <BrandLogo size={20} />
              <span className="hidden md:inline">GUSTAVO<span style={{ color: "#4edea3" }}>AI.DEV</span></span>
            </span>
            <div className="h-4 w-[1px] bg-outline-variant/30 hidden md:block" />
            <div
              className="text-[#4edea3] font-bold font-headline tracking-tight"
              style={{ visibility: isConnected ? "visible" : "hidden" }}
            >
              {elapsedLabel}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 mr-0 md:mr-4">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-[#e5e1e4]/60 hover:text-[#4edea3] transition-colors cursor-pointer active:opacity-80"
                aria-label="Ajustes"
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
            </div>
            <button
              onClick={() => { void handleLeave(); }}
              className="bg-gradient-to-tr from-[#fc7c78] to-error-container text-on-tertiary-fixed font-bold px-3 md:px-5 py-2 rounded-xl text-sm transition-transform active:scale-95 shadow-lg shadow-error/10"
            >
              Finalizar
            </button>
          </div>
        </header>

        {/* ── Session-ending warning (final minute) ── */}
        {endingSoon && isConnected && (
          <div
            role="alert"
            aria-live="assertive"
            className="shrink-0 w-full bg-amber-500/15 border-b border-amber-400/30 text-amber-300 text-xs md:text-sm font-headline tracking-wide text-center px-4 py-2"
          >
            La sesión terminará en menos de un minuto.
          </div>
        )}

        {/* ── Main workspace — fills between header and bottom bar ── */}
        <main className="flex-1 min-h-0 md:px-8 flex gap-6 overflow-hidden">

          {/* Content area — switches between 2-col grid (normal) and 75/25 flex row (sharing) */}
          <div className={`flex-1 min-h-0 py-4 px-4 md:px-0 ${
            isSharingScreen || isReceivingShare
              ? "relative overflow-hidden md:flex md:flex-row md:gap-4 md:overflow-visible"
              : "flex flex-col gap-3 overflow-hidden md:grid md:grid-cols-2 md:gap-6 md:overflow-hidden"
          }`}>

            {/* ── Screen share panel — both elements always in DOM so refs are valid ──
                Mobile: focus="screen" → fills the viewport; focus="faces" → shrinks
                to a corner PiP. Desktop (md:) always restores the original
                flex-[3] row column regardless of mobileShareFocus. */}
            <div className={
              !(isSharingScreen || isReceivingShare)
                ? "hidden"
                : [
                    "rounded-2xl bg-black border border-white/5",
                    mobileShareFocus === "screen"
                      ? "absolute inset-0 z-0"
                      : "absolute bottom-24 right-3 w-28 h-44 z-30 shadow-2xl",
                    "md:relative md:flex-[3] md:inset-auto md:w-auto md:h-auto md:z-auto md:shadow-none",
                  ].join(" ")
            }>
              {/* Mobile-only tap target — toggles share/faces focus. Hidden on
                  desktop, which uses the side focus-tab button instead. */}
              <button
                type="button"
                onClick={() =>
                  setMobileShareFocus((f) => (f === "screen" ? "faces" : "screen"))
                }
                className="md:hidden absolute inset-0 z-20"
                aria-label="Alternar entre pantalla compartida y participantes"
              />
              {/* Discoverability hint for the tap gesture — only while the share
                  is fullscreen (mobile, "screen" focus); the PiP is its own
                  obvious tap target in "faces" focus. */}
              {mobileShareFocus === "screen" && (
                <div className="md:hidden absolute top-2 right-2 z-20 pointer-events-none flex items-center gap-1 bg-black/60 backdrop-blur-sm text-[#4edea3] text-[9px] font-headline uppercase tracking-widest px-2 py-1 rounded-lg">
                  <span className="material-symbols-outlined text-sm">swap_vert</span>
                  Toca: participantes
                </div>
              )}
              {/* Media layer — keeps its own overflow-hidden so the video keeps
                  the rounded corners, while the focus tab below can overflow
                  the panel's right edge without being clipped. */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                {/* Local preview — used by startShareScreen; hidden when viewing remote share */}
                <video
                  ref={shareVideoRef}
                  className={`absolute inset-0 w-full h-full object-contain${isReceivingShare ? " hidden" : ""}`}
                  autoPlay
                  muted
                  playsInline
                />
                {/* Remote view canvas — used by startShareView; explicit intrinsic dimensions
                    so the SDK's codec setup reads non-zero canvas.width/height even when hidden */}
                <canvas
                  ref={shareCanvasRef}
                  width={1280}
                  height={720}
                  className={`absolute inset-0 w-full h-full object-contain${isReceivingShare ? "" : " hidden"}`}
                />
              </div>
              {/* Focus toggle — straddles the right border, vertically centered
                  (half outside / half inside). Arrow points right to expand
                  (hide the video column) and left to restore it. Sits outside
                  the media layer's overflow-hidden so its outer half stays
                  visible. */}
              <button
                onClick={() => setIsVideosPanelHidden((v) => !v)}
                className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 z-20 items-center justify-center bg-black/70 backdrop-blur-sm text-[#4edea3] w-7 h-12 rounded-md border border-white/10 shadow-lg hover:bg-black/90 transition-all active:scale-95 cursor-pointer"
                aria-label={isVideosPanelHidden ? "Mostrar paneles de video" : "Ocultar paneles de video"}
                title={isVideosPanelHidden ? "Mostrar participantes" : "Ocultar participantes"}
              >
                <span className="material-symbols-outlined text-xl">
                  {isVideosPanelHidden ? "chevron_left" : "chevron_right"}
                </span>
              </button>
            </div>

            {/*
              Videos wrapper — display:contents in grid mode (children become direct grid items),
              flex-col in share mode (25% column with stacked panels).
            */}
            <div className={(isSharingScreen || isReceivingShare)
              ? (isVideosPanelHidden
                  ? "hidden"
                  : [
                      mobileShareFocus === "screen"
                        ? "absolute bottom-24 right-3 z-30 w-28 h-44"
                        : "absolute inset-0 z-10",
                      "flex flex-col gap-2",
                      "md:static md:flex-[1] md:inset-auto md:w-auto md:h-auto md:z-auto md:gap-3 md:min-h-0",
                    ].join(" "))
              : "contents"
            }>

              {/* ── Remote / Tutor panel ── */}
              <div className={`flex flex-col gap-3 ${isSharingScreen || isReceivingShare ? "flex-1 min-h-0" : "flex-1 min-h-0 md:h-full md:min-h-[300px]"}`}>
                <section ref={remoteSectionRef} className="flex-1 relative group overflow-hidden rounded-2xl bg-surface-container shadow-2xl border border-white/5">
                  {/*
                    remoteMountRef div is ALWAYS in the DOM so makeVPC() always
                    has a valid element. WaitingOverlay is layered on top via
                    absolute inset-0 — it does NOT replace this div.
                  */}
                  <div ref={remoteMountRef} className="absolute inset-0" />

                  {/* Render priority (first match wins): connection-lost > waiting > cam-off */}
                  {primaryRemote && qos.remoteStatus === "lost" ? (
                    <ConnectionLostOverlay />
                  ) : !primaryRemote ? (
                    <WaitingOverlay />
                  ) : remoteCamOffIds.includes(primaryRemote.userId) ? (
                    <CamOffOverlay />
                  ) : null}

                  {/* Voice / mute indicator + poor-connection badge — hidden
                      while ConnectionLostOverlay is shown. */}
                  {primaryRemote && qos.remoteStatus !== "lost" && (
                    <>
                      <div className="absolute bottom-4 left-4">
                        {remoteMutedIds.includes(primaryRemote.userId) ? (
                          <MutedMicIndicator />
                        ) : (
                          <VoiceBars
                            active={remoteUsers.some((u) => activeSpeakers.includes(u.userId))}
                          />
                        )}
                      </div>
                      {qos.remoteStatus === "poor" && (
                        <div className="absolute bottom-4 left-16">
                          <PoorConnectionBadge />
                        </div>
                      )}
                    </>
                  )}
                </section>

                <div className={`flex items-center gap-2 px-1 ${(isSharingScreen || isReceivingShare) ? "hidden md:flex" : ""}`}>
                  {primaryRemote ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
                      <span className="font-headline font-bold text-xs uppercase tracking-widest text-[#4edea3]">
                        {primaryRemote.displayName}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-white/10" />
                      <span className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface/40">
                        Esperando participante
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* ── Local / Self panel ── */}
              {/* On mobile while sharing, the PiP shows only the remote panel
                  in "screen" focus — hide self there; desktop always shows it. */}
              <div className={`flex flex-col gap-3 ${
                isSharingScreen || isReceivingShare
                  ? `flex-1 min-h-0 ${mobileShareFocus === "screen" ? "hidden md:flex" : ""}`
                  : "flex-1 min-h-0 md:h-full md:min-h-[300px]"
              }`}>
                <section ref={localSectionRef} className="flex-1 relative overflow-hidden rounded-2xl bg-surface-container shadow-2xl border border-white/5">
                  {/* Always-present Zoom mount — video-player-container lives here */}
                  <div ref={localMountRef} className="absolute inset-0" />

                  {/* Render priority (first match wins): reconnecting > cam-off */}
                  {qos.selfStatus === "reconnecting" && isConnected ? (
                    <ReconnectingOverlay />
                  ) : isCamOff && isConnected ? (
                    <CamOffOverlay />
                  ) : null}

                  {/* Loading / joining state */}
                  {!isConnected && state !== "ended" && state !== "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface-container">
                      <Spinner />
                    </div>
                  )}

                  {/* Voice / mute indicator + poor-connection badge */}
                  <div className="absolute bottom-4 left-4">
                    {isMuted ? (
                      <MutedMicIndicator />
                    ) : (
                      <VoiceBars active={activeSpeakers.includes(selfUserId)} />
                    )}
                  </div>
                  {qos.selfStatus === "poor" && isConnected && (
                    <div className="absolute bottom-4 left-16">
                      <PoorConnectionBadge />
                    </div>
                  )}
                </section>

                <div className={`flex items-center gap-2 px-1 ${(isSharingScreen || isReceivingShare) ? "hidden md:flex" : ""}`}>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: isConnected ? "#4edea3" : "rgba(255,255,255,.1)" }}
                  />
                  <span
                    className="font-headline font-bold text-xs uppercase tracking-widest"
                    style={{ color: isConnected ? "#4edea3" : "rgba(229,225,228,.4)" }}
                  >
                    {userName}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* ── Chat sidebar (desktop) ── constrained to main height by flex layout ── */}
          {isChatOpen && isConnected && (
            <div className="hidden md:flex">
              <SessionChat
                messages={chat.messages}
                userName={userName}
                onSend={chat.send}
                onClose={() => setIsChatOpen(false)}
              />
            </div>
          )}
        </main>

        {/* ── Chat overlay (mobile) ── centered fixed overlay ── */}
        {isChatOpen && isConnected && (
          <div className="md:hidden fixed inset-0 z-[65] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 mobile-chat-overlay">
            <div className="w-full max-w-sm h-[70vh] max-h-[500px]">
              <SessionChat
                messages={chat.messages}
                userName={userName}
                onSend={chat.send}
                onClose={() => setIsChatOpen(false)}
              />
            </div>
          </div>
        )}

        {/* ── Settings drawer ── */}
        {isSettingsOpen && isConnected && (
          <SessionSettings
            stream={stream}
            qos={qos}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}

        {/* ── Bottom Controls Bar — shrink-0 so it never overlaps main ── */}
        <div className="shrink-0 h-20 bg-[#131315]/90 backdrop-blur-2xl border-t border-white/5 flex items-center px-8">
          {/* Controls centred via flex-1 justify-center; chat button at far right */}
          <div className="flex-1 flex justify-center">
            <nav className="flex gap-4 items-center">
              {/* Mute */}
              <button
                onClick={() => { void toggleMute(); }}
                className="flex flex-col items-center justify-center p-2 w-16 h-16 cursor-pointer hover:bg-white/5 rounded-xl transition-all active:scale-90 duration-200"
                style={{ color: isMuted ? "#ffb4ab" : "rgba(229,225,228,.5)" }}
                aria-label={isMuted ? "Activar micrófono" : "Silenciar"}
              >
                <span className="material-symbols-outlined mb-1">
                  {isMuted ? "mic_off" : "mic"}
                </span>
                <span className="font-headline text-[9px] font-bold uppercase tracking-widest">
                  {isMuted ? "Unmute" : "Mute"}
                </span>
              </button>

              {/* Video */}
              <button
                onClick={() => { void toggleCamera(); }}
                className="flex flex-col items-center justify-center p-2 w-16 h-16 cursor-pointer hover:bg-white/5 rounded-xl transition-all active:scale-90 duration-200"
                style={{ color: isCamOff ? "#ffb4ab" : "rgba(229,225,228,.5)" }}
                aria-label={isCamOff ? "Activar cámara" : "Desactivar cámara"}
              >
                <span className="material-symbols-outlined mb-1">
                  {isCamOff ? "videocam_off" : "videocam"}
                </span>
                <span className="font-headline text-[9px] font-bold uppercase tracking-widest">
                  Video
                </span>
              </button>

              {/* Screen Share */}
              <button
                onClick={() => {
                  if (isSharingScreen) { void stopScreenShare(); }
                  else { void startScreenShare(); }
                }}
                disabled={!isConnected || !canShare}
                title={!canShare ? "Compartir pantalla no está disponible en dispositivos móviles" : undefined}
                className={[
                  "flex flex-col items-center justify-center rounded-xl p-2 w-16 h-16 transition-all duration-200 shadow-lg",
                  isSharingScreen
                    ? "bg-[#ffb4ab] text-[#0e0e10] shadow-[#ffb4ab]/20 active:scale-95"
                    : "bg-[#4edea3] text-[#0e0e10] shadow-[#4edea3]/20 active:scale-95",
                  !isConnected || !canShare ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                ].join(" ")}
                aria-label={
                  !canShare
                    ? "Compartir pantalla no disponible en móvil"
                    : isSharingScreen
                      ? "Dejar de compartir pantalla"
                      : "Compartir pantalla"
                }
              >
                <span
                  className="material-symbols-outlined mb-1"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {isSharingScreen ? "stop_screen_share" : "screen_share"}
                </span>
                <span className="font-headline text-[9px] font-bold uppercase tracking-widest">
                  {isSharingScreen ? "Stop" : "Share"}
                </span>
              </button>
            </nav>
          </div>

          {/* Chat toggle — pushed to the far right by flex-1 on the controls group */}
          <button
            onClick={() => {
              setIsChatOpen((v) => {
                if (!v) setUnreadCount(0);
                return !v;
              });
            }}
            className="relative bg-surface-container-high hover:bg-surface-container-highest w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border border-white/5 transition-all active:scale-90"
            style={{ color: "#4edea3" }}
            aria-label={isChatOpen ? "Cerrar chat" : "Abrir chat"}
          >
            <span className="material-symbols-outlined text-xl">chat</span>
            {unreadCount > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#fc7c78] text-[8px] font-bold text-white flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Ambient light decoration ── */}
        <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#4edea3]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#10b981]/5 rounded-full blur-[120px] pointer-events-none" />

        {/* ── Terminal-state overlay (ended / error) ── */}
        {(state === "ended" || state === "error") && (
          <div
            className="absolute inset-0 z-[70] flex items-center justify-center"
            style={{ background: "rgba(13,15,16,0.95)" }}
          >
            {state === "ended" && (
              <PostClassReview
                eventId={eventId}
                userName={userName}
                userAvatarUrl={nextAuthSession?.user?.image ?? null}
              />
            )}

            {state === "error" && (
              <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl"
                  style={{ background: "rgba(255,180,171,0.12)", color: "#ffb4ab" }}
                >
                  ✕
                </div>
                <h2 className="text-xl font-medium" style={{ color: "#e5e1e4" }}>
                  Error
                </h2>
                <p className="text-sm break-words" style={{ color: "#86948a" }}>
                  {errorMsg}
                </p>
                <button
                  onClick={() => {
                    joinedRef.current = false;
                    setState("loading");
                    setErrorMsg("");
                    tokenRef.current  = null;
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color:      "#e5e1e4",
                    border:     "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
