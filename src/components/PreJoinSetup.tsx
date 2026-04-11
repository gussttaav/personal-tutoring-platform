"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ZoomRoom from "./ZoomRoom";
import PackBookingOverlay from "./PackBookingOverlay";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PreJoinSetupProps {
  eventId: string;
  userName: string;
  sessionLabel: string;
  timeLabel: string;
}

interface DeviceLists {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
}

// ─── Tiny 440 Hz beep (WAV, ~0.5 s) encoded as a data URI ─────────────────────
// Generated via OfflineAudioContext so no external asset is needed.
async function buildBeepUrl(): Promise<string> {
  const sampleRate = 44100;
  const duration = 0.4;
  const ctx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 440;
  gain.gain.setValueAtTime(0.4, 0);
  gain.gain.exponentialRampToValueAtTime(0.0001, duration - 0.05);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(0);
  osc.stop(duration);
  const buffer = await ctx.startRendering();
  // Encode PCM to WAV
  const numSamples = buffer.length;
  const ab = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(ab);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, numSamples * 2, true);
  const pcm = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return URL.createObjectURL(new Blob([ab], { type: "audio/wav" }));
}

// ─── Device enumeration ────────────────────────────────────────────────────────

async function enumerateDevices(): Promise<DeviceLists> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return {
    audioInputs:  all.filter((d) => d.kind === "audioinput"),
    videoInputs:  all.filter((d) => d.kind === "videoinput"),
    audioOutputs: all.filter((d) => d.kind === "audiooutput"),
  };
}

// ─── PreJoinSetup ──────────────────────────────────────────────────────────────

