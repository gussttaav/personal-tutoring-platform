// The History tab's derived numbers.
//
// These exist because the three stat cards are computed on the client from the
// /api/my-bookings/history payload rather than served by an aggregate endpoint —
// so the arithmetic is ours to get right. No jsdom / RTL in this repo, hence pure
// functions tested directly (the pattern resumeHref established next door).

import type { BookingHistoryEntry } from "@/domain/types";
import {
  canReview,
  computeHistoryStats,
  durationMinutes,
  groupByMonth,
  paymentLabel,
} from "@/features/personal-area/history-stats";

const entry = (over: Partial<BookingHistoryEntry> = {}): BookingHistoryEntry => ({
  id:          "b1",
  eventId:     "evt1",
  sessionType: "session1h",
  status:      "completed",
  startsAt:    "2026-06-20T15:00:00.000Z",
  endsAt:      "2026-06-20T16:00:00.000Z",
  note:        null,
  amountCents: 1600,
  currency:    "EUR",
  review:      null,
  ...over,
});

describe("computeHistoryStats", () => {
  it("counts only completed classes", () => {
    const stats = computeHistoryStats([
      entry({ id: "a", status: "completed" }),
      entry({ id: "b", status: "cancelled" }),
      entry({ id: "c", status: "no_show" }),
      entry({ id: "d", status: "completed" }),
    ]);
    expect(stats.completed).toBe(2);
  });

  it("sums duration over completed classes only", () => {
    const stats = computeHistoryStats([
      // 1 h
      entry({ id: "a" }),
      // 2 h, but cancelled — must not count toward time spent
      entry({
        id:       "b",
        status:   "cancelled",
        startsAt: "2026-06-21T15:00:00.000Z",
        endsAt:   "2026-06-21T17:00:00.000Z",
      }),
      // 30 min
      entry({
        id:       "c",
        startsAt: "2026-06-22T15:00:00.000Z",
        endsAt:   "2026-06-22T15:30:00.000Z",
      }),
    ]);
    expect(stats.totalMinutes).toBe(90);
  });

  it("averages the ratings the student gave", () => {
    const stats = computeHistoryStats([
      entry({ id: "a", review: { rating: 5, comment: null } }),
      entry({ id: "b", review: { rating: 4, comment: "ok" } }),
      entry({ id: "c", review: null }),
    ]);
    expect(stats.ratedCount).toBe(2);
    expect(stats.averageRating).toBe(4.5);
  });

  it("reports a null average rather than NaN when nothing is rated", () => {
    const stats = computeHistoryStats([entry(), entry({ id: "b" })]);
    expect(stats.averageRating).toBeNull();
    expect(stats.ratedCount).toBe(0);
  });

  it("returns zeroes for an empty history", () => {
    expect(computeHistoryStats([])).toEqual({
      completed:     0,
      averageRating: null,
      ratedCount:    0,
      totalMinutes:  0,
    });
  });

  it("ignores a malformed span instead of poisoning the total", () => {
    const stats = computeHistoryStats([
      entry({ id: "a" }),
      // endsAt before startsAt — a negative span must not subtract from the sum
      entry({ id: "b", startsAt: "2026-06-21T17:00:00.000Z", endsAt: "2026-06-21T15:00:00.000Z" }),
      entry({ id: "c", startsAt: "not-a-date", endsAt: "also-not-a-date" }),
    ]);
    expect(stats.totalMinutes).toBe(60);
    // They still count as classes that happened — only the duration is unusable.
    expect(stats.completed).toBe(3);
  });
});

