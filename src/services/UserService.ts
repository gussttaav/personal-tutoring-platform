import type { IUserRepository } from "@/domain/repositories/IUserRepository";
import { log } from "@/lib/logger";

export class UserService {
  constructor(private readonly users: IUserRepository) {}

  async ensureUser(email: string, name?: string, avatarUrl?: string): Promise<string> {
    return this.users.upsert(email, name, avatarUrl);
  }

  async findByEmail(email: string): Promise<{ id: string } | null> {
    return this.users.findByEmail(email);
  }

  // REFACTOR-P2-02: Pure DB role lookup. Creates the user as 'student' if they
  // don't exist yet. ADMIN_EMAILS is never consulted here — bootstrap happens
  // once at server startup via bootstrapAdminsFromEnv().
  async getRoleAndBootstrap(email: string): Promise<"student" | "teacher" | "admin"> {
    const normalized = email.toLowerCase().trim();
    const role = await this.users.getRole(normalized);
    if (role === null) {
      await this.ensureUser(normalized);
      return "student";
    }
    return role;
  }

  // REFACTOR-P2-02: Called once at server startup (instrumentation.ts). Reads
  // ADMIN_EMAILS, upserts each address, and promotes any at 'student' to
  // 'admin'. Teachers and existing admins are left unchanged.
  async bootstrapAdminsFromEnv(): Promise<void> {
    const emails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    for (const email of emails) {
      try {
        const role = await this.users.getRole(email);
        if (role === null || role === "student") {
          await this.ensureUser(email);
          await this.users.setRole(email, "admin");
          log("info", "Bootstrapped admin role from ADMIN_EMAILS", {
            service: "UserService",
            email,
          });
        }
      } catch (err) {
        log("error", "Failed to bootstrap admin role", {
          service: "UserService",
          email,
          error: err,
        });
      }
    }
  }
}
