/**
 * lib/attribution.ts — first-touch booking attribution (BOOKING-ATTRIBUTION-01)
 *
 * Answers "where did the student who booked this class come from?". On the first
 * page load of a visit, `AttributionCapture` (root layout) hands the URL and
 * `document.referrer` to `captureFirstTouch`, which keeps the visit in memory if it is
 * ATTRIBUTED (UTM tags, or else an external referrer) and nothing is kept yet.
 * `api-client` then sends `readPageAttribution()` with every booking and paid
 * checkout, and the server records it on the student's users row at their FIRST
 * booking only (IUserRepository.recordFirstBooking).
 *
 * ATTRIBUTION-MEMORY-01: memory only, nothing is written to the visitor's device.
 * Storing it (localStorage, 90 days, until 2026-11) was marketing measurement, which
 * the cookie rules (LSSI-CE art. 22.2 / ePrivacy art. 5(3)) only allow with consent;
 * keeping it in a module variable needs none. The price: it lives as long as the
 * page's JavaScript does. A booking made in the same tab after in-app navigation is
 * credited (the PaymentIntent metadata carries a paid class past the Stripe step);
 * a reload, a new tab, a later visit or the full-page OAuth fallback starts with
 * nothing. Direct visits never overwrite anything (they carry no information). Any
 * entry a browser kept from before is deleted on the first load.
 *
 * The mobile app has no landing page and sends nothing; the routes label its
 * requests (cookieless bearer) with MOBILE_APP_ATTRIBUTION via `resolveRequestAttribution`.
 *
 * Pure apart from the in-memory first touch, which stays empty outside a browser.
 */

import type { BookingAttribution } from "@/domain/types";

/** Where the first touch used to be stored; only read to delete it (ATTRIBUTION-MEMORY-01). */
export const LEGACY_ATTRIBUTION_STORAGE_KEY = "gai:attribution:v1";

export const MOBILE_APP_ATTRIBUTION: BookingAttribution = { source: "mobile_app", medium: "app" };

// Referrers that are a hop inside our own flows (OAuth redirect fallback, Stripe
// 3-D Secure / redirect methods), not a place a visitor came from.
const INTERNAL_REFERRER_HOSTS = [/(^|\.)accounts\.google\.com$/, /(^|\.)stripe\.com$/];

const MAX_TAG  = 100; // utm_* — mirrors AttributionSchema / migration 0025
const MAX_HOST = 200;
const MAX_PATH = 200;

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

// ─── In-memory first touch ───────────────────────────────────────────────────

let firstTouch: BookingAttribution | null = null;

/** Called once per full page load by AttributionCapture. Keeps the first attributed touch. */
export function captureFirstTouch(href: string, referrer: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_ATTRIBUTION_STORAGE_KEY);
  } catch { /* storage blocked (private mode) — nothing was stored there either */ }
  firstTouch ??= parseLandingAttribution(href, referrer);
}

/** This page's first touch, if any. Safe to call anywhere. */
export function readPageAttribution(): BookingAttribution | undefined {
  return firstTouch ?? undefined;
}

/** Test-only: forget the first touch, as a new page load would. */
export function __resetPageAttribution(): void {
  firstTouch = null;
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
