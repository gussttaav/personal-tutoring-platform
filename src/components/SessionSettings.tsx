"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SessionSettings.tsx — in-session settings drawer for ZoomRoomSession
//
// Self-contained right-side drawer (mirrors how SessionChat is structured) so
// ZoomRoomSession only needs an import + a state flag + a render site.
//
// Sections (per session.html mockup):
//   1. Audio y Vídeo        — live camera / microphone / speaker switching
//   2. Efectos de fondo     — background blur (guarded by SDK support)
//   3. Diagnóstico          — read-only render of the reactive `qos` object
//   4. General              — background noise suppression toggle
//
// The mic level meter owns its OWN monitoring-only audio graph (getUserMedia →
// AnalyserNode); it never touches ZoomRoomSession's existing audio monitoring.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from "react";
import type { ZoomConnectionQuality, QosSnapshot } from "@/hooks/useZoomConnectionQuality";

interface MediaDevice {
  label:    string;
  deviceId: string;
}

export interface SessionSettingsProps {
  stream:  any; // streamRef.current — the Zoom MediaStream SDK object
  qos:     ZoomConnectionQuality;
  onClose: () => void;
}

const selectClass =
  "w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none focus:border-primary";

const BAR_THRESHOLDS = [0.06, 0.14, 0.24, 0.38, 0.55];

// Pick the freshest non-null QoS snapshot so latency/jitter/loss reflect the
// most recently reported stream rather than a stale audio/video pair.
function freshestSnapshot(qos: ZoomConnectionQuality): QosSnapshot | null {
  const candidates = [
    qos.videoEncode,
    qos.videoDecode,
    qos.audioEncode,
    qos.audioDecode,
  ].filter((s): s is QosSnapshot => s !== null);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
}

function deviceLabel(d: MediaDevice): string {
  return d.label || `Dispositivo ${d.deviceId.slice(0, 6)}`;
}

