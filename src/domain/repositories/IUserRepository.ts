export interface IUserRepository {
  upsert(email: string, name?: string, avatarUrl?: string): Promise<string>;
  findByEmail(email: string): Promise<{ id: string } | null>;

  /** Returns the user's role, or null if user doesn't exist. */
  getRole(email: string): Promise<"student" | "teacher" | "admin" | null>;

  /** Updates a user's role. Throws if user doesn't exist. */
  setRole(email: string, role: "student" | "teacher" | "admin"): Promise<void>;
}
