"use client";

/*
 * REDESIGN-P1-01: `StatCard` now lives in `./StatCard.tsx` (shared with the home's
 * `HomeStats`); this file keeps serving `/mentoria` unchanged until P2-01 deletes it.
 */

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { StatCard } from "./StatCard";

// ─── HeroSection ──────────────────────────────────────────────────────────────

export default function HeroSection() {
  const t = useTranslations("landing.hero");
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

  const skills = t.raw("skills") as string[];

  const statCards = [
    {
      value: "15+",
      label: t("stats.experience.label"),
      modalTitle: t("stats.experience.title"),
      modalBody: t("stats.experience.body"),
      modalLinkLabel: t("stats.experience.link"),
      modalLinkHref: "https://www.linkedin.com/in/gustavo-torres-guerrero",
    },
    {
      value: "4700+",
      label: t("stats.classes.label"),
      modalTitle: t("stats.classes.title"),
      modalBody: t("stats.classes.body"),
      modalLinkLabel: t("stats.classes.link"),
      modalLinkHref: "https://www.classgap.com/es/tutor/gustavo-torres-guerrero",
      modalSide: "right" as const,
    },
    {
      value: "150+",
      label: t("stats.ratings.label"),
      modalTitle: t("stats.ratings.title"),
      modalBody: t("stats.ratings.body"),
      modalLinkLabel: t("stats.ratings.link"),
      modalLinkHref: "https://www.classgap.com/es/tutor/gustavo-torres-guerrero",
    },
    {
      value: "4.9",
      label: t("stats.avg.label"),
      modalTitle: t("stats.avg.title"),
      modalBody: t("stats.avg.body"),
      modalLinkLabel: t("stats.avg.link"),
      modalLinkHref: "https://www.classgap.com/es/tutor/gustavo-torres-guerrero",
      modalSide: "right" as const,
    },
  ];

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
            title={t("zoomTitle")}
          >
            <Image
              src="/avatar.png"
              alt="Gustavo Torres Guerrero"
              fill
              style={{ objectFit: "cover" }}
              sizes="(max-width: 768px) 128px, 176px"
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
                sizes="(max-width: 448px) calc(100vw - 48px), 400px"
                priority
              />
            </div>
            <button
              onClick={close}
              className="absolute top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(32,31,34,0.9)", border: "1px solid rgba(255,255,255,0.08)", color: "#bbcabf" }}
              aria-label={t("close")}
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
            {t("credential")}
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
            {t("subtitle")}
          </span>
          <span className="hidden md:block">
            {t("taglinePart1")}{" "}
          </span>
          <span
            className="hidden md:block"
            style={{
              background: "linear-gradient(135deg, #4edea3, #10b981)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              // background-clip:text paints only inside the box; the tight
              // line-height clips descenders (g, p, y). Extend the box and
              // pull it back so surrounding layout is unchanged.
              paddingBottom: "0.15em",
              marginBottom: "-0.15em",
            }}
          >
            {t("taglinePart2")}
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
            {t("subheading")}
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
          {skills.map((skill) => (
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
          id="hero-cta-row"
          className="hero-cta-row"
          style={{
            justifyContent: "center",
            gap: "16px",
            marginBottom: "44px",
          }}
        >
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-smart-book"))}
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
            {t("cta.book")}
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
            {t("cta.availability")}
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
          {statCards.map((card) => (
            <StatCard key={card.value + card.label} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}
