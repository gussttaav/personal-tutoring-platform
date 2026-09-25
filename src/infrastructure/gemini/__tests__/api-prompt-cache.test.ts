/**
 * PRICING-STUDENT-01 — the Gemini system-prompt cache must not serve one
 * caller's prompt to another.
 *
 * REFACTOR-P2-03 uploads the system prompt to Gemini once and references it by id
 * for 5 minutes. That was safe while every request built the same prompt from the
 * global public prices. Now the prompt can carry a single student's private price,
 * so a slot holding prompt A must never be reused for prompt B — otherwise the
 * first student to chat in a window has their private price answered to everyone,
 * anonymous visitors included.
 */

const CACHE_URL = "https://generativelanguage.googleapis.com/v1beta/cachedContents";

interface Sent { url: string; body: Record<string, unknown> }

function installFetch(sent: Sent[], cacheName = "cachedContents/abc") {
  global.fetch = jest.fn(async (url: unknown, init?: unknown) => {
    const u = String(url);
    const body = JSON.parse((init as { body: string }).body) as Record<string, unknown>;
    sent.push({ url: u, body });

    if (u === CACHE_URL) {
      return { ok: true, json: async () => ({ name: cacheName }) } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

async function freshModule() {
  let mod!: typeof import("../api");
  await jest.isolateModulesAsync(async () => {
    mod = await import("../api");
  });
  return mod;
}

beforeEach(() => {
  jest.resetModules();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("Gemini system-prompt cache isolation", () => {
  it("reuses the cache only for the identical prompt", async () => {
    const sent: Sent[] = [];
    installFetch(sent);
    const api = await freshModule();

    await api.chat("PUBLIC PROMPT pack10=14000", [], "hi");
    await api.chat("PUBLIC PROMPT pack10=14000", [], "again");

    const creates = sent.filter((s) => s.url === CACHE_URL);
    const calls   = sent.filter((s) => s.url !== CACHE_URL);
    expect(creates).toHaveLength(1);                       // uploaded once
    expect(calls.every((c) => c.body.cachedContent)).toBe(true);
  });

  it("does NOT serve a cached prompt to a different prompt", async () => {
    const sent: Sent[] = [];
    installFetch(sent);
    const api = await freshModule();

    await api.chat("PUBLIC PROMPT pack10=14000", [], "hi");
    sent.length = 0;
    await api.chat("PRIVATE PROMPT pack10=9999", [], "hi");

    const call = sent.find((s) => s.url !== CACHE_URL)!;
    // The student's request must carry its OWN instruction inline...
    expect(call.body.cachedContent).toBeUndefined();
    expect(call.body.system_instruction).toEqual({
      parts: [{ text: "PRIVATE PROMPT pack10=9999" }],
    });
    // ...and must not have evicted/replaced the shared public slot.
    expect(sent.filter((s) => s.url === CACHE_URL)).toHaveLength(0);
  });

  it("keeps serving the public prompt from cache after a private one", async () => {
    const sent: Sent[] = [];
    installFetch(sent);
    const api = await freshModule();

    await api.chat("PUBLIC PROMPT pack10=14000", [], "hi");
    await api.chat("PRIVATE PROMPT pack10=9999", [], "hi");
    sent.length = 0;
    await api.chat("PUBLIC PROMPT pack10=14000", [], "hi");

    const call = sent.find((s) => s.url !== CACHE_URL)!;
    expect(call.body.cachedContent).toBe("cachedContents/abc");
    expect(call.body.system_instruction).toBeUndefined();
  });

  it("falls back inline for everyone when the cache upload fails", async () => {
    const sent: Sent[] = [];
    global.fetch = jest.fn(async (url: unknown, init?: unknown) => {
      const u = String(url);
      sent.push({ url: u, body: JSON.parse((init as { body: string }).body) });
      if (u === CACHE_URL) return { ok: false, status: 500, text: async () => "boom" } as unknown as Response;
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const api = await freshModule();

    await api.chat("PUBLIC PROMPT", [], "hi");

    const call = sent.find((s) => s.url !== CACHE_URL)!;
    expect(call.body.system_instruction).toEqual({ parts: [{ text: "PUBLIC PROMPT" }] });
  });
});
