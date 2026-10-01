// REFACTOR-R4-P3-03: the booking-payment audit cron. The route is a thin dispatcher over
// BookingPaymentAuditService, so these tests pin only its contract with cron-job.org:
// the auth check, the log lines, the tutor email (only on findings, best-effort) and the
// response body. The rules live in src/services/__tests__/BookingPaymentAuditService.test.ts.
import { NextRequest } from "next/server";
import type { PaymentAuditFinding, PaymentAuditReport } from "@/domain/types";

const mockAudit       = jest.fn();
const mockEmailReport = jest.fn();
jest.mock("@/services", () => ({
  bookingPaymentAuditService: {
    auditUpcoming: (...args: unknown[]) => mockAudit(...args),
    emailReport:   (...args: unknown[]) => mockEmailReport(...args),
  },
}));

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

import { GET } from "@/app/api/internal/booking-payment-audit/route";
import { log } from "@/lib/logger";

const SECRET = "test-secret";

function makeReq(authorization: string | null = `Bearer ${SECRET}`): NextRequest {
  const headers: Record<string, string> = {};
  if (authorization !== null) headers.authorization = authorization;
  return new NextRequest("http://localhost/api/internal/booking-payment-audit", { headers });
}

function finding(bookingId: string, overrides: Partial<PaymentAuditFinding> = {}): PaymentAuditFinding {
  return {
    code:        "payment_refunded",
    severity:    "error",
    bookingId,
    email:       "s@example.com",
    sessionType: "session1h",
    startsAt:    "2026-10-05T08:00:00.000Z",
    paymentId:   `pi_${bookingId}`,
    ...overrides,
  };
}

function report(overrides: Partial<PaymentAuditReport> = {}): PaymentAuditReport {
  return {
    checked:           3,
    byType:            { free15min: 1, session1h: 1, session2h: 0, pack: 1 },
    manualPackClasses: 0,
    findings:          [],
    ...overrides,
  };
}

describe("REFACTOR-R4-P3-03: GET /api/internal/booking-payment-audit", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    mockAudit.mockResolvedValue(report());
    mockEmailReport.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 403 with a wrong CRON_SECRET", async () => {
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(403);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("returns 403 without an Authorization header", async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(403);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("returns 403 when CRON_SECRET is unset, even for 'Bearer undefined'", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeReq("Bearer undefined"));
    expect(res.status).toBe(403);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("a clean run: 200, an info log, no email", async () => {
    const res  = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checked: 3, findings: 0, details: [] });
    expect(log).toHaveBeenCalledWith("info", "Booking payment audit: all clear", {
      service:           "booking-payment-audit",
      checked:           3,
      byType:            { free15min: 1, session1h: 1, session2h: 0, pack: 1 },
      manualPackClasses: 0,
    });
    expect(log).not.toHaveBeenCalledWith("error", expect.anything(), expect.anything());
    expect(mockEmailReport).not.toHaveBeenCalled();
  });

  it("findings: 200 with the full list, one error log, one email with the report", async () => {
    const details = [finding("b1"), finding("b2", { code: "no_payment_link", paymentId: null })];
    const r = report({ findings: details });
    mockAudit.mockResolvedValue(r);

    const res  = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checked: 3, findings: 2, details });
    expect(log).toHaveBeenCalledWith("error", "Booking payment audit found classes not backed by their payment", {
      service: "booking-payment-audit",
      count:   2,
      errors:  2,
      checked: 3,
      sample:  details,
    });
    expect((log as jest.Mock).mock.calls.filter(([level]) => level === "error")).toHaveLength(1);
    expect(log).not.toHaveBeenCalledWith("info", expect.anything(), expect.anything());
    expect(mockEmailReport).toHaveBeenCalledTimes(1);
    expect(mockEmailReport).toHaveBeenCalledWith(r);
  });

  it("caps the logged sample at 10; the body keeps them all", async () => {
    const details = Array.from({ length: 12 }, (_, i) => finding(`b${i}`));
    mockAudit.mockResolvedValue(report({ checked: 12, findings: details }));

    const body = await (await GET(makeReq())).json();

    expect(body.details).toHaveLength(12);
    expect(log).toHaveBeenCalledWith("error", expect.any(String), expect.objectContaining({
      count: 12, sample: details.slice(0, 10),
    }));
  });

  it("review items only (a pack's partial refund): a warning, not a Sentry error, and still an email", async () => {
    const details = [finding("b1", { code: "payment_partially_refunded", severity: "review", sessionType: "pack" })];
    mockAudit.mockResolvedValue(report({ findings: details }));

    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checked: 3, findings: 1, details });
    expect(log).toHaveBeenCalledWith("warn", "Booking payment audit: classes to review", {
      service: "booking-payment-audit",
      count:   1,
      checked: 3,
      sample:  details,
    });
    expect(log).not.toHaveBeenCalledWith("error", expect.anything(), expect.anything());
    expect(mockEmailReport).toHaveBeenCalledTimes(1);
  });

  it("an email failure is logged and the run still answers 200", async () => {
    const details = [finding("b1")];
    mockAudit.mockResolvedValue(report({ findings: details }));
    mockEmailReport.mockRejectedValue(new Error("resend down"));

    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checked: 3, findings: 1, details });
    expect(log).toHaveBeenCalledWith("warn", "Booking payment audit email failed", {
      service: "booking-payment-audit",
      error:   "Error: resend down",
    });
  });

  it("a failed run (Supabase or Stripe): 500, an error log, no email, no all-clear", async () => {
    mockAudit.mockRejectedValue(new Error("supabase down"));

    const res = await GET(makeReq());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Audit failed" });
    expect(log).toHaveBeenCalledWith("error", "Booking payment audit failed", {
      service: "booking-payment-audit",
      error:   "Error: supabase down",
    });
    expect(log).not.toHaveBeenCalledWith("info", expect.anything(), expect.anything());
    expect(mockEmailReport).not.toHaveBeenCalled();
  });
});
