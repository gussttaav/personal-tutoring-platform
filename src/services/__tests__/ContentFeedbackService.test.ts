// CONTENT-FEEDBACK-01: ContentFeedbackService against the in-memory repository, a
// fake catalog and the fake email client.
//
// The catalog fake is what keeps the "unknown content is dropped" assertions
// readable: a page exists iff it is listed, in exactly the locales listed.
import type { ContentVoteRow } from "@/domain/types";
import { aggregateVotes } from "../ContentFeedbackService";
import { buildTestContentFeedbackService } from "@/__tests__/fixtures/services";
import { FakeContentCatalog } from "@/__tests__/fixtures/FakeContentCatalog";
import { FakeEmailClient } from "@/__tests__/fixtures/FakeEmailClient";

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

const EMAIL     = "reader@example.com";
const CLIENT_ID = "6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7";
const LESSON    = { contentType: "lesson" as const, contentKey: "dl-nlp/texto-como-numeros" };
const POST      = { contentType: "post" as const,   contentKey: "por-que-empiezo-un-blog" };

function makeService(overrides: Parameters<typeof buildTestContentFeedbackService>[0] = {}) {
  const catalog = new FakeContentCatalog([
    { ...LESSON, locales: ["es"],       title: "Texto como números" },
    { ...POST,   locales: ["es", "en"], title: "Por qué empiezo un blog" },
  ]);
  return buildTestContentFeedbackService({ catalog, ...overrides });
}

const anonVote = (vote: 1 | -1, comment?: string) => ({
  ref: LESSON, locale: "es" as const, vote, comment, clientId: CLIENT_ID, userEmail: null,
});

describe("ContentFeedbackService.vote", () => {
  it("stores an anonymous vote keyed by the browser's client id", async () => {
    const { service, feedback } = makeService();

    await service.vote(anonVote(1));

    const [row] = [...feedback.votes.values()];
    expect(feedback.votes.size).toBe(1);
    expect(row).toMatchObject({ ...LESSON, locale: "es", vote: 1, comment: null, userId: null });
    expect(row.voterKey).toBe(`anon:${CLIENT_ID}`);
  });

  it("keys a signed-in vote by the user id, creating the user if needed", async () => {
    const { service, feedback, userRepo } = makeService();

    await service.vote({ ...anonVote(1), userEmail: EMAIL });

    const user  = await userRepo.findByEmail(EMAIL);
    const [row] = [...feedback.votes.values()];
    expect(user).not.toBeNull();
    expect(row.userId).toBe(user!.id);
    expect(row.voterKey).toBe(`user:${user!.id}`);
  });

  it("updates the same row on a 👍→👎 switch instead of adding one", async () => {
    const { service, feedback } = makeService();

    await service.vote(anonVote(1));
    await service.vote(anonVote(-1));

    expect(feedback.votes.size).toBe(1);
    expect([...feedback.votes.values()][0].vote).toBe(-1);
  });

  it("attaches the comment re-posted after a 👎, and a later 👍 clears it", async () => {
    const { service, feedback } = makeService();

    await service.vote(anonVote(-1));
    await service.vote(anonVote(-1, "  Falta un ejemplo con código.  "));
    expect([...feedback.votes.values()][0].comment).toBe("Falta un ejemplo con código.");

    await service.vote(anonVote(1));
    expect(feedback.votes.size).toBe(1);
    expect([...feedback.votes.values()][0]).toMatchObject({ vote: 1, comment: null });
  });

  it("stores a whitespace-only comment as no comment", async () => {
    const { service, feedback } = makeService();

    await service.vote(anonVote(-1, "   "));

    expect([...feedback.votes.values()][0].comment).toBeNull();
  });

  it("keeps an anonymous and a signed-in vote from the same browser as two rows", async () => {
    const { service, feedback } = makeService();

    await service.vote(anonVote(1));
    await service.vote({ ...anonVote(-1), userEmail: EMAIL });

    expect(feedback.votes.size).toBe(2);
  });

  it("drops a vote on unknown content without throwing", async () => {
    const { service, feedback } = makeService();

    await service.vote({ ...anonVote(1), ref: { contentType: "post", contentKey: "no-such-post" } });

    expect(feedback.votes.size).toBe(0);
  });

  it("drops a vote in a locale the content is not published in", async () => {
    const { service, feedback } = makeService();

    // The lesson exists in "es" only — an "en" vote cannot refer to real prose.
    await service.vote({ ...anonVote(1), locale: "en" });

    expect(feedback.votes.size).toBe(0);
  });
});

