/**
 * POST /api/content/vote
 *
 * CONTENT-FEEDBACK-01: 👍/👎 (+ optional comment) on a lesson or post. Thin
 * dispatcher: origin → session → rate limit → parse → ContentFeedbackService.
 *
 * Two deliberate choices, both shared with /api/content/report:
 *   - Anonymous callers are allowed (reading needs no account), so `getSession()`
 *     returning null is a normal path, not a 401. The limiter is keyed by email
 *     when signed in and by IP otherwise — see `feedbackLimitKey`.
 *   - Unknown content is NOT a 400. The service drops the write and logs it; the
 *     route answers 200 so a stale static page never paints red in the console.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isValidOrigin } from "@/lib/csrf";
import { ContentVoteSchema } from "@/lib/schemas";
import { contentFeedbackService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { contentVoteRatelimit } from "@/lib/ratelimit";
import { feedbackLimitKey } from "../_shared";

export async function POST(req: NextRequest) {
  if (!isValidOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  const email   = session?.user?.email ?? null;

  const { success } = await contentVoteRatelimit.limit(feedbackLimitKey(req, email));
  if (!success)
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  const body   = await req.json().catch(() => ({}));
  const parsed = ContentVoteSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const data = parsed.data;

  try {
    await contentFeedbackService.vote({
      ref:       { contentType: data.contentType, contentKey: data.contentKey },
      locale:    data.locale,
      vote:      data.vote,
      comment:   data.comment,
      clientId:  data.clientId,
      userEmail: email,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapDomainErrorToResponse(err, { contentType: data.contentType, contentKey: data.contentKey });
  }
}
