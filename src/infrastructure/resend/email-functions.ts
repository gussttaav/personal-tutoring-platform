/**
 * lib/email.ts — all transactional emails via Resend.
 *
 * SECURITY FIX (CRIT-04): All user-controlled values (studentName, note,
 * studentEmail, sessionLabel) are now passed through escapeHtml() before
 * being interpolated into HTML strings. Without this, a student whose name
 * contained HTML tags could execute arbitrary JavaScript in the recipient's
 * email client (stored XSS).
 *
 * COURSE-P6-02: sendCourseNewsEmail is the one BULK send in this file — everything else is
 * transactional. Render and send are split (renderCourseNewsEmail / sendCourseNewsEmail) so
 * the admin announce route can show a real rendered sample on a dry run without touching
 * Resend, and so the template is unit-testable. Locale comes from `users.locale`, never a
 * cookie: a bulk send has no request context, the same rule the Stripe-webhook booking
 * emails follow.
 *
 * COURSE-P6-02b: that one bulk send now covers the three things the opt-in actually promises
 * — `launch`, `english`, `update` — one bilingual namespace each (ANNOUNCEMENT_NAMESPACE).
 * `update` is the only kind carrying operator-typed text, and it is a single line rendered
 * as escaped text, never markup: still not a newsletter.
 *
 * REFACTOR-R3-P1-01: send() now throws on a non-OK Resend response instead of
 * logging and returning normally, so callers (BookingService.sendWithRetry,
 * PaymentService.writeDeadLetter) can actually retry or record the failure.
 * All console.* calls replaced with structured log(). The E2E-skip and
 * missing-RESEND_API_KEY paths remain non-throwing no-ops.
 *
 * REFACTOR-R4-P3-03: sendPaymentAuditReportEmail — the daily booking-payment audit's
 * findings, to NOTIFY_EMAIL. Admin-facing, so Spanish and outside next-intl.
 */

import { getTranslations } from "next-intl/server";
import { formatDate, formatTime } from "@/lib/formatting";
import { localeUrl } from "@/lib/hreflang";
import type {
  AnnouncementKind, PaymentAuditCode, PaymentAuditReport, SessionType,
} from "@/domain/types";
import { log } from "@/lib/logger";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM     = process.env.RESEND_FROM ?? "Gustavo Torres <onboarding@resend.dev>";
// SEO-05: non-www default, consistent with sitemap.ts / robots.ts / layout.tsx
// (the canonical host is https://gustavoai.dev).
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

// ─── Security: HTML escaping ──────────────────────────────────────────────────

