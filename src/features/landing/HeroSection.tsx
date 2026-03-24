import Image from "next/image";
import { SKILL_ITEMS_DATA } from "./skill-icons";

export default function HeroSection() {
  return (
    <section style={{ padding: "32px 0 36px" }}>
      {/* Avatar + name */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 24,
          marginBottom: 28,
          animation: "fadeUp 0.6s ease both 0.05s",
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <Image
            src="/avatar.jpg"
            alt="Gustavo Torres Guerrero"
            width={80}
            height={80}
            priority
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid var(--border)",
              display: "block",
            }}
          />
        </div>

        <div style={{ flex: 1, paddingTop: 4, minWidth: 0 }}>
          <h1
            style={{
              fontFamily: "var(--font-serif), 'DM Serif Display', serif",
              fontSize: "clamp(24px, 5vw, 38px)",
              lineHeight: 1.1,
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            Gustavo Torres
            <br />
            Guerrero
          </h1>
          <p
            style={{
              fontSize: "clamp(12px, 2.5vw, 14px)",
              color: "var(--text-muted)",
              fontWeight: 400,
              lineHeight: 1.6,
            }}
          >
            Profesor de Programación, Matemáticas &amp; IA · Consultor
            <br />
            <span style={{ color: "var(--text-dim)", fontSize: "0.9em" }}>
              Msc. Matemáticas y Computación
            </span>
          </p>
        </div>
      </div>

      {/* Social proof badges */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 32,
          animation: "fadeUp 0.6s ease both 0.15s",
        }}
      >
        <a
          href="https://www.classgap.com/es/tutor/gustavo-torres-guerrero"
          target="_blank"
          rel="noopener noreferrer"
          className="badge-link badge-link--green"
        >
          ⭐ 150+ valoraciones · Classgap
        </a>

        <a
          href="https://www.linkedin.com/in/gustavo-torres-guerrero"
          target="_blank"
          rel="noopener noreferrer"
          className="badge-link"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
          </svg>
          LinkedIn
        </a>

        <a
          href="https://github.com/gussttaav"
          target="_blank"
          rel="noopener noreferrer"
          className="badge-link"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          GitHub
        </a>
      </div>

      {/* Bio */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "28px",
          marginBottom: 20,
          animation: "fadeUp 0.6s ease both 0.25s",
        }}
      >
        <p style={{ fontSize: 14.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.7 }}>
          Graduado en{" "}
          <strong style={{ color: "var(--text)", fontWeight: 500 }}>Ciencias de la Computación</strong>{" "}
          y máster en{" "}
          <strong style={{ color: "var(--text)", fontWeight: 500 }}>Matemáticas y Computación</strong>{" "}
          por la Universidad de Cantabria. Tras varios años como desarrollador de software, me dediqué
          durante cinco años a la investigación y la docencia en el ámbito universitario, antes de pasar a trabajar de
          forma independiente combinando enseñanza y consultoría.
        </p>
        <p style={{ fontSize: 14.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.7 }}>
          Desde hace más de siete años, acompaño a estudiantes y profesionales a potenciar sus 
          habilidades en programación, matemáticas e inteligencia artificial. Mi apoyo abarca 
          desde el refuerzo académico y el aprendizaje desde cero, hasta la preparación de 
          entrevistas técnicas y el desarrollo de proyectos reales.
        </p>
      </div>

      {/* Skills grid */}
      <SkillsGrid />
    </section>
  );
}

// ─── Skills grid — also a Server Component ───────────────────────────────────

function SkillsGrid() {
  return (
    <div style={{ animation: "fadeUp 0.6s ease both 0.35s" }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          marginBottom: 14,
          marginTop: 20,
        }}
      >
        Áreas de especialidad
      </p>
      <div className="skills-grid">
        {SKILL_ITEMS_DATA.map(({ icon, iconColor, label, tooltipTitle, tooltipBody }, index) => (
          <div key={label} className="skill-item">
            <span
              className="skill-icon"
              style={{ color: iconColor ?? undefined, display: "flex", alignItems: "center" }}
            >
              {icon}
            </span>
            {label}
            <span className="skill-hint">···</span>
            <div className={`skill-tooltip${index % 2 === 1 ? " skill-tooltip--right" : ""}`}>
              <strong>{tooltipTitle}</strong>
              {tooltipBody}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
