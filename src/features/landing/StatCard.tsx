"use client";

/*
 * REDESIGN-P1-01 — `StatCard`, moved verbatim out of `HeroSection.tsx` so the home's
 * `HomeStats` (features/home) and the Mentoría hero can share it until P2-01 deletes
 * `HeroSection`. No behaviour change: same popover, outside-click + Escape close, same
 * `landing.hero.statsHint` / `close` copy.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

export interface StatCardProps {
  value:          string;
  label:          string;
  modalTitle:     string;
  modalBody:      string;
  modalLinkLabel: string;
  modalLinkHref:  string;
  modalSide?:     "left" | "right"; // controls modal horizontal anchor on mobile
}

export function StatCard({ value, label, modalTitle, modalBody, modalLinkLabel, modalLinkHref, modalSide }: StatCardProps) {
  const t = useTranslations("landing.hero");
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the card
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={cardRef} style={{ position: "relative", textAlign: "center" }}>
      {/* Clickable card */}
      <button
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter") setOpen((v) => !v); }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px 12px",
          borderRadius: "8px",
          transition: "background 0.18s ease",
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          width: "100%",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(78,222,163,0.05)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
        aria-expanded={open}
        aria-label={`${value} ${label} — ${t("statsHint")}`}
      >
        {/* Number */}
        <div
          style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "#4edea3",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        {/* Label + external icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "0.75rem",
            color: "#86948a",
            letterSpacing: "0.04em",
          }}
        >
          {label}
          <svg
            width="9"
            height="9"
            viewBox="0 0 14 14"
            fill="none"
            style={{ opacity: 0.4, flexShrink: 0 }}
            aria-hidden="true"
          >
            <path d="M2 12L12 2M12 2H6M12 2V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {/* Modal — anchored to bottom of card */}
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            ...(modalSide === "right"
              ? { right: 0 }
              : modalSide === "left"
              ? { left: 0 }
              : { left: "50%", transform: "translateX(-50%)" }),
            zIndex: 30,
            width: "240px",
            background: "#201f22",
            border: "1px solid rgba(78,222,163,0.2)",
            borderRadius: "10px",
            padding: "14px 16px",
            textAlign: "left",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            animation: "fadeUp 0.18s ease both",
          }}
        >
          {/* Modal header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#4edea3" }}>
              {modalTitle}
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#86948a",
                padding: "0 0 0 8px",
                fontSize: "14px",
                lineHeight: 1,
                fontFamily: "inherit",
              }}
              aria-label={t("close")}
            >
              ✕
            </button>
          </div>
          {/* Modal body */}
          <p style={{ fontSize: "12px", color: "#bbcabf", lineHeight: 1.6, margin: 0 }}>
            {modalBody}
          </p>
          {/* Modal link */}
          <a
            href={modalLinkHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: "10px",
              fontSize: "11px",
              color: "#4edea3",
              textDecoration: "none",
              borderBottom: "0.5px solid rgba(78,222,163,0.35)",
              paddingBottom: "1px",
            }}
          >
            {modalLinkLabel} ↗
          </a>
        </div>
      )}
    </div>
  );
}