export default function SessionSettings({ stream, qos, onClose }: SessionSettingsProps) {
  const [cameras,  setCameras]  = useState<MediaDevice[]>([]);
  const [mics,     setMics]     = useState<MediaDevice[]>([]);
  const [speakers, setSpeakers] = useState<MediaDevice[]>([]);
  const [activeCamera,  setActiveCamera]  = useState("");
  const [activeMic,     setActiveMic]     = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState("");

  const [bgBlur, setBgBlur]               = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [volume, setVolume]               = useState(0);

  // Capability flags resolved once from the SDK.
  const supportsVB    = typeof stream?.isSupportVirtualBackground === "function" && stream.isSupportVirtualBackground();
  const supportsNoise = typeof stream?.isSupportBackgroundNoiseSuppression === "function" && stream.isSupportBackgroundNoiseSuppression();

  // Mic-meter audio graph (owned entirely by this component).
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const rafRef       = useRef<number | null>(null);

  // ── Populate device lists + current selection from the SDK ─────────────────
  // Seeds state from the Zoom stream's imperative device-enumeration API the
  // moment a stream becomes available — synchronising React state from an
  // external system, which is the legitimate use of an effect even though the
  // SDK calls are synchronous.
  useEffect(() => {
    if (!stream) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding state from the external SDK device list on stream change.
      setCameras((stream.getCameraList?.() ?? []) as MediaDevice[]);
      setMics((stream.getMicList?.() ?? []) as MediaDevice[]);
      setSpeakers((stream.getSpeakerList?.() ?? []) as MediaDevice[]);
      setActiveCamera(stream.getActiveCamera?.() ?? "");
      setActiveMic(stream.getActiveMicrophone?.() ?? "");
      setActiveSpeaker(stream.getActiveSpeaker?.() ?? "");
    } catch (e) {
      console.warn("[SessionSettings] device enumeration failed:", e);
    }
    // Seed background-effect state from current status.
    try {
      const vb = stream.getVirtualbackgroundStatus?.();
      setBgBlur(Boolean(vb?.imageSrc));
    } catch { /* status unavailable */ }
  }, [stream]);

  // ── Mic level meter — own monitoring stream, retargeted on mic change ──────
  const teardownMeter = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      teardownMeter();
      try {
        const monStream = await navigator.mediaDevices.getUserMedia({
          audio: activeMic ? { deviceId: { exact: activeMic } } : true,
          video: false,
        });
        if (cancelled) {
          monStream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = monStream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(monStream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setVolume(avg / 128);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Monitor stream unavailable — bars stay idle.
      }
    })();
    return () => { cancelled = true; teardownMeter(); };
  }, [activeMic, teardownMeter]);

  // ── Device switching ───────────────────────────────────────────────────────
  const onCameraChange = async (id: string) => {
    setActiveCamera(id);
    try { await stream.switchCamera(id); }
    catch (e) { console.warn("[SessionSettings] switchCamera failed:", e); }
  };

  const onMicChange = async (id: string) => {
    setActiveMic(id);
    try {
      await stream.switchMicrophone(id);
      setActiveMic(stream.getActiveMicrophone?.() ?? id);
    } catch (e) {
      console.warn("[SessionSettings] switchMicrophone failed:", e);
    }
  };

  const onSpeakerChange = async (id: string) => {
    setActiveSpeaker(id);
    try { await stream.switchSpeaker(id); }
    catch (e) { console.warn("[SessionSettings] switchSpeaker failed:", e); }
  };

  // ── Background blur ────────────────────────────────────────────────────────
  const applyBlur = async (enabled: boolean) => {
    setBgBlur(enabled);
    try {
      await stream.updateVirtualBackgroundImage(enabled ? "blur" : undefined);
    } catch (e) {
      console.warn("[SessionSettings] updateVirtualBackgroundImage failed:", e);
      setBgBlur(!enabled); // revert on failure
    }
  };

  // ── Noise suppression ──────────────────────────────────────────────────────
  const toggleNoise = async () => {
    const next = !noiseSuppression;
    setNoiseSuppression(next);
    try {
      await stream.enableBackgroundNoiseSuppression(next);
    } catch (e) {
      console.warn("[SessionSettings] enableBackgroundNoiseSuppression failed:", e);
      setNoiseSuppression(!next); // revert on failure
    }
  };

  // ── Diagnostics derived from the reactive qos prop ────────────────────────
  // Zoom only emits statistic events while media flows through the SFU, which
  // requires a second participant. Solo, there are no snapshots and no network
  // level — show an explicit "waiting" state instead of dashes next to a
  // misleading "Excelente" badge.
  const snap = freshestSnapshot(qos);
  const hasData = snap !== null || qos.selfUplink !== null;
  const latency = snap ? `${Math.round(snap.rtt)}ms`    : "—";
  const jitter  = snap ? `${Math.round(snap.jitter)}ms` : "—";
  const loss    = snap ? `${snap.avg_loss.toFixed(1)}%` : "—";

  const statusMeta =
    qos.selfStatus === "reconnecting"
      ? { label: "Reconectando", color: "#f5c451", bg: "rgba(245,196,81,0.2)" }
      : !hasData
        ? { label: "Sin datos",  color: "#bbcabf", bg: "rgba(187,202,191,0.15)" }
        : qos.selfStatus === "good"
          ? { label: "Excelente", color: "#4edea3", bg: "rgba(78,222,163,0.2)" }
          : { label: "Inestable", color: "#f5c451", bg: "rgba(245,196,81,0.2)" };

  return (
    <div
      className="fixed inset-0 z-[68] bg-background/60 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-container-low border-l border-white/10 h-full shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">settings</span>
            <h2 className="text-xl font-headline font-bold text-on-surface">Ajustes</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-variant rounded-full transition-colors text-on-surface-variant cursor-pointer active:scale-90"
            aria-label="Cerrar ajustes"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* ── Audio y Vídeo ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80">
              Audio y Vídeo
            </h3>
            <div className="space-y-4">
              {/* Camera */}
              <div className="space-y-1.5">
                <label className="text-sm text-on-surface-variant">Cámara</label>
                <div className="relative">
                  <select
                    value={activeCamera}
                    onChange={(e) => void onCameraChange(e.target.value)}
                    className={selectClass}
                  >
                    {cameras.length === 0 ? (
                      <option value="">Sin dispositivos</option>
                    ) : (
                      cameras.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {deviceLabel(d)}
                        </option>
                      ))
                    )}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-on-surface-variant">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Microphone + level meter */}
              <div className="space-y-1.5">
                <label className="text-sm text-on-surface-variant">Micrófono</label>
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <select
                      value={activeMic}
                      onChange={(e) => void onMicChange(e.target.value)}
                      className={selectClass}
                    >
                      {mics.length === 0 ? (
                        <option value="">Sin dispositivos</option>
                      ) : (
                        mics.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {deviceLabel(d)}
                          </option>
                        ))
                      )}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-on-surface-variant">
                      expand_more
                    </span>
                  </div>
                  <div className="flex gap-1 items-end h-6 shrink-0">
                    {BAR_THRESHOLDS.map((threshold, i) => (
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
              </div>

              {/* Speaker */}
              <div className="space-y-1.5">
                <label className="text-sm text-on-surface-variant">Altavoz</label>
                <div className="relative">
                  <select
                    value={activeSpeaker}
                    onChange={(e) => void onSpeakerChange(e.target.value)}
                    className={selectClass}
                  >
                    {speakers.length === 0 ? (
                      <option value="">Sin dispositivos</option>
                    ) : (
                      speakers.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {deviceLabel(d)}
                        </option>
                      ))
                    )}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-on-surface-variant">
                    expand_more
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Efectos de fondo (only when supported) ── */}
          {supportsVB && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80">
                Efectos de fondo
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => void applyBlur(false)}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all cursor-pointer ${
                    !bgBlur
                      ? "border border-primary bg-primary/10 text-primary"
                      : "border border-white/5 bg-surface-container-high text-on-surface-variant hover:bg-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">block</span>
                  Ninguno
                </button>
                <button
                  onClick={() => void applyBlur(true)}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all cursor-pointer ${
                    bgBlur
                      ? "border border-primary bg-primary/10 text-primary"
                      : "border border-white/5 bg-surface-container-high text-on-surface-variant hover:bg-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">blur_on</span>
                  Desenfoque
                </button>
              </div>
            </section>
          )}

          {/* ── Diagnóstico de conexión ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80">
              Diagnóstico de conexión
            </h3>
            <div className="bg-surface-container-high rounded-xl p-4 border border-white/5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-on-surface-variant">Estado</span>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider"
                  style={{ background: statusMeta.bg, color: statusMeta.color }}
                >
                  {statusMeta.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div className="space-y-1">
                  <div className="text-lg font-bold text-on-surface">{latency}</div>
                  <div className="text-[10px] text-on-surface-variant uppercase">Latencia</div>
                </div>
                <div className="space-y-1 border-x border-white/5">
                  <div className="text-lg font-bold text-on-surface">{jitter}</div>
                  <div className="text-[10px] text-on-surface-variant uppercase">Jitter</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold text-on-surface">{loss}</div>
                  <div className="text-[10px] text-on-surface-variant uppercase">Pérdida</div>
                </div>
              </div>
              {!hasData && (
                <p className="text-[11px] text-on-surface-variant/70 pt-1 leading-snug">
                  Las métricas aparecerán cuando otro participante esté conectado.
                </p>
              )}
            </div>
          </section>

          {/* ── General (noise suppression, only when supported) ── */}
          {supportsNoise && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80">
                General
              </h3>
              <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-xl border border-white/5">
                <div>
                  <p className="text-sm font-bold text-on-surface">Cancelación de ruido</p>
                  <p className="text-xs text-on-surface-variant">
                    Filtra el ruido de fondo
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={noiseSuppression}
                    onChange={() => void toggleNoise()}
                  />
                  <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                </label>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
