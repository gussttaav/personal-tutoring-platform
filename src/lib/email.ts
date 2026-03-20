/**
 * All transactional emails sent via Resend.
 * Every email comes from contacto@gustavoai.dev with Gustavo's branding.
 *
 * Env vars required:
 *   RESEND_API_KEY
 *   NOTIFY_EMAIL     ← Gustavo's notification address
 *   NEXT_PUBLIC_BASE_URL
 */

const RESEND_API_URL = "https://api.resend.com/emails";
// Use RESEND_FROM env var if set (requires verified domain in Resend dashboard).
// Falls back to Resend's default sender which works without domain verification.
const FROM    = process.env.RESEND_FROM ?? "Gustavo Torres <onboarding@resend.dev>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

async function send(payload: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send");
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, ...payload }),
  });

  if (!res.ok) {
    const body = await res.text();
    // Log clearly — Resend returns 403 if the FROM domain isn't verified
    console.error(`[email] Resend error ${res.status}: ${body}`);
    console.error(`[email] FROM address used: ${FROM}`);
    console.error(`[email] If 403: verify domain in Resend dashboard or set RESEND_FROM=onboarding@resend.dev`);
  } else {
    const data = await res.json();
    console.info(`[email] Sent to ${payload.to} — id: ${(data as { id?: string }).id}`);
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const STYLES = `
  body { margin: 0; padding: 0; background: #0d0f10; font-family: 'DM Sans', -apple-system, sans-serif; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
  .card { background: #141618; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; }
  h1 { font-size: 22px; font-weight: 500; color: #e8e9ea; margin: 0 0 8px; }
  p  { font-size: 14px; color: #7a7f84; line-height: 1.7; margin: 0 0 16px; }
  .label { font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #4a4f54; margin-bottom: 4px; }
  .value { font-size: 15px; color: #e8e9ea; margin-bottom: 20px; }
  .meet-btn { display: inline-block; padding: 12px 24px; background: #3ddc84; color: #0d0f10; font-size: 14px; font-weight: 500; text-decoration: none; border-radius: 8px; }
  .cal-btn  { display: inline-block; padding: 10px 20px; background: transparent; color: #7a7f84; font-size: 13px; text-decoration: none; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); margin-top: 10px; }
  .divider { height: 1px; background: rgba(255,255,255,0.07); margin: 24px 0; }
  .footer { font-size: 12px; color: #4a4f54; text-align: center; margin-top: 24px; }
  .footer a { color: #3ddc84; text-decoration: none; }
  strong { color: #e8e9ea; font-weight: 500; }
`;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/**
 * Generates a Google Calendar "Add to Calendar" URL.
 * Opens a pre-filled event creation page in Google Calendar.
 */
function googleCalendarUrl(params: {
  title: string;
  startIso: string;
  endIso: string;
  description: string;
  location: string;
}): string {
  // Google Calendar expects dates in YYYYMMDDTHHMMSSZ format
  const fmt = (iso: string) =>
    iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const qs = new URLSearchParams({
    action:   "TEMPLATE",
    text:     params.title,
    dates:    `${fmt(params.startIso)}/${fmt(params.endIso)}`,
    details:  params.description,
    location: params.location,
  });

  return `https://calendar.google.com/calendar/render?${qs.toString()}`;
}

// ─── Confirmation email ───────────────────────────────────────────────────────

export async function sendConfirmationEmail(params: {
  to: string;
  studentName: string;
  sessionLabel: string;
  startIso: string;
  endIso: string;
  meetLink: string;
  cancelToken: string;
}): Promise<void> {
  const cancelUrl     = `${BASE_URL}/cancelar?token=${params.cancelToken}`;
  const dateLabel     = formatDate(params.startIso);
  const startLabel    = formatTime(params.startIso);
  const endLabel      = formatTime(params.endIso);
  const addToCalUrl   = googleCalendarUrl({
    title:       `${params.sessionLabel} con Gustavo Torres`,
    startIso:    params.startIso,
    endIso:      params.endIso,
    description: `Enlace Google Meet: ${params.meetLink}\n\nClase con Gustavo Torres Guerrero — gustavoai.dev`,
    location:    params.meetLink,
  });

  await send({
    to: params.to,
    subject: `Clase confirmada · ${params.sessionLabel} · ${dateLabel}`,
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap">
        <div class="card">
          <h1>¡Clase confirmada! ✓</h1>
          <p>Hola <strong>${params.studentName}</strong>, tu reserva ha quedado confirmada.</p>

          <div class="label">Tipo de sesión</div>
          <div class="value">${params.sessionLabel}</div>

          <div class="label">Fecha</div>
          <div class="value">${dateLabel}</div>

          <div class="label">Hora</div>
          <div class="value">${startLabel} – ${endLabel} (hora de Madrid)</div>

          <div class="label">Enlace de Google Meet</div>
          <div style="margin-bottom: 24px;">
            <a class="meet-btn" href="${params.meetLink}">Unirse a Google Meet →</a>
            <br>
            <a class="cal-btn" href="${addToCalUrl}" target="_blank">📅 Añadir a Google Calendar</a>
          </div>

          <div class="divider"></div>

          <p style="font-size: 13px;">
            Si necesitas cancelar o reprogramar, puedes hacerlo hasta
            <strong>2 horas antes</strong> de la sesión sin ningún coste.
          </p>

          <p style="margin: 0;">
            <a href="${cancelUrl}" style="color: #3ddc84; font-size: 13px;">
              Cancelar esta reserva →
            </a>
          </p>
        </div>

        <div class="footer">
          <p style="margin: 0;">
            Gustavo Torres Guerrero ·
            <a href="${BASE_URL}">gustavoai.dev</a> ·
            <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>
          </p>
        </div>
      </div>
      </body></html>
    `,
  });
}

// ─── Cancellation confirmation to student ────────────────────────────────────

export async function sendCancellationConfirmationEmail(params: {
  to: string;
  studentName: string;
  sessionLabel: string;
  startIso: string;
  creditsRestored: boolean;
}): Promise<void> {
  const dateLabel  = formatDate(params.startIso);
  const startLabel = formatTime(params.startIso);

  await send({
    to: params.to,
    subject: `Reserva cancelada · ${params.sessionLabel} · ${dateLabel}`,
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap">
        <div class="card">
          <h1>Reserva cancelada</h1>
          <p>Hola <strong>${params.studentName}</strong>, hemos cancelado tu reserva.</p>

          <div class="label">Sesión cancelada</div>
          <div class="value">${params.sessionLabel} · ${dateLabel} · ${startLabel}</div>

          ${params.creditsRestored ? `
            <p style="color: #3ddc84;">
              ✓ Tu crédito ha sido devuelto automáticamente a tu pack.
              Puedes reservar otra clase cuando quieras desde
              <a href="${BASE_URL}" style="color: #3ddc84;">gustavoai.dev</a>.
            </p>
          ` : `
            <p>
              Si pagaste por esta sesión individualmente, Gustavo tramitará
              el reembolso en un plazo de 1–3 días hábiles.
            </p>
          `}
        </div>
        <div class="footer">
          <p style="margin: 0;">
            Gustavo Torres Guerrero ·
            <a href="${BASE_URL}">gustavoai.dev</a> ·
            <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>
          </p>
        </div>
      </div>
      </body></html>
    `,
  });
}

// ─── Notification to Gustavo (single session cancellation) ───────────────────

export async function sendCancellationNotificationEmail(params: {
  studentEmail: string;
  studentName: string;
  sessionLabel: string;
  startIso: string;
}): Promise<void> {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) return;

  const dateLabel  = formatDate(params.startIso);
  const startLabel = formatTime(params.startIso);

  await send({
    to: notifyEmail,
    subject: `❌ Sesión cancelada — ${params.studentName}`,
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap">
        <div class="card">
          <h1>Sesión individual cancelada</h1>
          <p>
            <strong>${params.studentName}</strong> (${params.studentEmail})
            ha cancelado su sesión de <strong>${params.sessionLabel}</strong>
            del ${dateLabel} a las ${startLabel}.
          </p>
          <p>Gestiona el reembolso manualmente si procede.</p>
        </div>
      </div>
      </body></html>
    `,
  });
}

// ─── New booking notification to Gustavo ─────────────────────────────────────

export async function sendNewBookingNotificationEmail(params: {
  studentEmail: string;
  studentName: string;
  sessionLabel: string;
  startIso: string;
  endIso: string;
  meetLink: string;
}): Promise<void> {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) return;

  const dateLabel  = formatDate(params.startIso);
  const startLabel = formatTime(params.startIso);
  const endLabel   = formatTime(params.endIso);

  await send({
    to: notifyEmail,
    subject: `📅 Nueva reserva — ${params.studentName} · ${dateLabel}`,
    html: `
      <html><head><style>${STYLES}</style></head><body>
      <div class="wrap">
        <div class="card">
          <h1>Nueva reserva</h1>

          <div class="label">Alumno</div>
          <div class="value">${params.studentName} · ${params.studentEmail}</div>

          <div class="label">Sesión</div>
          <div class="value">${params.sessionLabel}</div>

          <div class="label">Fecha y hora</div>
          <div class="value">${dateLabel} · ${startLabel}–${endLabel}</div>

          <div style="margin-top: 8px;">
            <a class="meet-btn" href="${params.meetLink}">Abrir Google Meet →</a>
          </div>
        </div>
      </div>
      </body></html>
    `,
  });
}
