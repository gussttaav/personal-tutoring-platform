/**
 * GET /api/policy — `{ packValidityDays, cancelHours }`.
 *
 * REFACTOR-R4-P2-03: the two policy numbers the footer modal needs on pages that don't
 * mount CommerceProviders. Prerendered; both loaders are tagged, so an admin edit
 * (revalidateTag) regenerates it on the next request.
 *
 * Public and unauthenticated on purpose: both numbers are already printed on /terminos.
 * The request object is deliberately UNUSED — touching it would opt the route out of
 * static rendering (see the search-index route for the same rule).
 *
 * Locale-free: src/middleware.ts keeps `/api/*` out of next-intl's locale rewrite.
 */

import { getPackValidityDays } from "@/lib/pricing-display";
import { getScheduleConfig } from "@/lib/schedule-config";

export const dynamic = "force-static";

export async function GET() {
  const [packValidityDays, schedule] = await Promise.all([
    getPackValidityDays(),
    getScheduleConfig(),
  ]);
  // Same shape as `PolicyNumbers` (src/components/policy/PolicyContent.tsx).
  return Response.json({ packValidityDays, cancelHours: schedule.cancelMinNoticeHours });
}
