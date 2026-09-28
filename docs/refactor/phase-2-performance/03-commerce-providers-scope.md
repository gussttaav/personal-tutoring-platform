# P2-03 — Commerce providers out of the root layout

**Tag:** `REFACTOR-R4-P2-03` · **Severity:** 🟡 · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

The root layout awaits prices, pack validity and the booking schedule from Supabase for **every**
route, then wraps everything in `PricesProvider` / `ScheduleProvider` / `UserPricingSync`. Only five
pages (the booking surfaces) and the footer's policy modal read them. The coupling has three costs:

- **Build:** every lesson and blog post prerender depends on Supabase. That's where the
  BUILD-01…04 / PGRST303 build flakes come from.
- **ISR:** every static page is tagged `pricing-all` + `schedule-config`, so an admin price or
  schedule edit invalidates every lesson and post, and each recompiles MDX + KaTeX + Shiki on its
  next hit. PERF-11 hid this by stretching the window to 30 days.
- **Client:** `UserPricingSync` fetches `/api/pricing` on every full page load for signed-in users,
  including pages that show no price.

Move the providers into a `CommerceProviders` server component mounted by the five booking pages.
Give the footer modal its two numbers lazily.

## Context

- `src/app/[locale]/layout.tsx:135-137`:
  ```ts
  const prices           = await getDisplayPrices(locale);
  const packValidityDays = await getPackValidityDays();
  const schedule         = await getScheduleConfig();
  ```
  `:146-155` wraps all children in `PricesProvider` → `ScheduleProvider` → `AuthProvider` → `UserPricingSync`.
- Consumers of the commerce contexts: `usePrices`, `useProductPrice`, `useSessionPriceLabel`,
  `usePricesSyncing`, `usePricesOverlay`, `usePackValidityDays`, `useScheduleConfig`. They are:
  - `app/[locale]/pago-exitoso/page.tsx`, `app/[locale]/sesion-confirmada/page.tsx`
  - `components/{AvailabilityModal,BookingModeView,PackModal,PaymentForm,SingleSessionBooking,WeeklyCalendar}.tsx`, `components/booking/BookingSidebar.tsx`
  - `features/booking/{InteractiveShell,PackCard}.tsx`, `features/personal-area/{BookSessionsPanel,DangerZone}.tsx`
  - `components/pricing/UserPricingSync.tsx`
  - **`features/landing/FooterModals.tsx:44-45`**: the only consumer rendered on *every* page (via `components/Footer.tsx:187`)
- Pages mounting the booking shell: `/` and `/area-personal` (`BookingOverlays`), `/mentoria`
  (`BookingOverlays` + `InteractiveShell`). `/pago-exitoso` and `/sesion-confirmada` read the hooks
  directly.
- `/terminos` (`app/[locale]/terminos/page.tsx:33-36`) already calls the loaders itself, which is
  right for a page whose whole content is the policy.
- The hooks **throw** outside their provider (`ScheduleProvider.tsx:23`, `PricesProvider.tsx:90,101,120`).
  A missed consumer crashes its page, so the enumeration above must be complete.
- Evidence from the build: all 62 `es/**/*.meta` prerender files list `pricing-all,schedule-config` in
  `x-next-cache-tags`, e.g. `es/blog/de-newton-a-adamw.meta` and `es/cursos/dl-nlp/adios-recurrencia.meta`.
- `src/components/pricing/UserPricingSync.tsx:47-58,62-71`: fetches `/api/pricing` once per page load per signed-in user.
- Loaders: `src/lib/pricing-display.ts:37-67` (`PRICING_CACHE_TAG`), `src/lib/schedule-config.ts:24-35` (`SCHEDULE_CACHE_TAG`).

## Files affected

| File | Change |
|------|--------|
| `src/components/commerce/CommerceProviders.tsx` (new, server) | Loads prices/validity/schedule; renders `PricesProvider` → `ScheduleProvider` → `UserPricingSync` |
| `src/app/[locale]/layout.tsx` | Drop the three awaits and the three providers; keep `AuthProvider`, `NextIntlClientProvider`, `Analytics` |
| `src/app/[locale]/{page,mentoria/page,area-personal/page,pago-exitoso/page,sesion-confirmada/page}.tsx` | Wrap the page tree (including `<Footer />`) in `<CommerceProviders locale={locale}>` |
| `src/components/pricing/PricesProvider.tsx`, `src/components/booking/ScheduleProvider.tsx` | Non-throwing `usePackValidityDaysOptional()` / `useScheduleConfigOptional()` |
| `src/features/landing/FooterModals.tsx` | `usePolicyNumbers()`: context if present, else lazy fetch on modal open |
| `src/app/api/policy/route.ts` (new) | `GET` → `{ packValidityDays, cancelHours }`; static, revalidated by both cache tags |
| tests | Provider/hook tests; `FooterModals` both branches |

## The change