/**
 * Escapes the five characters that are dangerous in HTML contexts.
 * Apply to every user-supplied string before interpolating into email HTML.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ─── Internal send ────────────────────────────────────────────────────────────

async function send(
  payload: { to: string; subject: string; html: string },
  studentEmail?: string,
): Promise<void> {
  // Skip when the recipient or the booking's student is a known E2E test
  // account, so Playwright runs don't consume the Resend daily quota.
  // Real users on the same deployment (manual smoke-tests on staging) still
  // receive emails.
  const testAccounts = (process.env.E2E_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (testAccounts.includes(payload.to) || (studentEmail && testAccounts.includes(studentEmail))) {
    log("info", "Email skipped for E2E test account", { service: "email", to: payload.to });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log("warn", "RESEND_API_KEY not set — email skipped", { service: "email", to: payload.to });
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, ...payload }),
  });

  if (!res.ok) {
    const body = await res.text();
    log("error", "Resend send failed", {
      service: "email", status: res.status, to: payload.to, from: FROM, body,
    });
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  log("info", "Email sent", { service: "email", to: payload.to, id: (data as { id?: string }).id });
}

const STYLES = `
  body { margin:0;padding:0;background:#0d0f10;font-family:'DM Sans',-apple-system,sans-serif; }
  .wrap { max-width:560px;margin:0 auto;padding:40px 24px; }
  .card { background:#141618;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px; }
  h1   { font-size:22px;font-weight:500;color:#e8e9ea;margin:0 0 8px; }
  p    { font-size:14px;color:#7a7f84;line-height:1.7;margin:0 0 16px; }
  .label { font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#4a4f54;margin-bottom:4px; }
  .value { font-size:15px;color:#e8e9ea;margin-bottom:20px; }
  .action-btn { display:inline-block;padding:10px 20px;background:transparent;color:#7a7f84;font-size:13px;text-decoration:none;border-radius:8px;border:1px solid rgba(255,255,255,0.1);margin-right:8px;margin-top:8px; }
  .cal-btn    { display:inline-block;padding:10px 20px;background:transparent;color:#7a7f84;font-size:13px;text-decoration:none;border-radius:8px;border:1px solid rgba(255,255,255,0.1);margin-top:8px; }
  .meet-btn   { display:inline-block;padding:12px 24px;background:#3ddc84;color:#0d0f10;font-size:14px;font-weight:500;text-decoration:none;border-radius:8px; }
  .divider { height:1px;background:rgba(255,255,255,0.07);margin:24px 0; }
  .footer  { font-size:12px;color:#4a4f54;text-align:center;margin-top:24px; }
  .footer a { color:#3ddc84;text-decoration:none; }
  strong    { color:#e8e9ea;font-weight:500; }
  .note-box { background:#1c1f21;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 16px;margin-bottom:20px; }
  .note-box p { margin:0;font-size:13px;color:#a0a5aa; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateInTz(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    timeZone: tz, weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatTimeInTz(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

const ADMIN_TZ = "Europe/Madrid";

function googleCalendarUrl(params: {
  title: string; startIso: string; endIso: string;
  description: string; location: string;
}): string {
  const fmt = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const qs = new URLSearchParams({
    action: "TEMPLATE", text: params.title,
    dates: `${fmt(params.startIso)}/${fmt(params.endIso)}`,
    details: params.description, location: params.location,
  });
  return `https://calendar.google.com/calendar/render?${qs.toString()}`;
}

const RESCHEDULE_PATHS: Record<string, string> = {
  free15min: "/mentoria?reschedule=free15min",
  session1h: "/mentoria?reschedule=session1h",
  session2h: "/mentoria?reschedule=session2h",
  pack:      "/mentoria?reschedule=pack",
};

/** Exported for unit tests — sendConfirmationEmail itself can't be rendered under
 *  Jest (getTranslations needs Next's config resolution), so this pure slice of it
 *  is what pins the URL shape. */
export function rescheduleUrl(sessionType: string, cancelToken: string): string {
  return `${BASE_URL}${RESCHEDULE_PATHS[sessionType] ?? "/mentoria"}&token=${cancelToken}`;
}

// ─── Confirmation email (student) ─────────────────────────────────────────────

