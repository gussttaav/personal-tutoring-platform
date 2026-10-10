/**
 * BLOG-15 — "how many people will this email reach?", shown as soon as the announcement is
 * defined, before any preview. Both announce forms render it from `useRecipientCount`.
 * Admin panel is Spanish.
 */
"use client";

import type { CountState } from "./useRecipientCount";

const people = (n: number) => (n === 1 ? "persona" : "personas");

export function RecipientCount({ count, onRetry }: { count: CountState; onRetry: () => void }) {
  if (count.status === "idle") return null;

  if (count.status === "error") {
    return (
      <div className="recipient-count is-error" role="status">
        <span className="material-symbols-outlined" aria-hidden="true">error</span>
        <div className="recipient-count-body">
          <div className="recipient-count-main">No se pudo calcular cuántas personas lo recibirán.</div>
          <button type="button" className="btn-ghost-sm" onClick={onRetry}>Reintentar</button>
        </div>
      </div>
    );
  }

  const data = count.data;
  if (count.status === "loading" || !data) {
    return (
      <div className="recipient-count is-loading" role="status">
        <span className="material-symbols-outlined" aria-hidden="true">group</span>
        <div className="recipient-count-body">
          <div className="recipient-count-main">Calculando destinatarios…</div>
        </div>
      </div>
    );
  }

  const outsideAreas = data.matching === undefined ? null : data.subscribers - data.matching;
  const details = [
    `${data.byLocale.es} en español · ${data.byLocale.en} en inglés`,
    data.alreadyNotified > 0 ? `${data.alreadyNotified} ya lo recibieron` : null,
    outsideAreas === null
      ? `${data.subscribers} ${data.subscribers === 1 ? "suscriptor" : "suscriptores"} en total`
      : `${data.subscribers} ${data.subscribers === 1 ? "suscriptor" : "suscriptores"} al blog, ${outsideAreas} no ${outsideAreas === 1 ? "sigue" : "siguen"} estas áreas`,
  ].filter(Boolean);

  return (
    <div className="recipient-count" role="status">
      <span className="material-symbols-outlined" aria-hidden="true">group</span>
      <div className="recipient-count-body">
        <div className="recipient-count-main">
          <strong>{data.pending}</strong> {people(data.pending)} {data.pending === 1 ? "recibirá" : "recibirán"} este correo
        </div>
        <div className="recipient-count-detail">{details.join(" · ")}</div>
      </div>
    </div>
  );
}
