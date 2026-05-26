// TEST-01: In-memory implementation of IUserRepository for integration tests.
import type { IUserRepository } from "@/domain/repositories/IUserRepository";
import { randomUUID } from "crypto";

type UserRecord = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: "student" | "teacher" | "admin";
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
}