export async function sendConfirmationEmail(params: {
  to: string;
  studentName: string;
  sessionLabel: string;
  startIso: string;
  endIso: string;
  joinToken: string;
  cancelToken: string;
  note: string | null;
  studentTz: string | null;
  sessionType: string;
  locale: 'es' | 'en';
  cancelHours: number;
}): Promise<void> {
  const t = await getTranslations({ locale: params.locale, namespace: "emails.confirmation" });

  // ── Escape all user-controlled values ────────────────────────────────────
  const safeName         = escapeHtml(params.studentName);
  const safeSessionLabel = escapeHtml(params.sessionLabel);
  const safeNote         = params.note ? escapeHtml(params.note) : null;
  // joinToken, cancelToken, and URLs are system-generated — not user input.

  const tz         = params.studentTz ?? ADMIN_TZ;
  // SEC-05: join URL uses joinToken (session entry only); cancel URL uses cancelToken (cancel/reschedule only)
  const joinUrl    = `${BASE_URL}/sesion/${params.joinToken}`;
  const cancelUrl  = `${BASE_URL}/cancelar?token=${params.cancelToken}`;
  const reschedUrl = rescheduleUrl(params.sessionType, params.cancelToken);
  const dateLabel  = formatDate(params.startIso, params.locale, { weekday: "long" });
  const startLabel = formatTime(params.startIso, params.locale);
  const endLabel   = formatTime(params.endIso,   params.locale);
  const tzNote     = tz !== ADMIN_TZ
    ? ` ${t("tzNoteOther", { tz })}`
    : ` ${t("tzNoteMadrid")}`;

  const addToCalUrl = googleCalendarUrl({
    title:       t("calTitle", { sessionLabel: params.sessionLabel }),
    startIso:    params.startIso,
    endIso:      params.endIso,
    description: t("calDescription", { joinUrl }),
    location:    joinUrl,
  });

  await send({
    to: params.to,
    subject: t("subject", { sessionLabel: params.sessionLabel, dateLabel }),
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap"><div class="card">
        <h1>${t("heading")}</h1>
        <p>
          ${t.raw("intro").replace("{name}", `<strong>${safeName}</strong>`)}
        </p>

        <div class="label">${t("labelType")}</div>
        <div class="value">${safeSessionLabel}</div>

        <div class="label">${t("labelDate")}</div>
        <div class="value">${dateLabel}</div>

        <div class="label">${t("labelTime")}</div>
        <div class="value">${startLabel} – ${endLabel}${tzNote}</div>

        <div class="label">${t("labelLink")}</div>
        <div class="value" style="margin-bottom:8px">
          <a class="meet-btn" href="${joinUrl}">${t("joinBtn")}</a>
        </div>

        ${safeNote ? `
        <div class="label">${t("labelNote")}</div>
        <div class="note-box"><p>${safeNote}</p></div>
        ` : ""}

        <div class="divider"></div>

        <a class="cal-btn" href="${addToCalUrl}" target="_blank">${t("addToCal")}</a>

        <div class="divider"></div>

        <p style="font-size:13px">${t.raw("cancelPolicy").replace("{hours}", String(params.cancelHours))}</p>
        <a class="action-btn" href="${cancelUrl}">${t("cancelBtn")}</a>
        <a class="action-btn" href="${reschedUrl}">${t("rescheduleBtn")}</a>

      </div>
      <div class="footer">
        <p style="margin:0">Gustavo Torres Guerrero ·
          <a href="${BASE_URL}">gustavoai.dev</a> ·
          <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>
        </p>
      </div></div>
      </body></html>
    `,
  });
}

// ─── Cancellation confirmation (student) ──────────────────────────────────────

export async function sendCancellationConfirmationEmail(params: {
  to: string;
  studentName: string;
  sessionLabel: string;
  startIso: string;
  creditsRestored: boolean;
  locale: 'es' | 'en';
}): Promise<void> {
  const t = await getTranslations({ locale: params.locale, namespace: "emails.cancellation" });

  // ── Escape all user-controlled values ────────────────────────────────────
  const safeName         = escapeHtml(params.studentName);
  const safeSessionLabel = escapeHtml(params.sessionLabel);

  const dateLabel  = formatDate(params.startIso, params.locale, { weekday: "long" });
  const startLabel = formatTime(params.startIso, params.locale);

  const creditsHtml = t.raw("creditsRestoredMsg").replace("{baseUrl}", BASE_URL);

  await send({
    to: params.to,
    subject: t("subject", { sessionLabel: params.sessionLabel, dateLabel }),
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap"><div class="card">
        <h1>${t("heading")}</h1>
        <p>
          ${t.raw("intro").replace("{name}", `<strong>${safeName}</strong>`)}
        </p>
        <div class="label">${t("labelSession")}</div>
        <div class="value">${safeSessionLabel} · ${dateLabel} · ${startLabel}</div>
        ${params.creditsRestored ? `
          <p style="color:#3ddc84">${creditsHtml}</p>` : `
          <p>${t("refundMsg")}</p>`
        }
      </div>
      <div class="footer"><p style="margin:0">Gustavo Torres Guerrero ·
        <a href="${BASE_URL}">gustavoai.dev</a> · <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>
      </p></div></div></body></html>
    `,
  });
}

// ─── Cancellation notification (Gustavo) ──────────────────────────────────────

export async function sendCancellationNotificationEmail(params: {
  studentEmail: string; studentName: string;
  sessionLabel: string; startIso: string;
}): Promise<void> {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) return;

  // ── Escape all user-controlled values ────────────────────────────────────
  const safeName         = escapeHtml(params.studentName);
  const safeEmail        = escapeHtml(params.studentEmail);
  const safeSessionLabel = escapeHtml(params.sessionLabel);

  const dateLabel  = formatDateInTz(params.startIso, ADMIN_TZ);
  const startLabel = formatTimeInTz(params.startIso, ADMIN_TZ);

  await send({
    to: notifyEmail,
    subject: `❌ Sesión cancelada — ${params.studentName}`,
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap"><div class="card">
        <h1>Sesión individual cancelada</h1>
        <p><strong>${safeName}</strong> (${safeEmail})
          ha cancelado su sesión de <strong>${safeSessionLabel}</strong>
          del ${dateLabel} a las ${startLabel}.</p>
        <p>Gestiona el reembolso manualmente si procede.</p>
      </div></div></body></html>
    `,
  }, params.studentEmail);
}

// ─── Dead-letter failure notification (Gustavo) ──────────────────────────────

export async function sendDeadLetterNotificationEmail(params: {
  studentEmail: string;
  stripeSessionId: string;
  userId: string;
  startIso: string;
  error: string;
}): Promise<void> {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) return;

  const safeSessionId = escapeHtml(params.stripeSessionId);
  const safeUserId    = escapeHtml(params.userId);
  const safeStartIso  = escapeHtml(params.startIso);
  const safeError     = escapeHtml(params.error);

  await send({
    to: notifyEmail,
    subject: `⚠️ Reserva fallida — acción manual requerida`,
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap"><div class="card">
        <h1>Reserva fallida</h1>
        <p>No se pudo crear el evento de calendario para la reserva <strong>${safeSessionId}</strong>.</p>
        <div class="label">Usuario</div>
        <div class="value">${safeUserId}</div>
        <div class="label">Slot</div>
        <div class="value">${safeStartIso}</div>
        <div class="label">Error</div>
        <div class="note-box"><p>${safeError}</p></div>
        <p>El alumno ha pagado. Gestiona el reembolso o crea el evento manualmente.</p>
      </div></div></body></html>
    `,
  }, params.studentEmail);
}

