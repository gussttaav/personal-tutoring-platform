// COURSE-P6-02b — the kind → message-namespace mapping behind renderCourseNewsEmail.
//
// The templates themselves cannot be rendered here: getTranslations() needs Next's config
// resolution, not just a react-server export condition, so there is no way to assert on the
// produced HTML from Jest. What CAN be pinned statically is the part that actually breaks —
// a kind pointing at a namespace that is missing, shared with another kind, or missing the
// keys the template reads. A key absent from one locale fails silently at send time, and the
// send is the one thing here that cannot be undone.

import { ANNOUNCEMENT_NAMESPACE, announcementUrls } from "../email-functions";
import type { AnnouncementKind } from "@/domain/types";
import es from "../../../../messages/es.json";
import en from "../../../../messages/en.json";

/** Same fallback as email-functions.ts; the env var is unset under Jest. */
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

/** Exactly the keys each template reads. Kept by hand, deliberately: the point is to notice
 *  when the template and the copy drift apart. */
const TEMPLATE_KEYS: Record<AnnouncementKind, string[]> = {
  launch:  ["subject", "heading", "intro", "body1", "body2", "cta", "landingCta", "unsubscribe"],
  english: ["subject", "heading", "intro", "body1", "body2", "cta", "landingCta", "unsubscribe"],
  update:  ["subject", "heading", "intro", "body1", "whatsNewLabel", "body2", "landingCta",
            "unsubscribe"],
};

const KINDS = Object.keys(TEMPLATE_KEYS) as AnnouncementKind[];

const MESSAGES: Record<"es" | "en", Record<string, unknown>> = { es, en };

function namespaceOf(locale: "es" | "en", path: string): Record<string, string> | undefined {
  return path.split(".").reduce<unknown>(
    (node, part) => (node as Record<string, unknown> | undefined)?.[part],
    MESSAGES[locale],
  ) as Record<string, string> | undefined;
}

describe("ANNOUNCEMENT_NAMESPACE", () => {
  it("covers every kind, one namespace each", () => {
    expect(Object.keys(ANNOUNCEMENT_NAMESPACE).sort()).toEqual([...KINDS].sort());
  });

  it("never points two kinds at the same copy", () => {
    const namespaces = Object.values(ANNOUNCEMENT_NAMESPACE);
    expect(new Set(namespaces).size).toBe(namespaces.length);
  });
});

describe.each(KINDS)("kind: %s", (kind) => {
  const path = ANNOUNCEMENT_NAMESPACE[kind];

  it.each(["es", "en"] as const)("has every key the template reads in %s", (locale) => {
    const ns = namespaceOf(locale, path);
    expect(ns).toBeDefined();
    for (const key of TEMPLATE_KEYS[kind]) {
      expect(typeof ns![key]).toBe("string");
      expect(ns![key].trim()).not.toBe("");
    }
  });

  it("carries no key the template will not render", () => {
    expect(Object.keys(namespaceOf("es", path)!).sort()).toEqual([...TEMPLATE_KEYS[kind]].sort());
  });

  it("keeps the {courseTitle} placeholder the renderer substitutes", () => {
    for (const locale of ["es", "en"] as const) {
      const ns = namespaceOf(locale, path)!;
      expect(ns.subject).toContain("{courseTitle}");
      expect(ns.body1).toContain("{courseTitle}");
    }
  });
});

// `lessonCount` is interpolated unconditionally but only `launch` has anywhere to put it —
// the other two would render the literal placeholder if someone pasted it in.
it("uses {lessonCount} in launch only", () => {
  expect(namespaceOf("es", ANNOUNCEMENT_NAMESPACE.launch)!.body1).toContain("{lessonCount}");
  for (const kind of ["english", "update"] as const) {
    for (const locale of ["es", "en"] as const) {
      const ns = namespaceOf(locale, ANNOUNCEMENT_NAMESPACE[kind])!;
      expect(Object.values(ns).join(" ")).not.toContain("{lessonCount}");
    }
  }
});

// ─── Link locales ─────────────────────────────────────────────────────────────
//
// Regression guard. The launch email's English "Start the first lesson" button used to point
// at the unprefixed Spanish URL, because the URL was built from the LESSONS' locale rather
// than the reader's — and with no English lessons on disk that resolves to "es". An English
// reader got the same Spanish prose wrapped in a fully Spanish site, while the landing button
// immediately beside it went to /en.

describe("announcementUrls", () => {
  const course = { courseSlug: "dl-nlp", firstLessonSlug: "texto-como-numeros" };

  it.each([
    ["launch", "es", ""],
    ["launch", "en", "/en"],
    ["update", "es", ""],
    ["update", "en", "/en"],
    // `english` is about the /en tree no matter which language it is written in.
    ["english", "es", "/en"],
    ["english", "en", "/en"],
  ] as const)("%s → %s reader keeps every course link under '%s'", (kind, locale, prefix) => {
    const { landingUrl, lessonUrl } = announcementUrls({ ...course, kind, locale });

    expect(landingUrl).toBe(`${BASE}${prefix}/cursos/dl-nlp`);
    expect(lessonUrl).toBe(`${BASE}${prefix}/cursos/dl-nlp/texto-como-numeros`);
    // The two buttons sit side by side; they must never disagree.
    expect(lessonUrl!.startsWith(`${BASE}${prefix}/cursos/`)).toBe(true);
  });

  it("drops the lesson button when the course has no lessons", () => {
    const { lessonUrl } = announcementUrls({
      courseSlug: "dl-nlp", firstLessonSlug: null, kind: "launch", locale: "es",
    });
    expect(lessonUrl).toBeNull();
  });

  // Unsubscribing is a control on the reader's own catalog page, so it follows the reader even
  // when the announcement points at /en.
  it("keeps the unsubscribe link in the reader's locale", () => {
    expect(announcementUrls({ ...course, kind: "english", locale: "es" }).unsubUrl)
      .toBe(`${BASE}/cursos#notificaciones`);
    expect(announcementUrls({ ...course, kind: "english", locale: "en" }).unsubUrl)
      .toBe(`${BASE}/en/cursos#notificaciones`);
  });
});
