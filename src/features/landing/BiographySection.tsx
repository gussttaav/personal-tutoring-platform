"use client";

import Image from "next/image";

export default function BiographySection() {
  return (
    <section
      style={{
        paddingTop: "40px",
        paddingBottom: "60px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        animation: "fadeUp 0.7s ease both 0.15s",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">

        {/* ── Left column: overline + headline + bio + divider + links ── */}
        <div>
          {/* Over-line */}
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#4edea3",
              marginBottom: "16px",
            }}
          >
            Sobre Gustavo
          </p>

          {/* Headline */}
          <h2
            style={{
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "#e5e1e4",
              marginBottom: "20px",
              lineHeight: 1.35,
            }}
          >
            Forjado entre código y ecuaciones
          </h2>

          {/* Bio paragraphs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
            <p style={{ fontSize: "15px", lineHeight: 1.75, color: "#bbcabf", margin: 0 }}>
              Graduado en Ciencias de la Computación y máster en Matemáticas y Computación por la 
              Universidad de Cantabria. Tras varios años como desarrollador de software, me dediqué 
              durante cinco años a la investigación y la docencia en el ámbito universitario, antes 
              de pasar a trabajar de forma independiente combinando enseñanza y consultoría.
            </p>
            <p style={{ fontSize: "15px", lineHeight: 1.75, color: "#bbcabf", margin: 0 }}>
              Desde hace más de siete años, acompaño a estudiantes y profesionales a potenciar sus 
              habilidades en programación, matemáticas e inteligencia artificial. Mi apoyo abarca 
              desde el refuerzo académico y el aprendizaje desde cero, hasta la preparación de entrevistas 
              técnicas y el desarrollo de proyectos reales.
            </p>
          </div>


          {/* Divider */}
          <hr style={{ border: "none", borderTop: "0.5px solid rgba(255,255,255,0.07)", margin: "20px 0" }} />

          {/* Social links */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              {
                href: "https://github.com/gussttaav",
                label: "GitHub",
                icon: (
                  <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                ),
              },
              {
                href: "https://www.linkedin.com/in/gustavo-torres-guerrero",
                label: "LinkedIn",
                icon: (
                  <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                ),
              },
              {
                href: "mailto:contacto@gustavoai.dev",
                label: "contacto@gustavoai.dev",
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                ),
              },
            ].map(({ href, label, icon }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("mailto") ? undefined : "_blank"}
                rel={href.startsWith("mailto") ? undefined : "noopener noreferrer"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "0.5px solid rgba(255,255,255,0.10)",
                  borderRadius: "7px",
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  textDecoration: "none",
                  transition: "border-color 0.2s, color 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(78,222,163,0.35)";
                  (e.currentTarget as HTMLElement).style.color = "#4edea3";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
                }}
              >
                {icon}
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* ── Right column: photo frame ── */}
        <div className="hidden md:flex" style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: "280px", aspectRatio: "3/4" }}>

            {/* Accent dot */}
            <div style={{
              position: "absolute", top: "-10px", left: "-10px",
              width: "22px", height: "22px", borderRadius: "50%",
              background: "#4edea3", opacity: 0.7, zIndex: 3,
            }} />
            {/* Accent line */}
            <div style={{
              position: "absolute", top: "24px", left: "-10px",
              width: "3px", height: "40px", borderRadius: "2px",
              background: "#4edea3", opacity: 0.4, zIndex: 3,
            }} />

            {/* Offset background blocks */}
            <div style={{
              position: "absolute", bottom: "-7px", right: "-7px",
              width: "85%", height: "85%", borderRadius: "14px",
              background: "#4edea3", opacity: 0.12,
            }} />
            <div style={{
              position: "absolute", bottom: "-14px", right: "-14px",
              width: "85%", height: "85%", borderRadius: "14px",
              background: "#4edea3", opacity: 0.25,
            }} />

            {/* Photo */}
            <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", borderRadius: "14px", overflow: "hidden" }}>
              <Image
                src="/avatar.png"
                alt="Gustavo Torres Guerrero"
                fill
                style={{ objectFit: "cover" }}
                sizes="280px"
              />
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}