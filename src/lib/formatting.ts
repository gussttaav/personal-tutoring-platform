const TZ = 'Europe/Madrid';

type Locale = 'es' | 'en';

function tag(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'es-ES';
}

export function formatDate(
  date: Date | string,
  locale: Locale,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(tag(locale), {
    timeZone: TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...opts,
  }).format(typeof date === 'string' ? new Date(date) : date);
}

export function formatTime(
  date: Date | string,
  locale: Locale,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(tag(locale), {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  }).format(typeof date === 'string' ? new Date(date) : date);
}

/**
 * Localized relative time — "en 2 días", "hace 6 días", "in 3 hours".
 *
 * Picks the coarsest unit that still reads naturally: days beyond 24h, then
 * hours, then minutes, falling back to "now" under a minute. Bilingual by way
 * of Intl.RelativeTimeFormat — unlike relativeTime() in
 * src/components/admin/format.ts, which hardcodes Spanish for the admin panel.
 */
export function formatRelative(
  date: Date | string,
  locale: Locale,
  now: Date = new Date(),
): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  const diffMs = target.getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: 'auto' });

  const absMinutes = Math.abs(diffMs) / 60_000;
  const sign = diffMs < 0 ? -1 : 1;

  if (absMinutes < 1) return rtf.format(0, 'minute');
  if (absMinutes < 60) return rtf.format(sign * Math.round(absMinutes), 'minute');

  const absHours = absMinutes / 60;
  if (absHours < 24) return rtf.format(sign * Math.round(absHours), 'hour');

  return rtf.format(sign * Math.round(absHours / 24), 'day');
}

export function formatCurrency(
  amount: number,
  locale: Locale,
  currency = 'EUR',
): string {
  return new Intl.NumberFormat(tag(locale), {
    style: 'currency',
    currency,
  }).format(amount);
}
