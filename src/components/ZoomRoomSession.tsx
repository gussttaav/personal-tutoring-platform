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
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from "react";
import SessionChat from "./SessionChat";

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
}

type RoomState = "loading" | "ready" | "joining" | "connected" | "ended" | "error";

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// ─── Video attachment helpers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
}: ZoomRoomInnerProps) {
  const [state, setState]             = useState<RoomState>("loading");
  const [errorMsg, setErrorMsg]       = useState("");
  const [elapsedSec, setElapsedSec]   = useState(0);
  const [isMuted, setIsMuted]         = useState(false);
  const [isCamOff, setIsCamOff]       = useState(false);
  const [isChatOpen, setIsChatOpen]   = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState<number[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<
    Array<{ userId: number; displayName: string }>
  >([]);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const tokenRef       = useRef<TokenResponse | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamRef      = useRef<any>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // ── Screen share video element — always in DOM so ref is valid before startShareScreen() ─
  const shareVideoRef = useRef<HTMLVideoElement>(null);

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

      const initResult = await client.init("en-US", "CDN");
      if (initResult instanceof Error) throw initResult;
      if (destroyedRef.current) return;

      const joinResult = await client.join(tok.sessionName, tok.token, userName, tok.passcode);
      if (joinResult instanceof Error) throw joinResult;
      if (destroyedRef.current) return;

      const stream      = client.getMediaStream();
      streamRef.current = stream;
      const selfUserId  = client.getCurrentUserInfo().userId;
      selfUserIdRef.current = selfUserId;

      // Seed remote user list from current participants
      const allUsers = client.getAllUser() as Array<{ userId: number; displayName?: string }>;
      const others   = allUsers
        .filter((u) => u.userId !== selfUserId)
        .map((u) => ({ userId: u.userId, displayName: u.displayName ?? "Participante" }));
      if (others.length > 0) setRemoteUsers(others);

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
          const el = await stream.attachVideo(selfUserId, VideoQuality.Video_360P);
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
          if (p.userId !== selfUserId && p.bVideoOn) {
            await attachRemoteVideo(stream, remoteVPC, p.userId, VideoQuality);
          }
        }
      }

      // ── SDK event listeners ──
      client.on(
        "peer-video-state-change",
        async ({ action, userId }: { action: "Start" | "Stop"; userId: number }) => {
          if (!remoteVPC || destroyedRef.current) return;
          if (action === "Start") await attachRemoteVideo(stream, remoteVPC, userId, VideoQuality);
          else                    await detachRemoteVideo(stream, remoteVPC, userId);
        }
      );

      client.on(
        "user-added",
        (users: Array<{ userId: number; displayName?: string }>) => {
          if (destroyedRef.current) return;
          const newOthers = users
            .filter((u) => u.userId !== selfUserIdRef.current)
            .map((u) => ({ userId: u.userId, displayName: u.displayName ?? "Participante" }));
          if (newOthers.length > 0) setRemoteUsers((prev) => [...prev, ...newOthers]);
        }
      );

      client.on(
        "user-remove",
        (users: Array<{ userId: number }>) => {
          if (destroyedRef.current) return;
          const removedIds = new Set(users.map((u) => u.userId));
          setRemoteUsers((prev) => prev.filter((u) => !removedIds.has(u.userId)));
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
  }, [userName, eventId, selectedMicId, selectedCameraId]);

  // ── Auto-join once the token is ready ─────────────────────────────────────
  useEffect(() => {
    if (state === "ready") void handleJoin();
  }, [state, handleJoin]);

  // ── Leave (explicit user action ONLY — never in effect cleanup) ────────────
  const handleLeave = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioRafRef.current !== null) cancelAnimationFrame(audioRafRef.current);
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    try { if (streamRef.current) await streamRef.current.stopShareScreen(); } catch { /* ignore */ }
    try { if (streamRef.current) await streamRef.current.stopVideo(); } catch { /* ignore */ }
    try { if (streamRef.current) await streamRef.current.stopAudio(); } catch { /* ignore */ }
    try { if (clientRef.current) await clientRef.current.leave();     } catch { /* ignore */ }
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
  // IMPORTANT: Do NOT call client.leave() here!
  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRafRef.current !== null) cancelAnimationFrame(audioRafRef.current);
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.stopShareScreen().catch(() => {});
    };
  }, []);

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

  // ── Elapsed timer: HH:MM ──────────────────────────────────────────────────
  const hh           = String(Math.floor(elapsedSec / 3600)).padStart(2, "0");
  const mm           = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, "0");
  const elapsedLabel = `${hh}:${mm}`;

  const isConnected = state === "connected";

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
          <div className="flex items-center gap-6">
            <span
              className="text-xl font-black tracking-tighter"
              style={{ fontFamily: "var(--font-headline, Manrope), sans-serif", color: "#e5e1e4" }}
            >
              GUSTAVO<span style={{ color: "#4edea3" }}>AI.DEV</span>
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
            <div className="flex items-center gap-2 mr-4 hidden md:flex">
              <button
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

        {/* ── Main workspace — fills between header and bottom bar ── */}
        <main className="flex-1 min-h-0 md:px-8 flex gap-6 overflow-hidden">

          {/* Content area — switches between 2-col grid (normal) and 75/25 flex row (sharing) */}
          <div className={`flex-1 min-h-0 py-4 px-4 md:px-0 overflow-hidden ${
            isSharingScreen
              ? "flex flex-row gap-4"
              : "grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto md:overflow-hidden"
          }`}>

            {/* ── Screen share panel — always in DOM so shareVideoRef is valid before startShareScreen() ── */}
            <div className={isSharingScreen
              ? "flex-[3] relative rounded-2xl overflow-hidden bg-black border border-white/5"
              : "hidden"
            }>
              <video
                ref={shareVideoRef}
                className="absolute inset-0 w-full h-full object-contain"
                autoPlay
                muted
                playsInline
              />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-[#4edea3] text-[9px] px-2 py-1 rounded-lg font-headline uppercase tracking-widest">
                Pantalla compartida
              </div>
            </div>

            {/*
              Videos wrapper — display:contents in grid mode (children become direct grid items),
              flex-col in share mode (25% column with stacked panels).
            */}
            <div className={isSharingScreen
              ? "flex-[1] flex flex-col gap-3 min-h-0"
              : "contents"
            }>

              {/* ── Remote / Tutor panel ── */}
              <div className={`flex flex-col gap-3 ${isSharingScreen ? "flex-1 min-h-0" : "h-full min-h-[300px]"}`}>
                <section ref={remoteSectionRef} className="flex-1 relative group overflow-hidden rounded-2xl bg-surface-container shadow-2xl border border-white/5">
                  {/*
                    remoteMountRef div is ALWAYS in the DOM so makeVPC() always
                    has a valid element. WaitingOverlay is layered on top via
                    absolute inset-0 — it does NOT replace this div.
                  */}
                  <div ref={remoteMountRef} className="absolute inset-0" />

                  {remoteUsers.length === 0 && <WaitingOverlay />}

                  {/* Voice indicator — rendered after WaitingOverlay so it sits on top */}
                  <div className="absolute bottom-4 left-4">
                    <VoiceBars
                      active={remoteUsers.some((u) => activeSpeakers.includes(u.userId))}
                    />
                  </div>
                </section>

                <div className="flex items-center gap-2 px-1">
                  {remoteUsers.length > 0 ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
                      <span className="font-headline font-bold text-xs uppercase tracking-widest text-[#4edea3]">
                        {remoteUsers[0].displayName}
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
              <div className={`flex flex-col gap-3 ${isSharingScreen ? "flex-1 min-h-0" : "h-full min-h-[300px]"}`}>
                <section ref={localSectionRef} className="flex-1 relative overflow-hidden rounded-2xl bg-surface-container shadow-2xl border border-white/5">
                  {/* Always-present Zoom mount — video-player-container lives here */}
                  <div ref={localMountRef} className="absolute inset-0" />

                  {/* Camera-off overlay — covers the frozen last frame */}
                  {isCamOff && isConnected && <CamOffOverlay />}

                  {/* Loading / joining state */}
                  {!isConnected && state !== "ended" && state !== "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface-container">
                      <Spinner />
                    </div>
                  )}

                  {/* Voice indicator */}
                  <div className="absolute bottom-4 left-4">
                    <VoiceBars active={activeSpeakers.includes(selfUserIdRef.current)} />
                  </div>
                </section>

                <div className="flex items-center gap-2 px-1">
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
                eventId={eventId}
                userName={userName}
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
                eventId={eventId}
                userName={userName}
                onClose={() => setIsChatOpen(false)}
              />
            </div>
          </div>
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
                disabled={!isConnected}
                className={[
                  "flex flex-col items-center justify-center rounded-xl p-2 w-16 h-16 transition-all duration-200 shadow-lg",
                  isSharingScreen
                    ? "bg-[#ffb4ab] text-[#0e0e10] shadow-[#ffb4ab]/20 active:scale-95"
                    : "bg-[#4edea3] text-[#0e0e10] shadow-[#4edea3]/20 active:scale-95",
                  !isConnected ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                ].join(" ")}
                aria-label={isSharingScreen ? "Dejar de compartir pantalla" : "Compartir pantalla"}
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
            onClick={() => setIsChatOpen((v) => !v)}
            className="bg-surface-container-high hover:bg-surface-container-highest w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border border-white/5 transition-all active:scale-90"
            style={{ color: "#4edea3" }}
            aria-label={isChatOpen ? "Cerrar chat" : "Abrir chat"}
          >
            <span className="material-symbols-outlined text-xl">chat</span>
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
              <div className="flex flex-col items-center gap-4 text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                  style={{ background: "rgba(78,222,163,0.12)", color: "#4edea3" }}
                >
                  ✓
                </div>
                <h2 className="text-xl font-medium" style={{ color: "#e5e1e4" }}>
                  Sesión finalizada
                </h2>
                <p className="text-sm" style={{ color: "#86948a" }}>
                  Gracias por participar. Hasta la próxima.
                </p>
              </div>
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
