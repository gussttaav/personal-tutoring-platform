"use client";

import { useEffect, useRef } from "react";

interface PackPanelProps {
  size: 5 | 10;
  price: string;
  perClass: string;
  savings: string;
  badge: string;
  featured?: boolean;
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onBuy: () => void;
}

export default function PackPanel({
  size, price, perClass, savings, badge,
  featured = false, isOpen, anchorRef, onClose, onBuy,
}: PackPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape or outside click
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && isOpen) onClose(); }
    function onOutside(e: MouseEvent) {
      if (
        isOpen &&
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  // Position popup to the left of the anchor button
  const getPopupStyle = (): React.CSSProperties => {
    if (!anchorRef.current) return { top: 0, right: 0 };
    const rect = anchorRef.current.getBoundingClientRect();
    return {
      position: "fixed",
      top: rect.top,
      right: window.innerWidth - rect.left + 8, // 8px gap to the left of button
      zIndex: 9999,
    };
  };

  const features = [
    { icon: "📅", text: "Reserva cada clase cuando quieras" },
    { icon: "🗓️", text: "Horarios en tiempo real vía Google Calendar" },
    { icon: "⏳", text: "Válido 6 meses desde la compra" },
    { icon: "💳", text: "Pago único con Stripe, sin suscripción" },
  ];

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      style={{
        ...getPopupStyle(),
        width: "300px",
        backgroundColor: "#161b27",
        border: featured ? "1.5px solid #18d26e" : "1px solid #1e2535",
        borderRadius: "16px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
        animation: "popupIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transformOrigin: "top right",
        overflow: "hidden",
      }}
    >
      {/* Arrow pointing right toward the button */}
      <div style={{
        position: "absolute",
        right: "-7px",
        top: "14px",
        width: "12px",
        height: "12px",
        backgroundColor: featured ? "#18d26e" : "#1e2535",
        transform: "rotate(45deg)",
        borderTop: featured ? "1.5px solid #18d26e" : "none",
        borderRight: featured ? "1.5px solid #18d26e" : "1px solid #1e2535",
        zIndex: 1,
      }} />
      <div style={{
        position: "absolute",
        right: "-6px",
        top: "15px",
        width: "10px",
        height: "10px",
        backgroundColor: "#161b27",
        transform: "rotate(45deg)",
        zIndex: 2,
      }} />

      <div className="p-5 flex flex-col gap-4">
        {/* Badge row */}
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{ color: "#18d26e", backgroundColor: "#18d26e15", border: "1px solid #18d26e33" }}
          >
            {badge}
          </span>
          {featured && (
            <span className="text-xs font-semibold" style={{ color: "#fbbf24" }}>✦ Más popular</span>
          )}
        </div>

        {/* Price */}
        <div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-white">{price}</span>
            <span className="text-xs mb-1" style={{ color: "#8b95a8" }}>pago único</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm" style={{ color: "#8b95a8" }}>{size} clases · {perClass}</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ color: "#18d26e", backgroundColor: "#18d26e15" }}
            >
              {savings}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #1e2535" }} />

        {/* Features */}
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f.text} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5">{f.icon}</span>
              <span style={{ color: "#c9d1de" }}>{f.text}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={() => { onClose(); onBuy(); }}
          className="w-full font-semibold py-3 rounded-xl text-white text-sm transition-all"
          style={{ backgroundColor: "#18d26e" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#15b85e")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#18d26e")}
        >
          Comprar Pack {size} — {price}
        </button>

        <p className="text-xs text-center" style={{ color: "#4b5563" }}>🔒 Pago seguro con Stripe</p>
      </div>

      <style>{`
        @keyframes popupIn {
          from { opacity: 0; transform: scale(0.92) translateX(8px); }
          to   { opacity: 1; transform: scale(1)    translateX(0); }
        }
      `}</style>
    </div>
  );
}
