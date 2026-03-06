"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function BookingContent() {
  const params = useSearchParams();
  const router = useRouter();

  const email = params.get("email") || "";
  const name = params.get("name") || "";
  const [credits, setCredits] = useState(parseInt(params.get("credits") || "0", 10));
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const CALENDAR_ID = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID || "";

  useEffect(() => {
    if (!email) router.push("/");
  }, [email, router]);

  async function confirmBooking() {
    if (credits <= 0) { setError("No tienes créditos disponibles."); return; }
    setBooking(true);
    setError("");
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) { setCredits(data.remaining); setConfirmed(true); }
      else setError(data.error || "Error al confirmar la reserva.");
    } catch { setError("Error de conexión."); }
    finally { setBooking(false); }
  }

  const calendarEmbedUrl = `https://calendar.google.com/calendar/appointments/schedules/${CALENDAR_ID}?gv=true`;

  if (!email) return null;

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#0f1117" }}>
      {/* Header */}
      <header className="border-b py-5 px-4" style={{ backgroundColor: "#161b27", borderColor: "#1e2535" }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Reservar clase</h1>
            <p className="text-sm" style={{ color: "#8b95a8" }}>Hola, {name} · {email}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: "#18d26e" }}>{credits}</p>
            <p className="text-xs" style={{ color: "#8b95a8" }}>clase{credits !== 1 ? "s" : ""} disponible{credits !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {credits === 0 && (
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "#1e1a0f", border: "1px solid #3d2f00" }}>
            <p className="font-medium" style={{ color: "#fbbf24" }}>No tienes clases disponibles.</p>
            <a
              href="/"
              className="inline-block mt-3 text-sm font-semibold px-5 py-2 rounded-xl text-white transition-all"
              style={{ backgroundColor: "#18d26e" }}
            >
              Comprar otro pack
            </a>
          </div>
        )}

        {confirmed && (
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "#0d1f14", border: "1px solid #18d26e44" }}>
            <p className="font-semibold text-lg" style={{ color: "#18d26e" }}>✓ ¡Clase confirmada!</p>
            <p className="text-sm mt-1" style={{ color: "#8b95a8" }}>
              Te quedan <strong className="text-white">{credits}</strong> clase{credits !== 1 ? "s" : ""}.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "#1f0d0d", border: "1px solid #f8717144" }}>
            <p style={{ color: "#f87171" }}>{error}</p>
          </div>
        )}

        {credits > 0 && (
          <div className="rounded-2xl p-6" style={{ backgroundColor: "#161b27", border: "1px solid #1e2535" }}>
            <h2 className="text-lg font-semibold text-white mb-1">Elige tu horario</h2>
            <p className="text-sm mb-4" style={{ color: "#8b95a8" }}>
              Selecciona un hueco en el calendario y luego pulsa <strong className="text-white">"Confirmar reserva"</strong> para descontar una clase.
            </p>

            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1e2535" }}>
              <iframe
                src={calendarEmbedUrl}
                style={{ border: 0, backgroundColor: "#0f1117" }}
                width="100%"
                height="600"
                frameBorder="0"
                title="Elegir horario"
              />
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={confirmBooking}
                disabled={booking || credits <= 0}
                className="font-semibold py-3 px-8 rounded-xl text-sm text-white transition-all"
                style={{ backgroundColor: booking ? "#0f7a40" : "#18d26e" }}
                onMouseEnter={e => { if (!booking) e.currentTarget.style.backgroundColor = "#15b85e"; }}
                onMouseLeave={e => { if (!booking) e.currentTarget.style.backgroundColor = "#18d26e"; }}
              >
                {booking ? "Confirmando..." : "Confirmar reserva (−1 crédito)"}
              </button>
              <p className="text-xs mt-2" style={{ color: "#4b5563" }}>
                Elige horario en el calendario y luego pulsa este botón.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ReservarPage() {
  return <Suspense><BookingContent /></Suspense>;
}
