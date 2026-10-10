// COURSE-ANNOUNCE-01 — CourseAnnouncementService: who a course announcement reaches, the
// guards around the one irreversible call, and the three kinds (COURSE-P6-02 / 02b, BLOG-15
// count-only) — the assertions that lived in the route's test before the logic moved here.
//
// The subscription list is a mock; the audit log is the in-memory fixture (so "already
// notified" is the real record of earlier sends, and the chunked walk pages the way it does
// in production); the email client is the fake that records each send and can be told to fail
// for an address; the sleep is injected so the batch pause costs nothing.
//
// `launch` and `english` must never send twice, while `update` must be able to send again and
// again. Those are the same mechanism read in opposite directions, and the only thing
// separating them is the announcementKey.

import {
  CourseAnnouncementService,
  COURSE_ANNOUNCE_AUDIT_ACTION,
  courseAnnouncementKey,
} from "../CourseAnnouncementService";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";
import { FakeEmailClient } from "@/__tests__/fixtures/FakeEmailClient";
import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type {
  AnnouncedCourse,
  EnglishTranslationCoverage,
  ICourseAnnouncementCatalog,
} from "@/domain/repositories/ICourseAnnouncementCatalog";
import type { SubscriptionRecipient } from "@/domain/types";
import type { CourseAnnouncementParams } from "@/infrastructure/resend";

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

function recipient(email: string, locale: "es" | "en"): SubscriptionRecipient {
  return { userId: `id-${email}`, email, locale, areas: null };
}

const RECIPIENTS: SubscriptionRecipient[] = [
  recipient("a@example.com", "es"),
  recipient("b@example.com", "en"),
  recipient("c@example.com", "es"),
];

const DL_NLP_ES: AnnouncedCourse = {
  courseSlug: "dl-nlp", courseTitle: "Curso", lessonCount: 2, firstLessonSlug: "intro",
};
const DL_NLP_EN: AnnouncedCourse = { ...DL_NLP_ES, courseTitle: "Course" };

const NOT_TRANSLATED: EnglishTranslationCoverage = { translated: 0, total: 2, fullyTranslated: false };

/** `en: null` models a course with no English manifest: `forLocale` then falls back to the
 *  canonical facts, which is the adapter's contract. */
function catalog(opts: {
  en?:       AnnouncedCourse | null;
  coverage?: EnglishTranslationCoverage;
} = {}): ICourseAnnouncementCatalog {
  const en = opts.en === undefined ? DL_NLP_EN : opts.en;
  return {
    canonical: (slug) => (slug === "dl-nlp" ? DL_NLP_ES : null),
    forLocale: (slug, locale) => {
      if (slug !== "dl-nlp") return null;
      return locale === "en" ? (en ?? DL_NLP_ES) : DL_NLP_ES;
    },
    englishCoverage: () => opts.coverage ?? NOT_TRANSLATED,
  };
}

function build(
  subscribers: SubscriptionRecipient[] = RECIPIENTS,
  courses: ICourseAnnouncementCatalog = catalog(),
) {
  const subs: jest.Mocked<ISubscriptionRepository> = {
    subscribe:    jest.fn(),
    isSubscribed: jest.fn(),
    getAreas:     jest.fn(),
    updateAreas:  jest.fn(),
    unsubscribe:  jest.fn(),
    listByType:   jest.fn().mockResolvedValue(subscribers),
  };
  const audit = new InMemoryAuditRepository();
  const email = new FakeEmailClient();
  const sleep = jest.fn().mockResolvedValue(undefined);
  const service = new CourseAnnouncementService(subs, audit, courses, email, sleep);
  return { service, subs, audit, email, sleep };
}

const sentTo = (email: FakeEmailClient): CourseAnnouncementParams[] =>
  email.sent.flatMap((e) => (e.type === "courseAnnouncement" ? [e.params] : []));

const LAUNCH = { courseSlug: "dl-nlp", kind: "launch" } as const;

