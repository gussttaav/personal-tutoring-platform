"use client";

import { useState } from "react";

interface StudentInfo {
  email: string;
  name: string;
  credits: number;
}

interface PackModalProps {
  packSize: 5 | 10;
  onClose: () => void;
  onCreditsReady?: (student: StudentInfo) => void;
}

export default function PackModal({ packSize, onClose, onCreditsReady }: PackModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const price = packSize === 5 ? "€75" : "€140";

  async function handleSubmit() {
    if (!name.trim() || !email.trim()) { setError("Por favor, rellena tu nombre y email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("El email no es válido."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/credits?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data.credits > 0) {
        // Already has credits → go directly to booking mode
        onClose();
        onCreditsReady?.({ email, name, credits: data.credits });
        return;
      }

      // No credits → Stripe checkout
      const checkoutRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, packSize }),
      });
      const checkoutData = await checkoutRes.json();

      if (checkoutData.url) {
        window.location.href = checkoutData.url;
      } else {
        setError("Error al crear la sesión de pago. Inténtalo de nuevo.");
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#0f1117",
    border: "1px solid #1e2535",
    borderRadius: "12px",
    padding: "10px 16px",
    fontSize: "14px",
    color: "#ffffff",
    outline: "none",
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-md p-8"
        style={{ backgroundColor: "#161b27", border: "1px solid #1e2535" }}
      >
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
              style={{ backgroundColor: "#18d26e22", color: "#18d26e" }}
            >
              G
            </div>
            <div>
              <p className="text-sm" style={{ color: "#8b95a8" }}>Gustavo Torres Guerrero</p>
              <h2 className="text-lg font-bold text-white">Pack {packSize} clases</h2>
            </div>
          </div>
          <div className="rounded-xl p-3 text-sm space-y-1" style={{ backgroundColor: "#0f1117" }}>
            <p style={{ color: "#8b95a8" }}>🕐 {packSize} horas · A reservar individualmente</p>
            <p style={{ color: "#8b95a8" }}>💳 Pago único de <strong className="text-white">{price}</strong></p>
            <p style={{ color: "#8b95a8" }}>📅 Válido <strong className="text-white">6 meses</strong> desde la compra</p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#c9d1de" }}>
              Tu Nombre <span style={{ color: "#18d26e" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="María García"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#c9d1de" }}>
              Email <span style={{ color: "#18d26e" }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="maria@ejemplo.com"
              style={inputStyle}
            />
          </div>
          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: "#f87171", backgroundColor: "#f8717115" }}>
              {error}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 font-medium py-2.5 rounded-xl text-sm transition-all"
            style={{ border: "1px solid #1e2535", color: "#8b95a8", backgroundColor: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1e2535")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Atrás
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 font-semibold py-2.5 rounded-xl text-sm text-white transition-all"
            style={{ backgroundColor: loading ? "#0f7a40" : "#18d26e" }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = "#15b85e"; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = "#18d26e"; }}
          >
            {loading ? "Verificando..." : "Continuar"}
          </button>
        </div>

        <p className="text-xs text-center mt-4" style={{ color: "#4b5563" }}>
          El pago se procesará de forma segura a través de Stripe.
        </p>
      </div>
    </div>
  );
}
