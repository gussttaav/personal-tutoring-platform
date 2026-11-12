// REFACTOR-R5-P2-02 — the cancellation confirmation picks its money line from the session type:
// a pack class with its credit back, a pack class whose credit couldn't be restored, a paid
// single session (refund line), and nothing about money for the free call.
//
// getTranslations can't resolve Next's config under Jest (see reschedule-url.test.ts), so it is
// mocked to echo the keys it is asked for, and fetch (Resend) is mocked to capture the HTML.

jest.mock("next-intl/server", () => {
  const t = Object.assign((key: string) => `[${key}]`, { raw: (key: string) => `[${key}]` });
  return { getTranslations: jest.fn(async () => t) };
});
jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

import type { SessionType } from "@/domain/types";
import { sendCancellationConfirmationEmail } from "../email-functions";

const MONEY_KEYS = ["creditsRestoredMsg", "noCreditRestoredMsg", "refundMsg"] as const;

describe("sendCancellationConfirmationEmail — money line", () => {
  const fetchMock = jest.fn();
  const savedKey  = process.env.RESEND_API_KEY;

  beforeAll(() => {
    process.env.RESEND_API_KEY = "re_test";
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterAll(() => { process.env.RESEND_API_KEY = savedKey; });
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: "em_1" }) });
  });

  async function moneyKeysIn(sessionType: SessionType, creditsRestored: boolean): Promise<string[]> {
    await sendCancellationConfirmationEmail({
      to: "ana@example.com", studentName: "Ana", sessionLabel: "Clase",
      startIso: "2026-12-01T10:00:00.000Z", sessionType, creditsRestored, locale: "es",
    });
    const { html } = JSON.parse(fetchMock.mock.calls[0]![1].body) as { html: string };
    return MONEY_KEYS.filter(k => html.includes(`[${k}]`));
  }

  it.each<[string, SessionType, boolean, string[]]>([
    ["pack, credit restored",      "pack",      true,  ["creditsRestoredMsg"]],
    ["pack, no credit restored",   "pack",      false, ["noCreditRestoredMsg"]],
    ["session1h",                  "session1h", false, ["refundMsg"]],
    ["session2h",                  "session2h", false, ["refundMsg"]],
    ["free15min",                  "free15min", false, []],
  ])("%s → %j", async (_name, sessionType, restored, expected) => {
    expect(await moneyKeysIn(sessionType, restored)).toEqual(expected);
  });
});