async function recordAsNotified(audit: InMemoryAuditRepository, emails: string[], key: string) {
  for (const to of emails) {
    await audit.append(to, {
      action: COURSE_ANNOUNCE_AUDIT_ACTION, announcementKey: key, courseSlug: "dl-nlp", kind: "launch",
    });
  }
}

describe("CourseAnnouncementService.preview", () => {
  it("sends nothing and reports the audience", async () => {
    const { service, subs, email, audit } = build();

    const preview = await service.preview({ ...LAUNCH, samples: true });

    expect(subs.listByType).toHaveBeenCalledWith("courses");
    expect(preview).toMatchObject({
      dryRun:          true,
      kind:            "launch",
      announcementKey: "launch:dl-nlp",
      subscribers:     3,
      alreadyNotified: 0,
      pending:         3,
      wouldSendNow:    3,
      byLocale:        { es: 2, en: 1 },
      translation:     NOT_TRANSLATED,
    });
    expect(sentTo(email)).toHaveLength(0);
    expect(audit.getAll("a@example.com")).toHaveLength(0);
  });

  it("renders a sample per locale, each in that locale's course facts", async () => {
    const { service, email } = build();
    const render = jest.spyOn(email, "renderCourseAnnouncement");

    const preview = await service.preview({ ...LAUNCH, samples: true });

    // A real rendered email per locale — the only way to read it before it is irreversible.
    expect(preview?.samples).toEqual({
      es: { subject: "[es] Curso",  html: "<p>launch</p>" },
      en: { subject: "[en] Course", html: "<p>launch</p>" },
    });
    expect(render.mock.calls.map(([p]) => [p.locale, p.courseTitle])).toEqual([
      ["es", "Curso"],
      ["en", "Course"],
    ]);
  });

  it("leaves a locale out of the samples when the catalog has nothing for it", async () => {
    const { service } = build(RECIPIENTS, {
      ...catalog(),
      forLocale: (_slug, locale) => (locale === "es" ? DL_NLP_ES : null),
    });

    const preview = await service.preview({ ...LAUNCH, samples: true });

    expect(Object.keys(preview?.samples ?? {})).toEqual(["es"]);
  });

  // BLOG-15: the live count the admin form asks for before any preview.
  it("count only: reports the audience without rendering or sending", async () => {
    const { service, email, audit } = build();
    const render = jest.spyOn(email, "renderCourseAnnouncement");
    await recordAsNotified(audit, ["a@example.com"], "launch:dl-nlp");

    const preview = await service.preview({ ...LAUNCH, samples: false });

    expect(preview).toMatchObject({
      dryRun: true, subscribers: 3, alreadyNotified: 1, pending: 2, wouldSendNow: 2,
      byLocale: { es: 1, en: 1 },
    });
    expect(preview?.samples).toBeUndefined();
    expect(render).not.toHaveBeenCalled();
    expect(sentTo(email)).toHaveLength(0);
  });

  it("counts an update before its line is written", async () => {
    const { service } = build();

    const preview = await service.preview({ courseSlug: "dl-nlp", kind: "update", samples: false });

    expect(preview?.announcementKey).toMatch(/^update:dl-nlp:\d{4}-\d{2}-\d{2}$/);
  });

  it("reports how much of the course exists in English", async () => {
    const coverage = { translated: 1, total: 2, fullyTranslated: false };
    const { service } = build(RECIPIENTS, catalog({ coverage }));

    const preview = await service.preview({ courseSlug: "dl-nlp", kind: "english", samples: false });

    expect(preview?.translation).toEqual(coverage);
  });

  it("caps wouldSendNow at the chunk limit, from the offset", async () => {
    const many = Array.from({ length: 45 }, (_, i) => recipient(`r${i}@x.com`, "es"));
    const { service } = build(many);

    expect(await service.preview({ ...LAUNCH, samples: false }))
      .toMatchObject({ pending: 45, wouldSendNow: 30 });
    expect(await service.preview({ ...LAUNCH, samples: false, offset: 40 }))
      .toMatchObject({ pending: 45, wouldSendNow: 5 });
    expect(await service.preview({ ...LAUNCH, samples: false, offset: 1, limit: 1 }))
      .toMatchObject({ wouldSendNow: 1 });
  });

  it("is null for a course that does not exist, without reading the subscribers", async () => {
    const { service, subs } = build();

    await expect(service.preview({ courseSlug: "nope", kind: "launch", samples: true }))
      .resolves.toBeNull();
    expect(subs.listByType).not.toHaveBeenCalled();
  });
});

