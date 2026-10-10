/*
 * POST   /api/subscribe — subscribe the signed-in user to `type`.
 * GET    /api/subscribe?type= — is the signed-in user subscribed?
 * DELETE /api/subscribe — COURSE-P6-02: unsubscribe.
 *
 * DELETE exists because the courses opt-in is a TOGGLE, not a one-way button, and that
 * toggle is the unsubscribe path the announce email links to. No token infrastructure is
 * needed for it: subscribing already requires a signed-in account, so the same session
 * that opted in can opt out. Unlike POST it never 409s — removing a subscription that is
 * not there has still achieved what the caller asked for.
 *
 * BLOG-15: the blog opt-in follows AREAS. POST may carry `areas` (omitted = every area),
 * GET answers `{ subscribed, areas }` (`areas: null` = every area), and
 * PATCH /api/subscribe `{ type: "blog", areas }` changes the selection of an existing
 * subscription — 404 NOT_SUBSCRIBED when there is none, never a silent re-subscribe.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isValidOrigin } from "@/lib/csrf";
import { BlogAreasSchema, SubscribeSchema } from "@/lib/schemas";
import { subscriptionService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { subscribeRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";

export async function POST(req: NextRequest) {
  const { success } = await subscribeRatelimit.limit(getClientIp(req));
  if (!success)
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  if (!isValidOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    await subscriptionService.subscribe(session.user.email, parsed.data.type, parsed.data.areas);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapDomainErrorToResponse(err, { email: session.user.email, type: parsed.data.type });
  }
}

export async function GET(req: NextRequest) {
  const { success } = await subscribeRatelimit.limit(getClientIp(req));
  if (!success)
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  const session = await getSession();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const typeParam = req.nextUrl.searchParams.get("type");
  const parsed = SubscribeSchema.safeParse({ type: typeParam });
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    const status = await subscriptionService.getStatus(session.user.email, parsed.data.type);
    return NextResponse.json(status);
  } catch (err) {
    return mapDomainErrorToResponse(err, { email: session.user.email, type: parsed.data.type });
  }
}

export async function DELETE(req: NextRequest) {
  const { success } = await subscribeRatelimit.limit(getClientIp(req));
  if (!success)
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  if (!isValidOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    await subscriptionService.unsubscribe(session.user.email, parsed.data.type);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapDomainErrorToResponse(err, { email: session.user.email, type: parsed.data.type });
  }
}

export async function PATCH(req: NextRequest) {
  const { success } = await subscribeRatelimit.limit(getClientIp(req));
  if (!success)
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  if (!isValidOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BlogAreasSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    const updated = await subscriptionService.updateBlogAreas(session.user.email, parsed.data.areas);
    if (!updated)
      return NextResponse.json({ error: "NOT_SUBSCRIBED" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapDomainErrorToResponse(err, { email: session.user.email, type: parsed.data.type });
  }
}
