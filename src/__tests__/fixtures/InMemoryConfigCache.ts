// REFACTOR-R3-P3-02: In-memory implementation of IConfigCache for tests.
// Mirrors the Redis adapter's semantics: version-namespaced keys, a version that
// starts at 0, and auto-serialization (values are stored by reference — deep
// copies on read keep tests from mutating cached state through a returned object).
import type { IConfigCache } from "@/domain/repositories/IConfigCache";

export class InMemoryConfigCache implements IConfigCache {
  private store   = new Map<string, unknown>();
  private version = 0;

  /** Test helper: per-method call counts. */
  readonly calls = { currentVersion: 0, get: 0, set: 0, bumpVersion: 0 };

  /** Test helper: the ttl each key was written with, for asserting the TTL backstop. */
  readonly ttls = new Map<string, number>();

  /** Test helper: when set, every method rejects with this error (simulates a Redis outage). */
  failWith: Error | null = null;

  async currentVersion(): Promise<number> {
    this.calls.currentVersion++;
    if (this.failWith) throw this.failWith;
    return this.version;
  }

  async get<T>(key: string): Promise<T | null> {
    this.calls.get++;
    if (this.failWith) throw this.failWith;
    if (!this.store.has(key)) return null;
    return structuredClone(this.store.get(key)) as T;
  }

  async set<T>(key: string, value: T, ttlSec: number): Promise<void> {
    this.calls.set++;
    if (this.failWith) throw this.failWith;
    this.store.set(key, structuredClone(value));
    this.ttls.set(key, ttlSec);
  }

  async bumpVersion(): Promise<void> {
    this.calls.bumpVersion++;
    if (this.failWith) throw this.failWith;
    this.version++;
  }

  /** Test helper: the keys currently cached. */
  keys(): string[] {
    return [...this.store.keys()];
  }
}
