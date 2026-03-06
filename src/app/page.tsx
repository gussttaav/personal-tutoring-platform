"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import PackModal from "@/components/PackModal";
import PackPanel from "@/components/PackPanel";

const CalComBooking = dynamic(() => import("@/components/CalComBooking"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ height: "580px" }}>
      <div className="text-center space-y-3">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
          style={{ borderColor: "#18d26e", borderTopColor: "transparent" }}
        />
        <p className="text-sm" style={{ color: "#8b95a8" }}>Cargando calendario...</p>
      </div>
    </div>
  ),
});

type ActivePanel = null | 5 | 10;
interface StudentInfo { email: string; name: string; credits: number; }

function HomeContent() {
  const params = useSearchParams();
  const [activePanel, setActivePanel]   = useState<ActivePanel>(null);
  const [selectedPack, setSelectedPack] = useState<5 | 10 | null>(null);
  const [student, setStudent]           = useState<StudentInfo | null>(null);

  // Refs for the two floating buttons — used to anchor the popups
  const btn5Ref  = useRef<HTMLButtonElement>(null);
  const btn10Ref = useRef<HTMLButtonElement>(null);

  // Ref to the main block — used to track when it scrolls out of view
  const blockRef        = useRef<HTMLDivElement>(null);
  const [isFixed, setIsFixed] = useState(false);
  // Remember the absolute right offset for when buttons are fixed
  const [btnRight, setBtnRight] = useState(4);

  const CAL_LINK = (process.env.NEXT_PUBLIC_CAL_URL || "https://cal.com/gustavo-torres")
    .replace("https://cal.com/", "");

  // Enter booking mode automatically when returning from Stripe
  useEffect(() => {
    if (params.get("booking") === "1") {
      const email   = params.get("email")   || "";
      const name    = params.get("name")    || "";
      const credits = parseInt(params.get("credits") || "0", 10);
      if (email && credits > 0) setStudent({ email, name, credits });
    }
  }, [params]);

  // Observe when the block's top-right corner goes above the viewport
  useEffect(() => {
    function update() {
      if (!blockRef.current) return;
      const rect = blockRef.current.getBoundingClientRect();
      setIsFixed(rect.top + 16 < 0);

      if (!isFixed) {
        const rightOffset = window.innerWidth - rect.right;
        setBtnRight(rightOffset+4);   // o +4, +6, lo que te guste
      }
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function togglePanel(pack: 5 | 10) {
    setActivePanel((prev) => (prev === pack ? null : pack));
  }

  function handleCreditsReady(info: StudentInfo) {
    setSelectedPack(null);
    setActivePanel(null);
    setStudent(info);
  }

  const isBookingMode = student !== null;

  // Shared button style
  const btnStyle = (isOpen: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "9999px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
    backgroundColor: isOpen ? "#18d26e" : "#0f1117",
    border: `1.5px solid ${isOpen ? "#18d26e" : "#18d26e66"}`,
    color: isOpen ? "#fff" : "#18d26e",
    boxShadow: isOpen ? "0 0 18px #18d26e55" : "0 2px 10px #00000088",
    whiteSpace: "nowrap" as const,
  });

  // Buttons container: absolute inside block normally, fixed when scrolled past
  const containerStyle: React.CSSProperties = isFixed
    ? { position: "fixed", top: "16px", right: `${btnRight - 16}px`, zIndex: 50, display: "flex", flexDirection: "column", gap: "8px" }
    : { position: "absolute", top: "16px", right: "4px",        zIndex: 20, display: "flex", flexDirection: "column", gap: "8px" };

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#0f1117" }}>

      {/* ── HEADER ── */}
      <header className="border-b py-5 px-4" style={{ backgroundColor: "#161b27", borderColor: "#1e2535" }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Gustavo Torres Guerrero</h1>
            <p className="text-sm" style={{ color: "#8b95a8" }}>Profesor y consultor independiente</p>
          </div>
          {isBookingMode && student && (
            <div className="text-right">
              <p className="text-xs" style={{ color: "#8b95a8" }}>Hola, {student.name}</p>
              <p className="text-lg font-bold" style={{ color: "#18d26e" }}>
                {student.credits} clase{student.credits !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div
          ref={blockRef}
          className="rounded-2xl overflow-visible relative"
          style={{ backgroundColor: "#161b27", border: "1px solid #1e2535", minHeight: "580px" }}
        >

          {/* ═══════════════════════════════════
              CALENDAR MODE
          ═══════════════════════════════════ */}
          {!isBookingMode && (
            <>
              {/* Floating buttons — absolute or fixed depending on scroll */}
              <div style={containerStyle}>
                {/* Botón Pack 5 */}
                <button
                  ref={btn5Ref}
                  onClick={() => togglePanel(5)}
                  className="group relative flex flex-col items-center justify-center"
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    border: "1.5px solid #18d26e",
                    backgroundColor: activePanel === 5 ? "rgba(24, 210, 110, 0.12)" : "transparent",
                    color: "#18d26e",
                    boxShadow: activePanel === 5 
                      ? "0 0 20px rgba(24, 210, 110, 0.5), inset 0 0 12px rgba(24, 210, 110, 0.25)"
                      : "0 3px 12px rgba(0,0,0,0.5), inset 0 1px 2px rgba(24, 210, 110, 0.15)",
                    transition: "all 0.25s ease",
                    backdropFilter: "blur(2px)", // opcional – da un toque más premium en fondos oscuros
                    WebkitBackdropFilter: "blur(2px)",
                  }}
                >
                  <span 
                    style={{ 
                      fontSize: "18px", 
                      fontWeight: 600, 
                      lineHeight: 1,
                      letterSpacing: "-0.5px",
                    }}
                  >
                    5h
                  </span>
                  <span 
                    style={{ 
                      fontSize: "8px", 
                      fontWeight: 300, 
                      opacity: 0.80,
                      marginTop: "2px",
                    }}
                  >
                    €75
                  </span>

                  {/* Indicador visual de abierto (flecha pequeña o punto) – opcional */}
                  {activePanel === 5 && (
                    <div 
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#18d26e] shadow-[0_0_8px_#18d26e]"
                    />
                  )}
                </button>

                {/* Botón Pack 10 */}
                <button
                  ref={btn10Ref}
                  onClick={() => togglePanel(10)}
                  className="group relative flex flex-col items-center justify-center"
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    border: "1.5px solid #18d26e",
                    backgroundColor: activePanel === 10 ? "rgba(24, 210, 110, 0.12)" : "transparent",
                    color: "#18d26e",
                    boxShadow: activePanel === 10 
                      ? "0 0 20px rgba(24, 210, 110, 0.5), inset 0 0 12px rgba(24, 210, 110, 0.25)"
                      : "0 3px 12px rgba(0,0,0,0.5), inset 0 1px 2px rgba(24, 210, 110, 0.15)",
                    transition: "all 0.25s ease",
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)",
                  }}
                >
                  <span 
                    style={{ 
                      fontSize: "18px", 
                      fontWeight: 600, 
                      lineHeight: 1,
                      letterSpacing: "-0.5px",
                    }}
                  >
                    10h
                  </span>
                  <span 
                    style={{ 
                      fontSize: "8px", 
                      fontWeight: 300, 
                      opacity: 0.80,
                      marginTop: "2px",
                    }}
                  >
                    €140
                  </span>

                  {activePanel === 10 && (
                    <div 
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#18d26e] shadow-[0_0_8px_#18d26e]"
                    />
                  )}
                </button>
              </div>

              {/* Calendar */}
              <div style={{ opacity: activePanel ? 0.35 : 1, transition: "opacity 0.3s ease", pointerEvents: activePanel ? "none" : "auto" }}>
                <CalComBooking calLink={CAL_LINK} theme="dark" brandColor="#18d26e" />
              </div>

              {/* Popup panels */}
              <PackPanel
                size={5} price="€75" perClass="€15/clase" savings="ahorra €5" badge="Popular"
                isOpen={activePanel === 5}
                anchorRef={btn5Ref}
                onClose={() => setActivePanel(null)}
                onBuy={() => { setActivePanel(null); setSelectedPack(5); }}
              />
              <PackPanel
                size={10} price="€140" perClass="€14/clase" savings="ahorra €20" badge="Mejor precio" featured
                isOpen={activePanel === 10}
                anchorRef={btn10Ref}
                onClose={() => setActivePanel(null)}
                onBuy={() => { setActivePanel(null); setSelectedPack(10); }}
              />
            </>
          )}

          {/* ═══════════════════════════════════
              BOOKING MODE
          ═══════════════════════════════════ */}
          {isBookingMode && student && (
            <BookingModeView
              student={student}
              calLink={CAL_LINK}
              onCreditsUpdated={(remaining) =>
                setStudent(remaining > 0 ? { ...student, credits: remaining } : null)
              }
              onExit={() => setStudent(null)}
            />
          )}
        </div>
      </div>

      {selectedPack && (
        <PackModal
          packSize={selectedPack}
          onClose={() => setSelectedPack(null)}
          onCreditsReady={handleCreditsReady}
        />
      )}
    </main>
  );
}

