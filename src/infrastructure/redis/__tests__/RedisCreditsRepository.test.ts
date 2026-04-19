// ARCH-11 — Smoke tests: verify RedisCreditsRepository delegates to kv module.

const mockGetCredits      = jest.fn();
const mockAddOrUpdate     = jest.fn();
const mockDecrementCredit = jest.fn();
const mockRestoreCredit   = jest.fn();
const mockAppendAuditLog  = jest.fn();

jest.mock("@/infrastructure/redis/credits-store", () => ({
  getCredits:        (...args: unknown[]) => mockGetCredits(...args),
  addOrUpdateStudent:(...args: unknown[]) => mockAddOrUpdate(...args),
  decrementCredit:   (...args: unknown[]) => mockDecrementCredit(...args),
  restoreCredit:     (...args: unknown[]) => mockRestoreCredit(...args),
  appendAuditLog:    (...args: unknown[]) => mockAppendAuditLog(...args),
}));

jest.mock("@/infrastructure/redis/client", () => ({ kv: {} }));

import { RedisCreditsRepository } from "../RedisCreditsRepository";

describe("RedisCreditsRepository", () => {
  let repo: RedisCreditsRepository;

  beforeEach(() => {
    repo = new RedisCreditsRepository();
    jest.clearAllMocks();
  });

  it("getCredits delegates to kvModule.getCredits", async () => {
    mockGetCredits.mockResolvedValue(null);
    const result = await repo.getCredits("test@example.com");
    expect(mockGetCredits).toHaveBeenCalledWith("test@example.com");
    expect(result).toBeNull();
  });

  it("addCredits delegates to kvModule.addOrUpdateStudent", async () => {
    mockAddOrUpdate.mockResolvedValue(undefined);
    await repo.addCredits({
      email: "test@example.com",
      name: "Test User",
      creditsToAdd: 5,
      packLabel: "Pack 5",
      stripeSessionId: "cs_123",
    });
    expect(mockAddOrUpdate).toHaveBeenCalledWith(
      "test@example.com", "Test User", 5, "Pack 5", "cs_123"
    );
  });

  it("decrementCredit delegates to kvModule.decrementCredit", async () => {
    mockDecrementCredit.mockResolvedValue({ ok: false, remaining: 0 });
    const result = await repo.decrementCredit("test@example.com");
    expect(mockDecrementCredit).toHaveBeenCalledWith("test@example.com");
    expect(result).toEqual({ ok: false, remaining: 0 });
  });

  it("restoreCredit delegates to kvModule.restoreCredit", async () => {
    mockRestoreCredit.mockResolvedValue({ ok: true, credits: 3 });
    const result = await repo.restoreCredit("test@example.com");
    expect(mockRestoreCredit).toHaveBeenCalledWith("test@example.com");
    expect(result).toEqual({ ok: true, credits: 3 });
  });
});
