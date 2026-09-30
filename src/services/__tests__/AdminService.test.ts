// REFACTOR-R4-P3-02 — AdminService: the admin panel's reads and the manual credit
// adjustment moved out of POST /api/admin/students/[email].
//
// Real CreditService + PricingService over the in-memory repositories, so the
// adjustment is checked against an actual balance: a debit stops at it and says so,
// and a failure that is not "no credits left" propagates instead of being swallowed.
import { AdminService, STUDENTS_PAGE_SIZE } from "../AdminService";
import { CreditService } from "../CreditService";
import { PricingService } from "../PricingService";
import { InMemoryAdminQueryRepository } from "@/__tests__/fixtures/InMemoryAdminQueryRepository";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";
import { InMemoryCreditsRepository } from "@/__tests__/fixtures/InMemoryCreditsRepository";
import { InMemoryPricingRepository } from "@/__tests__/fixtures/InMemoryPricingRepository";

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

const DAY_MS = 86_400_000;
const EMAIL  = "ana@example.com";
const ADMIN  = "admin@example.com";

const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

function setup() {
  const queries     = new InMemoryAdminQueryRepository();
  const creditsRepo = new InMemoryCreditsRepository();
  const audit       = new InMemoryAuditRepository();
  const pricingRepo = new InMemoryPricingRepository();
  const credits     = new CreditService(creditsRepo, audit);
  const pricing     = new PricingService(pricingRepo, audit);
  const service     = new AdminService(queries, credits, pricing, audit);
  return { service, queries, creditsRepo, audit, pricingRepo };
}

async function seedCredits(creditsRepo: InMemoryCreditsRepository, credits: number) {
  await creditsRepo.addCredits({
    email: EMAIL, name: "Ana", creditsToAdd: credits, packLabel: "pack5",
    stripeSessionId: `cs_seed_${credits}`, expiresAt: inDays(30),
  });
}

describe("AdminService.adjustCredits", () => {
  it("a positive adjustment creates a manual pack with the configured validity", async () => {
    const { service, creditsRepo, audit, pricingRepo } = setup();
    await pricingRepo.updateSettings({ packValidityDays: 90, updatedBy: ADMIN });

    const before = Date.now();
    const result = await service.adjustCredits({ email: EMAIL, amount: 3, reason: "Reposición", by: ADMIN });

    expect(result).toEqual({ requested: 3, applied: 3 });
    const balance = await creditsRepo.getCredits(EMAIL);
    expect(balance?.credits).toBe(3);
    const expiresAt = new Date(balance!.expiresAt!).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 90 * DAY_MS);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 90 * DAY_MS);

    const [purchase, adjust] = audit.getAll(EMAIL);
    expect(purchase).toMatchObject({ action: "purchase", creditsAdded: 3, packLabel: "Ajuste manual: Reposición" });
    expect(purchase.stripeSessionId).toMatch(/^manual-[0-9a-f-]{36}$/);
    expect(adjust).toMatchObject({ action: "admin_adjust", amount: 3, applied: 3, reason: "Reposición", by: ADMIN });
  });

  it("two manual grants get distinct pack ids (neither is dropped as a duplicate payment)", async () => {
    const { service, creditsRepo } = setup();

    await service.adjustCredits({ email: EMAIL, amount: 1, reason: "a", by: ADMIN });
    await service.adjustCredits({ email: EMAIL, amount: 1, reason: "b", by: ADMIN });

    expect((await creditsRepo.getCredits(EMAIL))?.credits).toBe(2);
  });

  it("a debit within the balance applies in full", async () => {
    const { service, creditsRepo } = setup();
    await seedCredits(creditsRepo, 3);

    const result = await service.adjustCredits({ email: EMAIL, amount: -2, reason: "Corrección", by: ADMIN });

    expect(result).toEqual({ requested: -2, applied: -2 });
    expect((await creditsRepo.getCredits(EMAIL))?.credits).toBe(1);
  });

  it("−3 on a 1-credit student stops at 0 and reports −1 applied, in the response and the audit", async () => {
    const { service, creditsRepo, audit } = setup();
    await seedCredits(creditsRepo, 1);

    const result = await service.adjustCredits({ email: EMAIL, amount: -3, reason: "Corrección", by: ADMIN });

    expect(result).toEqual({ requested: -3, applied: -1 });
    expect((await creditsRepo.getCredits(EMAIL))?.credits).toBe(0);
    const entries = audit.getAll(EMAIL);
    expect(entries.filter((e) => e.action === "decrement")).toHaveLength(1);
    expect(entries.at(-1)).toMatchObject({
      action: "admin_adjust", amount: -3, applied: -1, reason: "Corrección", by: ADMIN,
    });
  });

  it("a debit on a student with no credits applies nothing and still records the attempt", async () => {
    const { service, audit } = setup();

    const result = await service.adjustCredits({ email: EMAIL, amount: -2, reason: "x", by: ADMIN });

    expect(result).toEqual({ requested: -2, applied: 0 });
    expect(audit.getAll(EMAIL)).toEqual([
      expect.objectContaining({ action: "admin_adjust", amount: -2, applied: 0 }),
    ]);
  });

  it("a failure that is not InsufficientCredits propagates, after the credits already taken", async () => {
    const { service, creditsRepo, audit } = setup();
    await seedCredits(creditsRepo, 3);
    const decrement = jest.spyOn(creditsRepo, "decrementCredit");
    decrement.mockImplementationOnce(InMemoryCreditsRepository.prototype.decrementCredit.bind(creditsRepo));
    decrement.mockRejectedValueOnce(new Error("connection reset"));

    await expect(
      service.adjustCredits({ email: EMAIL, amount: -3, reason: "Corrección", by: ADMIN }),
    ).rejects.toThrow("connection reset");

    expect(decrement).toHaveBeenCalledTimes(2);
    expect((await creditsRepo.getCredits(EMAIL))?.credits).toBe(2);
    expect(audit.getAll(EMAIL).some((e) => e.action === "admin_adjust")).toBe(false);
  });

  it("amount 0 touches no credits but records the attribution", async () => {
    const { service, creditsRepo, audit } = setup();
    const decrement = jest.spyOn(creditsRepo, "decrementCredit");
    const add       = jest.spyOn(creditsRepo, "addCredits");

    const result = await service.adjustCredits({ email: EMAIL, amount: 0, reason: "noop", by: ADMIN });

    expect(result).toEqual({ requested: 0, applied: 0 });
    expect(decrement).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(audit.getAll(EMAIL)).toHaveLength(1);
  });
});

