// REFACTOR-R4-P2-03: GET /api/policy — the footer modal's two numbers on pages without
// CommerceProviders. Read through the tagged ISR loaders (so an admin edit revalidates it)
// and prerendered.
const mockGetPackValidityDays = jest.fn();
const mockGetScheduleConfig   = jest.fn();
jest.mock("@/lib/pricing-display", () => ({
  getPackValidityDays: () => mockGetPackValidityDays(),
}));
jest.mock("@/lib/schedule-config", () => ({
  getScheduleConfig: () => mockGetScheduleConfig(),
}));

import { GET, dynamic } from "@/app/api/policy/route";

describe("REFACTOR-R4-P2-03: GET /api/policy", () => {
  it("answers the pack validity and the cancellation window from the cached loaders", async () => {
    mockGetPackValidityDays.mockResolvedValue(180);
    mockGetScheduleConfig.mockResolvedValue({ cancelMinNoticeHours: 2, minNoticeHours: 5 });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ packValidityDays: 180, cancelHours: 2 });
  });

  it("is prerendered", () => {
    expect(dynamic).toBe("force-static");
  });
});