describe("ContentFeedbackService.report", () => {
  const anonReport = {
    ref:       POST,
    locale:    "en" as const,
    message:   "The second code block does not run.",
    userEmail: null,
    userAgent: "Mozilla/5.0 (test)",
  };

  it("stores the report with a SERVER-derived page URL and mails the admin", async () => {
    const { service, feedback, email } = makeService();

    await service.report({ ...anonReport, email: "anon@example.com" });

    expect(feedback.reports).toHaveLength(1);
    expect(feedback.reports[0]).toMatchObject({
      ...POST,
      locale:        "en",
      pageUrl:       "https://example.test/en/post/por-que-empiezo-un-blog",
      message:       anonReport.message,
      reporterEmail: "anon@example.com",
      userId:        null,
      userAgent:     "Mozilla/5.0 (test)",
      status:        "open",
    });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({
      type:   "contentReportNotification",
      params: {
        reportId:      feedback.reports[0].id,
        contentType:   "post",
        contentKey:    POST.contentKey,
        locale:        "en",
        pageUrl:       "https://example.test/en/post/por-que-empiezo-un-blog",
        message:       anonReport.message,
        reporterEmail: "anon@example.com",
      },
    });
  });

  it("uses the session email over the body email when signed in", async () => {
    const { service, feedback, userRepo } = makeService();

    await service.report({ ...anonReport, email: "someone-else@example.com", userEmail: EMAIL });

    const user = await userRepo.findByEmail(EMAIL);
    expect(feedback.reports[0]).toMatchObject({ reporterEmail: EMAIL, userId: user!.id });
  });

  it("leaves reporterEmail null for an anonymous reporter who typed nothing", async () => {
    const { service, feedback } = makeService();

    await service.report(anonReport);

    expect(feedback.reports[0].reporterEmail).toBeNull();
  });

  it("still stores the report when the notification email fails", async () => {
    const email = new FakeEmailClient();
    email.sendContentReportNotification = async () => { throw new Error("resend down"); };
    const { service, feedback } = makeService({ email });

    await expect(service.report(anonReport)).resolves.toBeUndefined();

    expect(feedback.reports).toHaveLength(1);
  });

  it("drops a report on unknown content: no row, no email", async () => {
    const { service, feedback, email } = makeService();

    await service.report({ ...anonReport, ref: { contentType: "lesson", contentKey: "dl-nlp/nope" } });

    expect(feedback.reports).toHaveLength(0);
    expect(email.sent).toHaveLength(0);
  });
});

describe("ContentFeedbackService.getAdminOverview / setReportStatus", () => {
  it("aggregates votes per content, enriches with the catalog, and lists comments + reports", async () => {
    const { service } = makeService();

    await service.vote(anonVote(-1, "Falta un ejemplo."));
    await service.vote({ ...anonVote(1), clientId: "11111111-1111-4111-8111-111111111111" });
    await service.vote({ ...anonVote(1), ref: POST, clientId: "22222222-2222-4222-8222-222222222222" });
    await service.report({
      ref: POST, locale: "es", message: "Enlace roto en el segundo párrafo.", userEmail: null, userAgent: null,
    });

    const overview = await service.getAdminOverview();

    expect(overview.aggregates).toEqual([
      expect.objectContaining({
        ...LESSON, up: 1, down: 1, comments: 1,
        title: "Texto como números",
        pageUrl: "https://example.test/es/lesson/dl-nlp/texto-como-numeros",
      }),
      expect.objectContaining({ ...POST, up: 1, down: 0, comments: 0, title: "Por qué empiezo un blog" }),
    ]);
    expect(overview.comments).toEqual([
      expect.objectContaining({ ...LESSON, vote: -1, comment: "Falta un ejemplo." }),
    ]);
    expect(overview.reports).toEqual([
      expect.objectContaining({ ...POST, status: "open", message: "Enlace roto en el segundo párrafo." }),
    ]);
  });

  it("marks content whose page no longer exists with a null title", async () => {
    const { service, feedback } = makeService();
    await feedback.upsertVote({
      contentType: "post", contentKey: "unpublished", locale: "es",
      voterKey: "anon:x", userId: null, vote: 1, comment: null,
    });

    const { aggregates } = await service.getAdminOverview();

    expect(aggregates[0]).toMatchObject({ contentKey: "unpublished", title: null, pageUrl: null });
  });

  it("stamps resolved_at when resolving and clears it when reopening; false for an unknown id", async () => {
    const { service, feedback } = makeService();
    await service.report({
      ref: POST, locale: "es", message: "Enlace roto en el segundo párrafo.", userEmail: null, userAgent: null,
    });
    const id = feedback.reports[0].id;

    expect(await service.setReportStatus(id, "resolved")).toBe(true);
    expect(feedback.reports[0].status).toBe("resolved");
    expect(feedback.reports[0].resolvedAt).not.toBeNull();

    expect(await service.setReportStatus(id, "open")).toBe(true);
    expect(feedback.reports[0]).toMatchObject({ status: "open", resolvedAt: null });

    expect(await service.setReportStatus("report-404", "resolved")).toBe(false);
  });
});

describe("aggregateVotes", () => {
  const row = (over: Partial<ContentVoteRow>): ContentVoteRow => ({
    contentType: "post", contentKey: "a", locale: "es", vote: 1, comment: null, updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  });

  it("counts up/down/comments per content and keeps the latest timestamp", () => {
    const out = aggregateVotes([
      row({ vote: 1,  updatedAt: "2026-01-01T00:00:00.000Z" }),
      row({ vote: -1, updatedAt: "2026-01-03T00:00:00.000Z", comment: "meh" }),
      row({ vote: -1, updatedAt: "2026-01-02T00:00:00.000Z" }),
    ]);

    expect(out).toEqual([
      { contentType: "post", contentKey: "a", up: 1, down: 2, comments: 1, lastVoteAt: "2026-01-03T00:00:00.000Z" },
    ]);
  });

  it("sorts most-👎 first, then most-👍", () => {
    const out = aggregateVotes([
      row({ contentKey: "quiet" }),
      row({ contentKey: "loved" }), row({ contentKey: "loved" }),
      row({ contentKey: "trouble", vote: -1 }),
    ]);

    expect(out.map((a) => a.contentKey)).toEqual(["trouble", "loved", "quiet"]);
  });

  it("returns [] for no rows", () => {
    expect(aggregateVotes([])).toEqual([]);
  });
});
