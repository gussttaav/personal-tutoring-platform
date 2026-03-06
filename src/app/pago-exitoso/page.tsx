"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const email = params.get("email") || "";
  const name  = params.get("name")  || "";
  const pack  = params.get("pack")  || "";
  const [credits, setCredits] = useState<number | null>(null);
  const [dots, setDots]       = useState(".");

  // Animated dots while waiting for webhook
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  // Poll until Stripe webhook has written credits to Sheets
  useEffect(() => {
    if (!email) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res  = await fetch(`/api/credits?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.credits > 0) { setCredits(data.credits); clearInterval(interval); }
      } catch { /* retry */ }
      if (attempts > 15) clearInterval(interval); // ~15s max
    }, 1000);
    return () => clearInterval(interval);
  }, [email]);

  // Once credits confirmed → redirect to home in booking mode
  function goToBooking() {
    router.push(
      `/?booking=1&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&credits=${credits}`
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#0f1117" }}>
      <div
        className="rounded-2xl shadow-2xl p-10 max-w-md w-full text-center space-y-6"
        style={{ backgroundColor: "#161b27", border: "1px solid #1e2535" }}
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold"
          style={{ backgroundColor: "#18d26e22", color: "#18d26e" }}
        >
          ✓
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">¡Pago completado!</h1>
          <p className="mt-2 text-sm" style={{ color: "#8b95a8" }}>
            Gracias, <strong className="text-white">{name}</strong>.
            Tu Pack {pack} ha sido activado.
          </p>
        </div>

        {/* Credits status */}
        {credits === null ? (
          <div
            className="rounded-xl p-4 text-sm"
            style={{ backgroundColor: "#0f1117", border: "1px solid #1e2535" }}
          >
            <p style={{ color: "#8b95a8" }}>Activando tus créditos{dots}</p>
          </div>
        ) : (
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: "#0d1f14", border: "1px solid #18d26e44" }}
          >
            <p className="font-semibold text-lg" style={{ color: "#18d26e" }}>
              🎉 {credits} clase{credits !== 1 ? "s" : ""} disponible{credits !== 1 ? "s" : ""}
            </p>
            <p className="text-sm mt-1" style={{ color: "#8b95a8" }}>
              Válidas 6 meses · Reserva cuando quieras
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={goToBooking}
          disabled={credits === null}
          className="w-full font-semibold py-3 rounded-xl text-sm transition-all"
          style={{
            backgroundColor: credits !== null ? "#18d26e" : "#1e2535",
            color: credits !== null ? "#fff" : "#4b5563",
          }}
          onMouseEnter={e => { if (credits !== null) e.currentTarget.style.backgroundColor = "#15b85e"; }}
          onMouseLeave={e => { if (credits !== null) e.currentTarget.style.backgroundColor = "#18d26e"; }}
        >
          {credits !== null ? "Reservar mis clases →" : "Esperando confirmación..."}
        </button>

        <a href="/" className="block text-xs" style={{ color: "#4b5563" }}>
          Volver al inicio
        </a>
      </div>
    </main>
  );
}

export default function PagoExitosoPage() {
  return <Suspense><SuccessContent /></Suspense>;
}
