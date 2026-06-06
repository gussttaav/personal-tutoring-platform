/**
 * POST /api/locale
 *
 * Persists a logged-in user's explicit language choice to users.locale (the
 * account-level source of truth) and keeps the NEXT_LOCALE cookie in sync.
 * next-intl already sets the cookie client-side on switch; we re-assert it here
 * so the DB and cookie never drift. Anonymous switching stays cookie-only and
 * never reaches this route (the switcher only calls it when authenticated).
 *
 * Applied fixes:
 *   SEC-04: CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { isValidOrigin } from "@/lib/csrf";
import { LocaleSchema } from "@/lib/schemas";
import { userService } from "@/services";
import { tracedRoute } from "@/lib/with-request-context";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

async function postHandler(req: NextRequest) {
  if (!isValidOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });

  const parsed = LocaleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const { locale } = parsed.data;
  await userService.setLocale(session.user.email, locale);

  (await cookies()).set("NEXT_LOCALE", locale, {
    path: "/",
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
  });

  return NextResponse.json({ ok: true });
}

export const POST = tracedRoute(postHandler);
