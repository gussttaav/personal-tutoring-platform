/**
 * lib/email.ts — all transactional emails via Resend.
 *
 * SECURITY FIX (CRIT-04): All user-controlled values (studentName, note,
 * studentEmail, sessionLabel) are now passed through escapeHtml() before
 * being interpolated into HTML strings. Without this, a student whose name
 * contained HTML tags could execute arbitrary JavaScript in the recipient's
 * email client (stored XSS).
 */

import { getTranslations } from "next-intl/server";
import { formatDate, formatTime } from "@/lib/formatting";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM     = process.env.RESEND_FROM ?? "Gustavo Torres <onboarding@resend.dev>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.gustavoai.dev";

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
    console.info(`[email] test booking — skipped send to ${payload.to}`);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn("[email] RESEND_API_KEY not set"); return; }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, ...payload }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[email] Resend error ${res.status}: ${body}`);
    console.error(`[email] FROM: ${FROM} — if 403, set RESEND_FROM=onboarding@resend.dev`);
  } else {
    const data = await res.json();
    console.info(`[email] Sent to ${payload.to} — id: ${(data as { id?: string }).id}`);
  }
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
  free15min: "/?reschedule=free15min",
  session1h: "/?reschedule=session1h",
  session2h: "/?reschedule=session2h",
  pack:      "/?reschedule=pack",
};

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
  const reschedUrl = `${BASE_URL}${RESCHEDULE_PATHS[params.sessionType] ?? "/"}&token=${params.cancelToken}`;
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

        <p style="font-size:13px">${t.raw("cancelPolicy")}</p>
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
