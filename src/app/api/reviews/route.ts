/**
 * POST /api/reviews
 *
 * Post-class review flow. Thin dispatcher: parse → call ReviewService → map.
 * Three discriminated actions on `kind`:
 *   - "rating":  persists the rating immediately; returns { showGoogleReview }.
 *   - "comment": attaches an optional comment to the already-rated booking.
 *   - "google":  records the Google-review CTA outcome (accept | decline).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isValidOrigin } from "@/lib/csrf";
import { ReviewSchema } from "@/lib/schemas";
import { reviewService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { reviewRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const { success } = await reviewRatelimit.limit(getClientIp(req));
  if (!success)
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  if (!isValidOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const email = session.user.email;
  const data = parsed.data;

  try {
    switch (data.kind) {
      case "rating": {
        const { showGoogleReview } = await reviewService.submitRating({
          eventId:   data.eventId,
          userEmail: email,
          rating:    data.rating,
        });
        log("info", "Review rating captured", {
          service: "reviews",
          email,
          eventId: data.eventId,
          rating:  data.rating,
          showGoogleReview,
        });
        return NextResponse.json({ ok: true, showGoogleReview });
      }
      case "comment": {
        await reviewService.submitComment({
          eventId:   data.eventId,
          userEmail: email,
          comment:   data.comment,
        });
        return NextResponse.json({ ok: true });
      }
      case "google": {
        if (data.action === "accept") await reviewService.acceptGoogle(email);
        else                          await reviewService.declineGoogle(email);
        log("info", "Google review prompt outcome", {
          service: "reviews",
          email,
          action:  data.action,
        });
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    return mapDomainErrorToResponse(err, { email, kind: data.kind });
  }
}
