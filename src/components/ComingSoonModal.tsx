"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession, signIn } from "next-auth/react";
import { signInWithPopup } from "@/lib/auth-popup";

type SubscribeState = "idle" | "loading" | "subscribed" | "error";

interface ComingSoonModalProps {
  type:    "courses" | "blog";
  onClose: () => void;
}

const CONTENT = {
  courses: {
    badge:    "CURSOS",
    icon:     "school",
    headline: "Formación en profundidad",
    subline:  "Cursos estructurados sobre IA y desarrollo. Próximamente.",
    ctaLabel: "Suscribirse a Cursos",
  },
  blog: {
    badge:    "BLOG",
    icon:     "article",
    headline: "Artículos y recursos",
    subline:  "Guías, tutoriales y reflexiones sobre IA. Próximamente.",
    ctaLabel: "Suscribirse al Blog",
  },
} as const;

export default function ComingSoonModal({ type, onClose }: ComingSoonModalProps) {
  const { data: session, status, update } = useSession();
  const [mounted,        setMounted]        = useState(false);
  const [subscribeState, setSubscribeState] = useState<SubscribeState>("idle");

  const isLoaded   = status !== "loading";
  const isSignedIn = !!session?.user?.email;
  const content    = CONTENT[type];

  // Portal requires the DOM to be available
  useEffect(() => { setMounted(true); }, []);

  // Scroll lock + Escape key
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Once signed in, check existing subscription status
  useEffect(() => {
    if (!isSignedIn || subscribeState !== "idle") return;
    setSubscribeState("loading");
    fetch(`/api/subscribe?type=${type}`)
      .then(r => r.json())
      .then(data => setSubscribeState(data.subscribed ? "subscribed" : "idle"))
      .catch(() => setSubscribeState("idle"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, type]);

  async function handleSubscribeClick() {
    if (!isSignedIn) {
      const result = await signInWithPopup("/");
      if (result.blocked) { signIn("google"); return; }
      if (result.success) await update();
      return;
    }

    setSubscribeState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type }),
      });
      setSubscribeState(res.ok || res.status === 409 ? "subscribed" : "error");
    } catch {
      setSubscribeState("error");
    }
  }

  const showSpinner = subscribeState === "loading" || (!isLoaded && isSignedIn);

  const modal = (
    <>
      <style>{`
        @keyframes comingSoonFadeUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes comingSoonBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:             "fixed",
          inset:                0,
          zIndex:               9999,
          background:           "rgba(0,0,0,0.75)",
          backdropFilter:       "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display:              "flex",
          alignItems:           "center",
          justifyContent:       "center",
          padding:              "24px",
          animation:            "comingSoonBackdropIn 0.2s ease both",
        }}
      >
        {/* Panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Próximamente — ${content.badge}`}
          onClick={e => e.stopPropagation()}
          style={{
            width:        "min(460px, 100%)",
            background:   "#1c1b1d",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: "24px",
            boxShadow:    "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
            padding:      "28px",
            animation:    "comingSoonFadeUp 0.25s ease both",
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
            <span style={{
              display:       "inline-block",
              padding:       "3px 10px",
              borderRadius:  "20px",
              background:    "rgba(78,222,163,0.10)",
              border:        "1px solid rgba(78,222,163,0.20)",
              color:         "#4edea3",
              fontSize:      "11px",
              fontWeight:    700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily:    "var(--font-headline, Manrope), sans-serif",
            }}>
              {content.badge}
            </span>

            <button
              onClick={onClose}
              aria-label="Cerrar"
              style={{
                width:          "32px",
                height:         "32px",
                borderRadius:   "8px",
                border:         "1px solid rgba(255,255,255,0.08)",
                background:     "transparent",
                cursor:         "pointer",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                color:          "#bbcabf",
                flexShrink:     0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#353437"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Icon */}
          <div style={{
            width:          "52px",
            height:         "52px",
            borderRadius:   "14px",
            background:     "rgba(78,222,163,0.08)",
            border:         "1px solid rgba(78,222,163,0.15)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            marginBottom:   "16px",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "26px", color: "#4edea3" }}>
              {content.icon}
            </span>
          </div>

          {/* Headline + subline */}
          <h2 style={{
            margin:     0,
            fontSize:   "20px",
            fontWeight: 800,
            color:      "#e5e1e4",
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            lineHeight: 1.2,
          }}>
            {content.headline}
          </h2>
          <p style={{ margin: "8px 0 24px", fontSize: "14px", color: "#86948a", lineHeight: 1.6 }}>
            {content.subline}
          </p>

          <hr style={{ borderColor: "rgba(255,255,255,0.06)", margin: "0 0 20px" }} />

          {/* Subscription section */}
          {subscribeState === "subscribed" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{
                  width:          "32px",
                  height:         "32px",
                  borderRadius:   "50%",
                  background:     "rgba(78,222,163,0.12)",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  flexShrink:     0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8l3.5 3.5L13 5" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "#bbcabf" }}>
                  ¡Apuntado! Te avisaremos cuando esté disponible.
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  width:        "100%",
                  padding:      "12px",
                  borderRadius: "12px",
                  border:       "1px solid rgba(255,255,255,0.08)",
                  background:   "transparent",
                  color:        "#bbcabf",
                  fontSize:     "14px",
                  fontWeight:   600,
                  cursor:       "pointer",
                  fontFamily:   "var(--font-headline, Manrope), sans-serif",
                  transition:   "background 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#353437"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                Cerrar
              </button>
            </>
          ) : subscribeState === "error" ? (
            <>
              <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#ffb4ab" }}>
                Algo fue mal al suscribirte.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => { setSubscribeState("idle"); handleSubscribeClick(); }}
                  style={{
                    flex:         1,
                    padding:      "12px",
                    borderRadius: "12px",
                    border:       "none",
                    background:   "#4edea3",
                    color:        "#131315",
                    fontSize:     "14px",
                    fontWeight:   700,
                    cursor:       "pointer",
                    fontFamily:   "var(--font-headline, Manrope), sans-serif",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#10b981"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#4edea3"; }}
                >
                  Reintentar
                </button>
                <button
                  onClick={onClose}
                  style={{
                    flex:         1,
                    padding:      "12px",
                    borderRadius: "12px",
                    border:       "1px solid rgba(255,255,255,0.08)",
                    background:   "transparent",
                    color:        "#bbcabf",
                    fontSize:     "14px",
                    fontWeight:   600,
                    cursor:       "pointer",
                    fontFamily:   "var(--font-headline, Manrope), sans-serif",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#353437"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#86948a" }}>
                {isSignedIn
                  ? "Recibe un aviso cuando publique nuevo contenido."
                  : "Inicia sesión con Google para recibir un aviso al publicar."}
              </p>
              <button
                onClick={handleSubscribeClick}
                disabled={showSpinner}
                style={{
                  width:         "100%",
                  padding:       "13px 24px",
                  borderRadius:  "12px",
                  border:        "none",
                  background:    showSpinner ? "rgba(78,222,163,0.4)" : "#4edea3",
                  color:         "#131315",
                  fontSize:      "14px",
                  fontWeight:    700,
                  cursor:        showSpinner ? "not-allowed" : "pointer",
                  fontFamily:    "var(--font-headline, Manrope), sans-serif",
                  display:       "flex",
                  alignItems:    "center",
                  justifyContent:"center",
                  gap:           "8px",
                  marginBottom:  "10px",
                  transition:    "background 0.15s",
                  pointerEvents: showSpinner ? "none" : "auto",
                }}
                onMouseEnter={e => { if (!showSpinner) (e.currentTarget as HTMLElement).style.background = "#10b981"; }}
                onMouseLeave={e => { if (!showSpinner) (e.currentTarget as HTMLElement).style.background = "#4edea3"; }}
              >
                {showSpinner ? (
                  <span style={{
                    width:          "18px",
                    height:         "18px",
                    borderRadius:   "50%",
                    border:         "2px solid rgba(19,19,21,0.3)",
                    borderTopColor: "#131315",
                    display:        "inline-block",
                    animation:      "spin 0.7s linear infinite",
                  }} />
                ) : !isSignedIn ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continuar con Google
                  </>
                ) : content.ctaLabel}
              </button>

              <button
                onClick={onClose}
                style={{
                  width:        "100%",
                  padding:      "12px",
                  borderRadius: "12px",
                  border:       "1px solid rgba(255,255,255,0.08)",
                  background:   "transparent",
                  color:        "#bbcabf",
                  fontSize:     "14px",
                  fontWeight:   600,
                  cursor:       "pointer",
                  fontFamily:   "var(--font-headline, Manrope), sans-serif",
                  transition:   "background 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#353437"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
