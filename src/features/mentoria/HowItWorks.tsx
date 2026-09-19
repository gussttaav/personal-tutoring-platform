/*
 * REDESIGN-P2-01 — «Cómo funciona»: section head + four numbered step cards (encuentro inicial
 * → eliges día y hora → la clase con Zoom → si surge algo), 1 / 2 / 4 columns at 0 / 640 / 1024.
 * `docs/redesign/design/mentoria.html` `.sec` + `.steps` is the reference; the section-head
 * values are the ones `InteractiveShell` inlines on the sessions/packs sections.
 *
 * `id="como-funciona"` is the target of the home bio's «Cómo funcionan las clases» link
 * (`/mentoria#como-funciona`); `.mt-sec`'s `scroll-margin-top` keeps it clear of the navbar.
 *
 * The fourth step quotes the cancellation window («hasta {hours} horas antes»). It is READ, not
 * written: `booking_settings.cancel_min_notice_hours`, the value the cancel/reschedule guards
 * enforce (`BookingService.getCancelWindowMs()`), reaches this component as a prop — the page
 * reads `getScheduleConfig()` once (it is `unstable_cache`d with the ISR window) and passes
 * the number down; this component never calls it.
 *
 * Server Component, no client JS: the cards are static HTML and the hover is CSS.
 */

import { getTranslations } from "next-intl/server";

interface HowItWorksProps {
  locale: string;
  /** `ScheduleConfig.cancelMinNoticeHours` — whole hours before a class it can still be moved. */
  cancelMinNoticeHours: number;
}

const STEPS = ["initial", "slot", "zoom", "changes"] as const;

export default async function HowItWorks({ locale, cancelMinNoticeHours }: HowItWorksProps) {
  const t = await getTranslations({ locale, namespace: "mentoria.how" });

  return (
    <>
      <section id="como-funciona" className="mt-sec" style={{ animation: "fadeUp 0.7s ease both 0.15s" }}>
        <p className="mt-sec-k">{t("kicker")}</p>
        <h2 className="mt-sec-h">{t("heading")}</h2>
        <p className="mt-sec-s">{t("subtitle")}</p>

        <div className="mt-steps">
          {STEPS.map((step, i) => (
            <div key={step} className="mt-step">
              <span className="mt-step-n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{t(`steps.${step}.title`)}</h3>
              <p>
                {step === "changes"
                  ? t("steps.changes.body", { hours: cancelMinNoticeHours })
                  : t(`steps.${step}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* The mock's divider before Áreas de Especialización carries no bottom margin: the
          bento's own kicker adds the 40px above itself (`SpecializationsSection`). */}
      <div className="mt-divider" style={{ marginBottom: 0 }} />
    </>
  );
}
