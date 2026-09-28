// LANDING-01: the destination ladder through the real in-memory stack — a booking
// row, a credit pack, an enrolment — where LandingService.test.ts only mocks the
// three reads. State is created the way production creates it (a booking record,
// `addCredits`, `markLessonSeen`), never by poking the destination directly.
jest.mock("@/lib/availability-cache", () => ({
  invalidate: jest.fn().mockResolvedValue(undefined),
  getCached:  jest.fn().mockResolvedValue(null),
  setCached:  jest.fn().mockResolvedValue(undefined),
}));

import { InMemoryCreditsRepository } from "../fixtures/InMemoryCreditsRepository";
import { InMemoryBookingRepository } from "../fixtures/InMemoryBookingRepository";
import { FakeCourseCatalog }         from "../fixtures/FakeCourseCatalog";
import {
  buildTestBookingService,
  buildTestCourseService,
  buildTestCreditService,
  buildTestLandingService,
} from "../fixtures/services";

const EMAIL = "alice@example.com";

function makeStack() {
  const creditsRepo  = new InMemoryCreditsRepository();
  const bookingsRepo = new InMemoryBookingRepository();
  const credits      = buildTestCreditService({ credits: creditsRepo });
  const bookings     = buildTestBookingService({ bookings: bookingsRepo, credits });
  const courses      = buildTestCourseService({
    catalog: new FakeCourseCatalog({ "dl-nlp": ["l1", "l2"], "otro": ["a"] }),
  }).service;
  const { service } = buildTestLandingService({ bookings, credits, courses });
  return { service, creditsRepo, bookingsRepo, credits, courses };
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe("Landing ladder (LANDING-01)", () => {
  it("a brand-new account lands on the personal area", async () => {
    const { service } = makeStack();
    expect(await service.resolve(EMAIL, false)).toEqual({ kind: "personal-area" });
  });

  it("a reader with course progress and nothing else lands on that course", async () => {
    const { service, courses } = makeStack();
    await courses.markLessonSeen(EMAIL, "dl-nlp", "l1");
    await courses.markLessonSeen(EMAIL, "otro", "a");
    await courses.markLessonSeen(EMAIL, "dl-nlp", "l2");

    expect(await service.resolve(EMAIL, false)).toEqual({ kind: "course", courseSlug: "dl-nlp" });
  });

  it("a pack bought before the first class already lands on the personal area", async () => {
    const { service, credits, courses } = makeStack();
    await courses.markLessonSeen(EMAIL, "dl-nlp", "l1");
    await credits.addCredits({
      email: EMAIL, name: "Alice", amount: 5, packLabel: "Pack 5 clases",
      stripeSessionId: "pi_landing_001", expiresAt: hoursFromNow(24 * 180),
    });

    expect(await service.resolve(EMAIL, false)).toEqual({ kind: "personal-area" });
  });

  it("one booking — even a cancelled one — lands on the personal area", async () => {
    const { service, bookingsRepo, courses } = makeStack();
    await courses.markLessonSeen(EMAIL, "dl-nlp", "l1");
    const { cancelToken } = await bookingsRepo.createBooking({
      eventId: "evt_landing_001", email: EMAIL, name: "Alice",
      sessionType: "free15min", startsAt: hoursFromNow(6), endsAt: hoursFromNow(6.25),
    });
    await bookingsRepo.consumeCancelToken(cancelToken);

    expect(await service.resolve(EMAIL, false)).toEqual({ kind: "personal-area" });
  });

  it("the admin lands on the panel regardless of state", async () => {
    const { service, courses } = makeStack();
    await courses.markLessonSeen(EMAIL, "dl-nlp", "l1");
    expect(await service.resolve(EMAIL, true)).toEqual({ kind: "admin" });
  });
});
