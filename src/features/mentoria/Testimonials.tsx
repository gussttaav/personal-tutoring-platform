/*
 * REDESIGN-P2-02 — «Valoraciones»: three testimonial cards, initials avatars, a link to the
 * verified Classgap reviews under the grid. `docs/redesign/design/mentoria.html` `.quotes-grid`
 * / `.quote` is the reference (1 column, 3 from 768).
 *
 * The quotes are content, not copy — they live in `src/constants/testimonials.ts` with a `lang`
 * tag and are never translated; `pickTestimonials(locale)` puts the visitor's own language
 * first and takes the top three. Only the section chrome (kicker, heading, subtitle, the
 * Classgap link) is a message key.
 *
 * The initials circle reuses the navbar's no-picture avatar values (`Navbar.tsx`'s
 * `rgba(78,222,163,0.12)` fill, `0.2` border, Manrope 700 12px green) — no new visual
 * vocabulary for a student without a photo.
 *
 * Server Component, no client JS: static HTML, hover is CSS (`.mt-quote:hover` in
 * `mentoria.css`).
 */

import { getTranslations } from "next-intl/server";
import { pickTestimonials } from "@/constants/testimonials";
import { CLASSGAP_PROFILE_URL } from "@/constants";

interface TestimonialsProps {
  locale: string;
}

export default async function Testimonials({ locale }: TestimonialsProps) {
  const t = await getTranslations({ locale, namespace: "mentoria.testimonials" });
  const testimonials = pickTestimonials(locale);

  return (
    <>
      <section id="valoraciones" className="mt-sec" style={{ animation: "fadeUp 0.7s ease both 0.15s" }}>
        <p className="mt-sec-k">{t("kicker")}</p>
        <h2 className="mt-sec-h">{t("heading")}</h2>
        <p className="mt-sec-s">{t("subtitle")}</p>

        <div className="mt-quotes">
          {testimonials.map((item) => (
            <div key={item.name} className="mt-quote">
              <span className="mt-quote-mark" aria-hidden="true">&ldquo;</span>
              <p>{item.quote}</p>
              <div className="mt-quote-who">
                <span className="mt-quote-av">{item.initials}</span>
                <div>
                  <div className="mt-quote-name">{item.name}</div>
                  <div className="mt-quote-ctx">{item.context ?? t("student")}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <a
          className="mt-quotes-more"
          href={CLASSGAP_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("classgap")}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M2 12L12 2M12 2H6M12 2V8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </section>

      <div className="mt-divider" />
    </>
  );
}
