// RSC layout shell shared by all dedicated policy pages.

import Link from "next/link";
import type { ReactNode } from "react";

interface PolicyPageProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export default function PolicyPage({ title, lastUpdated, children }: PolicyPageProps) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        {/* Back link */}
        <div style={{ padding: "28px 0 20px" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "var(--text-muted)",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            className="policy-back-link"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Volver al inicio
          </Link>
        </div>

        {/* Header */}
        <div
          style={{
            paddingBottom: 28,
            borderBottom: "1px solid var(--border)",
            marginBottom: 32,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-serif), 'DM Serif Display', serif",
              fontSize: "clamp(26px, 5vw, 36px)",
              color: "var(--text)",
              fontWeight: 400,
              lineHeight: 1.2,
              marginBottom: 10,
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Última actualización: {lastUpdated}
          </p>
        </div>

        {/* Policy content */}
        <div className="policy-body">
          {children}
        </div>

        {/* Footer link back */}
        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Volver al inicio
          </Link>
          <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
            gustavoai.dev · contacto@gustavoai.dev
          </p>
        </div>
      </div>

      {/* Scoped styles */}
      <style>{`
        .policy-back-link:hover { color: var(--text); }

        .policy-body {
          font-size: 14.5px;
          line-height: 1.8;
          color: var(--text-muted);
        }
        .policy-body h3 {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-dim);
          margin: 28px 0 10px;
        }
        .policy-body p  { margin-bottom: 12px; }
        .policy-body ul {
          padding-left: 20px;
          margin-bottom: 12px;
        }
        .policy-body li { margin-bottom: 6px; }
        .policy-body strong {
          color: var(--text);
          font-weight: 500;
        }
        .policy-body a {
          color: var(--green);
          text-decoration: none;
        }
        .policy-body a:hover { text-decoration: underline; }
      `}</style>
    </main>
  );
}
