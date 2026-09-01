// ARCH-10: Audit repository interface.
import type { AuditEntry } from "../types";

export interface IAuditRepository {
  /**
   * Appends an audit entry for a user. The implementation sets the `ts` field
   * to the current ISO timestamp. Non-blocking — implementations should not let
   * audit failures propagate to callers.
   */
  append(email: string, entry: Omit<AuditEntry, "ts">): Promise<void>;

  /**
   * Returns the most recent audit entries for a user, newest first. Defaults
   * to a reasonable cap (e.g. 100) if limit is not specified. Returns an empty
   * array if no entries exist for the email.
   */
  list(email: string, limit?: number): Promise<AuditEntry[]>;

  /**
   * COURSE-P6-02: emails already recorded under `action` with a matching
   * `details.announcementKey`. One query, so a bulk send can skip what it already
   * delivered without asking per recipient — which is what makes a partial send
   * retryable rather than a double-send.
   */
  listNotifiedEmails(action: string, announcementKey: string): Promise<Set<string>>;
}
