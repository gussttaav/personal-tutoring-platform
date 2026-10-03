/**
 * @jest-environment jsdom
 */
// BOOKING-ATTRIBUTION-01: first-touch capture, request labelling and the Stripe
// metadata round trip.
import {
  ATTRIBUTION_STORAGE_KEY,
  ATTRIBUTION_TTL_DAYS,
  MOBILE_APP_ATTRIBUTION,
  attributionFromMetadata,
  attributionToMetadata,
  captureFirstTouch,
  parseLandingAttribution,
  readStoredAttribution,
  resolveRequestAttribution,
  selectFirstTouch,
} from "../attribution";

const SITE = "https://www.gustavoai.dev";
const DAY  = 86_400_000;

describe("parseLandingAttribution", () => {
  it("reads the UTM tags, lowercased, plus the landing path", () => {
    expect(parseLandingAttribution(
      `${SITE}/mentoria?utm_source=LinkedIn&utm_medium=profile&utm_campaign=topcard#sessions`,
      "https://www.linkedin.com/",
    )).toEqual({
      source: "linkedin", medium: "profile", campaign: "topcard",
      referrerHost: "linkedin.com", landingPath: "/mentoria",
    });
  });

  it("falls back to an external referrer's host when there are no tags", () => {
    expect(parseLandingAttribution(`${SITE}/blog/rag?x=1`, "https://www.google.com/search?q=secret"))
      .toEqual({ referrerHost: "google.com", landingPath: "/blog/rag" });
  });

  it("ignores direct visits, our own pages, and OAuth / Stripe hops", () => {
    expect(parseLandingAttribution(`${SITE}/`, "")).toBeNull();
    expect(parseLandingAttribution(`${SITE}/mentoria`, `${SITE}/`)).toBeNull();
    expect(parseLandingAttribution(`${SITE}/mentoria`, "https://gustavoai.dev/en")).toBeNull();
    expect(parseLandingAttribution(`${SITE}/mentoria`, "https://accounts.google.com/")).toBeNull();
    expect(parseLandingAttribution(`${SITE}/mentoria`, "https://hooks.stripe.com/x")).toBeNull();
  });

  it("caps long values to the column limits", () => {
    const a = parseLandingAttribution(`${SITE}/?utm_source=${"x".repeat(300)}`, "");
    expect(a?.source).toHaveLength(100);
  });

  it("returns null for a malformed URL", () => {
    expect(parseLandingAttribution("not a url", "")).toBeNull();
  });
});

describe("selectFirstTouch", () => {
  const stored = { attribution: { source: "linkedin" }, capturedAt: 1_000 };

  it("keeps an unexpired first touch over a newer visit", () => {
    expect(selectFirstTouch(stored, { source: "x" }, 1_000 + DAY)).toBe(stored);
  });

  it("replaces an expired first touch", () => {
    const now = 1_000 + ATTRIBUTION_TTL_DAYS * DAY;
    expect(selectFirstTouch(stored, { source: "x" }, now))
      .toEqual({ attribution: { source: "x" }, capturedAt: now });
  });

  it("a direct visit never clears or creates anything", () => {
    expect(selectFirstTouch(null, null, 5)).toBeNull();
    expect(selectFirstTouch(stored, null, 5)).toBe(stored);
  });
});

describe("captureFirstTouch / readStoredAttribution", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores the first attributed visit and keeps it", () => {
    captureFirstTouch(`${SITE}/mentoria?utm_source=linkedin`, "", 1_000);
    captureFirstTouch(`${SITE}/?utm_source=x`, "https://google.com/", 2_000);
    expect(readStoredAttribution(3_000)).toEqual({ source: "linkedin", landingPath: "/mentoria" });
  });

  it("reads nothing once expired, and survives garbage in storage", () => {
    captureFirstTouch(`${SITE}/?utm_source=linkedin`, "", 0);
    expect(readStoredAttribution(ATTRIBUTION_TTL_DAYS * DAY)).toBeUndefined();
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, "{not json");
    expect(readStoredAttribution()).toBeUndefined();
  });
});

describe("resolveRequestAttribution", () => {
  it("keeps what the browser sent", () => {
    expect(resolveRequestAttribution(false, { source: "linkedin" })).toEqual({ source: "linkedin" });
  });

  it("labels the mobile app, which sends nothing", () => {
    expect(resolveRequestAttribution(true, undefined)).toEqual(MOBILE_APP_ATTRIBUTION);
    expect(resolveRequestAttribution(true, {})).toEqual(MOBILE_APP_ATTRIBUTION);
  });

  it("leaves a direct web booking without a source", () => {
    expect(resolveRequestAttribution(false, undefined)).toBeUndefined();
  });
});

describe("Stripe metadata round trip", () => {
  it("maps to the bookings column names and back, dropping empty fields", () => {
    const a = { source: "linkedin", campaign: "featured", landingPath: "/en/mentoria" };
    const md = attributionToMetadata(a);
    expect(md).toEqual({ utm_source: "linkedin", utm_campaign: "featured", landing_path: "/en/mentoria" });
    expect(attributionFromMetadata({ ...md, student_email: "a@b.c", utm_medium: "" })).toEqual(a);
  });

  it("is empty for no attribution", () => {
    expect(attributionToMetadata(undefined)).toEqual({});
    expect(attributionFromMetadata({ student_email: "a@b.c" })).toBeUndefined();
    expect(attributionFromMetadata(null)).toBeUndefined();
  });
});
