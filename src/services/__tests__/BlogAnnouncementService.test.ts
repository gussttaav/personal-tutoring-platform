// BLOG-15 — BlogAnnouncementService: who a new post reaches, and the guards around the
// one irreversible call. The subscription list is a mock; the audit log is the in-memory
// fixture (so "already notified" is the real record of earlier sends), and the email client
// is the fake that records each send and can be told to fail for an address.

import { BlogAnnouncementService, BLOG_ANNOUNCE_AUDIT_ACTION } from "../BlogAnnouncementService";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";
import { FakeEmailClient } from "@/__tests__/fixtures/FakeEmailClient";
import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type { AnnouncedPost, IBlogPostCatalog } from "@/domain/repositories/IBlogPostCatalog";
import type { BlogArea, SubscriptionRecipient } from "@/domain/types";
import type { BlogPostAnnouncementParams } from "@/infrastructure/resend";

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

function recipient(email: string, areas: BlogArea[] | null, locale: "es" | "en" = "es"): SubscriptionRecipient {
  return { userId: `id-${email}`, email, locale, areas };
}

/** `posts`: slug → locale → post. A locale missing from the map is "not published there". */
function catalog(posts: Record<string, Partial<Record<"es" | "en", AnnouncedPost>>>): IBlogPostCatalog {
  return {
    get: (slug, locale) => posts[slug]?.[locale] ?? null,
    locales: (slug) => (["es", "en"] as const).filter((l) => posts[slug]?.[l]),
  };
}

const ARBOLES_ES: AnnouncedPost = {
  slug: "arboles-b", title: "Árboles B", summary: "Cómo indexa una base de datos.",
  areas: ["bases-de-datos", "programacion"],
};
const ARBOLES_EN: AnnouncedPost = { ...ARBOLES_ES, title: "B-trees", summary: "How a database indexes." };
const ADAMW_ES: AnnouncedPost = {
  slug: "de-newton-a-adamw", title: "De Newton a AdamW", summary: "Optimizadores.",
  areas: ["ia", "matematicas"],
};
const INTRO_ES: AnnouncedPost = {
  slug: "por-que-empiezo-un-blog", title: "Por qué empiezo un blog", summary: "Presentación.",
  areas: [],
};

const POSTS = catalog({
  "arboles-b":               { es: ARBOLES_ES, en: ARBOLES_EN },
  "de-newton-a-adamw":       { es: ADAMW_ES },             // Spanish only
  "por-que-empiezo-un-blog": { es: INTRO_ES },
});

const SUBSCRIBERS: SubscriptionRecipient[] = [
  recipient("all@x.com",  null),                         // every area
  recipient("db@x.com",   ["bases-de-datos"], "en"),
  recipient("ai@x.com",   ["ia"]),
  recipient("math@x.com", ["matematicas"], "en"),
];

function build(subscribers: SubscriptionRecipient[] = SUBSCRIBERS) {
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
  const service = new BlogAnnouncementService(subs, audit, POSTS, email, sleep);
  return { service, subs, audit, email, sleep };
}

const sentTo = (email: FakeEmailClient): BlogPostAnnouncementParams[] =>
  email.sent.flatMap((e) => (e.type === "blogPostAnnouncement" ? [e.params] : []));

