"use client";

/**
 * FooterModals — client island for the last 2 columns of the footer grid.
 *
 * Renders:
 *   • Col 2 — Políticas: buttons that open policy modals (+ links to dedicated pages)
 *   • Col 3 — Ayuda: email link + AI assistant trigger
 *   • The three modals (full-screen overlay)
 *
 * Policy content is imported from src/components/policy/PolicyContent.tsx —
 * the single source of truth shared with the dedicated /privacidad and /terminos pages.
 */

import { useState, useEffect, useCallback } from "react";
import {
  PrivacidadContent,
  TerminosContent,
  CancelacionContent,
} from "@/components/policy/PolicyContent";

const MODAL_META: Record<Exclude<ModalId, null>, { title: string; Content: () => React.JSX.Element; href?: string }> = {
  cancelacion: { title: "Política de cancelación", Content: CancelacionContent },
  terminos:    { title: "Términos de servicio",     Content: TerminosContent,    href: "/terminos" },
  privacidad:  { title: "Política de privacidad",  Content: PrivacidadContent,  href: "/privacidad" },
};

type ModalId = "cancelacion" | "terminos" | "privacidad" | null;

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ id, onClose }: { id: Exclude<ModalId, null>; onClose: () => void }) {
  const { title, Content } = MODAL_META[id];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        width: "100%", maxWidth: 560, maxHeight: "85dvh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          <h2 style={{
            fontFamily: "var(--font-serif), 'DM Serif Display', serif",
            fontSize: 20, fontWeight: 400, color: "var(--text)",
          }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", padding: 4,
              display: "flex", borderRadius: 6, transition: "color 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-prose" style={{
          padding: "20px 24px 24px", overflowY: "auto",
          fontSize: 14, lineHeight: 1.75, color: "var(--text-muted)",
        }}>
          <Content />
        </div>
      </div>

      <style>{`
        .modal-prose h3 { font-size:12px; font-weight:500; letter-spacing:0.07em; text-transform:uppercase; color:var(--text-dim); margin:20px 0 8px; }
        .modal-prose p  { margin-bottom:10px; }
        .modal-prose ul { padding-left:18px; margin-bottom:10px; }
        .modal-prose li { margin-bottom:5px; }
        .modal-prose strong { color:var(--text); font-weight:500; }
        .modal-prose a  { color:var(--green); text-decoration:none; }
        .modal-prose a:hover { text-decoration:underline; }
      `}</style>
    </div>
  );
}

// ─── Main export — renders footer columns 2, 3, 4 ────────────────────────────

export default function FooterModals() {
  const [openModal, setOpenModal] = useState<ModalId>(null);
  const close = useCallback(() => setOpenModal(null), []);

  function openChat() {
    window.dispatchEvent(new Event("open-chat"));
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  return (
    <>
      {/* ── Col 2: Políticas ── */}
      <div>
        <p className="footer-col-label">Políticas</p>
        {(["cancelacion", "terminos", "privacidad"] as Exclude<ModalId, null>[]).map((id) => {
          const { title, href } = MODAL_META[id];
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button className="footer-link" onClick={() => setOpenModal(id)} style={{ width: "auto", flex: 1 }}>
                {title}
              </button>
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${title} en página propia`}
                  title="Abrir en página propia"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    color: "var(--text-dim)",
                    flexShrink: 0,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-dim)")}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Col 3: Ayuda ── */}
      <div>
        <p className="footer-col-label">Ayuda</p>
        <a className="footer-link" href="mailto:contacto@gustavoai.dev" style={{display:"flex",alignItems:"center",gap:6}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" style={{flexShrink:0}}>
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m2 7 10 7 10-7"/>
          </svg>
          contacto@gustavoai.dev
        </a>
        <button
          className="footer-link"
          onClick={openChat}
          style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}
          title="Abre el asistente IA para responder tus preguntas al instante"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{flexShrink:0,color:"var(--green)"}}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Pregunta al asistente IA
        </button>
        <button
          onClick={openChat}
          style={{
            display:"inline-block",
            fontSize:11, color:"var(--green)",
            padding:"2px 8px",
            border:"1px solid rgba(61,220,132,0.25)",
            borderRadius:100,
            marginTop:5,
            marginLeft:19,
            background:"none",
            cursor:"pointer",
            fontFamily:"inherit",
            transition:"background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(61,220,132,0.08)";
            el.style.borderColor = "rgba(61,220,132,0.5)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "none";
            el.style.borderColor = "rgba(61,220,132,0.25)";
          }}
          title="Abrir el asistente IA"
        >
          FAQs al instante
        </button>
      </div>

      {/* ── Modals ── */}
      {openModal && <Modal id={openModal} onClose={close} />}

      <style>{`
        .footer-link {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-muted);
          text-decoration: none;
          padding: 3px 0;
          line-height: 1.55;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: color 0.15s;
          width: 100%;
        }
        .footer-link:hover { color: var(--text); }
      `}</style>
    </>
  );
}
