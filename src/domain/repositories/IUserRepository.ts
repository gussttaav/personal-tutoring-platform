export interface IUserRepository {
  upsert(email: string, name?: string, avatarUrl?: string): Promise<string>;
  findByEmail(email: string): Promise<{ id: string } | null>;

  /** Returns the user's role, or null if user doesn't exist. */
  getRole(email: string): Promise<"student" | "teacher" | "admin" | null>;

  /** Updates a user's role. Throws if user doesn't exist. */
  setRole(email: string, role: "student" | "teacher" | "admin"): Promise<void>;

  /** Returns the user's saved locale, or null if unset / user doesn't exist. */
  getLocale(email: string): Promise<"es" | "en" | null>;

  /** Persists the user's locale preference. */
  setLocale(email: string, locale: "es" | "en"): Promise<void>;
}
