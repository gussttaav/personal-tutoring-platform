/*
 * REDESIGN-P2-01 — the /mentoria page header: kicker + hairline rule, the serif title with the
 * green italic tail, the lead, the two booking CTAs and the free-meeting note.
 * `docs/redesign/design/mentoria.html` `.mt-head` is the reference.
 *
 * It is the Cursos/Blog header (`cursos/page.tsx`: `.lp-section-head`, `h1.lp-serif`, the
 * `t.rich` accent) plus the CTAs — the three menu pages read as one family and the home keeps
 * the site's only hero. Replaces `HeroSection` (deleted): the photo, the identity line, the
 * subject chips and the stats are gone from this page; the stats live on the home (`HomeStats`).
 *
 * Server Component: everything here is static HTML except `MentoriaCtas` (two buttons
 * dispatching the shell's events), so the boundary sits there. `#hero-cta-row` stays on the
 * CTA row: `Chat.tsx` watches it to keep the FAB out of the buttons' way.
 */

import { getTranslations } from "next-intl/server";
import MentoriaCtas from "./MentoriaCtas";

interface MentoriaHeaderProps {
  locale: string;
}

export default async function MentoriaHeader({ locale }: MentoriaHeaderProps) {
  const t = await getTranslations({ locale, namespace: "mentoria.header" });

  return (
    <header className="mt-head" style={{ animation: "fadeUp 0.7s ease both" }}>
      <div className="lp-section-head">
        <span className="lp-kicker">{t("kicker")}</span>
        <span className="lp-rule" />
      </div>

      <h1 className="lp-serif mt-title">
        {t.rich("title", {
          accent: (chunks) => (
            <span style={{ fontStyle: "italic", color: "var(--green)" }}>{chunks}</span>
          ),
        })}
      </h1>

      <p className="mt-lead">{t("lead")}</p>

      {/* ── CTAs ── */}
      <div id="hero-cta-row" className="hero-cta-row mt-cta-row" style={{ gap: "16px" }}>
        <MentoriaCtas />
      </div>

      {/* ── Free-meeting note ── */}
      <p
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "18px",
          fontSize: "13px",
          color: "#86948a",
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4edea3", flexShrink: 0 }}
        />
        {t("freeNote")}
      </p>
    </header>
  );
}
