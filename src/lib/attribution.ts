/**
 * lib/attribution.ts — first-touch booking attribution (BOOKING-ATTRIBUTION-01)
 *
 * Answers "where did the student who booked this class come from?". On the first
 * page load of a visit, `AttributionCapture` (root layout) hands the URL and
 * `document.referrer` to `captureFirstTouch`, which stores the visit in localStorage
 * if it is ATTRIBUTED (UTM tags, or else an external referrer) and nothing unexpired
 * is stored yet. `api-client` then sends `readStoredAttribution()` with every booking
 * and paid checkout, and the server persists it on the bookings row.
 *
 * First touch, deliberately: a visitor who arrives from a LinkedIn post and books a
 * week later from a Google search is credited to LinkedIn. Direct visits never
 * overwrite anything (they carry no information), and an entry expires after
 * ATTRIBUTION_TTL_DAYS so a stale source does not claim a booking months later.
 *
 * The mobile app has no landing page and sends nothing; the routes label its
 * requests (cookieless bearer) with MOBILE_APP_ATTRIBUTION via `resolveRequestAttribution`.
 *
 * Pure apart from the two storage helpers, which no-op outside a browser.
 */

import type { BookingAttribution } from "@/domain/types";

export const ATTRIBUTION_STORAGE_KEY = "gai:attribution:v1";
export const ATTRIBUTION_TTL_DAYS    = 90;

export const MOBILE_APP_ATTRIBUTION: BookingAttribution = { source: "mobile_app", medium: "app" };

// Referrers that are a hop inside our own flows (OAuth redirect fallback, Stripe
// 3-D Secure / redirect methods), not a place a visitor came from.
const INTERNAL_REFERRER_HOSTS = [/(^|\.)accounts\.google\.com$/, /(^|\.)stripe\.com$/];

const MAX_TAG  = 100; // utm_* — mirrors AttributionSchema / migration 0025
const MAX_HOST = 200;
const MAX_PATH = 200;

interface StoredAttribution {
  attribution: BookingAttribution;
  capturedAt:  number; // ms since epoch
}

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function tag(value: string | null): string | undefined {
  const v = value?.trim().toLowerCase().slice(0, MAX_TAG);
  return v ? v : undefined;
}

/**
 * The attribution a page load carries, or null when it is a direct / internal
 * visit. UTM tags win; without them an external referrer's hostname is kept.
 */
export function parseLandingAttribution(href: string, referrer: string): BookingAttribution | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }

  const landingPath = url.pathname.slice(0, MAX_PATH) || undefined;

  let referrerHost: string | undefined;
  if (referrer) {
    try {
      const host = bareHost(new URL(referrer).hostname);
      const internal = host === bareHost(url.hostname)
        || INTERNAL_REFERRER_HOSTS.some((re) => re.test(host));
      if (host && !internal) referrerHost = host.slice(0, MAX_HOST);
    } catch { /* malformed referrer — ignore */ }
  }

  const source = tag(url.searchParams.get("utm_source"));
  if (source) {
    return compact({
      source,
      medium:   tag(url.searchParams.get("utm_medium")),
      campaign: tag(url.searchParams.get("utm_campaign")),
      referrerHost,
      landingPath,
    });
  }
  if (referrerHost) return compact({ referrerHost, landingPath });
  return null;
}

/** Keeps the stored first touch unless it is missing or expired. Returns what is stored after. */
export function selectFirstTouch(
  stored:    StoredAttribution | null,
  candidate: BookingAttribution | null,
  nowMs:     number,
): StoredAttribution | null {
  const fresh = stored && nowMs - stored.capturedAt < ATTRIBUTION_TTL_DAYS * 86_400_000 ? stored : null;
  if (fresh) return fresh;
  return candidate ? { attribution: candidate, capturedAt: nowMs } : null;
}

/**
 * Server side: the attribution to persist for a request. A cookieless bearer request
 * is the mobile app, which never sends one of its own.
 */
export function resolveRequestAttribution(
  isMobileApp: boolean,
  fromBody:    BookingAttribution | undefined,
): BookingAttribution | undefined {
  if (fromBody && Object.keys(fromBody).length > 0) return fromBody;
  return isMobileApp ? MOBILE_APP_ATTRIBUTION : undefined;
}

// ─── Browser storage ─────────────────────────────────────────────────────────

function readStored(): StoredAttribution | null {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttribution;
    return parsed && typeof parsed.capturedAt === "number" && parsed.attribution ? parsed : null;
  } catch {
    return null;
  }
}

/** Called once per full page load by AttributionCapture. */
export function captureFirstTouch(href: string, referrer: string, nowMs = Date.now()): void {
  if (typeof window === "undefined") return;
  const stored = readStored();
  const next   = selectFirstTouch(stored, parseLandingAttribution(href, referrer), nowMs);
  if (!next || next === stored) return;
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
  } catch { /* storage blocked (private mode) — attribution is best-effort */ }
}

/** The stored first touch, if any and unexpired. Safe to call anywhere. */
export function readStoredAttribution(nowMs = Date.now()): BookingAttribution | undefined {
  if (typeof window === "undefined") return undefined;
  return selectFirstTouch(readStored(), null, nowMs)?.attribution;
}

function compact(a: BookingAttribution): BookingAttribution {
  return Object.fromEntries(
    Object.entries(a).filter(([, v]) => v !== undefined),
  ) as BookingAttribution;
}

// ─── Stripe metadata (paid classes) ──────────────────────────────────────────
// A paid class is booked by the webhook, so its source rides the PaymentIntent
// metadata. Keys match the bookings columns; absent fields are left out (Stripe
// metadata values must be non-empty strings to be stored).

const METADATA_KEYS = {
  source:       "utm_source",
  medium:       "utm_medium",
  campaign:     "utm_campaign",
  referrerHost: "referrer_host",
  landingPath:  "landing_path",
} as const satisfies Record<keyof BookingAttribution, string>;

export function attributionToMetadata(a: BookingAttribution | undefined): Record<string, string> {
  if (!a) return {};
  const out: Record<string, string> = {};
  for (const [field, key] of Object.entries(METADATA_KEYS)) {
    const v = a[field as keyof BookingAttribution];
    if (v) out[key] = v;
  }
  return out;
}

export function attributionFromMetadata(
  metadata: Record<string, string> | null | undefined,
): BookingAttribution | undefined {
  if (!metadata) return undefined;
  const out: BookingAttribution = {};
  for (const [field, key] of Object.entries(METADATA_KEYS)) {
    const v = metadata[key];
    if (v) out[field as keyof BookingAttribution] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