/* ─────────────────────────
   Booking mode view
───────────────────────── */
function BookingModeView({ student, calLink, onCreditsUpdated, onExit }: {
  student: StudentInfo;
  calLink: string;
  onCreditsUpdated: (remaining: number) => void;
  onExit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function confirmBooking() {
    setConfirming(true);
    setMessage(null);
    try {
      const res  = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: student.email }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "ok", text: `✓ ¡Clase reservada! Te quedan ${data.remaining} clases.` });
        onCreditsUpdated(data.remaining);
      } else {
        setMessage({ type: "err", text: data.error || "Error al confirmar." });
      }
    } catch {
      setMessage({ type: "err", text: "Error de conexión." });
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ minHeight: "580px" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#1e2535" }}>
        <span
          className="text-xs font-bold px-3 py-1 rounded-full"
          style={{ backgroundColor: "#18d26e18", color: "#18d26e", border: "1px solid #18d26e33" }}
        >
          {student.credits} clase{student.credits !== 1 ? "s" : ""} disponible{student.credits !== 1 ? "s" : ""}
        </span>
        <button
          onClick={onExit}
          className="text-xs transition-colors"
          style={{ color: "#4b5563" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#8b95a8")}
          onMouseLeave={e => (e.currentTarget.style.color = "#4b5563")}
        >
          ← Volver
        </button>
      </div>

      {message && (
        <div
          className="mx-5 mt-4 rounded-xl px-4 py-3 text-sm text-center"
          style={{
            backgroundColor: message.type === "ok" ? "#0d1f14" : "#1f0d0d",
            border: `1px solid ${message.type === "ok" ? "#18d26e44" : "#f8717144"}`,
            color: message.type === "ok" ? "#18d26e" : "#f87171",
          }}
        >
          {message.text}
        </div>
      )}

      <div className="flex-1">
        <CalComBooking
          calLink={calLink}
          userName={student.name}
          userEmail={student.email}
          theme="dark"
          brandColor="#18d26e"
          onBookingSuccess={confirmBooking}
        />
      </div>

      <div className="p-5 border-t" style={{ borderColor: "#1e2535" }}>
        {student.credits > 0 ? (
          <>
            <button
              onClick={confirmBooking}
              disabled={confirming}
              className="w-full font-semibold py-3 rounded-xl text-white text-sm transition-all"
              style={{ backgroundColor: confirming ? "#0f7a40" : "#18d26e" }}
              onMouseEnter={e => { if (!confirming) e.currentTarget.style.backgroundColor = "#15b85e"; }}
              onMouseLeave={e => { if (!confirming) e.currentTarget.style.backgroundColor = "#18d26e"; }}
            >
              {confirming ? "Confirmando..." : "Confirmar reserva — descuenta 1 clase"}
            </button>
            <p className="text-xs text-center mt-2" style={{ color: "#4b5563" }}>
              Elige primero el horario en el calendario, luego pulsa confirmar.
            </p>
          </>
        ) : (
          <div className="text-center space-y-3">
            <p className="text-sm" style={{ color: "#8b95a8" }}>Has agotado tus clases disponibles.</p>
            <button onClick={onExit} className="font-semibold py-2.5 px-6 rounded-xl text-white text-sm" style={{ backgroundColor: "#18d26e" }}>
              Comprar otro pack
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return <Suspense><HomeContent /></Suspense>;
}
