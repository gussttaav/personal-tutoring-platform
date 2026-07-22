import { ReviewService } from "../ReviewService";
import { UserService }   from "../UserService";
import type { IReviewRepository } from "@/domain/repositories/IReviewRepository";
import type { IGoogleReviewPromptRepository } from "@/domain/repositories/IGoogleReviewPromptRepository";
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { GoogleReviewPromptState, SessionType } from "@/domain/types";
import { ReviewBookingNotFoundError } from "@/domain/errors";

const USER_ID    = "user-uuid";
const BOOKING_ID = "booking-uuid";
const EVENT_ID   = "evt-123";
const EMAIL      = "student@example.com";

const mockReviews = (): jest.Mocked<IReviewRepository> => ({
  upsertRating:     jest.fn().mockResolvedValue(undefined),
  setComment:       jest.fn().mockResolvedValue(undefined),
  findByBookingIds: jest.fn().mockResolvedValue(new Map()),
});

const mockGprompt = (): jest.Mocked<IGoogleReviewPromptRepository> => ({
  get:            jest.fn().mockResolvedValue(null),
  recordShown:    jest.fn().mockResolvedValue(undefined),
  recordDeclined: jest.fn().mockResolvedValue(undefined),
  recordAccepted: jest.fn().mockResolvedValue(undefined),
});

const mockBookings = (sessionType: SessionType = "session1h") =>
  ({
    findIdByEventIdForUser: jest
      .fn()
      .mockResolvedValue({ id: BOOKING_ID, sessionType, status: "confirmed" }),
    markCompleted:      jest.fn().mockResolvedValue(undefined),
    countCompletedPaid: jest.fn().mockResolvedValue(1),
  } as unknown as jest.Mocked<IBookingRepository>);

const mockUserService = () =>
  ({
    ensureUser:  jest.fn().mockResolvedValue(USER_ID),
    findByEmail: jest.fn().mockResolvedValue({ id: USER_ID }),
  } as unknown as jest.Mocked<Pick<UserService, "ensureUser" | "findByEmail">>);

function make(opts: {
  sessionType?: SessionType;
  promptState?: GoogleReviewPromptState | null;
  completed?:   number;
} = {}) {
  const reviews  = mockReviews();
  const gprompt  = mockGprompt();
  const bookings = mockBookings(opts.sessionType ?? "session1h");
  const userSvc  = mockUserService();

  if (opts.promptState !== undefined) {
    (gprompt.get as jest.Mock).mockResolvedValue(opts.promptState);
  }
  if (opts.completed !== undefined) {
    (bookings.countCompletedPaid as jest.Mock).mockResolvedValue(opts.completed);
  }

  const service = new ReviewService(
    reviews,
    gprompt,
    bookings,
    userSvc as unknown as UserService,
  );
  return { service, reviews, gprompt, bookings, userSvc };
}

const state = (s: Partial<GoogleReviewPromptState>): GoogleReviewPromptState => ({
  shownCount:              0,
  skippedCount:            0,
  dismissed:               false,
  lastShownCompletedCount: null,
  acceptedAt:              null,
  ...s,
});

describe("ReviewService.submitRating", () => {
  it("marks the booking completed and persists the rating before deciding", async () => {
    const { service, reviews, bookings } = make();
    await service.submitRating({ eventId: EVENT_ID, userEmail: EMAIL, rating: 5 });

    expect(bookings.markCompleted).toHaveBeenCalledWith(BOOKING_ID);
    expect(reviews.upsertRating).toHaveBeenCalledWith(BOOKING_ID, USER_ID, 5);
  });

  it("shows the Google prompt on the first paid class rated >= 4", async () => {
    const { service, gprompt } = make({ completed: 1 });
    const res = await service.submitRating({ eventId: EVENT_ID, userEmail: EMAIL, rating: 4 });

    expect(res.showGoogleReview).toBe(true);
    expect(gprompt.recordShown).toHaveBeenCalledWith(USER_ID, 1);
  });

  it("does not show the prompt when rating < 4", async () => {
    const { service, gprompt } = make();
    const res = await service.submitRating({ eventId: EVENT_ID, userEmail: EMAIL, rating: 3 });

    expect(res.showGoogleReview).toBe(false);
    expect(gprompt.recordShown).not.toHaveBeenCalled();
  });

  it("never shows the prompt for the free 15-min intro, even at rating 5", async () => {
    const { service, gprompt } = make({ sessionType: "free15min" });
    const res = await service.submitRating({ eventId: EVENT_ID, userEmail: EMAIL, rating: 5 });

    expect(res.showGoogleReview).toBe(false);
    expect(gprompt.recordShown).not.toHaveBeenCalled();
  });

  it("does not re-show until 3 more paid classes after a skip", async () => {
    const { service } = make({
      promptState: state({ shownCount: 1, skippedCount: 1, lastShownCompletedCount: 1 }),
      completed:   3, // only 2 more since last shown — not enough
    });
    const res = await service.submitRating({ eventId: EVENT_ID, userEmail: EMAIL, rating: 5 });
    expect(res.showGoogleReview).toBe(false);
  });

  it("re-shows once 3 more paid classes have completed", async () => {
    const { service, gprompt } = make({
      promptState: state({ shownCount: 1, skippedCount: 1, lastShownCompletedCount: 1 }),
      completed:   4, // 1 + 3
    });
    const res = await service.submitRating({ eventId: EVENT_ID, userEmail: EMAIL, rating: 5 });
    expect(res.showGoogleReview).toBe(true);
    expect(gprompt.recordShown).toHaveBeenCalledWith(USER_ID, 4);
  });

  it("never shows again once dismissed", async () => {
    const { service, gprompt } = make({
      promptState: state({ shownCount: 2, skippedCount: 2, dismissed: true }),
      completed:   99,
    });
    const res = await service.submitRating({ eventId: EVENT_ID, userEmail: EMAIL, rating: 5 });
    expect(res.showGoogleReview).toBe(false);
    expect(gprompt.recordShown).not.toHaveBeenCalled();
  });

  it("never shows again once accepted", async () => {
    const { service } = make({
      promptState: state({ shownCount: 1, acceptedAt: "2026-05-01T00:00:00.000Z" }),
      completed:   50,
    });
    const res = await service.submitRating({ eventId: EVENT_ID, userEmail: EMAIL, rating: 5 });
    expect(res.showGoogleReview).toBe(false);
  });

  it("throws ReviewBookingNotFoundError when the booking is not the user's", async () => {
    const { service, bookings } = make();
    (bookings.findIdByEventIdForUser as jest.Mock).mockResolvedValue(null);

    await expect(
      service.submitRating({ eventId: EVENT_ID, userEmail: EMAIL, rating: 5 }),
    ).rejects.toThrow(ReviewBookingNotFoundError);
  });
});

describe("ReviewService.submitComment", () => {
  it("attaches the comment to the rated booking", async () => {
    const { service, reviews } = make();
    await service.submitComment({ eventId: EVENT_ID, userEmail: EMAIL, comment: "Great class" });
    expect(reviews.setComment).toHaveBeenCalledWith(BOOKING_ID, "Great class");
  });
});

describe("ReviewService Google outcomes", () => {
  it("delegates decline to the prompt repo", async () => {
    const { service, gprompt } = make();
    await service.declineGoogle(EMAIL);
    expect(gprompt.recordDeclined).toHaveBeenCalledWith(USER_ID);
  });

  it("delegates accept to the prompt repo", async () => {
    const { service, gprompt } = make();
    await service.acceptGoogle(EMAIL);
    expect(gprompt.recordAccepted).toHaveBeenCalledWith(USER_ID);
  });
});