describe("BlogAnnouncementService.preview", () => {
  it("counts the subscribers whose areas match the post", async () => {
    const { service, subs } = build();

    const preview = await service.preview({ slug: "arboles-b", samples: false });

    expect(subs.listByType).toHaveBeenCalledWith("blog");
    expect(preview).toMatchObject({
      dryRun:          true,
      announcementKey: "post:arboles-b",
      subscribers:     4,
      matching:        2,   // all@ (every area) + db@
      alreadyNotified: 0,
      pending:         2,
      wouldSendNow:    2,
      byLocale:        { es: 1, en: 1 },
      post:            { slug: "arboles-b", areas: ["bases-de-datos", "programacion"], locales: ["es", "en"] },
    });
    expect(preview?.samples).toBeUndefined();
  });

  it("reaches every subscriber with a post that names no area", async () => {
    const { service } = build();

    const preview = await service.preview({ slug: "por-que-empiezo-un-blog", samples: false });

    expect(preview?.matching).toBe(4);
  });

  it("leaves out whoever already has the post", async () => {
    const { service, audit } = build();
    await audit.append("db@x.com", {
      action: BLOG_ANNOUNCE_AUDIT_ACTION, announcementKey: "post:arboles-b", slug: "arboles-b",
    });

    const preview = await service.preview({ slug: "arboles-b", samples: false });

    expect(preview).toMatchObject({ matching: 2, alreadyNotified: 1, pending: 1, byLocale: { es: 1, en: 0 } });
  });

  it("caps wouldSendNow at the chunk limit", async () => {
    const many = Array.from({ length: 45 }, (_, i) => recipient(`r${i}@x.com`, null));
    const { service } = build(many);

    const preview = await service.preview({ slug: "arboles-b", samples: false });

    expect(preview).toMatchObject({ pending: 45, wouldSendNow: 30 });
  });

  it("renders a sample per locale only when asked, without sending anything", async () => {
    const { service, email } = build();

    const preview = await service.preview({ slug: "arboles-b", samples: true });

    expect(preview?.samples).toEqual({
      es: { subject: "[es] Árboles B", html: "<p>Cómo indexa una base de datos.</p>" },
      en: { subject: "[en] B-trees",   html: "<p>How a database indexes.</p>" },
    });
    expect(sentTo(email)).toHaveLength(0);
  });

  it("is null for a slug that is not a published post", async () => {
    const { service, subs } = build();

    await expect(service.preview({ slug: "nope", samples: false })).resolves.toBeNull();
    expect(subs.listByType).not.toHaveBeenCalled();
  });
});

describe("BlogAnnouncementService.send", () => {
  it("emails each matching reader in their language and records the send", async () => {
    const { service, email, audit } = build();

    const result = await service.send({ slug: "arboles-b" });

    expect(result).toMatchObject({ dryRun: false, sent: 2, failed: 0, remaining: 0 });
    const sent = sentTo(email);
    expect(sent.map((p) => [p.to, p.locale, p.postTitle])).toEqual([
      ["all@x.com", "es", "Árboles B"],
      ["db@x.com",  "en", "B-trees"],
    ]);
    expect(await audit.listNotifiedEmails(BLOG_ANNOUNCE_AUDIT_ACTION, "post:arboles-b"))
      .toEqual(new Set(["all@x.com", "db@x.com"]));
  });

  it("gives an English reader of a Spanish-only post the Spanish title and both locales to link by", async () => {
    const { service, email } = build();

    await service.send({ slug: "de-newton-a-adamw" });

    const math = sentTo(email).find((p) => p.to === "math@x.com");
    expect(math).toMatchObject({
      locale:      "en",
      postTitle:   "De Newton a AdamW",
      postLocales: ["es"],
      areas:       ["ia", "matematicas"],
    });
  });

  it("never sends the same post twice to one reader", async () => {
    const { service, email } = build();

    await service.send({ slug: "arboles-b" });
    const second = await service.send({ slug: "arboles-b" });

    expect(second).toMatchObject({ sent: 0, remaining: 0 });
    expect(sentTo(email)).toHaveLength(2);
  });

  it("keeps going past an address that fails, and does not record it as notified", async () => {
    const { service, email, audit } = build();
    email.failFor.add("all@x.com");

    const result = await service.send({ slug: "arboles-b" });

    expect(result).toMatchObject({ sent: 1, failed: 1, failedTo: ["all@x.com"] });
    expect(await audit.listNotifiedEmails(BLOG_ANNOUNCE_AUDIT_ACTION, "post:arboles-b"))
      .toEqual(new Set(["db@x.com"]));
  });

  it("sends one chunk in batches of five with a pause between them", async () => {
    const many = Array.from({ length: 12 }, (_, i) => recipient(`r${i}@x.com`, null));
    const { service, email, sleep } = build(many);

    const result = await service.send({ slug: "arboles-b", limit: 10 });

    expect(result).toMatchObject({ sent: 10, remaining: 2, nextOffset: 10 });
    expect(sentTo(email)).toHaveLength(10);
    expect(sleep).toHaveBeenCalledTimes(1);   // between batch 1 (5) and batch 2 (5)
  });

  it("is null for a slug that is not a published post", async () => {
    const { service, email } = build();

    await expect(service.send({ slug: "nope" })).resolves.toBeNull();
    expect(sentTo(email)).toHaveLength(0);
  });
});
