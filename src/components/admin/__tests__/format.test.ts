// ADMIN-03: the admin date helpers format in the timezone they are given (the tutor's
// ScheduleConfig.timezone), never the runtime's — on Vercel that is UTC, 1–2 h off Madrid.
// Instants are pinned in UTC, so the assertions hold whatever zone Jest runs in.
import { fmtDate, fmtDateTime, fmtShort } from "@/components/admin/format";

const MADRID = "Europe/Madrid";

// Summer time (CEST, UTC+2).
const SUMMER = "2026-10-09T20:14:00.000Z";
// Winter time (CET, UTC+1).
const WINTER = "2026-12-03T08:05:00.000Z";
// 23:30 UTC is already the next day in Madrid. PostgREST spelling, as the pages receive it.
const LATE_EVENING = "2026-11-30T23:30:00+00:00";

describe("fmtDateTime", () => {
  it("renders the wall-clock time in Madrid, summer and winter", () => {
    expect(fmtDateTime(SUMMER, MADRID)).toBe("09/10/2026, 22:14");
    expect(fmtDateTime(WINTER, MADRID)).toBe("03/12/2026, 09:05");
  });

  it("rolls over to the next day when Madrid is past midnight", () => {
    expect(fmtDateTime(LATE_EVENING, MADRID)).toBe("01/12/2026, 00:30");
  });

  it("follows the zone it is given", () => {
    expect(fmtDateTime(SUMMER, "UTC")).toBe("09/10/2026, 20:14");
  });
});

describe("fmtDate", () => {
  it("renders the calendar day in Madrid", () => {
    expect(fmtDate(SUMMER, MADRID)).toBe("09/10/2026");
    expect(fmtDate(LATE_EVENING, MADRID)).toBe("01/12/2026");
    expect(fmtDate(LATE_EVENING, "UTC")).toBe("30/11/2026");
  });
});

describe("fmtShort", () => {
  it("renders day/month and time in Madrid", () => {
    expect(fmtShort(SUMMER, MADRID)).toBe("9/10, 22:14");
    expect(fmtShort(WINTER, MADRID)).toBe("3/12, 09:05");
    expect(fmtShort(LATE_EVENING, MADRID)).toBe("1/12, 00:30");
  });
});
