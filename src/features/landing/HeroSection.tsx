"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  value:          string;
  label:          string;
  modalTitle:     string;
  modalBody:      string;
  modalLinkLabel: string;
  modalLinkHref:  string;
  modalSide?:     "left" | "right"; // controls modal horizontal anchor on mobile
}

function StatCard({ value, label, modalTitle, modalBody, modalLinkLabel, modalLinkHref, modalSide }: StatCardProps) {
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
        aria-label={`${value} ${label} — haz clic para más información`}
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
              aria-label="Cerrar"
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

// ─── HeroSection ──────────────────────────────────────────────────────────────

export default function HeroSection() {
  const [zoomed, setZoomed] = useState(false);

  const close = useCallback(() => setZoomed(false), []);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoomed, close]);

  return (
    <section
      style={{
        minHeight: "85vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "100px",
        paddingBottom: "40px",
        animation: "fadeUp 0.7s ease both",
      }}
    >
      <div
        style={{
          maxWidth: "860px",
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* ── Profile image with glow ── */}
        <div className="relative mb-10 group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary-container rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
          <div
            className="relative w-32 h-32 md:w-44 md:h-44 rounded-xl overflow-hidden shadow-2xl cursor-zoom-in"
            style={{ border: "2px solid rgba(78,222,163,0.3)" }}
            onClick={() => setZoomed(true)}
            title="Clic para ampliar"
          >
            <Image
              src="/avatar.png"
              alt="Gustavo Torres Guerrero"
              fill
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
        </div>

        {/* ── Zoom modal ── */}
        {zoomed && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={close}
          >
            <div
              className="relative rounded-xl overflow-hidden shadow-2xl"
              style={{
                width: "min(400px, calc(100vw - 48px))",
                height: "min(400px, calc(100vw - 48px))",
                border: "2px solid rgba(78,222,163,0.4)",
                animation: "zoomIn 0.2s ease both",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src="/avatar.png"
                alt="Gustavo Torres Guerrero"
                fill
                style={{ objectFit: "cover" }}
                priority
              />
            </div>
            <button
              onClick={close}
              className="absolute top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(32,31,34,0.9)", border: "1px solid rgba(255,255,255,0.08)", color: "#bbcabf" }}
              aria-label="Cerrar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        <style>{`
          @keyframes zoomIn {
            from { opacity: 0; transform: scale(0.85); }
            to   { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* ── Identity ── */}
        <div style={{ marginBottom: "16px" }}>
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#4edea3",
              marginBottom: "8px",
            }}
          >
            Gustavo Torres Guerrero
          </p>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#86948a",
              fontWeight: 400,
            }}
          >
            MSc. Matemáticas y Computación
          </p>
        </div>

        {/* ── Headline ── */}
        <h1
          className="mb-5 md:mb-6"
          style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize: "clamp(2.4rem, 6vw, 4.25rem)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#e5e1e4",
          }}
        >
          <span
            className="mb-0 md:mb-4"
            style={{
              display: "block",
              fontSize: "clamp(1.5rem, 3.5vw, 1.875rem)",
              fontWeight: 400,
              lineHeight: 1.4,
              color: "#bbcabf",
              letterSpacing: 0,
            }}
          >
            Profesor · Programación, Matemáticas &amp; IA
          </span>
          <span className="hidden md:block">
            Entiende de verdad lo que{" "}
          </span>
          <span
            className="hidden md:block"
            style={{
              background: "linear-gradient(135deg, #4edea3, #10b981)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            la IA solo resume.
          </span>
        </h1>

        {/* ── Subtitle ── */}
        <div className="hidden md:block" style={{ maxWidth: "640px", marginBottom: "16px" }}>
          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: 1.7,
              color: "#e5e1e4",
              marginTop: "-8px",
              marginBottom: "8px",
              fontWeight: 500,
            }}
          >
            Sin videos, sin prompts, sin perder el tiempo.
          </p>
        </div>

        {/* ── Skills ── */}
        <div
          className="mb-7 md:mb-[40px]"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          {["Java", "Python", "C", "Algorítmica", "Deep Learning", "Estadística"].map((skill) => (
            <span
              key={skill}
              style={{
                display: "inline-flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-headline, Manrope), sans-serif",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#d8f0e8",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: "rgba(78, 222, 163, 0.04)",
                border: "1px solid rgba(78, 222, 163, 0.25)",
                borderRadius: "9999px",
                padding: "6px 18px",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.08)",
              }}
            >
              {skill}
            </span>
          ))}
        </div>

        {/* ── CTAs ── */}
        <div
          className="hero-cta-row"
          style={{
            justifyContent: "center",
            gap: "16px",
            marginBottom: "44px",
          }}
        >
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-session-picker-modal"))}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "16px 36px",
              background: "linear-gradient(135deg, #4edea3, #10b981)",
              color: "#003824",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "1rem",
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              boxShadow: "0 8px 32px rgba(78,222,163,0.25)",
              transition: "transform 0.2s, box-shadow 0.2s",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(78,222,163,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(78,222,163,0.25)";
            }}
          >
            Reservar sesión ahora
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-availability-modal"))}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "16px 36px",
              background: "#2a2a2c",
              color: "#e5e1e4",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "1rem",
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              border: "1px solid rgba(60,74,66,0.5)",
              transition: "background 0.2s, border-color 0.2s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#353437";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(60,74,66,0.8)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#2a2a2c";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(60,74,66,0.5)";
            }}
          >
            Ver disponibilidad
          </button>
        </div>

        {/* ── Stats bar ── */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4"
          style={{
            gap: "32px",
            paddingTop: "32px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            width: "100%",
          }}
        >
          <StatCard
            value="15+"
            label="Años de experiencia"
            modalTitle="Años de experiencia"
            modalBody="Más de 15 años combinando desarrollo de software, investigación y docencia, clases online y consultoría en programación, matemáticas e IA."
            modalLinkLabel="Ver perfil en LinkedIn"
            modalLinkHref="https://www.linkedin.com/in/gustavo-torres-guerrero"
          />
          <StatCard
            value="4700+"
            label="Clases realizadas"
            modalTitle="Clases realizadas"
            modalBody="Más de 4700 clases impartidas a estudiantes de grado y profesionales en plataformas verificadas como Classgap."
            modalLinkLabel="Ver perfil en Classgap"
            modalLinkHref="https://www.classgap.com/es/tutor/gustavo-torres-guerrero"
            modalSide="right"
          />
          <StatCard
            value="150+"
            label="Valoraciones"
            modalTitle="150+ Valoraciones"
            modalBody="Más de 150 opiniones verificadas de estudiantes reales publicadas en Classgap."
            modalLinkLabel="Ver todas las valoraciones"
            modalLinkHref="https://www.classgap.com/es/tutor/gustavo-torres-guerrero"
          />
          <StatCard
            value="4.9"
            label="Valoración media"
            modalTitle="Valoración media"
            modalBody="Puntuación media de 4.9 sobre 5 basada en reseñas verificadas de estudiantes reales en Classgap."
            modalLinkLabel="Ver reseñas verificadas"
            modalLinkHref="https://www.classgap.com/es/tutor/gustavo-torres-guerrero"
            modalSide="right"
          />
        </div>
      </div>
    </section>
  );
}
