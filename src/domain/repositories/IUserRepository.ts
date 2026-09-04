/**
 * ACCOUNT-DELETE-01: per-table row counts erased by deleteAccount, for logging.
 * Keys are table names; the set is whatever the stored procedure touched.
 */
export type AccountDeletionCounts = Record<string, number>;

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

  /**
   * ACCOUNT-DELETE-01: erases the user and every row linked to it, in one
   * transaction. IRREVERSIBLE -- there is no soft-delete and no grace period.
   * Callers are responsible for tearing down external artifacts (Google Calendar
   * events) first; this only touches Postgres.
   *
   * Throws UserNotFoundError if no user has this email.
   */
  deleteAccount(email: string): Promise<AccountDeletionCounts>;
}
