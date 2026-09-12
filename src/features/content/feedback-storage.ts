/*
 * CONTENT-FEEDBACK-01 — what the widget remembers in the browser.
 *
 * Two things, both per-browser and both optional:
 *   - a random client id, the dedupe key for ANONYMOUS votes (the server upserts
 *     on it, so a 👍→👎 switch updates one row instead of adding a second);
 *   - the vote cast on each page, so the pressed thumb survives a reload without
 *     the page having to GET anything on mount (the reader route ships static).
 *
 * Every call takes the Storage explicitly and swallows every failure: Safari
 * private mode throws on write, some embeds throw on ACCESS, and a page that
 * cannot remember a vote must still be able to cast one. With no storage the id
 * lives for the page load only (`memoryId`), which is exactly the right fallback —
 * the vote still lands, it just cannot be deduped on the next visit.
 *
 * Keys follow the house `namespace:name` convention (chat:sessionId, …).
 */

const CLIENT_ID_KEY = "content:clientId";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memoryId: string | null = null;

/** The browser's Storage, or null when merely touching it throws. */
export function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** RFC 4122 v4. `crypto.randomUUID` needs a secure context, so keep a fallback. */
export function makeUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Returns the stored client id, minting (and trying to persist) one if absent. */
export function getClientId(storage: Storage | null): string {
  try {
    const stored = storage?.getItem(CLIENT_ID_KEY);
    if (stored && UUID_RE.test(stored)) return stored;
  } catch {
    // fall through to mint
  }
  const id = memoryId ?? makeUuid();
  memoryId = id;
  try {
    storage?.setItem(CLIENT_ID_KEY, id);
  } catch {
    // unwritable storage: the id lives for this page load only
  }
  return id;
}

export interface VoteRef {
  contentType: string;
  contentKey:  string;
}

function voteStorageKey(ref: VoteRef): string {
  return `content:vote:${ref.contentType}:${ref.contentKey}`;
}

export function readVote(storage: Storage | null, ref: VoteRef): 1 | -1 | null {
  try {
    const raw = storage?.getItem(voteStorageKey(ref));
    return raw === "1" ? 1 : raw === "-1" ? -1 : null;
  } catch {
    return null;
  }
}

export function writeVote(storage: Storage | null, ref: VoteRef, vote: 1 | -1): void {
  try {
    storage?.setItem(voteStorageKey(ref), String(vote));
  } catch {
    // a vote the browser cannot remember is still a vote the server received
  }
}