describe("CourseAnnouncementService.send", () => {
  it("sends once per recipient, in that recipient's locale, and records each", async () => {
    const { service, email, audit } = build();

    const result = await service.send(LAUNCH);

    expect(sentTo(email).map((p) => [p.to, p.locale, p.courseTitle])).toEqual([
      ["a@example.com", "es", "Curso"],
      ["b@example.com", "en", "Course"],
      ["c@example.com", "es", "Curso"],
    ]);
    expect(audit.getAll("a@example.com")).toEqual([
      expect.objectContaining({
        action: "course_announcement_sent",
        announcementKey: "launch:dl-nlp",
        courseSlug: "dl-nlp",
        kind: "launch",
      }),
    ]);
    expect(await audit.listNotifiedEmails(COURSE_ANNOUNCE_AUDIT_ACTION, "launch:dl-nlp"))
      .toEqual(new Set(RECIPIENTS.map((r) => r.email)));
    expect(result).toEqual({
      dryRun: false, kind: "launch", announcementKey: "launch:dl-nlp",
      sent: 3, failed: 0, failedTo: [], remaining: 0, nextOffset: 3,
    });
  });

  it("skips addresses already recorded — a retry does not double-send", async () => {
    const { service, email, audit } = build();
    await recordAsNotified(audit, ["a@example.com", "c@example.com"], "launch:dl-nlp");

    const result = await service.send(LAUNCH);

    expect(sentTo(email).map((p) => p.to)).toEqual(["b@example.com"]);
    expect(result).toMatchObject({ sent: 1 });
  });

  it("matches already-notified addresses case-insensitively", async () => {
    const { service, email, audit } = build([recipient("Mixed@Example.com", "es")]);
    await recordAsNotified(audit, ["mixed@example.com"], "launch:dl-nlp");

    await service.send(LAUNCH);

    expect(sentTo(email)).toHaveLength(0);
  });

  it("one failing send does not abort the batch, and is not recorded as sent", async () => {
    const { service, email, audit } = build();
    email.failFor.add("a@example.com");

    const result = await service.send(LAUNCH);

    expect(sentTo(email)).toHaveLength(2);
    expect(await audit.listNotifiedEmails(COURSE_ANNOUNCE_AUDIT_ACTION, "launch:dl-nlp"))
      .toEqual(new Set(["b@example.com", "c@example.com"]));
    expect(result).toMatchObject({ sent: 2, failed: 1, failedTo: ["a@example.com"] });
  });

  it("falls back to the canonical facts for a locale the catalog has nothing for", async () => {
    const { service, email } = build(RECIPIENTS, {
      ...catalog(),
      forLocale: (_slug, locale) => (locale === "es" ? DL_NLP_ES : null),
    });

    await service.send(LAUNCH);

    expect(sentTo(email).find((p) => p.to === "b@example.com"))
      .toMatchObject({ locale: "en", courseTitle: "Curso" });
  });

  it("honours offset/limit and reports where to resume", async () => {
    const { service, email } = build();

    const result = await service.send({ ...LAUNCH, offset: 1, limit: 1 });

    expect(sentTo(email).map((p) => p.to)).toEqual(["b@example.com"]);
    expect(result).toMatchObject({ sent: 1, nextOffset: 2, remaining: 1 });
  });

  it("uses a custom announcementKey so a second announcement is not suppressed", async () => {
    const { service, audit } = build();

    const result = await service.send({ courseSlug: "dl-nlp", kind: "english", announcementKey: "english-launch" });

    expect(result).toMatchObject({ announcementKey: "english-launch", sent: 3 });
    expect(await audit.listNotifiedEmails(COURSE_ANNOUNCE_AUDIT_ACTION, "english-launch"))
      .toEqual(new Set(RECIPIENTS.map((r) => r.email)));
    expect(await audit.listNotifiedEmails(COURSE_ANNOUNCE_AUDIT_ACTION, "english:dl-nlp"))
      .toEqual(new Set());
  });

  it("sends one chunk in batches of five with a pause between them", async () => {
    const many = Array.from({ length: 12 }, (_, i) => recipient(`r${i}@x.com`, "es"));
    const { service, email, sleep } = build(many);

    const result = await service.send({ ...LAUNCH, limit: 10 });

    expect(result).toMatchObject({ sent: 10, remaining: 2, nextOffset: 10 });
    expect(sentTo(email)).toHaveLength(10);
    expect(sleep).toHaveBeenCalledTimes(1);   // between batch 1 (5) and batch 2 (5)
    expect(sleep).toHaveBeenCalledWith(1200);
  });

  it("sends a default chunk of thirty", async () => {
    const many = Array.from({ length: 45 }, (_, i) => recipient(`r${i}@x.com`, "es"));
    const { service, email } = build(many);

    const result = await service.send(LAUNCH);

    expect(sentTo(email)).toHaveLength(30);
    expect(result).toMatchObject({ sent: 30, remaining: 15, nextOffset: 30 });
  });

  it("is null for a course that does not exist, and sends nothing", async () => {
    const { service, subs, email } = build();

    await expect(service.send({ courseSlug: "nope", kind: "launch" })).resolves.toBeNull();
    expect(subs.listByType).not.toHaveBeenCalled();
    expect(sentTo(email)).toHaveLength(0);
  });
});

