import type { GoogleReviewPromptState } from "../types";

// Tracks the Google-review CTA lifecycle per user so it can be shown once,
// re-shown after 3 more paid classes, and then permanently dismissed.

export interface IGoogleReviewPromptRepository {
  /** Returns the user's prompt state, or null if they have never seen it. */
  get(userId: string): Promise<GoogleReviewPromptState | null>;

  /**
   * Records that the prompt is being shown now. Increments shown_count and
   * stores the completed-paid-class count at show time. Creates the row if
   * it does not exist.
   */
  recordShown(userId: string, completedCount: number): Promise<void>;

  /**
   * Records that the user declined the prompt. Increments skipped_count and,
   * once the prompt has been shown twice, sets dismissed = true.
   */
  recordDeclined(userId: string): Promise<void>;

  /**
   * Records that the user accepted (clicked through to Google). Sets
   * accepted_at and dismissed = true so it is never shown again.
   */
  recordAccepted(userId: string): Promise<void>;
}
