// REFACTOR-P4-01: reconciliation cron tests.
import { NextRequest } from "next/server";

const mockList = jest.fn();
jest.mock("@/infrastructure/stripe/client-singleton", () => ({
  stripe: { paymentIntents: { list: (...args: unknown[]) => mockList(...args) } },
}));

const mockHasProcessedPayment = jest.fn();
const mockHasBookingForPayment = jest.fn();
const mockHasFailedBooking     = jest.fn();
const mockIsProcessed          = jest.fn();
jest.mock("@/infrastructure/supabase", () => ({
  supabaseCreditsRepository: {
    hasProcessedPayment: (...args: unknown[]) => mockHasProcessedPayment(...args),
  },
  supabaseBookingRepository: {
    hasBookingForPayment: (...args: unknown[]) => mockHasBookingForPayment(...args),
  },
  supabasePaymentRepository: {
    hasFailedBooking: (...args: unknown[]) => mockHasFailedBooking(...args),
    isProcessed:      (...args: unknown[]) => mockIsProcessed(...args),
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

function pi(
  id: string,
  checkoutType: string | undefined,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    status:   "succeeded",
    amount:   5000,
    currency: "eur",
    created:  1_700_000_000,
    metadata: { checkout_type: checkoutType, student_email: "s@example.com" },
    ...overrides,
  };
}

function onePage(data: unknown[]) {
  mockList.mockResolvedValue({ data, has_more: false });
}

describe("REFACTOR-P4-01: GET /api/internal/reconcile-stripe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    onePage([]);
    mockHasProcessedPayment.mockResolvedValue(true);
    mockHasBookingForPayment.mockResolvedValue(true);
    mockHasFailedBooking.mockResolvedValue(false);
    mockIsProcessed.mockResolvedValue(true);
  });

  it("returns 403 without a valid CRON_SECRET", async () => {
    const res = await GET(makeReq("wrong"));
    expect(res.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("returns 0 mismatches when every PI is accounted for", async () => {
    onePage([pi("pi_pack1", "pack"), pi("pi_single1", "single")]);

    const res  = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.scanned).toBe(2);
    expect(body.mismatches).toBe(0);
    expect(body.details).toEqual([]);
  });

  it("flags a pack PI with no credit_packs row", async () => {
    onePage([pi("pi_pack1", "pack")]);
    mockHasProcessedPayment.mockResolvedValue(false);

    const res  = await GET(makeReq());
    const body = await res.json();

    expect(body.mismatches).toBe(1);
    expect(body.details[0]).toMatchObject({
      paymentIntentId: "pi_pack1",
      reason:          "no_credit_pack",
    });
  });

  it("does NOT flag a single PI that has a failed_bookings entry", async () => {
    onePage([pi("pi_single1", "single")]);
    mockHasBookingForPayment.mockResolvedValue(false);
    mockHasFailedBooking.mockResolvedValue(true);

    const res  = await GET(makeReq());
    const body = await res.json();

    expect(body.mismatches).toBe(0);
  });

  it("flags a single PI with no booking, dead-letter, or processed marker", async () => {
    onePage([pi("pi_single1", "single")]);
    mockHasBookingForPayment.mockResolvedValue(false);
    mockHasFailedBooking.mockResolvedValue(false);
    mockIsProcessed.mockResolvedValue(false);

    const res  = await GET(makeReq());
    const body = await res.json();

    expect(body.mismatches).toBe(1);
    expect(body.details[0]).toMatchObject({
      paymentIntentId: "pi_single1",
      reason:          "no_booking",
    });
  });

  it("skips non-succeeded PIs", async () => {
    onePage([pi("pi_pending", "pack", { status: "processing" })]);
    mockHasProcessedPayment.mockResolvedValue(false);

    const res  = await GET(makeReq());
    const body = await res.json();

    expect(body.scanned).toBe(1);
    expect(body.mismatches).toBe(0);
    expect(mockHasProcessedPayment).not.toHaveBeenCalled();
  });

  it("logs at error level when mismatches > 0", async () => {
    onePage([pi("pi_pack1", "pack")]);
    mockHasProcessedPayment.mockResolvedValue(false);

    await GET(makeReq());

    expect(log).toHaveBeenCalledWith("error", expect.any(String), expect.any(Object));
  });
});
