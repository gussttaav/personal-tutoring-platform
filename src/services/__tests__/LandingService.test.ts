// LANDING-01: the destination ladder against mocked collaborators, like
// AccountService.test.ts — what matters here is the ORDER of the rules and which
// reads each rule pays for, not the repositories behind them.
import { LandingService } from "../LandingService";
import { BookingService } from "../BookingService";
import { CreditService }  from "../CreditService";
import { CourseService }  from "../CourseService";
import type { CreditResult, LandingDestination } from "@/domain/types";

const EMAIL = "student@example.com";

interface Fixture {
  hasBooked?: boolean;
  /** `null` mirrors the repository: no active pack at all. */
  credits?:   number | null;
  course?:    string | null;
}

function make(opts: Fixture = {}) {
  const balance: CreditResult | null =
    opts.credits == null ? null : { credits: opts.credits, name: "Student", packSize: 5 };

  const bookings = { hasAnyBooking:    jest.fn().mockResolvedValue(opts.hasBooked ?? false) } as unknown as jest.Mocked<BookingService>;
  const credits  = { getBalance:       jest.fn().mockResolvedValue(balance) }                  as unknown as jest.Mocked<CreditService>;
  const courses  = { getCurrentCourse: jest.fn().mockResolvedValue(opts.course ?? null) }      as unknown as jest.Mocked<CourseService>;

  return { service: new LandingService(bookings, credits, courses), bookings, credits, courses };
}

describe("LandingService.resolve", () => {
  const cases: { name: string; fixture: Fixture; isAdmin?: boolean; expected: LandingDestination }[] = [
    { name: "admin → the admin panel, whatever else is true",
      fixture: { hasBooked: true, credits: 5, course: "dl-nlp" }, isAdmin: true, expected: { kind: "admin" } },
    { name: "has booked once → personal area",
      fixture: { hasBooked: true }, expected: { kind: "personal-area" } },
    { name: "holds pack credits, never booked → personal area",
      fixture: { credits: 3 }, expected: { kind: "personal-area" } },
    { name: "booked AND reading a course → personal area (rule 2 before rule 3)",
      fixture: { hasBooked: true, course: "dl-nlp" }, expected: { kind: "personal-area" } },
    { name: "no pack (null balance), nothing booked, reading a course → that course",
      fixture: { course: "dl-nlp" }, expected: { kind: "course", courseSlug: "dl-nlp" } },
    { name: "a spent pack (0 credits) does not count — the course still wins",
      fixture: { credits: 0, course: "dl-nlp" }, expected: { kind: "course", courseSlug: "dl-nlp" } },
    { name: "nothing booked, no credits, no course → personal area (default)",
      fixture: {}, expected: { kind: "personal-area" } },
  ];

  it.each(cases)("$name", async ({ fixture, isAdmin, expected }) => {
    const { service } = make(fixture);
    expect(await service.resolve(EMAIL, isAdmin ?? false)).toEqual(expected);
  });

  it("admin short-circuits before any read", async () => {
    const { service, bookings, credits, courses } = make();
    await service.resolve(EMAIL, true);
    expect(bookings.hasAnyBooking).not.toHaveBeenCalled();
    expect(credits.getBalance).not.toHaveBeenCalled();
    expect(courses.getCurrentCourse).not.toHaveBeenCalled();
  });

  it("reads bookings and credits once each, and courses only when both come back empty", async () => {
    const booked = make({ hasBooked: true, course: "dl-nlp" });
    await booked.service.resolve(EMAIL, false);
    expect(booked.bookings.hasAnyBooking).toHaveBeenCalledTimes(1);
    expect(booked.credits.getBalance).toHaveBeenCalledTimes(1);
    expect(booked.courses.getCurrentCourse).not.toHaveBeenCalled();

    const reader = make({ course: "dl-nlp" });
    await reader.service.resolve(EMAIL, false);
    expect(reader.courses.getCurrentCourse).toHaveBeenCalledWith(EMAIL);
  });
});