// ─── COURSE-P6-02b: the three kinds ───────────────────────────────────────────

describe("announcement kinds", () => {
  it.each(["launch", "english", "update"] as const)(
    "renders and sends %s under its own kind",
    async (kind) => {
      const { service, email } = build();
      const render = jest.spyOn(email, "renderCourseAnnouncement");
      const input = kind === "update"
        ? { courseSlug: "dl-nlp", kind, whatsNew: "Bloque 4 reescrito." }
        : { courseSlug: "dl-nlp", kind };

      // Dry run renders both locales for the chosen kind, and nothing else.
      await service.preview({ ...input, samples: true });
      expect(render.mock.calls.map(([p]) => [p.locale, p.kind])).toEqual([
        ["es", kind],
        ["en", kind],
      ]);

      // The confirmed send carries the same kind through to every recipient.
      await service.send(input);
      expect(sentTo(email)).toHaveLength(3);
      expect(sentTo(email).every((p) => p.kind === kind)).toBe(true);
    },
  );

  it("defaults the key per kind, dating only the one that recurs", async () => {
    const { service } = build();
    const keyFor = async (kind: "launch" | "english" | "update") =>
      (await service.preview({ courseSlug: "dl-nlp", kind, samples: false }))?.announcementKey;

    expect(await keyFor("launch")).toBe("launch:dl-nlp");
    expect(await keyFor("english")).toBe("english:dl-nlp");
    expect(await keyFor("update")).toMatch(/^update:dl-nlp:\d{4}-\d{2}-\d{2}$/);
  });
});

describe("courseAnnouncementKey", () => {
  const now = new Date("2026-10-10T23:59:59.000Z");

  it("is once-ever for launch and english", () => {
    expect(courseAnnouncementKey("launch", "dl-nlp", now)).toBe("launch:dl-nlp");
    expect(courseAnnouncementKey("english", "dl-nlp", now)).toBe("english:dl-nlp");
  });

  it("carries the UTC date for update, so two updates are two announcements", () => {
    expect(courseAnnouncementKey("update", "dl-nlp", now)).toBe("update:dl-nlp:2026-10-10");
    expect(courseAnnouncementKey("update", "dl-nlp", new Date("2026-11-02T00:00:00.000Z")))
      .toBe("update:dl-nlp:2026-11-02");
  });
});

