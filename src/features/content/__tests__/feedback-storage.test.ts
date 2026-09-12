// CONTENT-FEEDBACK-01 — localStorage access must never throw and must dedupe the id.
import { getClientId, makeUuid, readVote, writeVote } from "../feedback-storage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem:    (k: string) => map.get(k) ?? null,
    setItem:    (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear:      () => map.clear(),
    key:        (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}

function throwingStorage(): Storage {
  const boom = () => { throw new Error("QuotaExceededError"); };
  return { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 };
}

const REF = { contentType: "post", contentKey: "por-que-empiezo-un-blog" };

describe("makeUuid", () => {
  it("produces a v4 uuid", () => {
    expect(makeUuid()).toMatch(UUID_RE);
  });
});

describe("getClientId", () => {
  it("mints a uuid once and reuses it", () => {
    const storage = memoryStorage();
    const first  = getClientId(storage);
    const second = getClientId(storage);
    expect(first).toMatch(UUID_RE);
    expect(second).toBe(first);
    expect(storage.getItem("content:clientId")).toBe(first);
  });

  it("replaces a corrupted stored value", () => {
    const storage = memoryStorage();
    storage.setItem("content:clientId", "not-a-uuid");
    expect(getClientId(storage)).toMatch(UUID_RE);
  });

  it("never throws on a hostile storage and stays stable for the page load", () => {
    const a = getClientId(throwingStorage());
    const b = getClientId(throwingStorage());
    expect(a).toMatch(UUID_RE);
    expect(b).toBe(a);
  });

  it("works with no storage at all", () => {
    expect(getClientId(null)).toMatch(UUID_RE);
  });
});

describe("readVote / writeVote", () => {
  it("round-trips a vote per content and returns null when none is stored", () => {
    const storage = memoryStorage();
    expect(readVote(storage, REF)).toBeNull();

    writeVote(storage, REF, -1);
    expect(readVote(storage, REF)).toBe(-1);
    expect(readVote(storage, { ...REF, contentKey: "otro" })).toBeNull();

    writeVote(storage, REF, 1);
    expect(readVote(storage, REF)).toBe(1);
  });

  it("treats garbage as no vote", () => {
    const storage = memoryStorage();
    storage.setItem("content:vote:post:por-que-empiezo-un-blog", "yes");
    expect(readVote(storage, REF)).toBeNull();
  });

  it("swallows storage failures", () => {
    expect(() => writeVote(throwingStorage(), REF, 1)).not.toThrow();
    expect(readVote(throwingStorage(), REF)).toBeNull();
    expect(readVote(null, REF)).toBeNull();
  });
});
