// ARCH-12: Unit tests for CreditService.
import { CreditService } from "../CreditService";
import type { ICreditsRepository } from "@/domain/repositories/ICreditsRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import { InsufficientCreditsError } from "@/domain/errors";

const mockCredits = (): jest.Mocked<ICreditsRepository> => ({
  getCredits:      jest.fn(),
  addCredits:      jest.fn(),
  decrementCredit: jest.fn(),
  restoreCredit:   jest.fn(),
});

const mockAudit = (): jest.Mocked<IAuditRepository> => ({
  append: jest.fn(),
  list:   jest.fn(),
});

describe("CreditService.useCredit", () => {
  it("throws InsufficientCreditsError when decrement fails", async () => {
    const credits = mockCredits();
    const audit   = mockAudit();
    credits.decrementCredit.mockResolvedValue({ ok: false, remaining: 0 });

    const service = new CreditService(credits, audit);

    await expect(service.useCredit("a@b.com")).rejects.toThrow(InsufficientCreditsError);
    expect(audit.append).not.toHaveBeenCalled();
  });

  it("returns remaining and appends audit entry on success", async () => {
    const credits = mockCredits();
    const audit   = mockAudit();
    credits.decrementCredit.mockResolvedValue({ ok: true, remaining: 4 });

    const service = new CreditService(credits, audit);
    const result  = await service.useCredit("a@b.com");

    expect(result).toEqual({ remaining: 4 });
    expect(audit.append).toHaveBeenCalledWith("a@b.com", expect.objectContaining({
      action: "decrement", remaining: 4,
    }));
  });
});

describe("CreditService.addCredits", () => {
  it("delegates to repository and appends audit entry", async () => {
    const credits = mockCredits();
    const audit   = mockAudit();
    credits.addCredits.mockResolvedValue(undefined);

    const service = new CreditService(credits, audit);
    await service.addCredits({
      email:           "s@b.com",
      name:            "Student",
      amount:          5,
      packLabel:       "Pack 5 clases",
      stripeSessionId: "cs_test_123",
    });

    expect(credits.addCredits).toHaveBeenCalledWith(expect.objectContaining({
      email:        "s@b.com",
      creditsToAdd: 5,
    }));
    expect(audit.append).toHaveBeenCalledWith("s@b.com", expect.objectContaining({
      action: "purchase", creditsAdded: 5,
    }));
  });
});

describe("CreditService.restoreCredit", () => {
  it("appends audit entry when restore succeeds", async () => {
    const credits = mockCredits();
    const audit   = mockAudit();
    credits.restoreCredit.mockResolvedValue({ ok: true, credits: 3 });

    const service = new CreditService(credits, audit);
    const result  = await service.restoreCredit("a@b.com");

    expect(result).toEqual({ credits: 3 });
    expect(audit.append).toHaveBeenCalledWith("a@b.com", expect.objectContaining({
      action: "restore", credits: 3,
    }));
  });

  it("does not append audit entry when no active pack", async () => {
    const credits = mockCredits();
    const audit   = mockAudit();
    credits.restoreCredit.mockResolvedValue({ ok: false, credits: 0 });

    const service = new CreditService(credits, audit);
    const result  = await service.restoreCredit("a@b.com");

    expect(result).toEqual({ credits: 0 });
    expect(audit.append).not.toHaveBeenCalled();
  });
});
