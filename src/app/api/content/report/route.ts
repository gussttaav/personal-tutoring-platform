/**
 * POST /api/content/report
 *
 * CONTENT-FEEDBACK-01: "Reportar un error" on a lesson or post. Same shape and
 * same two choices as /api/content/vote (anonymous allowed, unknown content is
 * dropped with a 200) — see that file's header.
 *
 * The page URL is never taken from the body: the service derives it from the
 * content ref. The only request-derived extras are the User-Agent (sliced to the
 * column's cap) and, for an anonymous reporter, the optional email he typed —
 * a signed-in reporter's session email always wins over the body.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isValidOrigin } from "@/lib/csrf";
import { ContentReportSchema } from "@/lib/schemas";
import { contentFeedbackService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { contentReportRatelimit } from "@/lib/ratelimit";
import { feedbackLimitKey } from "../_shared";

const USER_AGENT_MAX = 512;

export async function POST(req: NextRequest) {
  if (!isValidOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  const email   = session?.user?.email ?? null;

  const { success } = await contentReportRatelimit.limit(feedbackLimitKey(req, email));
  if (!success)
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  const body   = await req.json().catch(() => ({}));
  const parsed = ContentReportSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const data      = parsed.data;
  const userAgent = req.headers.get("user-agent")?.slice(0, USER_AGENT_MAX) ?? null;

  try {
    await contentFeedbackService.report({
      ref:       { contentType: data.contentType, contentKey: data.contentKey },
      locale:    data.locale,
      message:   data.message,
      email:     data.email,
      userEmail: email,
      userAgent,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapDomainErrorToResponse(err, { contentType: data.contentType, contentKey: data.contentKey });
  }
}