export default function PreJoinSetup({
  eventId,
  userName,
  sessionLabel,
  timeLabel,
}: PreJoinSetupProps) {
  // ── Phase ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<"preview" | "session">("preview");

  // ── Device lists & selection ───────────────────────────────────────────────
  const [devices, setDevices] = useState<DeviceLists>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });
  const [selectedMicId, setSelectedMicId] = useState("");
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");

  // ── State flags ────────────────────────────────────────────────────────────
  const [isMicOff, setIsMicOff] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0); // 0–1

  // ── Refs ───────────────────────────────────────────────────────────────────
  const previewVideoRef  = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef     = useRef<MediaStream | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const animFrameRef     = useRef<number | null>(null);

  // ── Start camera preview ───────────────────────────────────────────────────
  const startPreview = useCallback(async (cameraId?: string) => {
    // Stop any existing preview stream
    previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    previewStreamRef.current = null;

    try {
      const constraints: MediaStreamConstraints = {
        video: cameraId ? { deviceId: { exact: cameraId } } : true,
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      previewStreamRef.current = stream;
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }
      setPermissionError(null);

      // Re-enumerate after permission grant to get labelled device names
      const updated = await enumerateDevices();
      setDevices(updated);
      if (!cameraId && updated.videoInputs.length > 0 && !selectedCameraId) {
        setSelectedCameraId(updated.videoInputs[0].deviceId);
      }
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setPermissionError("No se pudo acceder a la cámara. Comprueba los permisos del navegador.");
      } else {
        setPermissionError("No se pudo acceder a la cámara.");
      }
    }
  }, [selectedCameraId]);

  // ── Start mic stream for volume meter ─────────────────────────────────────
  const startMicMeter = useCallback(async (micId?: string) => {
    // Stop previous mic stream
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: micId ? { deviceId: { exact: micId } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(avg / 128);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Re-enumerate with labels
      const updated = await enumerateDevices();
      setDevices(updated);
      if (!micId && updated.audioInputs.length > 0 && !selectedMicId) {
        setSelectedMicId(updated.audioInputs[0].deviceId);
      }
      if (updated.audioOutputs.length > 0 && !selectedSpeakerId) {
        setSelectedSpeakerId(updated.audioOutputs[0].deviceId);
      }
    } catch {
      // Mic permission denied — non-fatal for the pre-join page
    }
  }, [selectedMicId, selectedSpeakerId]);

  // ── Initial setup on mount ─────────────────────────────────────────────────
  useEffect(() => {
    void startPreview();
    void startMicMeter();

    return () => {
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Restart preview when camera selection changes ──────────────────────────
  useEffect(() => {
    if (selectedCameraId && !isCamOff) {
      void startPreview(selectedCameraId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]);

  // ── Restart mic meter when mic selection changes ───────────────────────────
  useEffect(() => {
    if (selectedMicId && !isMicOff) {
      void startMicMeter(selectedMicId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMicId]);

  // ── Toggle camera ──────────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    if (isCamOff) {
      setIsCamOff(false);
      void startPreview(selectedCameraId || undefined);
    } else {
      setIsCamOff(true);
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
      if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    }
  }, [isCamOff, selectedCameraId, startPreview]);

  // ── Toggle mic ─────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (isMicOff) {
      setIsMicOff(false);
      void startMicMeter(selectedMicId || undefined);
    } else {
      setIsMicOff(true);
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setVolume(0);
    }
  }, [isMicOff, selectedMicId, startMicMeter]);

  // ── Speaker test ───────────────────────────────────────────────────────────
  const testSpeaker = useCallback(async () => {
    try {
      const url = await buildBeepUrl();
      const audio = new Audio(url);
      if (selectedSpeakerId && "setSinkId" in audio) {
        await (audio as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(selectedSpeakerId);
      }
      await audio.play();
      audio.addEventListener("ended", () => URL.revokeObjectURL(url));
    } catch {
      // Speaker test is non-fatal
    }
  }, [selectedSpeakerId]);

  // ── Enter session ──────────────────────────────────────────────────────────
  const enterSession = useCallback(() => {
    // Stop preview and mic streams before Zoom takes over devices
    previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    previewStreamRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setPhase("session");
  }, []);

  // ── Volume bar heights ─────────────────────────────────────────────────────
  // 5 bars: threshold at 0.1, 0.25, 0.45, 0.65, 0.85
  const barThresholds = [0.1, 0.25, 0.45, 0.65, 0.85];

  // ─── Render: session overlay ───────────────────────────────────────────────
  if (phase === "session") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0d0f10" }}>
        <header
          className="shrink-0 flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: "#e5e1e4" }}>
              {sessionLabel}
            </p>
            <p className="text-xs" style={{ color: "#86948a" }}>
              {timeLabel} (hora de Madrid)
            </p>
          </div>
          <a
            href="/"
            className="text-xs"
            style={{ color: "#4edea3", textDecoration: "none" }}
          >
            gustavoai.dev
          </a>
        </header>
        <div className="flex-1 min-h-0">
          <ZoomRoom
            eventId={eventId}
            userName={userName}
            selectedMicId={selectedMicId || undefined}
            selectedCameraId={selectedCameraId || undefined}
          />
        </div>
      </div>
    );
  }

  // ─── Render: preview UI ────────────────────────────────────────────────────
  return (
    <>
    <PackBookingOverlay />
    <main className="flex-1 flex flex-col w-full px-6">
      {/* Spacer that matches the fixed Navbar height so content starts below it */}
      <div className="shrink-0" style={{ height: "72px" }} />

      {/* Inner content — vertically centered in remaining space */}
      <div className="flex-1 flex flex-col justify-center max-w-7xl mx-auto w-full py-6 lg:py-10">

      {/* Permission error banner */}
      {permissionError && (
        <div
          className="w-full mb-6 px-4 py-3 rounded-xl flex items-center justify-between gap-4"
          style={{
            background: "rgba(255,180,171,0.08)",
            border: "1px solid rgba(255,180,171,0.2)",
            color: "#ffb4ab",
          }}
        >
          <span className="text-sm">{permissionError}</span>
          <button
            onClick={() => {
              setPermissionError(null);
              void startPreview(selectedCameraId || undefined);
              void startMicMeter(selectedMicId || undefined);
            }}
            className="text-xs font-medium shrink-0"
            style={{ color: "#ffb4ab", textDecoration: "underline" }}
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 w-full items-center mt-6 lg:mt-14">
        {/* ── Left: Video preview ── */}
        <div className="lg:col-span-7 w-full">
          <div className="relative aspect-video rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant/20 shadow-2xl group">
            {/* Camera feed */}
            {isCamOff ? (
              <div className="w-full h-full flex items-center justify-center" style={{ background: "#0e0e10" }}>
                <span className="material-symbols-outlined text-4xl" style={{ color: "#3c4a42" }}>
                  videocam_off
                </span>
              </div>
            ) : (
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            )}

            {/* Gradient overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(to top, rgba(19,19,21,0.8) 0%, transparent 40%)" }}
            />

            {/* Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
              <button
                onClick={toggleMic}
                className="w-14 h-14 rounded-full backdrop-blur-md flex items-center justify-center transition-all active:scale-90 border"
                style={{
                  background: isMicOff
                    ? "rgba(255,180,171,0.15)"
                    : "rgba(53,52,55,0.8)",
                  borderColor: isMicOff
                    ? "rgba(255,180,171,0.3)"
                    : "rgba(60,74,66,0.3)",
                  color: isMicOff ? "#ffb4ab" : "#e5e1e4",
                }}
                aria-label={isMicOff ? "Activar micrófono" : "Silenciar micrófono"}
              >
                <span className="material-symbols-outlined">
                  {isMicOff ? "mic_off" : "mic"}
                </span>
              </button>
              <button
                onClick={toggleCamera}
                className="w-14 h-14 rounded-full backdrop-blur-md flex items-center justify-center transition-all active:scale-90 border"
                style={{
                  background: isCamOff
                    ? "rgba(255,180,171,0.15)"
                    : "rgba(53,52,55,0.8)",
                  borderColor: isCamOff
                    ? "rgba(255,180,171,0.3)"
                    : "rgba(60,74,66,0.3)",
                  color: isCamOff ? "#ffb4ab" : "#e5e1e4",
                }}
                aria-label={isCamOff ? "Activar cámara" : "Desactivar cámara"}
              >
                <span className="material-symbols-outlined">
                  {isCamOff ? "videocam_off" : "videocam"}
                </span>
              </button>
            </div>

            {/* "Preview Live" badge */}
            <div
              className="absolute top-4 left-4 flex items-center gap-2 backdrop-blur px-3 py-1.5 rounded-lg border"
              style={{
                background: "rgba(14,14,16,0.6)",
                borderColor: "rgba(60,74,66,0.2)",
              }}
            >
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium tracking-wide uppercase font-label text-on-surface">
                Preview Live
              </span>
            </div>
          </div>
        </div>

        {/* ── Right: Title + CTA ── */}
        <div className="lg:col-span-5 flex flex-col justify-center h-full space-y-8 pt-4">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-extrabold font-headline tracking-tighter text-on-surface leading-tight">
              ¿Todo listo para tu clase?
            </h1>
            <p className="text-on-surface-variant text-lg font-body max-w-md">
              Configura tus dispositivos y asegúrate de que todo funcione correctamente antes de entrar al aula virtual.
            </p>
          </div>

          <button
            onClick={enterSession}
            className="w-full py-5 px-8 rounded-xl font-headline font-bold text-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            style={{
              background: "linear-gradient(to right, #4edea3, #10b981)",
              color: "#002113",
              boxShadow: "0 0 20px rgba(16,185,129,0.3)",
            }}
          >
            Entrar al aula
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* ── Bottom: Device selector cards ── */}
      <div className="w-full mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Micrófono */}
        <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">mic</span>
              <h3 className="font-headline font-bold text-sm tracking-tight uppercase font-label text-on-surface-variant">
                Micrófono
              </h3>
            </div>
            {/* Volume bars */}
            <div className="flex gap-1 items-end h-4">
              {barThresholds.map((threshold, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full transition-colors duration-75"
                  style={{
                    height: `${(i + 1) * 20}%`,
                    minHeight: "3px",
                    background: volume >= threshold ? "#4edea3" : "rgba(78,222,163,0.2)",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="relative">
            <select
              value={selectedMicId}
              onChange={(e) => setSelectedMicId(e.target.value)}
              className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none focus:border-primary"
            >
              {devices.audioInputs.length === 0 ? (
                <option value="">Sin dispositivos</option>
              ) : (
                devices.audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Micrófono ${d.deviceId.slice(0, 6)}`}
                  </option>
                ))
              )}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-on-surface-variant">
              expand_more
            </span>
          </div>
        </div>

        {/* Cámara */}
        <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">videocam</span>
            <h3 className="font-headline font-bold text-sm tracking-tight uppercase font-label text-on-surface-variant">
              Cámara
            </h3>
          </div>
          <div className="relative">
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none focus:border-primary"
            >
              {devices.videoInputs.length === 0 ? (
                <option value="">Sin dispositivos</option>
              ) : (
                devices.videoInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Cámara ${d.deviceId.slice(0, 6)}`}
                  </option>
                ))
              )}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-on-surface-variant">
              expand_more
            </span>
          </div>
        </div>

        {/* Altavoz */}
        <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">speaker</span>
            <h3 className="font-headline font-bold text-sm tracking-tight uppercase font-label text-on-surface-variant">
              Altavoz
            </h3>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <select
                value={selectedSpeakerId}
                onChange={(e) => setSelectedSpeakerId(e.target.value)}
                className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none focus:border-primary"
              >
                {devices.audioOutputs.length === 0 ? (
                  <option value="">Por defecto</option>
                ) : (
                  devices.audioOutputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Altavoz ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))
                )}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-on-surface-variant">
                expand_more
              </span>
            </div>
            <button
              onClick={() => { void testSpeaker(); }}
              className="bg-surface-container-high px-4 py-3 rounded-lg border border-outline-variant/30 text-xs font-bold uppercase tracking-widest hover:bg-surface-container-highest transition-colors text-on-surface"
            >
              Probar
            </button>
          </div>
        </div>
      </div>
      </div>
    </main>
    </>
  );
}
