import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
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

  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

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

  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const typeParam = req.nextUrl.searchParams.get("type");
  const parsed = SubscribeSchema.safeParse({ type: typeParam });
  if (!parsed.success)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

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