// ─── Content error report notification (Gustavo) ─────────────────────────────
// CONTENT-FEEDBACK-01: a reader pressed "Reportar un error" on a lesson or post.
// Admin-facing, so Spanish and outside next-intl, like the dead-letter mail above.

export async function sendContentReportNotificationEmail(params: {
  reportId:      string;
  contentType:   "lesson" | "post";
  contentKey:    string;
  locale:        "es" | "en";
  pageUrl:       string;
  message:       string;
  reporterEmail: string | null;
}): Promise<void> {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) return;

  // ── Escape all reader-controlled values ──────────────────────────────────
  const safeKey     = escapeHtml(params.contentKey);
  const safeMessage = escapeHtml(params.message).replace(/\n/g, "<br>");
  const safeEmail   = params.reporterEmail ? escapeHtml(params.reporterEmail) : "anónimo";
  const safeUrl     = escapeHtml(params.pageUrl);
  const kind        = params.contentType === "lesson" ? "Lección" : "Artículo";
  const adminUrl    = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev"}/admin/feedback`;

  await send({
    to: notifyEmail,
    subject: `🐞 Reporte de error — ${params.contentKey}`,
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap"><div class="card">
        <h1>Reporte de error</h1>
        <p>Un lector ha reportado un error en ${kind.toLowerCase()} <strong>${safeKey}</strong> (${params.locale}).</p>
        <div class="label">${kind}</div>
        <div class="value"><a href="${safeUrl}" style="color:#e8e9ea">${safeUrl}</a></div>
        <div class="label">Reportado por</div>
        <div class="value">${safeEmail}</div>
        <div class="label">Mensaje</div>
        <div class="note-box"><p>${safeMessage}</p></div>
        <a class="action-btn" href="${adminUrl}">Ver en el panel</a>
      </div></div></body></html>
    `,
  }, params.reporterEmail ?? undefined);
}

// ─── Booking payment audit report (Gustavo) ──────────────────────────────────
// REFACTOR-R4-P3-03: upcoming classes whose payment is missing, refunded, disputed or
// doesn't match. Sent only when there are findings; nothing has been changed.

const PAYMENT_AUDIT_LABELS: Record<PaymentAuditCode, string> = {
  length_mismatch:            "La duración no corresponde al tipo de sesión",
  no_payment_link:            "Sin pago asociado",
  pack_not_owned:             "El pack pertenece a otro alumno",
  payment_not_found:          "Stripe no encuentra el pago",
  payment_not_succeeded:      "El pago no se completó",
  payment_refunded:           "Pago reembolsado",
  payment_partially_refunded: "Pago reembolsado en parte",
  payment_disputed:           "Pago en disputa",
  payment_mismatch:           "El pago no corresponde a esta clase",
};

const AUDIT_SESSION_LABELS: Record<SessionType, string> = {
  free15min: "Llamada gratuita 15 min",
  session1h: "Sesión 1h",
  session2h: "Sesión 2h",
  pack:      "Clase de pack",
};

export async function sendPaymentAuditReportEmail(report: PaymentAuditReport): Promise<void> {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) return;

  const errors  = report.findings.filter(f => f.severity === "error").length;
  const reviews = report.findings.length - errors;
  const subject = errors > 0
    ? `⚠️ Auditoría de pagos: ${errors} ${errors === 1 ? "incidencia" : "incidencias"}` +
      (reviews > 0 ? ` y ${reviews} para revisar` : "")
    : `🔎 Auditoría de pagos: ${reviews} para revisar`;

  const { byType } = report;
  const summary =
    `${report.checked} clases próximas revisadas: ${byType.session1h} de 1h, ${byType.session2h} de 2h, ` +
    `${byType.pack} de pack (${report.manualPackClasses} de packs manuales) y ${byType.free15min} gratuitas.`;

  // ── Escape every value that came from the database or from Stripe ────────
  const items = report.findings.map(f => {
    const when = `${formatDateInTz(f.startsAt, ADMIN_TZ)} · ${formatTimeInTz(f.startsAt, ADMIN_TZ)} (Madrid)`;
    const tag  = f.severity === "error" ? "Error" : "Revisar";
    const diffParts = [
      ...(f.expected ? [`Esperado: ${escapeHtml(f.expected)}`] : []),
      ...(f.actual   ? [`Encontrado: ${escapeHtml(f.actual)}`] : []),
    ];
    const diff = diffParts.length > 0 ? `<br>${diffParts.join(" · ")}` : "";
    return `
        <div class="note-box"><p>
          <strong>[${tag}] ${PAYMENT_AUDIT_LABELS[f.code] ?? escapeHtml(f.code)}</strong><br>
          ${escapeHtml(f.email)} · ${AUDIT_SESSION_LABELS[f.sessionType] ?? escapeHtml(f.sessionType)} · ${when}<br>
          Pago: ${f.paymentId ? escapeHtml(f.paymentId) : "ninguno"} · Reserva: ${escapeHtml(f.bookingId)}${diff}
        </p></div>`;
  }).join("");

  await send({
    to: notifyEmail,
    subject,
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap"><div class="card">
        <h1>Auditoría de pagos</h1>
        <p>${summary}</p>
        <p>Estas clases próximas no cuadran con su pago. No se ha cambiado nada: revisa cada caso
          en Stripe y decide si cancelar la clase, cobrarla o dejarla como está.</p>
        ${items}
      </div></div></body></html>
    `,
  });
}

