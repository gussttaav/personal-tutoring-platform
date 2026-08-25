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
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isValidOrigin } from "@/lib/csrf";
import { SubscribeSchema } from "@/lib/schemas";
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
    await subscriptionService.subscribe(session.user.email, parsed.data.type);
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
    const subscribed = await subscriptionService.isSubscribed(
      session.user.email,
      parsed.data.type,
    );
    return NextResponse.json({ subscribed });
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
