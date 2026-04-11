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
// Loaded ONLY on the client via dynamic() in ZoomRoom.tsx (ssr: false).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  token: string;
  sessionName: string;
  passcode: string;
  startIso: string;
  durationWithGrace: number;
  expiresAt: number;
}

export interface ZoomRoomInnerProps {
  eventId: string;
  userName: string;
  selectedMicId?: string;
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

function ControlButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-xl text-base flex items-center justify-center transition-colors"
      style={{
        background: active ? "rgba(78,222,163,0.1)" : "rgba(255,255,255,0.05)",
        border: active
          ? "1px solid rgba(78,222,163,0.25)"
          : "1px solid rgba(255,255,255,0.1)",
        color: active ? "#4edea3" : "#86948a",
      }}
      aria-label={label}
    >
      {children}
    </button>
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
      node.style.cssText = "width:100%;height:100%;display:block;";
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

export default function ZoomRoomInner({ eventId, userName, selectedMicId, selectedCameraId }: ZoomRoomInnerProps) {
  const [state, setState] = useState<RoomState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState("--:--");
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  const tokenRef = useRef<TokenResponse | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Critical guards ────────────────────────────────────────────────────────
  // joinedRef: prevents React Strict Mode from calling join() twice.
  // destroyedRef: prevents async callbacks from mutating state after unmount.
  const joinedRef = useRef(false);
  const destroyedRef = useRef(false);

  // ── Mount divs (always in the DOM so refs are never null) ──────────────────
  const localMountRef = useRef<HTMLDivElement>(null);
  const remoteMountRef = useRef<HTMLDivElement>(null);

  // ── Fetch JWT Token ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/zoom/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          throw new Error(d.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as TokenResponse;
        if (!cancelled) {
          tokenRef.current = data;
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // ── Join Session ───────────────────────────────────────────────────────────
  const handleJoin = useCallback(async () => {
    const tok = tokenRef.current;
    if (!tok || joinedRef.current) return;
    joinedRef.current = true;
    destroyedRef.current = false;
    setState("joining");

    try {
      // Dynamic import — @zoom/videosdk accesses `navigator` at module scope
      const ZoomVideo = (await import("@zoom/videosdk")).default;
      const { VideoQuality } = await import("@zoom/videosdk");

      const client = ZoomVideo.createClient();
      clientRef.current = client;

      // Init SDK — "CDN" loads WASM workers from Zoom's CDN
      const initResult = await client.init("en-US", "CDN");
      if (initResult instanceof Error) throw initResult;

      if (destroyedRef.current) return;

      // Join session
      const joinResult = await client.join(
        tok.sessionName,
        tok.token,
        userName,
        tok.passcode
      );
      if (joinResult instanceof Error) throw joinResult;

      if (destroyedRef.current) return;

      const stream = client.getMediaStream();
      streamRef.current = stream;
      const selfUserId = client.getCurrentUserInfo().userId;

      // ── Prepare video-player-container elements BEFORE starting video ──
      // The SDK's custom element <video-player> must be inside a
      // <video-player-container> to render. Create these now while the
      // divs are guaranteed to be in the DOM.
      const makeVPC = (mount: HTMLDivElement | null): HTMLElement | null => {
        if (!mount) return null;
        const existing = mount.querySelector("video-player-container");
        if (existing) return existing as HTMLElement;
        const vpc = document.createElement("video-player-container");
        vpc.style.cssText = "width:100%;height:100%;display:block;";
        mount.replaceChildren(vpc);
        return vpc;
      };

      const localVPC = makeVPC(localMountRef.current);
      const remoteVPC = makeVPC(remoteMountRef.current);

      // ── Start audio & video ──
      try {
        await stream.startAudio(selectedMicId ? { microphoneId: selectedMicId } : undefined);
      } catch {
        /* mic permission denied is non-fatal */
      }

      const videoResult = await stream.startVideo(selectedCameraId ? { cameraId: selectedCameraId } : undefined);
      if (videoResult instanceof Error) {
        console.warn("[ZoomRoom] startVideo warning:", videoResult.message);
        // Continue — camera may have been denied but session is usable
      }

      if (destroyedRef.current) return;

      // ── CRITICAL: Wait for bVideoOn to become true ──
      // startVideo() is async and the SDK's internal WASM encoder needs
      // time to negotiate. attachVideo() called before bVideoOn=true
      // returns a <video-player> element that renders nothing.
      await new Promise<void>((resolve) => {
        const tryAttach = () => {
          const me = client.getCurrentUserInfo();
          if (me?.bVideoOn) {
            resolve();
            return true;
          }
          return false;
        };

        // Check immediately
        if (tryAttach()) return;

        // Listen for user-updated event
        const handler = () => {
          if (tryAttach()) {
            client.off("user-updated", handler);
          }
        };
        client.on("user-updated", handler);

        // Fallback: proceed after 5 seconds even if bVideoOn never flips
        // (this can happen if the user denied camera permission)
        setTimeout(() => {
          client.off("user-updated", handler);
          resolve();
        }, 5000);
      });

      if (destroyedRef.current) return;

      // ── Attach self video ──
      if (localVPC && stream.isCapturingVideo()) {
        try {
          const el = await stream.attachVideo(selfUserId, VideoQuality.Video_360P);
          if (el && !(el instanceof Error)) {
            const node = el as unknown as HTMLElement;
            node.style.cssText = "width:100%;height:100%;display:block;";
            localVPC.replaceChildren(node);
            console.log("[ZoomRoom] Self video attached successfully");
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

      // ── Listen for remote video state changes ──
      client.on(
        "peer-video-state-change",
        async ({ action, userId }: { action: "Start" | "Stop"; userId: number }) => {
          if (!remoteVPC || destroyedRef.current) return;
          if (action === "Start") {
            await attachRemoteVideo(stream, remoteVPC, userId, VideoQuality);
          } else {
            await detachRemoteVideo(stream, remoteVPC, userId);
          }
        }
      );

      // ── Listen for connection closure ──
      client.on("connection-change", ({ state: s }: { state: string }) => {
        if (s === "Closed" && !destroyedRef.current) {
          setState("ended");
        }
      });

      // ── Connected! Start countdown ──
      setState("connected");

      const endMs =
        new Date(tok.startIso).getTime() + tok.durationWithGrace * 60_000;
      const tick = () => {
        const rem = endMs - Date.now();
        const s = Math.max(0, Math.floor(rem / 1000));
        setCountdown(
          `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
        );
      };
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
  // PreJoinSetup is now the device/auth gate, so no manual confirmation step
  // is needed here. Join as soon as the Zoom token arrives.
  useEffect(() => {
    if (state === "ready") {
      void handleJoin();
    }
  }, [state, handleJoin]);

  // ── Leave (explicit user action ONLY — never in effect cleanup) ────────────
  const handleLeave = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      if (streamRef.current) await streamRef.current.stopVideo();
    } catch { /* ignore */ }
    try {
      if (streamRef.current) await streamRef.current.stopAudio();
    } catch { /* ignore */ }
    try {
      if (clientRef.current) await clientRef.current.leave();
    } catch { /* ignore */ }
    setState("ended");
  }, []);

  // ── Toggle mute ────────────────────────────────────────────────────────────
  const toggleMute = useCallback(async () => {
    const s = streamRef.current;
    if (!s) return;
    try {
      if (isMuted) {
        await s.unmuteAudio();
        setIsMuted(false);
      } else {
        await s.muteAudio();
        setIsMuted(true);
      }
    } catch { /* ignore */ }
  }, [isMuted]);

  // ── Toggle camera ──────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const s = streamRef.current;
    if (!s) return;
    try {
      if (isCamOff) {
        await s.startVideo();
        setIsCamOff(false);
      } else {
        await s.stopVideo();
        setIsCamOff(true);
      }
    } catch { /* ignore */ }
  }, [isCamOff]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  // IMPORTANT: Do NOT call client.leave() here!
  // React Strict Mode unmounts/remounts — calling leave() would kill the
  // session that the second mount is actively using.
  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const showOverlay = state !== "connected";

  return (
    <div className="relative flex flex-col h-full" style={{ background: "#0d0f10" }}>
      {/* ── Always-present video area ── */}
      <div
        className="flex flex-1 gap-2 p-3 min-h-0"
        style={{ visibility: showOverlay ? "hidden" : "visible" }}
      >
        {/* Remote (large) */}
        <div
          className="flex-1 relative rounded-xl overflow-hidden"
          style={{
            background: "#131315",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div ref={remoteMountRef} className="w-full h-full" />
          <span
            className="absolute bottom-2 left-3 text-xs pointer-events-none"
            style={{ color: "#86948a" }}
          >
            Tutor
          </span>
        </div>

        {/* Local PiP */}
        <div
          className="w-36 h-28 rounded-xl overflow-hidden shrink-0 relative self-end"
          style={{
            background: "#131315",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div ref={localMountRef} className="w-full h-full" />
          <span
            className="absolute bottom-1 left-2 text-xs pointer-events-none"
            style={{ color: "#86948a" }}
          >
            Tú
          </span>
        </div>
      </div>

      {/* ── Controls bar (connected only) ── */}
      {!showOverlay && (
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span
            className="text-sm font-mono"
            style={{
              color: countdown === "00:00" ? "#fbbf24" : "#4edea3",
            }}
          >
            {countdown === "00:00"
              ? "Sesión terminando pronto..."
              : countdown}
          </span>
          <div className="flex gap-2">
            <ControlButton
              onClick={() => {
                void toggleMute();
              }}
              active={!isMuted}
              label={isMuted ? "Activar mic" : "Silenciar"}
            >
              {isMuted ? "🔇" : "🎙"}
            </ControlButton>
            <ControlButton
              onClick={() => {
                void toggleCamera();
              }}
              active={!isCamOff}
              label={isCamOff ? "Activar cámara" : "Desactivar cámara"}
            >
              {isCamOff ? "📵" : "📹"}
            </ControlButton>
            <button
              onClick={() => {
                void handleLeave();
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                background: "rgba(255,180,171,0.15)",
                color: "#ffb4ab",
                border: "1px solid rgba(255,180,171,0.2)",
              }}
              aria-label="Salir de la sesión"
            >
              Salir
            </button>
          </div>
        </div>
      )}

      {/* ── Overlay for non-connected states ── */}
      {showOverlay && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "#0d0f10" }}
        >
          {state === "loading" && (
            <div className="flex flex-col items-center gap-3">
              <Spinner />
              <p className="text-sm" style={{ color: "#86948a" }}>
                Preparando sesión...
              </p>
            </div>
          )}

          {(state === "ready" || state === "joining") && (
            <div className="flex flex-col items-center gap-3">
              <Spinner />
              <p className="text-sm" style={{ color: "#86948a" }}>
                Conectando...
              </p>
            </div>
          )}

          {state === "ended" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                style={{
                  background: "rgba(78,222,163,0.12)",
                  color: "#4edea3",
                }}
              >
                ✓
              </div>
              <h2
                className="text-xl font-medium"
                style={{ color: "#e5e1e4" }}
              >
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
                style={{
                  background: "rgba(255,180,171,0.12)",
                  color: "#ffb4ab",
                }}
              >
                ✕
              </div>
              <h2
                className="text-xl font-medium"
                style={{ color: "#e5e1e4" }}
              >
                Error
              </h2>
              <p
                className="text-sm break-words"
                style={{ color: "#86948a" }}
              >
                {errorMsg}
              </p>
              <button
                onClick={() => {
                  joinedRef.current = false;
                  setState("loading");
                  setErrorMsg("");
                  tokenRef.current = null;
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "#e5e1e4",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