describe("AdminService.listStudents", () => {
  function seedStudents(queries: InMemoryAdminQueryRepository) {
    queries.addUser("reader@example.com", "Solo Lee");           // course reader: no booking, no pack
    queries.addUser("booker@example.com", "Bea Booker");
    queries.addBooking("booker@example.com", { startsAt: inDays(3) });
    queries.addUser("holder@example.com", "Hugo Holder");
    queries.addPack("holder@example.com", { credits: 4, expiresAt: inDays(60) });
    queries.addUser("low@example.com", "Lola Low");
    queries.addPack("low@example.com", { credits: 1, expiresAt: inDays(60) });
    queries.addPack("low@example.com", { credits: 5, expiresAt: inDays(-1) }); // expired: doesn't count
  }

  it("lists students only, with both counts, and leaves course readers out", async () => {
    const { service, queries } = setup();
    seedStudents(queries);

    const page = await service.listStudents({ lowCredit: false, page: 1, pageSize: STUDENTS_PAGE_SIZE });

    expect(page.rows.map((r) => r.email)).toEqual([
      "booker@example.com", "holder@example.com", "low@example.com",
    ]);
    expect(page.total).toBe(3);
    // booker (0 credits) and low (1 active; the 5 in the expired pack don't count)
    expect(page.lowCreditTotal).toBe(2);
    expect(await service.getStudent("reader@example.com")).toMatchObject({ email: "reader@example.com" });
  });

  it("the low-credit tab keeps the unfiltered total", async () => {
    const { service, queries } = setup();
    seedStudents(queries);

    const page = await service.listStudents({ lowCredit: true, page: 1, pageSize: STUDENTS_PAGE_SIZE });

    expect(page.rows.map((r) => r.email)).toEqual(["booker@example.com", "low@example.com"]);
    expect(page).toMatchObject({ total: 3, lowCreditTotal: 2 });
  });

  it("maps the 1-based page to an offset and trims the query", async () => {
    const { service, queries } = setup();

    await service.listStudents({ query: "  ana  ", lowCredit: false, page: 3, pageSize: 50 });

    expect(queries.listCalls.at(-1)).toEqual({ query: "ana", lowCredit: false, limit: 50, offset: 100 });
  });

  it("a blank query lists everyone and a nonsense page reads as page 1", async () => {
    const { service, queries } = setup();

    await service.listStudents({ query: "   ", lowCredit: false, page: 0, pageSize: 50 });
    await service.listStudents({ lowCredit: false, page: 2.5, pageSize: 50 });

    expect(queries.listCalls).toEqual([
      { query: undefined, lowCredit: false, limit: 50, offset: 0 },
      { query: undefined, lowCredit: false, limit: 50, offset: 0 },
    ]);
  });

  it("finds a student past the first 100 by email", async () => {
    const { service, queries } = setup();
    for (let i = 0; i < 120; i++) {
      const email = `alumno-${String(i).padStart(3, "0")}@example.com`;
      queries.addUser(email, `Alumno ${i}`);
      queries.addBooking(email, { startsAt: inDays(1 + i) });
    }

    const found = await service.listStudents({ query: "alumno-110", lowCredit: false, page: 1, pageSize: 50 });
    const page3 = await service.listStudents({ lowCredit: false, page: 3, pageSize: 50 });

    expect(found.rows.map((r) => r.email)).toEqual(["alumno-110@example.com"]);
    expect(page3.rows.map((r) => r.email)).toContain("alumno-110@example.com");
    expect(page3.rows).toHaveLength(20);
    expect(page3.total).toBe(120);
  });
});

describe("AdminService dashboard reads", () => {
  it("revenueLast30Days sums succeeded payments inside the window", async () => {
    const { service, queries } = setup();
    queries.addUser(EMAIL, "Ana");
    queries.addPayment(EMAIL, { amountCents: 1600, createdAt: inDays(-2) });
    queries.addPayment(EMAIL, { amountCents: 3000, createdAt: inDays(-29) });
    queries.addPayment(EMAIL, { amountCents: 9999, createdAt: inDays(-31) });
    queries.addPayment(EMAIL, { amountCents: 7500, status: "refunded", createdAt: inDays(-1) });

    expect(await service.revenueLast30Days()).toBe(4600);
  });

  it("dashboardCounts counts low-credit students, not every user", async () => {
    const { service, queries } = setup();
    queries.addUser("reader-1@example.com");
    queries.addUser("reader-2@example.com");
    queries.addUser("holder@example.com");
    queries.addPack("holder@example.com", { credits: 1, expiresAt: inDays(10) });
    queries.failedBookings = 2;

    expect(await service.dashboardCounts()).toEqual({
      upcomingBookings: 0, lowCreditStudents: 1, failedBookings: 2,
    });
  });
});