describe("groupByMonth", () => {
  // Fixed zone so the assertions do not depend on the machine running them.
  const TZ = "Europe/Madrid";

  it("groups by calendar month and keeps the endpoint's descending order", () => {
    const months = groupByMonth(
      [
        entry({ id: "a", startsAt: "2026-06-20T15:00:00.000Z", endsAt: "2026-06-20T16:00:00.000Z" }),
        entry({ id: "b", startsAt: "2026-06-12T15:00:00.000Z", endsAt: "2026-06-12T16:00:00.000Z" }),
        entry({ id: "c", startsAt: "2026-05-28T15:00:00.000Z", endsAt: "2026-05-28T16:00:00.000Z" }),
      ],
      "es",
      TZ,
    );

    expect(months.map((m) => m.key)).toEqual(["2026-06", "2026-05"]);
    expect(months[0].entries.map((e) => e.id)).toEqual(["a", "b"]);
    expect(months[1].entries.map((e) => e.id)).toEqual(["c"]);
  });

  it("labels months in the requested locale", () => {
    const [es] = groupByMonth([entry()], "es", TZ);
    const [en] = groupByMonth([entry()], "en", TZ);
    expect(es.label.toLowerCase()).toContain("junio");
    expect(en.label.toLowerCase()).toContain("june");
    // The key is language-independent so it stays a stable React key across a switch.
    expect(es.key).toBe(en.key);
  });

  it("splits across a year boundary", () => {
    const months = groupByMonth(
      [
        entry({ id: "a", startsAt: "2027-01-04T15:00:00.000Z", endsAt: "2027-01-04T16:00:00.000Z" }),
        entry({ id: "b", startsAt: "2026-12-28T15:00:00.000Z", endsAt: "2026-12-28T16:00:00.000Z" }),
      ],
      "es",
      TZ,
    );
    expect(months.map((m) => m.key)).toEqual(["2027-01", "2026-12"]);
  });

  it("buckets by the month as seen in the given timezone", () => {
    // 23:30 UTC on 31 May is already 01:30 on 1 June in Madrid (UTC+2 in summer).
    const late = entry({
      id:       "late",
      startsAt: "2026-05-31T23:30:00.000Z",
      endsAt:   "2026-06-01T00:30:00.000Z",
    });
    expect(groupByMonth([late], "es", "Europe/Madrid")[0].key).toBe("2026-06");
    expect(groupByMonth([late], "es", "UTC")[0].key).toBe("2026-05");
  });

  it("returns nothing for an empty history", () => {
    expect(groupByMonth([], "es", TZ)).toEqual([]);
  });
});

describe("paymentLabel", () => {
  it("reads a pack class as one credit", () => {
    expect(paymentLabel(entry({ sessionType: "pack", packSize: 5, amountCents: null, currency: null }), "es"))
      .toEqual({ key: "payCredit" });
  });

  it("reads a CANCELLED pack class as a refunded credit", () => {
    // cancelByToken restores the credit, so "1 crédito" would be wrong here.
    expect(paymentLabel(
      entry({ sessionType: "pack", packSize: 5, status: "cancelled", amountCents: null, currency: null }),
      "es",
    )).toEqual({ key: "payCreditRefunded" });
  });

  it("formats a card payment in the entry's own currency", () => {
    const label = paymentLabel(entry({ amountCents: 7500, currency: "EUR" }), "es");
    expect(label.key).toBe("payCard");
    // Non-breaking spaces vary by ICU version — assert on the digits and symbol.
    expect(label.key === "payCard" && label.amount).toMatch(/75/);
    expect(label.key === "payCard" && label.amount).toMatch(/€/);
  });

  it("defaults to EUR when the row has an amount but no currency", () => {
    const label = paymentLabel(entry({ amountCents: 1600, currency: null }), "es");
    expect(label.key === "payCard" && label.amount).toMatch(/€/);
  });

  it("reads a row with no amount and no pack as free", () => {
    expect(paymentLabel(entry({ sessionType: "free15min", amountCents: null, currency: null }), "es"))
      .toEqual({ key: "payFree" });
  });
});

describe("canReview", () => {
  it("allows rating a completed, unrated class", () => {
    expect(canReview(entry())).toBe(true);
  });

  it("refuses a class that is already rated", () => {
    expect(canReview(entry({ review: { rating: 5, comment: null } }))).toBe(false);
  });

  it("refuses a cancelled class", () => {
    expect(canReview(entry({ status: "cancelled" }))).toBe(false);
  });

  it("refuses a class with no eventId", () => {
    // POST /api/reviews is keyed by eventId; "" has nothing to key against.
    expect(canReview(entry({ eventId: "" }))).toBe(false);
  });
});

describe("durationMinutes", () => {
  it("measures the booked span", () => {
    expect(durationMinutes(entry())).toBe(60);
  });

  it("returns 0 for an unusable span rather than a negative number", () => {
    expect(durationMinutes(entry({ startsAt: "2026-06-20T16:00:00.000Z", endsAt: "2026-06-20T15:00:00.000Z" })))
      .toBe(0);
    expect(durationMinutes(entry({ startsAt: "nope", endsAt: "nope" }))).toBe(0);
  });
});
