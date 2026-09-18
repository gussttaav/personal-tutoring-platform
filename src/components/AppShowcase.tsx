/*
 * REDESIGN-P1-04 — the mobile-app showcase: the phone mock beside the pitch. Mounted on `/`
 * and, from P2-03, on `/mentoria`; `docs/redesign/design/home.html` `.app` is the reference and
 * `app-showcase.css` carries its rules (imported by the page).
 *
 * Server Component, no client JS. The phone is MARKUP, not an image: the app's real home
 * screen drawn with the site's own tokens, crisp at every DPR and recoloured with the palette.
 * Its sample data («Hola, Lucía», «Hoy · 18:00», «5 créditos · Pack Esencial», Vie 18 / Lun
 * 21) and its visible labels (the buttons, the tab bar) are literals here, deliberately in
 * Spanish and not in the message files — it is a screenshot of the Spanish app, not UI copy.
 * The whole mock is `aria-hidden`; the copy column carries the meaning.
 *
 * Store links are honest placeholders until the app exists: the bracketed labels from the
 * design, as `<span aria-disabled>`. `NEXT_PUBLIC_APP_STORE_URL` / `NEXT_PUBLIC_PLAY_STORE_URL`
 * flip each one to a real `<a>` without a code change.
 *
 * The three benefit icons render from the self-hosted Material Symbols font, like the
 * neighbouring `HomeAreas` boxes; the icons inside the phone are the mock's inline SVGs.
 */

import { getTranslations } from "next-intl/server";

interface AppShowcaseProps {
  locale: string;
}

const BENEFITS = [
  { key: "join", icon: "videocam" },
  { key: "book", icon: "calendar_month" },
  { key: "credits", icon: "credit_card" },
] as const;

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL;
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL;

function StoreButton({ href, kicker, label }: { href?: string; kicker: string; label: string }) {
  const inner = (
    <>
      <span className="material-symbols-outlined" style={{ fontSize: "22px" }} aria-hidden="true">
        download
      </span>
      <span>
        <span className="k">{kicker}</span>
        <span className="v">{label}</span>
      </span>
    </>
  );
  return href ? (
    <a className="app-store" href={href} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <span className="app-store" aria-disabled="true">
      {inner}
    </span>
  );
}

/* Feather-style strokes, sized as in the mock. */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function PhoneMock() {
  return (
    <div className="app-phone-frame" aria-hidden="true">
      <div className="ap-body">
        <div className="ap-greet">
          <div>
            <div className="hi">Buenas tardes</div>
            <div className="name">Hola, Lucía</div>
          </div>
          <span className="ap-initials">LR</span>
        </div>

        <div className="ap-card next">
          <div className="ap-cap">
            <span className="ap-k">Tu próxima clase</span>
            <span className="ap-live"><span className="dot" />Empieza en 8 min</span>
          </div>
          <div className="ap-when">
            <span className="day">Hoy</span> · 18:00 <span className="till">– 19:00</span>
          </div>
          <div className="ap-sub">1 hora · con Gustavo · Sala lista</div>
          <div className="ap-join">
            <svg width="17" height="17" viewBox="0 0 24 24" strokeWidth="2" {...stroke}>
              <rect x="2" y="6" width="14" height="12" rx="2" />
              <path d="m16 10 6-3v10l-6-3z" />
            </svg>
            Unirse a la clase
          </div>
          <div className="ap-pair">
            <span className="ap-ghost">Ver detalle</span>
            <span className="ap-sq">
              <svg width="17" height="17" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
          </div>
        </div>

        <div className="ap-card">
          <div className="ap-cap">
            <span className="ap-k">Saldo de créditos</span>
            <span className="ap-link">Comprar más</span>
          </div>
          <div className="ap-credits">
            <span className="n">5</span>
            <span className="u">créditos · Pack Esencial</span>
          </div>
          <div className="ap-bar"><span /></div>
          <div className="ap-fine">Caduca en 142 días · 12 dic 2026</div>
          <div className="ap-outline">
            Reservar con crédito
            <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2.2" {...stroke}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>

        <div className="ap-h"><b>Próximas clases</b><span className="ap-count">2</span></div>
        <div className="ap-item">
          <div className="ap-date"><span className="d">Vie</span><span className="n">18</span></div>
          <div className="info">
            <div className="t">17:00 – 18:00</div>
            <div className="m">1 hora <span className="ap-tag">Crédito</span></div>
          </div>
          <span className="chev">
            <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" {...stroke}>
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </span>
        </div>
        <div className="ap-item">
          <div className="ap-date"><span className="d">Lun</span><span className="n">21</span></div>
          <div className="info">
            <div className="t">10:00 – 12:00</div>
            <div className="m">2 horas <span className="ap-tag paid">Pagada</span></div>
          </div>
          <span className="chev">
            <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" {...stroke}>
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </span>
        </div>
        <div className="ap-add">
          <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2.2" {...stroke}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Reservar otra clase
        </div>
      </div>

      <div className="ap-tabs">
        <span className="ap-tab on">
          <svg width="19" height="19" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
            <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 13 15 13 15 22" />
          </svg>
          Inicio
        </span>
        <span className="ap-tab">
          <svg width="19" height="19" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Reservar
        </span>
        <span className="ap-tab">
          <svg width="19" height="19" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
            <rect x="3" y="8" width="18" height="13" rx="2" />
            <path d="M3 12h18" />
            <path d="M12 8v13" />
            <path d="M12 8S9.5 3.5 7 5s1 3 5 3z" />
            <path d="M12 8s2.5-4.5 5-3-1 3-5 3z" />
          </svg>
          Packs
        </span>
        <span className="ap-tab">
          <svg width="19" height="19" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Perfil
        </span>
      </div>
    </div>
  );
}

export default async function AppShowcase({ locale }: AppShowcaseProps) {
  const t = await getTranslations({ locale, namespace: "app" });

  return (
    <section className="app-showcase">
      <div className="app-grid">
        <div className="app-phone">
          <PhoneMock />
        </div>

        <div className="app-copy">
          <span className="app-soon">{t("soon")}</span>
          <h2 className="app-heading">{t("heading")}</h2>
          <p className="app-lead">{t("lead")}</p>

          <div className="app-benefits">
            {BENEFITS.map(({ key, icon }) => (
              <div key={key} className="app-benefit">
                <div className="ico">
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }} aria-hidden="true">
                    {icon}
                  </span>
                </div>
                <div>
                  <h3>{t(`benefits.${key}.title`)}</h3>
                  <p>{t(`benefits.${key}.body`)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="app-stores">
            <StoreButton href={APP_STORE_URL} kicker={t("stores.downloadOn")} label={t("stores.appStore")} />
            <StoreButton href={PLAY_STORE_URL} kicker={t("stores.availableOn")} label={t("stores.playStore")} />
          </div>
        </div>
      </div>
    </section>
  );
}
