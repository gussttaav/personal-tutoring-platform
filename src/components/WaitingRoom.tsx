"use client";

import { useEffect, useRef, useState } from "react";

interface WaitingRoomProps {
  isCamOff: boolean;
  isMicOff: boolean;
  error: string | null;
  onRetry: () => void;
  sessionLabel?: string;
  timeLabel?: string;
}

const STATUS_MESSAGES = [
  "Conectando con el servidor...",
  "Inicializando cámara...",
  "Optimizando calidad de video...",
  "Ajustando resolución y FPS...",
  "Verificando micrófono...",
  "Estableciendo conexión segura...",
  "Buscando otros participantes...",
  "Inicializando chat y recursos...",
  "Preparando tu aula virtual...",
];

export default function WaitingRoom({ isCamOff, isMicOff, error, onRetry, sessionLabel, timeLabel }: WaitingRoomProps) {
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [checks, setChecks] = useState({
    cam: false,
    mic: false,
    network: false,
    latency: false,
  });

  // Rotate status messages every 2.5 s
  useEffect(() => {
    if (error) return;
    const id = setInterval(() => setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length), 2500);
    return () => clearInterval(id);
  }, [error]);

  // Progress bar: 0 → 75% over ~15 s, then stalls
  const progressRef = useRef(0);

  // Reset the bar to 0 whenever we enter/leave the error state (render-phase
  // "adjust state on input change" — not an effect). The interval below then
  // re-fills it from 0 when not in the error state.
  const [prevError, setPrevError] = useState(error);
  if (error !== prevError) {
    setPrevError(error);
    setProgress(0);
  }

  useEffect(() => {
    if (error) return;
    progressRef.current = 0;
    const id = setInterval(() => {
      progressRef.current = Math.min(75, progressRef.current + 0.5);
      setProgress(progressRef.current);
      if (progressRef.current >= 75) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [error]);

  // Staggered system check badges (initial state is already all-false, so the
  // timeouts only need to flip them true)
  useEffect(() => {
    const t1 = setTimeout(() => setChecks((c) => ({ ...c, cam: true })),     1000);
    const t2 = setTimeout(() => setChecks((c) => ({ ...c, mic: true })),     2000);
    const t3 = setTimeout(() => setChecks((c) => ({ ...c, network: true })), 3500);
    const t4 = setTimeout(() => setChecks((c) => ({ ...c, latency: true })), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  return (
    <>
      <style>{`
        @keyframes wr-ping  { 0%{transform:scale(.5);opacity:0} 20%{opacity:.4} 100%{transform:scale(1.8);opacity:0} }
        @keyframes wr-orbit { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes wr-orbit-rev { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes wr-shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes wr-breath { 0%,100%{opacity:.3} 50%{opacity:1} }
        .wr-ping{position:absolute;inset:0;border:1px solid rgba(78,222,163,.25);border-radius:50%;animation:wr-ping 3s linear infinite}
        .wr-ping:nth-child(2){animation-delay:.75s}
        .wr-ping:nth-child(3){animation-delay:1.5s}
        .wr-ping:nth-child(4){animation-delay:2.25s}
        .wr-orbit{animation:wr-orbit 20s linear infinite}
        .wr-orbit-rev{animation:wr-orbit-rev 12s linear infinite}
        .wr-shimmer{background:linear-gradient(90deg,rgba(16,185,129,0) 0%,rgba(78,222,163,1) 50%,rgba(16,185,129,0) 100%);background-size:200% 100%;animation:wr-shimmer 2s linear infinite}
        .wr-breath{animation:wr-breath 3s ease-in-out infinite}
        .wr-spin{animation:wr-orbit .8s linear infinite}
      `}</style>

      <div className="fixed inset-0 z-[65] flex flex-col bg-[#131315] text-on-surface overflow-hidden">

        {/* ── Ambient background glows ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-[120px]" style={{ background: "rgba(78,222,163,0.05)" }} />
          <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-[120px]" style={{ background: "rgba(16,185,129,0.05)" }} />
        </div>

        {/* ── Main content ── */}
        <main className="flex-1 relative flex flex-col items-center justify-center p-6 z-10">

          {error ? (
            /* ── Error state ── */
            <div className="flex flex-col items-center gap-6 text-center max-w-sm">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                style={{ background: "rgba(255,180,171,0.12)", color: "#ffb4ab" }}
              >
                ✕
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold font-headline" style={{ color: "#e5e1e4" }}>
                  Error de conexión
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "#86948a" }}>
                  {error}
                </p>
              </div>
              <button
                onClick={onRetry}
                className="px-6 py-3 rounded-xl text-sm font-bold font-headline tracking-wide transition-all active:scale-95"
                style={{
                  background: "linear-gradient(to right, #4edea3, #10b981)",
                  color: "#002113",
                  boxShadow: "0 0 20px rgba(16,185,129,0.25)",
                }}
              >
                Reintentar
              </button>
            </div>
          ) : (
            /* ── Loading state ── */
            <div className="flex flex-col items-center text-center w-full max-w-md gap-10">

              {/* Animated logo */}
              <div className="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center">
                {/* Ping halos */}
                <div className="absolute inset-0 scale-150 pointer-events-none">
                  <div className="wr-ping" />
                  <div className="wr-ping" />
                  <div className="wr-ping" />
                  <div className="wr-ping" />
                </div>

                {/* Ambient glow */}
                <div
                  className="absolute inset-0 rounded-full blur-3xl opacity-40"
                  style={{ background: "rgba(78,222,163,0.15)" }}
                />

                {/* Orbital ring (outer) */}
                <div className="wr-orbit absolute inset-0 rounded-full pointer-events-none" style={{ border: "1px solid rgba(78,222,163,0.2)" }}>
                  <div
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                    style={{ background: "#4edea3", boxShadow: "0 0 10px #4edea3" }}
                  />
                </div>

                {/* Orbital ring (inner, reverse) */}
                <div className="wr-orbit-rev absolute inset-6 rounded-full pointer-events-none" style={{ border: "1px solid rgba(16,185,129,0.15)" }}>
                  <div
                    className="absolute bottom-0 right-1/4 w-1.5 h-1.5 rounded-full"
                    style={{ background: "#10b981", boxShadow: "0 0 8px #10b981" }}
                  />
                </div>

                {/* Logo SVG */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="100"
                  height="100"
                  viewBox="0 0 28 28"
                  className="relative z-10 animate-pulse"
                  style={{
                    animationDuration: "4s",
                    filter: "drop-shadow(0 0 16px rgba(78,222,163,0.5))",
                  }}
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="wr-main-g" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4edea3"/>
                      <stop offset="100%" stopColor="#10b981"/>
                    </linearGradient>
                  </defs>
                  <path fill="url(#wr-main-g)" fillRule="evenodd" d="M21.8844 14.4497c-.4575-.1116-1.8449-.06-2.3983-.06h-1.0193l-.9593.06h-2.5782l-1.0192.0599h-1.7987c-.2045 0-.6032.0366-.7609-.0959-.1613-.1361-.1379-.3729-.1385-.5636v-1.9786c0-.1943-.0288-.6781.0612-.8304.1187-.2009.3351-.1877.5384-.1889h1.0792l.8994-.0599h12.7109c.2386 0 .7009-.054.8634.1385.1163.1379.0923.3525.0965.521l.0593.8394.0576 1.0792c-.0258.4893-.3975.7015-.7171 1.0193l-1.9786 1.9186-2.5781 2.4607-2.6981 2.6333-2.9979 2.8803-2.4582 2.3384c-.2129.2122-.6182.7279-.9539.6127-.2069-.0707-.6805-.6643-.8478-.8526l-2.0523-2.3383-7.0672-8.0342-2.458263-2.7977c-.170878-.1943-.6979014-.7027-.666124-.9569.017987-.1463.160685-.2746.260814-.3711l.834003-.7357L4.3169 8.44911l6.8351-5.91837 1.5589-1.35443c.2266-.19666.0229-.04193.2891-.14686.2272-.089335 1.7332-.032454 2-.029456h.5l1 .000004L17.5 1c.3106.0012.8805-.046088 1.1916.02946-.1259.42809-.5737.74946-.8993 1.03606l-1.9186 1.73876-3.4776 3.16094-3.47747 3.16098L7 11.8715c-.18887.1709-.75546.6332-.82441.8496-.06715.2105-.33995.3801-.21464.5294l1.29687 1.499 4.68268 5.3961 1.147 1.3191c.1193.1343.3219.3825.5228.3567.1541-.0204.5306-.3711.6595-.4862l1.4989-1.3443 3.7773-3.366c.5636-.4958 1.9457-1.656 2.3384-2.1752"/>
                </svg>
              </div>

              {/* Heading */}
              <div className="space-y-3">
                <h1
                  className="text-3xl md:text-4xl font-extrabold tracking-tight font-headline"
                  style={{ color: "#e5e1e4" }}
                >
                  Preparando tu aula virtual<span style={{ color: "#4edea3" }}>...</span>
                </h1>
                {(sessionLabel || timeLabel) && (
                  <div className="flex flex-col items-center gap-0.5">
                    {sessionLabel && (
                      <p className="text-sm font-semibold font-headline" style={{ color: "#bbcabf" }}>
                        {sessionLabel}
                      </p>
                    )}
                    {timeLabel && (
                      <p className="text-xs" style={{ color: "#86948a" }}>
                        {timeLabel} · hora de Madrid
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full space-y-3">
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <div
                    className="h-full rounded-full relative overflow-hidden transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(to right, #10b981, #4edea3)",
                      boxShadow: "0 0 12px rgba(78,222,163,0.4)",
                    }}
                  >
                    <div className="absolute inset-0 wr-shimmer opacity-30" />
                  </div>
                </div>

                {/* Status message */}
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="material-symbols-outlined text-sm wr-spin"
                    style={{ color: "#4edea3", fontSize: "14px" }}
                  >
                    sync
                  </span>
                  <p
                    className="text-xs font-label uppercase tracking-[0.2em] wr-breath"
                    style={{ color: "rgba(187,202,191,0.8)" }}
                  >
                    {STATUS_MESSAGES[statusIdx]}
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── System checks footer ── */}
        {!error && (
          <footer className="shrink-0 pb-8 px-6 flex flex-wrap justify-center gap-x-8 gap-y-3 z-10">
            <CheckBadge label="Cámara activa" ready={checks.cam} disabled={isCamOff} />
            <CheckBadge label="Micrófono listo" ready={checks.mic} disabled={false} />
            <CheckBadge label="Red estable" ready={checks.network} disabled={false} />
            <CheckBadge label="Latencia baja" ready={checks.latency} disabled={false} />
          </footer>
        )}
      </div>
    </>
  );
}

function CheckBadge({
  label,
  ready,
  disabled,
}: {
  label: string;
  ready: boolean;
  disabled: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 transition-opacity duration-500"
      style={{ opacity: ready ? 0.7 : 0.3 }}
    >
      {ready ? (
        <span
          className="material-symbols-outlined text-sm"
          style={{ color: disabled ? "#86948a" : "#4edea3", fontSize: "16px" }}
        >
          {disabled ? "cancel" : "check_circle"}
        </span>
      ) : (
        <span
          className="material-symbols-outlined text-sm"
          style={{ color: "#3c4a42", fontSize: "16px", animation: "wr-orbit .8s linear infinite" }}
        >
          progress_activity
        </span>
      )}
      <span className="text-xs font-label uppercase tracking-tight" style={{ color: "#bbcabf" }}>
        {label}
      </span>
    </div>
  );
}
