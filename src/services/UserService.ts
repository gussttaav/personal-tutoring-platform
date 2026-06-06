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

  // i18n: account-level locale preference. Read by the email path (fallback 'es')
  // and seeded into the NEXT_LOCALE cookie at login — never read on the render
  // hot path. See docs/i18n and the seedLocaleOnLogin reconciliation below.
  async getLocale(email: string): Promise<"es" | "en" | null> {
    return this.users.getLocale(email.toLowerCase().trim());
  }

  async setLocale(email: string, locale: "es" | "en"): Promise<void> {
    return this.users.setLocale(email.toLowerCase().trim(), locale);
  }

  // Reconciles users.locale with the request at login and returns the locale to
  // write into the NEXT_LOCALE cookie. Precedence: a stored preference wins
  // (delivers cross-device); otherwise we backfill the effective locale from the
  // cookie (Option B — persist for everyone so background emails work), defaulting
  // to 'es'. The DB always wins at login; one switcher click corrects a mismatch.
  async seedLocaleOnLogin(email: string, cookieLocale?: "es" | "en"): Promise<"es" | "en"> {
    const normalized = email.toLowerCase().trim();
    const stored = await this.users.getLocale(normalized);
    if (stored !== null) return stored;

    const effective = cookieLocale ?? "es";
    await this.users.setLocale(normalized, effective);
    return effective;
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
