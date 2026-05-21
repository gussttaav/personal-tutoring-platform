// Post-class review orchestration: captures the rating immediately, stores an
// optional comment, and decides when to surface the Google-review CTA.
import type { IReviewRepository } from "@/domain/repositories/IReviewRepository";
import type { IGoogleReviewPromptRepository } from "@/domain/repositories/IGoogleReviewPromptRepository";
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { ReviewDecision, SessionType } from "@/domain/types";
import { ReviewBookingNotFoundError } from "@/domain/errors";
import { UserService } from "./UserService";

const PAID_TYPES: ReadonlySet<SessionType> = new Set<SessionType>([
  "session1h",
  "session2h",
  "pack",
]);

// How many additional completed paid classes must elapse before re-showing the
// Google-review CTA to a user who skipped it the first time.
const RESHOW_AFTER_PAID_CLASSES = 3;

export class ReviewService {
  constructor(
    private readonly reviews:     IReviewRepository,
    private readonly gprompt:     IGoogleReviewPromptRepository,
    private readonly bookings:    IBookingRepository,
    private readonly userService: UserService,
  ) {}

  /**
   * Persists the rating immediately and returns whether the flow should show
   * the Google-review CTA instead of the comment textarea.
   */
  async submitRating(params: {
    eventId:   string;
    userEmail: string;
    rating:    number;
  }): Promise<ReviewDecision> {
    const { userId, booking } = await this.resolveBooking(params.eventId, params.userEmail);

    // Mark the class completed before counting so "first class" => count 1.
    await this.bookings.markCompleted(booking.id);
    await this.reviews.upsertRating(booking.id, userId, params.rating);

    const showGoogleReview = await this.shouldShowGooglePrompt(
      userId,
      params.rating,
      booking.sessionType,
    );

    return { showGoogleReview };
  }

  async submitComment(params: {
    eventId:   string;
    userEmail: string;
    comment:   string;
  }): Promise<void> {
    const { booking } = await this.resolveBooking(params.eventId, params.userEmail);
    await this.reviews.setComment(booking.id, params.comment);
  }

  async declineGoogle(userEmail: string): Promise<void> {
    const userId = await this.userService.ensureUser(userEmail);
    await this.gprompt.recordDeclined(userId);
  }

  async acceptGoogle(userEmail: string): Promise<void> {
    const userId = await this.userService.ensureUser(userEmail);
    await this.gprompt.recordAccepted(userId);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async resolveBooking(eventId: string, userEmail: string) {
    const userId = await this.userService.ensureUser(userEmail);
    const booking = await this.bookings.findIdByEventIdForUser(eventId, userId);
    if (!booking) throw new ReviewBookingNotFoundError();
    return { userId, booking };
  }

  private async shouldShowGooglePrompt(
    userId:      string,
    rating:      number,
    sessionType: SessionType,
  ): Promise<boolean> {
    if (rating < 4) return false;
    if (!PAID_TYPES.has(sessionType)) return false;

    const state = await this.gprompt.get(userId);
    if (state?.dismissed || state?.acceptedAt) return false;

    const shownCount     = state?.shownCount ?? 0;
    const completedCount = await this.bookings.countCompletedPaid(userId);

    let eligible: boolean;
    if (shownCount === 0) {
      // First qualifying (>=4) paid class — a low earlier rating just defers it.
      eligible = true;
    } else if (shownCount === 1) {
      const lastShown = state?.lastShownCompletedCount ?? 0;
      eligible = completedCount >= lastShown + RESHOW_AFTER_PAID_CLASSES;
    } else {
      eligible = false;
    }

    if (!eligible) return false;

    await this.gprompt.recordShown(userId, completedCount);
    return true;
  }
}
