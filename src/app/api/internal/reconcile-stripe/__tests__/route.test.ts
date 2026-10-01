// REFACTOR-P4-01: reconciliation cron tests.
// REFACTOR-R4-P3-01: the route is a thin dispatcher over
// PaymentService.reconcileRecentPayments, so these tests pin only its contract with
// cron-job.org — the auth check, the constants, the log lines and the response body.
// The proof matrix (pack / single / unknown type, paging, page cap) lives in
// src/services/__tests__/PaymentService.test.ts.
import { NextRequest } from "next/server";
import type { ReconcileMismatch, ReconcileResult } from "@/services/PaymentService";

const mockReconcile = jest.fn();
jest.mock("@/services", () => ({
  paymentService: {
    reconcileRecentPayments: (...args: unknown[]) => mockReconcile(...args),
  },
}));

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

import { GET } from "@/app/api/internal/reconcile-stripe/route";
import { log } from "@/lib/logger";

const SECRET = "test-secret";

function makeReq(secret: string | null = SECRET): NextRequest {
  const headers: Record<string, string> = {};
  if (secret !== null) headers.authorization = `Bearer ${secret}`;
  return new NextRequest("http://localhost/api/internal/reconcile-stripe", { headers });
}

function mismatch(id: string, overrides: Partial<ReconcileMismatch> = {}): ReconcileMismatch {
  return {
    paymentIntentId: id,
    amount:          5000,
    currency:        "eur",
    email:           "s@example.com",
    createdAt:       "2023-11-14T22:13:20.000Z",
    reason:          "no_booking",
    ...overrides,
  };
}

function resolveWith(result: Partial<ReconcileResult>) {
  mockReconcile.mockResolvedValue({ scanned: 0, mismatches: [], hitPageCap: false, ...result });
}

describe("REFACTOR-P4-01: GET /api/internal/reconcile-stripe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    resolveWith({});
  });

  it("returns 403 without a valid CRON_SECRET", async () => {
    const res = await GET(makeReq("wrong"));
    expect(res.status).toBe(403);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("returns 403 without an Authorization header", async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(403);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("reconciles the last 48 hours, 100 per page, at most 10 pages", async () => {
    await GET(makeReq());

    expect(mockReconcile).toHaveBeenCalledWith({ lookbackHours: 48, pageSize: 100, maxPages: 10 });
  });

  it("returns 0 mismatches and logs all clear when every PI is accounted for", async () => {
    resolveWith({ scanned: 2 });

    const res  = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ scanned: 2, mismatches: 0, details: [] });
    expect(log).toHaveBeenCalledWith("info", "Stripe reconciliation: all clear", {
      service: "reconciliation",
      scanned: 2,
    });
    expect(log).not.toHaveBeenCalledWith("error", expect.anything(), expect.anything());
  });

  it("returns the count and the full list of mismatches", async () => {
    const details = [mismatch("pi_pack1", { reason: "no_credit_pack" }), mismatch("pi_single1")];
    resolveWith({ scanned: 3, mismatches: details });

    const res  = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ scanned: 3, mismatches: 2, details });
  });

  it("logs mismatches at error level with a sample capped at 10", async () => {
    const details = Array.from({ length: 12 }, (_, i) => mismatch(`pi_${i}`));
    resolveWith({ scanned: 40, mismatches: details });

    const body = await (await GET(makeReq())).json();

    expect(body.details).toHaveLength(12);
    expect(log).toHaveBeenCalledWith("error", "Stripe reconciliation found mismatched PaymentIntents", {
      service: "reconciliation",
      count:   12,
      scanned: 40,
      sample:  details.slice(0, 10),
    });
  });

  it("warns when the run hit the page cap", async () => {
    resolveWith({ scanned: 1000, hitPageCap: true });

    await GET(makeReq());

    expect(log).toHaveBeenCalledWith("warn", "Reconciliation hit page cap — may have missed older PIs", {
      service:       "reconciliation",
      lookbackHours: 48,
      maxPages:      10,
    });
  });

  it("does not warn below the page cap", async () => {
    await GET(makeReq());

    expect(log).not.toHaveBeenCalledWith("warn", expect.anything(), expect.anything());
  });

  it("returns 500 and logs when the run fails (e.g. a proof read errors)", async () => {
    mockReconcile.mockRejectedValue(new Error("supabase down"));

    const res = await GET(makeReq());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Reconciliation failed" });
    expect(log).toHaveBeenCalledWith("error", "Reconciliation cron failed", {
      service: "reconciliation",
      error:   "Error: supabase down",
    });
  });
});
