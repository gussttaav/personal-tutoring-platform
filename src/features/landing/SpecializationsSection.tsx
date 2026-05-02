"use client";

// ─── Specializations data ──────────────────────────────────────────────────────

const CARDS = [
  {
    colSpan: 8,
    icon: "code",
    iconSize: "2.5rem",
    iconBoxSize: 56,
    bg: "#201f22",
    title: "Programación",
    body: "De los paradigmas fundamentales a las estructuras de datos, algoritmos, concurrencia y patrones de diseño. Con foco en buenas prácticas y en aprovechar la IA sin perder el criterio propio.",
    tags: ["Python", "Java / Spring Boot", "C / C++", "Haskell"],
    layout: "large" as const,
  },
  {
    colSpan: 4,
    icon: "dns",
    iconSize: "1.875rem",
    iconBoxSize: 48,
    bg: "#201f22",
    title: "Desarrollo Backend",
    body: "Creación de APIs REST y microservicios, integración con bases de datos SQL y NoSQL, despliegue en la nube y flujos DevOps con Docker y Git.",
    tags: ["API REST", "SQL/NoSQL", "DevOps"],
    layout: "medium" as const,
  },
  {
    colSpan: 4,
    icon: "calculate",
    iconSize: "1.875rem",
    iconBoxSize: 48,
    bg: "#201f22",
    title: "Matemática Computacional",
    body: "Cálculo, álgebra lineal, métodos numéricos, mátemáticas discreta y compiladores/autómatas.",
    tags: [],
    layout: "medium" as const,
  },
  {
    colSpan: 4,
    icon: "psychology",
    iconSize: "1.875rem",
    iconBoxSize: 48,
    bg: "#201f22",
    title: "Inteligencia Artificial",
    body: "Machine Learning, Deep Learning, LLMs y programación multiagente, con bases matemáticas e implementación práctica.",
    tags: [],
    layout: "medium" as const,
  },
  {
    colSpan: 4,
    icon: "analytics",
    iconSize: "1.875rem",
    iconBoxSize: 48,
    bg: "#201f22",
    title: "Análisis de Datos y Estadística",
    body: "Probabilidades, estadística aplicada, minería de datos, big data y series temporales.",
    tags: [],
    layout: "medium" as const,
  },
  {
    colSpan: 12,
    icon: "school",
    iconSize: "3.125rem",
    iconBoxSize: 80,
    bg: "#2a2a2c",
    title: "Ciclos Formativos DAM / DAW",
    body: "Preparación intensiva para Grado Superior. Refuerzo en los módulos técnicos más complejos y mentoría experta para proyectos finales.",
    tags: [],
    layout: "full" as const,
  },
] as const;

export default function SpecializationsSection() {
  return (
    <section style={{ paddingBottom: "64px", animation: "fadeUp 0.7s ease both 0.2s" }}>
      {/* ── Header: title left, subtitle right ── */}
      <div className="specs-header" style={{ marginBottom: "48px" }}>
        <div>
          <span
            style={{
              paddingTop: "40px",
              display: "block",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#4edea3",
              marginBottom: "15px",
            }}
          >
            Capacidades
          </span>
          <h2
            style={{
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#e5e1e4",
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Áreas de Especialización
          </h2>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="specs-grid">
        {CARDS.map((card) => {
          const isLarge = card.layout === "large";
          const isFull = card.layout === "full";

          return (
            <div
              key={card.title}
              className={isFull ? "dam-card" : undefined}
              style={{
                gridColumn: `span ${card.colSpan}`,
                background: card.bg,
                border: "1px solid rgba(60,74,66,0.15)",
                borderRadius: "16px",
                padding: isLarge ? "40px" : isFull ? "32px 40px" : "32px",
                ...(isFull ? { gap: "40px" } : {
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: isLarge ? "space-between" : undefined,
                }),
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(78,222,163,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(60,74,66,0.15)";
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: card.iconBoxSize,
                  height: card.iconBoxSize,
                  borderRadius: isFull ? "16px" : "10px",
                  background: "rgba(78,222,163,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginBottom: isFull ? 0 : "24px",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: card.iconSize, color: "#4edea3" }}
                >
                  {card.icon}
                </span>
              </div>

              {/* Content */}
              <div className={isFull ? "dam-card-text" : undefined} style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    fontFamily: "var(--font-headline, Manrope), sans-serif",
                    fontSize: isLarge ? "1.625rem" : isFull ? "1.25rem" : "1.125rem",
                    fontWeight: 700,
                    color: "#e5e1e4",
                    letterSpacing: "-0.01em",
                    marginBottom: "12px",
                    lineHeight: 1.2,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.9375rem",
                    color: "#86948a",
                    lineHeight: 1.7,
                    margin: 0,
                    marginBottom: card.tags.length > 0 ? "24px" : 0,
                    maxWidth: isLarge ? "480px" : undefined,
                  }}
                >
                  {card.body}
                </p>

                {/* Tech tags */}
                {card.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: "6px 16px",
                          background: "#201f22",
                          border: "1px solid rgba(60,74,66,0.25)",
                          borderRadius: "100px",
                          fontSize: "0.8125rem",
                          color: "#bbcabf",
                          fontWeight: 500,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* CTA button for DAM/DAW card */}
              {isFull && (
                <button
                  style={{
                    padding: "14px 28px",
                    border: "2px solid #4edea3",
                    borderRadius: "10px",
                    background: "transparent",
                    color: "#4edea3",
                    fontFamily: "var(--font-headline, Manrope), sans-serif",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(78,222,163,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  Solicitar apoyo académico
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer strip ── */}
      <div
        style={{
          marginTop: "32px",
          paddingTop: "16px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "6px",
        }}
      >
        <span style={{ fontSize: "13px", color: "#86948a" }}>
          ¿No estás seguro de si puedo ayudarte?
        </span>
        <button
          onClick={() => window.dispatchEvent(new Event("open-chat"))}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "13px",
            color: "#4edea3",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            padding: 0,
            textDecoration: "none",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.75")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#4edea3" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Pregunta al asistente IA
        </button>
      </div>
    </section>
  );
}
