/**
 * GET /api/health — liveness probe for uptime monitors.
 *
 * Deliberately cheap and side-effect free: no DB, no Redis, no ISR. `force-dynamic`
 * ensures it is never cached, so an external uptime check (Sentry, etc.) verifies
 * the deployment is up WITHOUT triggering a full-route ISR regeneration (which is
 * what a monitor pointed at `/` was doing, burning ISR write quota).
 *
 * Point external uptime monitoring at this endpoint instead of the homepage.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
