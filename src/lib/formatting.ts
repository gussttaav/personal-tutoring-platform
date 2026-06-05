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
