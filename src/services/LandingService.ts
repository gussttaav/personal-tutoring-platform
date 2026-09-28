/*
 * LANDING-01 — where a signed-in visitor to "/" belongs.
 *
 * The marketing home is for people who have not decided yet. Someone with a session
 * has, so "/" sends them to the surface that matches what they have done, first
 * match wins:
 *
 *   1. the admin panel, for the tutor;
 *   2. the personal area, for anyone who has ever booked a class or holds pack
 *      credits — that is where classes and credits live (a cancelled booking still
 *      counts: `hasAnyBooking` is the same "has been a student" test the free-trial
 *      gate uses, and a pack bought before the first booking is a mentoring customer
 *      all the same);
 *   3. the landing of the course they are reading, for a reader who signed in only
 *      to keep progress (enrolled, not finished, nothing booked);
 *   4. the personal area, for everyone else.
 *
 * The ladder IS the feature, so it lives here — unit-tested against mocks like
 * AccountService's eligibility ladder — and never in the `/inicio` page that calls
 * it. The booking and credit reads run in parallel; the course read is deferred
 * because most signed-in visitors never reach rule 3.
 */

import type { LandingDestination } from "@/domain/types";
import { BookingService } from "./BookingService";
import { CreditService } from "./CreditService";
import { CourseService } from "./CourseService";

export class LandingService {
  constructor(
    private readonly bookings: BookingService,
    private readonly credits:  CreditService,
    private readonly courses:  CourseService,
  ) {}

  async resolve(email: string, isAdmin: boolean): Promise<LandingDestination> {
    if (isAdmin) return { kind: "admin" };

    const [hasBooked, balance] = await Promise.all([
      this.bookings.hasAnyBooking(email),
      this.credits.getBalance(email),
    ]);
    if (hasBooked || (balance?.credits ?? 0) > 0) return { kind: "personal-area" };

    const courseSlug = await this.courses.getCurrentCourse(email);
    if (courseSlug) return { kind: "course", courseSlug };

    return { kind: "personal-area" };
  }
}
