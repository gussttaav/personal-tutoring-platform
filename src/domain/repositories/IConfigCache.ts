// REFACTOR-R3-P3-02 — Port for the version-keyed admin-config cache.
//
// Version-namespaced rather than delete-based: an admin edit bumps the version,
// which instantly orphans every key under the old namespace (old keys expire on
// their own TTL). Implementations must be safe to call on a cold cache —
// `currentVersion()` resolves to 0 when the counter was never set.

export interface IConfigCache {
  /** Returns the current global config version (0 if unset). */
  currentVersion(): Promise<number>;
  /** Reads a cached value, or null on miss. */
  get<T>(key: string): Promise<T | null>;
  /** Writes a value with a TTL backstop in seconds. */
  set<T>(key: string, value: T, ttlSec: number): Promise<void>;
  /** Bumps the version, orphaning every key under the old namespace. */
  bumpVersion(): Promise<void>;
}
