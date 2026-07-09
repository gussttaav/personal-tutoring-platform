// Curated list of IANA timezones offered in the admin schedule picker.
// Kept short and relevant (teacher's locale + common student locales) so the
// dropdown stays usable and the server can validate against a known allowlist.
export const SUPPORTED_TIMEZONES = [
  "Europe/Madrid",
  "Atlantic/Canary",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Bogota",
  "America/Argentina/Buenos_Aires",
] as const;

export type SupportedTimezone = (typeof SUPPORTED_TIMEZONES)[number];

export function isSupportedTimezone(tz: string): tz is SupportedTimezone {
  return (SUPPORTED_TIMEZONES as readonly string[]).includes(tz);
}