// ─── New booking notification (Gustavo) ───────────────────────────────────────

export async function sendNewBookingNotificationEmail(params: {
  studentEmail: string; studentName: string;
  sessionLabel: string; startIso: string; endIso: string;
  joinUrl: string; note: string | null;
}): Promise<void> {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) return;

  // ── Escape all user-controlled values ────────────────────────────────────
  const safeName         = escapeHtml(params.studentName);
  const safeEmail        = escapeHtml(params.studentEmail);
  const safeSessionLabel = escapeHtml(params.sessionLabel);
  const safeNote         = params.note ? escapeHtml(params.note) : null;

  const dateLabel  = formatDateInTz(params.startIso, ADMIN_TZ);
  const startLabel = formatTimeInTz(params.startIso, ADMIN_TZ);
  const endLabel   = formatTimeInTz(params.endIso,   ADMIN_TZ);

  await send({
    to: notifyEmail,
    subject: `📅 Nueva reserva — ${params.studentName} · ${dateLabel}`,
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap"><div class="card">
        <h1>Nueva reserva</h1>
        <div class="label">Alumno</div>
        <div class="value">${safeName} · ${safeEmail}</div>
        <div class="label">Sesión</div>
        <div class="value">${safeSessionLabel}</div>
        <div class="label">Fecha y hora (Madrid)</div>
        <div class="value">${dateLabel} · ${startLabel}–${endLabel}</div>
        ${safeNote ? `
        <div class="label">Motivo indicado por el alumno</div>
        <div class="note-box"><p>${safeNote}</p></div>` : ""}
        <div style="margin-top:8px">
          <a class="meet-btn" href="${params.joinUrl}">Unirse a la sesión →</a>
        </div>
      </div></div></body></html>
    `,
  }, params.studentEmail);
}

// ─── Course announcement (bulk, COURSE-P6-02) ─────────────────────────────────

/** Kind → message namespace. Exported so a test can pin the mapping without rendering
 *  (the templates cannot be rendered under Jest — `getTranslations` needs Next's config). */
export const ANNOUNCEMENT_NAMESPACE: Record<AnnouncementKind, string> = {
  launch:  "emails.courseLaunch",
  english: "emails.courseEnglish",
  update:  "emails.courseUpdate",
};

export interface CourseNewsParams {
  to:              string;
  locale:          'es' | 'en';
  kind:            AnnouncementKind;
  courseSlug:      string;
  courseTitle:     string;
  lessonCount:     number;
  firstLessonSlug: string | null;
  /** The single admin-typed "what's new" line. `update` only; ignored by the other kinds.
   *  This is the one operator-supplied string in the template — escaped like the rest. */
  whatsNew?:       string;
}

/**
 * Every URL the announcement links to. Split out of the template because it is the part with
 * a rule worth pinning, and unlike the template it can actually be tested — no getTranslations,
 * so no Next config resolution.
 *
 * The rule: ONE locale for every course link, the reader's — except `english`, which is about
 * the /en tree by definition and points there whatever language it is written in.
 *
 * Explicitly NOT the lessons' own `contentLocale`. An untranslated lesson still has a real page
 * under /en: the reader route resolves per lesson and shows the "not translated yet" notice,
 * noindex with a canonical back to the Spanish original (src/lib/courses/catalog-view.ts).
 * Using contentLocale sent an English reader to the unprefixed URL — the same Spanish prose,
 * but wrapped in a fully Spanish site, and disagreeing with the landing button beside it.
 */
export function announcementUrls(params: {
  kind:            AnnouncementKind;
  locale:          "es" | "en";
  courseSlug:      string;
  firstLessonSlug: string | null;
}): { landingUrl: string; lessonUrl: string | null; unsubUrl: string } {
  const linkLocale = params.kind === "english" ? "en" : params.locale;

  return {
    landingUrl: localeUrl(`/cursos/${params.courseSlug}`, linkLocale),
    lessonUrl:  params.firstLessonSlug
      ? localeUrl(`/cursos/${params.courseSlug}/${params.firstLessonSlug}`, linkLocale)
      : null,
    // The notify card on the catalog IS the unsubscribe control — no token needed, because
    // subscribing required a signed-in account in the first place. It stays in the reader's
    // locale even when the announcement itself points at /en.
    unsubUrl: `${localeUrl("/cursos", params.locale)}#notificaciones`,
  };
}

