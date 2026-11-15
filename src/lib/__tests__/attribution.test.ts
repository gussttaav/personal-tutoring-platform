/**
 * @jest-environment jsdom
 */
// BOOKING-ATTRIBUTION-01: first-touch capture, request labelling and the Stripe
// metadata round trip. ATTRIBUTION-MEMORY-01: the first touch lives in memory only.
import {
  LEGACY_ATTRIBUTION_STORAGE_KEY,
  MOBILE_APP_ATTRIBUTION,
  __resetPageAttribution,
  attributionFromMetadata,
  attributionToMetadata,
  captureFirstTouch,
  parseLandingAttribution,
  readPageAttribution,
  resolveRequestAttribution,
} from "../attribution";

const SITE = "https://www.gustavoai.dev";

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

describe("captureFirstTouch / readPageAttribution", () => {
  beforeEach(() => {
    __resetPageAttribution();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps the first attributed visit over later ones", () => {
    captureFirstTouch(`${SITE}/mentoria?utm_source=linkedin`, "");
    captureFirstTouch(`${SITE}/?utm_source=x`, "https://google.com/");
    expect(readPageAttribution()).toEqual({ source: "linkedin", landingPath: "/mentoria" });
  });

  it("a direct visit keeps nothing, and a later attributed one still counts", () => {
    captureFirstTouch(`${SITE}/`, "");
    expect(readPageAttribution()).toBeUndefined();
    captureFirstTouch(`${SITE}/blog/rag`, "https://www.google.com/");
    expect(readPageAttribution()).toEqual({ referrerHost: "google.com", landingPath: "/blog/rag" });
  });

  it("writes nothing to the device", () => {
    captureFirstTouch(`${SITE}/mentoria?utm_source=linkedin`, "https://www.linkedin.com/");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("deletes the entry older versions stored, without reading it back", () => {
    window.localStorage.setItem(
      LEGACY_ATTRIBUTION_STORAGE_KEY,
      JSON.stringify({ attribution: { source: "old" }, capturedAt: Date.now() }),
    );
    captureFirstTouch(`${SITE}/`, "");
    expect(window.localStorage.getItem(LEGACY_ATTRIBUTION_STORAGE_KEY)).toBeNull();
    expect(readPageAttribution()).toBeUndefined();
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
