/**
 * ACCOUNT-DELETE-01
 *
 * GET    /api/account — may this account be deleted, and if not, why?
 * DELETE /api/account — erase the account and every row linked to it.
 *
 * Authenticated for BOTH clients: getSession() accepts the web session cookie or
 * the mobile `Authorization: Bearer <token>` credential, so the native app uses
 * these endpoints unchanged. isValidOrigin() self-exempts cookieless bearer
 * requests, so no mobile carve-out is needed here.
 *
 * Deletion is gated (see AccountService): it is refused while the student holds
 * redeemable pack credits (409 DELETION_BLOCKED_ACTIVE_PACK — he must ask Gustavo
 * for a refund) or upcoming classes he can still cancel himself (409
 * DELETION_BLOCKED_CANCELLABLE_BOOKINGS — he must cancel them first). The GET is a
 * preflight so clients can render the right state; the DELETE re-checks and never
 * trusts it.
 *
 * DELETE is IRREVERSIBLE. There is no soft delete, no grace period, no export.
 *
 * Credential caveat: deletion cannot invalidate credentials already issued. Both
 * the NextAuth JWT cookie and the 1-hour mobile bearer are stateless — they are
 * decoded, never checked against the users table — and several services call
 * userService.ensureUser(), which upserts. A client that keeps using its old
 * credential after a successful delete will therefore recreate an empty users row.
 * On a 200 the caller MUST discard its credential: the web UI calls signOut(), and
 * the mobile app must drop its bearer.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isValidOrigin } from "@/lib/csrf";
import { AccountDeletionSchema } from "@/lib/schemas";
import { accountService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { accountDeletionRatelimit } from "@/lib/ratelimit";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = session.user.email;

  const { success } = await accountDeletionRatelimit.limit(email);
  if (!success)
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  try {
    return NextResponse.json(await accountService.getDeletionEligibility(email));
  } catch (err) {
    return mapDomainErrorToResponse(err, { email, route: "account/eligibility" });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isValidOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = session.user.email;

  // Rate limited by email, so it has to come after the session resolves.
  const { success } = await accountDeletionRatelimit.limit(email);
  if (!success)
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  const body   = await req.json().catch(() => ({}));
  const parsed = AccountDeletionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    await accountService.deleteAccount(email, parsed.data.confirmEmail);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapDomainErrorToResponse(err, { email, route: "account/delete" });
  }
}
