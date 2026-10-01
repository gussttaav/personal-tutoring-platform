// REFACTOR-R4-P2-03: the commerce data (prices, pack validity, booking schedule) and the
// per-student price overlay, mounted ONLY by the pages that sell or book. Before this,
// the root layout loaded it for every route, which tied every lesson and post to
// Supabase at build time and to the pricing/schedule ISR tags.
//
// Mounted by: `/` (and `/inicio`, which renders it), `/mentoria`, `/area-personal`,
// `/sesion/[token]`, and the layouts of `/pago-exitoso` and `/sesion-confirmada` (their
// pages are client components). A page that renders a component calling `usePrices`,
// `useProductPrice`, `useSessionPriceLabel`, `usePackValidityDays` or `useScheduleConfig`
// must mount this too: those hooks throw outside their provider. The footer's policy
// modal is the exception — it reads the `*Optional` hooks and falls back to `/api/policy`.
//
// `UserPricingSync` calls `useSession()`, so this must render inside `AuthProvider`,
// which the root layout keeps above every page.
import { PricesProvider } from "@/components/pricing/PricesProvider";
import { UserPricingSync } from "@/components/pricing/UserPricingSync";
import { ScheduleProvider } from "@/components/booking/ScheduleProvider";
import { getDisplayPrices, getPackValidityDays } from "@/lib/pricing-display";
import { getScheduleConfig } from "@/lib/schedule-config";

export async function CommerceProviders({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [prices, packValidityDays, schedule] = await Promise.all([
    getDisplayPrices(locale),
    getPackValidityDays(),
    getScheduleConfig(),
  ]);
  return (
    <PricesProvider value={prices} packValidityDays={packValidityDays}>
      <ScheduleProvider value={schedule}>
        {/* PRICING-STUDENT-01: wraps children because it owns the "prices still
            syncing" flag. A no-op for anonymous visitors. */}
        <UserPricingSync>{children}</UserPricingSync>
      </ScheduleProvider>
    </PricesProvider>
  );
}