/**
 * Renders the announcement without sending it. The admin route calls this for its dry run,
 * which is the only way to read the real thing before it is irreversible.
 */
export async function renderCourseNewsEmail(
  params: Omit<CourseNewsParams, "to">,
): Promise<{ subject: string; html: string }> {
  const t = await getTranslations({
    locale:    params.locale,
    namespace: ANNOUNCEMENT_NAMESPACE[params.kind],
  });

  // Course titles come from a git-versioned manifest, not user input — but this file's rule
  // is that everything interpolated into HTML is escaped, and a rule with exceptions is not
  // a rule. (CRIT-04)
  const safeTitle = escapeHtml(params.courseTitle);

  const { landingUrl, lessonUrl, unsubUrl } = announcementUrls(params);

  // `body1` carries <strong>, so it comes through t.raw() and its placeholders are filled in
  // by hand — with values that were escaped above. `{lessonCount}` only appears in `launch`.
  const body1Html = t.raw("body1")
    .replace("{courseTitle}", safeTitle)
    .replace("{lessonCount}", String(params.lessonCount));

  const whatsNewHtml = params.kind === "update" && params.whatsNew
    ? `<div class="note-box">
         <div class="label">${t("whatsNewLabel")}</div>
         <p>${escapeHtml(params.whatsNew)}</p>
       </div>`
    : "";

  // No first-lesson button on an update: someone already partway through the course does not
  // want to be sent back to lesson one.
  const lessonCtaHtml = params.kind !== "update" && lessonUrl
    ? `<a class="meet-btn" href="${lessonUrl}">${t("cta")}</a>`
    : "";

  return {
    subject: t("subject", { courseTitle: params.courseTitle }),
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap"><div class="card">
        <h1>${t("heading")}</h1>
        <p>${t("intro")}</p>

        <p>${body1Html}</p>
        ${whatsNewHtml}
        <p>${t("body2")}</p>

        <div class="divider"></div>

        ${lessonCtaHtml}
        <a class="action-btn" href="${landingUrl}">${t("landingCta")}</a>

      </div>
      <div class="footer">
        <p style="margin:0 0 6px"><a href="${unsubUrl}">${t("unsubscribe")}</a></p>
        <p style="margin:0">Gustavo Torres Guerrero ·
          <a href="${BASE_URL}">gustavoai.dev</a> ·
          <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>
        </p>
      </div></div>
      </body></html>
    `,
  };
}

export async function sendCourseNewsEmail(params: CourseNewsParams): Promise<void> {
  const { to, ...rest } = params;
  const { subject, html } = await renderCourseNewsEmail(rest);
  await send({ to, subject, html });
}