```tsx
// src/components/commerce/CommerceProviders.tsx
// REFACTOR-R4-P2-03: the commerce data (prices, pack validity, booking schedule) and the
// per-student price overlay, mounted ONLY by the pages that sell or book. Before this,
// the root layout loaded it for every route, which tied every lesson and post to
// Supabase at build time and to the pricing/schedule ISR tags.
import { PricesProvider } from "@/components/pricing/PricesProvider";
import { UserPricingSync } from "@/components/pricing/UserPricingSync";
import { ScheduleProvider } from "@/components/booking/ScheduleProvider";
import { getDisplayPrices, getPackValidityDays } from "@/lib/pricing-display";
import { getScheduleConfig } from "@/lib/schedule-config";

export async function CommerceProviders({ locale, children }: { locale: string; children: React.ReactNode }) {
  const [prices, packValidityDays, schedule] = await Promise.all([
    getDisplayPrices(locale),
    getPackValidityDays(),
    getScheduleConfig(),
  ]);
  return (
    <PricesProvider value={prices} packValidityDays={packValidityDays}>
      <ScheduleProvider value={schedule}>
        <UserPricingSync>{children}</UserPricingSync>
      </ScheduleProvider>
    </PricesProvider>
  );
}
```

`UserPricingSync` calls `useSession()`, so it must stay **inside** `AuthProvider`. It still is,
because `AuthProvider` remains in the root layout above every page.

```tsx
// FooterModals — REFACTOR-R4-P2-03
function usePolicyNumbers(open: boolean): { packValidityDays: number; cancelHours: number } | null {
  const days  = usePackValidityDaysOptional();
  const sched = useScheduleConfigOptional();
  const [fetched, setFetched] = useState<{ packValidityDays: number; cancelHours: number } | null>(null);
  useEffect(() => {
    if (!open || (days !== null && sched !== null) || fetched) return;
    fetch("/api/policy").then((r) => r.json()).then(setFetched).catch(() => {});
  }, [open, days, sched, fetched]);
  if (days !== null && sched !== null) return { packValidityDays: days, cancelHours: sched.cancelMinNoticeHours };
  return fetched;   // modal renders a short skeleton while null
}
```

```ts
// src/app/api/policy/route.ts
// REFACTOR-R4-P2-03: the two policy numbers the footer modal needs on pages that don't
// mount CommerceProviders. Prerendered; both loaders are tagged, so an admin edit
// (revalidateTag) regenerates it on the next request.
export const dynamic = "force-static";
export async function GET() {
  const [packValidityDays, schedule] = await Promise.all([getPackValidityDays(), getScheduleConfig()]);
  return Response.json({ packValidityDays, cancelHours: schedule.cancelMinNoticeHours });
}
```

## Acceptance criteria

- [ ] `layout.tsx` imports nothing from `pricing-display`, `schedule-config`, `PricesProvider`, `ScheduleProvider` or `UserPricingSync`
- [ ] After `pnpm build`, no `.meta` for a blog post, lesson, course landing, `/cursos` or `/blog` lists `pricing-all` or `schedule-config`. The five commerce pages (and `/terminos`, `/api/policy`) still do
- [ ] Every page renders without a provider error. Visit all routes in `src/app/[locale]` (signed-out and signed-in) plus the booking overlays on `/`, `/mentoria`, `/area-personal`
- [ ] Footer policy modal on a blog post and a lesson shows the current numbers (fetched on open); on `/mentoria` it shows them with no fetch
- [ ] An admin price edit changes `/mentoria` prices and the footer modal numbers on the next request, and does **not** invalidate blog/lesson pages
- [ ] Signed-in visit to a lesson or post issues no `/api/pricing` request
- [ ] File-top comment blocks carry `REFACTOR-R4-P2-03`

## Test plan

- **Existing:** e2e `home.spec.ts`, `booking-*.spec.ts`, `booking-personal-area.spec.ts`,
  `courses-navigation.spec.ts` green. `pnpm build` green.
- **New (unit):** `FooterModals`. With providers mounted it doesn't call `fetch`. Without them,
  opening the modal fetches `/api/policy` once and renders the numbers.
- **New (unit):** the `*Optional` hooks return `null` outside their providers, and the throwing hooks still throw.
- **Build check:** a small script or a documented one-liner that greps
  `.next/server/app/{es,en}/{blog,cursos}/**/*.meta` for `pricing-all|schedule-config` and must find
  nothing. Put the one-liner in the PR description.
- **Manual:** network panel on a lesson while signed in shows no `/api/pricing`; on `/mentoria` it shows one.

## Notes / gotchas

- **Decision (Gustavo): footer modal source.** The default is a lazy fetch from `/api/policy`. The
  alternative is to render the footer's "Terms / Cancellation" entries as links to `/terminos`
  on non-commerce pages, which needs no new route but changes the footer's behaviour per page.
- **A missed consumer throws at runtime**, and only on the page that renders it. Use the grep in
  Context as the checklist, and add any new hit to a page that mounts `CommerceProviders`.
  `PackModal` is reached from `InteractiveShell`/`PackCard`. Confirm it isn't mounted anywhere else.
- **Footer inside the wrapper.** On the five commerce pages, wrap `<Footer />` too, so the modal reads
  the context and doesn't fetch.
- PERF-11's 30-day `REVALIDATE_SECONDS` can probably shrink once only ~7 routes carry the tags. Leave
  it; that's a separate, measured change.
- The `/api` prefix is outside the next-intl middleware matcher, so the route is locale-free. Verify
  that `src/middleware.ts`'s matcher still excludes `/api/*`.

## Out of scope

- The `NextIntlClientProvider` messages payload (every namespace, including server-only `emails`, ships to every page).
- `AuthProvider` / `useSession` on static pages. Needed for the Navbar.
- Lowering the ISR window (PERF-11).
- P2-04's single user-session state.
