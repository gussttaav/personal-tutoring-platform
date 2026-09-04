// TEST-01: In-memory implementation of IUserRepository for integration tests.
import type { AccountDeletionCounts, IUserRepository } from "@/domain/repositories/IUserRepository";
import { UserNotFoundError } from "@/domain/errors";
import { randomUUID } from "crypto";

type UserRecord = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: "student" | "teacher" | "admin";
  locale?: "es" | "en";
};

export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, UserRecord>();

  async upsert(email: string, name?: string, avatarUrl?: string): Promise<string> {
    const normalized = email.toLowerCase().trim();
    const existing = this.users.get(normalized);
    if (existing) {
      if (name)      existing.name      = name;
      if (avatarUrl) existing.avatarUrl = avatarUrl;
      return existing.id;
    }
    const id = randomUUID();
    this.users.set(normalized, { id, email: normalized, name: name ?? "", avatarUrl, role: "student" });
    return id;
  }

  async findByEmail(email: string): Promise<{ id: string } | null> {
    const normalized = email.toLowerCase().trim();
    const user = this.users.get(normalized);
    return user ? { id: user.id } : null;
  }

  async getRole(email: string): Promise<"student" | "teacher" | "admin" | null> {
    const user = this.users.get(email.toLowerCase().trim());
    return user ? user.role : null;
  }

  async setRole(email: string, role: "student" | "teacher" | "admin"): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const user = this.users.get(normalized);
    if (!user) throw new Error(`User not found: ${email}`);
    user.role = role;
  }

  async getLocale(email: string): Promise<"es" | "en" | null> {
    const user = this.users.get(email.toLowerCase().trim());
    return user?.locale ?? null;
  }

  async setLocale(email: string, locale: "es" | "en"): Promise<void> {
    const normalized = email.toLowerCase().trim();
    let user = this.users.get(normalized);
    if (!user) {
      // Mirror Supabase semantics loosely: locale is only set for known users.
      // Create a minimal row so tests that setLocale before upsert still work.
      const id = randomUUID();
      user = { id, email: normalized, name: "", role: "student" };
      this.users.set(normalized, user);
    }
    user.locale = locale;
  }

  // ACCOUNT-DELETE-01: the real implementation erases 13 tables via a stored
  // procedure; here there is only the user map, so the counts are the users row.
  async deleteAccount(email: string): Promise<AccountDeletionCounts> {
    const normalized = email.toLowerCase().trim();
    if (!this.users.delete(normalized)) throw new UserNotFoundError();
    return { users: 1 };
  }
}