describe("kind: update", () => {
  it("passes the whatsNew line to the template and to every recipient", async () => {
    const { service, email } = build();
    const render = jest.spyOn(email, "renderCourseAnnouncement");
    const input = { courseSlug: "dl-nlp", kind: "update", whatsNew: "Bloque 4 reescrito." } as const;

    await service.preview({ ...input, samples: true });
    await service.send(input);

    expect(render.mock.calls.every(([p]) => p.whatsNew === "Bloque 4 reescrito.")).toBe(true);
    expect(sentTo(email).every((p) => p.whatsNew === "Bloque 4 reescrito.")).toBe(true);
  });

  // The whole reason `update` gets a dated key. Two updates are two announcements; the audit
  // log must not read the second as a retry of the first.
  it("reaches everyone again under a new key", async () => {
    const { service, email } = build();

    await service.send({
      courseSlug: "dl-nlp", kind: "update", whatsNew: "Uno", announcementKey: "update:dl-nlp:2026-08-01",
    });
    expect(sentTo(email)).toHaveLength(3);

    // Second update: everyone is recorded under the FIRST key, but this one asks about its own.
    const second = await service.send({
      courseSlug: "dl-nlp", kind: "update", whatsNew: "Dos", announcementKey: "update:dl-nlp:2026-09-01",
    });

    expect(sentTo(email)).toHaveLength(6);
    expect(second).toMatchObject({ sent: 3 });
  });

  it("reaches nobody when the key is reused — the trap the panel warns about", async () => {
    const { service, email } = build();
    const key = "update:dl-nlp:2026-08-01";

    await service.send({ courseSlug: "dl-nlp", kind: "update", whatsNew: "Uno", announcementKey: key });
    email.sent.length = 0;

    const second = await service.send({ courseSlug: "dl-nlp", kind: "update", whatsNew: "Dos", announcementKey: key });

    expect(sentTo(email)).toHaveLength(0);
    expect(second).toMatchObject({ sent: 0, remaining: 0 });
  });
});

describe("chunked walk", () => {
  const four = [
    recipient("a@example.com", "es"),
    recipient("b@example.com", "en"),
    recipient("c@example.com", "es"),
    recipient("d@example.com", "en"),
  ];

  // `offset` indexes into `pending`, which shrinks as sends are recorded — so the way to walk
  // a list is to send again with offset 0 and let the audit log do the paging. This is the
  // test that keeps the admin panel's "Continuar" button honest.
  it("reaches the whole list across chunks when each call re-sends with offset 0", async () => {
    const { service, email } = build(four);

    const first = await service.send({ ...LAUNCH, limit: 2 });

    expect(sentTo(email).map((p) => p.to)).toEqual(["a@example.com", "b@example.com"]);
    expect(first).toMatchObject({ sent: 2, remaining: 2 });

    // The first chunk is now on the audit log, so `pending` is c/d.
    email.sent.length = 0;
    const second = await service.send({ ...LAUNCH, limit: 2 });

    expect(sentTo(email).map((p) => p.to)).toEqual(["c@example.com", "d@example.com"]);
    expect(second).toMatchObject({ sent: 2, remaining: 0 });
  });

  it("resuming at nextOffset instead would step clean over the rest of the list", async () => {
    const { service, email } = build(four);

    const first = await service.send({ ...LAUNCH, limit: 2 });
    email.sent.length = 0;
    const second = await service.send({ ...LAUNCH, limit: 2, offset: first!.nextOffset });

    expect(sentTo(email)).toHaveLength(0);
    expect(second).toMatchObject({ sent: 0 });
  });
});
