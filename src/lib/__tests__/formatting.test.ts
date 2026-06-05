import { formatDate, formatTime, formatCurrency } from "../formatting";

// All tests use Europe/Madrid as the implicit timezone (pinned in formatting.ts).

describe("formatDate", () => {
  it("formats a winter date in Spanish", () => {
    // 15 January 2026, 10:00 UTC = 11:00 Madrid (UTC+1 in winter)
    const result = formatDate("2026-01-15T10:00:00.000Z", "es");
    expect(result).toMatch(/enero/i);
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/15/);
  });

  it("formats a winter date in English (en-GB style)", () => {
    const result = formatDate("2026-01-15T10:00:00.000Z", "en");
    expect(result).toMatch(/January/i);
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/15/);
  });

  it("accepts a Date object", () => {
    const date = new Date("2026-06-01T08:00:00.000Z");
    expect(() => formatDate(date, "es")).not.toThrow();
  });

  it("passes opts override — weekday only", () => {
    // A known Monday in Madrid time
    const result = formatDate("2026-01-19T10:00:00.000Z", "es", { weekday: "long", year: undefined, day: undefined, month: undefined });
    // "lunes" is Monday in Spanish
    expect(result.toLowerCase()).toContain("lunes");
  });

  it("handles DST spring-forward boundary (last Sunday of March, Madrid)", () => {
    // 2026-03-29 at 01:00 UTC = 02:00 Madrid (clocks jump from 02:00 to 03:00)
    // Should still produce a valid date string without throwing
    expect(() => formatDate("2026-03-29T01:00:00.000Z", "es")).not.toThrow();
    expect(() => formatDate("2026-03-29T01:00:00.000Z", "en")).not.toThrow();
  });

  it("handles DST spring-forward — date resolves to correct day", () => {
    // 2026-03-29T10:00:00Z = noon in Madrid (UTC+2 after spring forward)
    const es = formatDate("2026-03-29T10:00:00.000Z", "es");
    const en = formatDate("2026-03-29T10:00:00.000Z", "en");
    expect(es).toMatch(/29/);
    expect(en).toMatch(/29/);
  });
});

describe("formatTime", () => {
  it("formats 10:00 Madrid time in Spanish (24h)", () => {
    // 10:00 Madrid winter = 09:00 UTC
    const result = formatTime("2026-01-15T09:00:00.000Z", "es");
    expect(result).toMatch(/10[:​]00/);
  });

  it("formats 10:00 Madrid time in English (24h, en-GB)", () => {
    const result = formatTime("2026-01-15T09:00:00.000Z", "en");
    expect(result).toMatch(/10[:​]00/);
  });

  it("handles DST spring-forward boundary time", () => {
    // Just after spring forward: 01:30 UTC = 03:30 Madrid (clocks skipped 02:xx)
    expect(() => formatTime("2026-03-29T01:30:00.000Z", "es")).not.toThrow();
    expect(() => formatTime("2026-03-29T01:30:00.000Z", "en")).not.toThrow();
  });

  it("accepts a Date object", () => {
    expect(() => formatTime(new Date(), "en")).not.toThrow();
  });
});

describe("formatCurrency", () => {
  it("formats euros in Spanish locale", () => {
    const result = formatCurrency(30, "es");
    expect(result).toContain("30");
    expect(result).toContain("€");
  });

  it("formats euros in English locale", () => {
    const result = formatCurrency(30, "en");
    expect(result).toContain("30");
    expect(result).toContain("€");
  });

  it("formats non-default currency", () => {
    const result = formatCurrency(100, "en", "USD");
    expect(result).toContain("100");
    expect(result).toContain("$");
  });
});
