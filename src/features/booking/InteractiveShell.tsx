"use client";

/**
 * InteractiveShell — Emerald Nocturne reskin
 *
 * Logic: 100% IDENTICAL to original.
 * Changes: UI tokens only — inline styles updated to Emerald Nocturne palette.
 *
 * All hooks, handlers, routing logic, and overlays are preserved verbatim.
 * The only modifications are:
 *   - Color values (--bg → #131315, --green → #4edea3, etc.)
 *   - Section typography (Manrope headlines)
 *   - Skeleton pulse animation retains same timing
 *
 * COURSE-P10-01: the `?book=` deep link gained a `smart` case (the in-lesson CTA in
 * the course reader needs the landing hero's routing from a page where this component
 * is not mounted), and the effect that consumes it now waits for NextAuth to settle.
 *
 * REDESIGN-P0-01: the `#sessions` scroll-intent machinery (COURSE-P6-03) is gone with
 * `useSessionsAnchor` — «Mentoría» is the `/mentoria` page now, and this shell is what
 * its header leads into. `close-booking-overlay` stays (the logo click still closes an
 * open booking) but no longer carries a `scrollTo`. `id="sessions"` is kept: harmless,
 * and a footer link may target it again later.
 *
 * REDESIGN-P1-01: the `?book=` deep link gained an `availability` case — the home hero's
 * «Ver disponibilidad» is a link into /mentoria now, not the `open-availability-modal`
 * event (which only this component hears, and only on this page).
 *
 * REDESIGN-P1-06: this file is now the Mentoría-only SECTIONS (sessions + packs + the chat
 * FAB). The logic above is still 100% identical — it just lives in two sibling files: the
 * hooks, the five state atoms, the window listeners, the `?book=` consumer and the OAuth
 * restore effects moved verbatim into `BookingProvider.tsx` (read here via `useBooking()`),
 * and the three overlay renders into `BookingOverlays.tsx`, so the booking screens can open
 * in place on `/` too. The reschedule reader (`useRescheduleIntent`, the one `useSearchParams`)
 * is `RescheduleBridge`, mounted from here so it stays inside Mentoría's `Suspense` boundary.
 * The sections unmount while an overlay is up (`overlayOpen` is the overlays' own conditions),
 * exactly as when the shell returned the overlay instead of them — so the pack checkout button
 * is never clickable behind the pack-booking screen. The bridge stays mounted throughout, or
 * the reschedule state would be thrown away each time a booking screen opens.
 */

import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { useHydrated } from "@/hooks/useClientValue";
import Chat from "@/components/Chat";
import { PACK_SIZES, PACK_CONFIG } from "@/constants";
import { usePrices, usePackValidityDays } from "@/components/pricing/PricesProvider";
import SessionCard from "./SessionCard";
import PackCard from "./PackCard";
import RescheduleBridge from "./RescheduleBridge";
import { useBooking } from "./BookingProvider";
import type { PackSize } from "@/domain/types";

// ─── Skeleton atoms ────────────────────────────────────────────────────────────

function SessionCardSkeleton() {
  return (
    <div
      style={{
        height: 80,
        borderRadius: 10,
        background: "#2a2a2c",
        marginBottom: 10,
        animation: "skeletonPulse 1.4s ease-in-out infinite",
      }}
      aria-hidden="true"
    />
  );
}

function PackCardSkeleton() {
  return (
    <div
      style={{
        flex: "1 1 200px",
        height: 180,
        borderRadius: 12,
        background: "#2a2a2c",
        animation: "skeletonPulse 1.4s ease-in-out infinite",
      }}
      aria-hidden="true"
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteractiveShell() {
  const t = useTranslations("booking.shell");
  const prices = usePrices();
  const packValidityDays = usePackValidityDays();
  const {
    router,
    googleUser,
    isSignedIn,
    isAuthLoading,
    packSession,
    creditsLoading,
    setPackClientSecret,
    packCheckoutLoading,
    setPackCheckoutLoading,
    packCheckoutInFlight: packCheckoutInFlightRef,
    packStudentInfo,
  } = useBooking();

  // Hydration-safe skeleton gate. In dev this boundary is server-rendered with the session
  // still "loading" (skeletons); on the client the provider — now OUTSIDE the boundary — can
  // settle the session and start the credits fetch before React gets to hydrate the sections,
  // which would then hydrate as cards against skeleton HTML. Holding the skeletons until
  // hydration keeps both sides identical; the cards appear one render later. No-op in
  // production, where the boundary is client-rendered (the useSearchParams bailout).
  const hydrated = useHydrated();
  const showSkeletons = isAuthLoading || !hydrated;

  // The pack booking overlay / the single session booking overlay — `BookingOverlays` renders
  // them under these exact conditions; while either is up the sections are unmounted.
  const overlayOpen =
    Boolean(router.showPackBooking && packStudentInfo && googleUser?.email) ||
    Boolean(router.activeSession && googleUser?.email);

  return (
    <>
      <RescheduleBridge />

      {/* ── Normal landing layer ── */}
      {!overlayOpen && (
        <>
          <style>{`
            @keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
          `}</style>

          {/* ── Sessions section ── */}
          <section id="sessions" style={{ animation: "fadeUp 0.6s ease both 0.3s" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#4edea3",
                marginBottom: "10px",
              }}
            >
              {t("individualSessions")}
            </p>
            <h2
              style={{
                fontFamily: "var(--font-headline, Manrope), sans-serif",
                fontSize: "clamp(1.4rem, 3.5vw, 2rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#e5e1e4",
                marginBottom: "8px",
              }}
            >
              {t("chooseMode")}
            </h2>
            <p style={{ fontSize: "14px", color: "#86948a", marginBottom: "32px" }}>
              {t("modeSubtitle")}
            </p>

            {showSkeletons ? (
              <div className="sessions-grid">
                <SessionCardSkeleton /><SessionCardSkeleton /><SessionCardSkeleton />
              </div>
            ) : (
              <div className="sessions-grid">
                <SessionCard
                  badge={t("sessions.free15min.badge")}
                  name={t("sessions.free15min.name")}
                  duration={t("sessions.free15min.duration")}
                  price={t("sessions.free15min.price")}
                  isFree
                  vertical
                  onClick={() => router.handleSessionClick("free15min")}
                />
                <SessionCard
                  badge={t("sessions.session1h.badge")}
                  name={t("sessions.session1h.name")}
                  duration={t("sessions.session1h.duration")}
                  price={prices.session1h.price}
                  featured
                  vertical
                  onClick={() => router.handleSessionClick("session1h")}
                />
                <SessionCard
                  name={t("sessions.session2h.name")}
                  duration={t("sessions.session2h.duration")}
                  price={prices.session2h.price}
                  vertical
                  onClick={() => router.handleSessionClick("session2h")}
                />
              </div>
            )}
          </section>

          {/* ── Divider ── */}
          <div
            style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
              margin: "56px 0",
            }}
          />

          {/* ── Packs section ── */}
          <section style={{ animation: "fadeUp 0.6s ease both 0.5s" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#4edea3",
                marginBottom: "10px",
              }}
            >
              {t("continuityPacks")}
            </p>
            <h2
              style={{
                fontFamily: "var(--font-headline, Manrope), sans-serif",
                fontSize: "clamp(1.4rem, 3.5vw, 2rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#e5e1e4",
                marginBottom: "8px",
              }}
            >
              {t("packsSubtitle")}
            </h2>
            <p style={{ fontSize: "14px", color: "#86948a", marginBottom: "32px" }}>
              {t("packsDescription", { days: packValidityDays })}
            </p>

            {showSkeletons ? (
              <div className="packs-grid">
                <PackCardSkeleton /><PackCardSkeleton />
              </div>
            ) : (
              <div className="packs-grid">
                {PACK_SIZES.map((size) => {
                  const cfg = PACK_CONFIG[size];
                  const hasActiveCredits = (packSession?.credits ?? 0) > 0 && packSession?.packSize === size;
                  return (
                    <PackCard
                      key={size}
                      size={size}
                      recommended={"recommended" in cfg && cfg.recommended}
                      activeCredits={creditsLoading ? null : hasActiveCredits ? (packSession?.credits ?? null) : null}
                      creditsLoading={creditsLoading && isSignedIn}
                      checkoutLoading={packCheckoutLoading === size}
                      onClick={async () => {
                        if (!isSignedIn) {
                          // Not signed in — show sign-in gate; after OAuth the modal
                          // will open normally (without pre-fetched clientSecret).
                          router.handlePackBuy(size as PackSize);
                          return;
                        }
                        if (packCheckoutInFlightRef.current) return;
                        packCheckoutInFlightRef.current = true;
                        setPackCheckoutLoading(size as PackSize);
                        try {
                          const { clientSecret } = await api.stripe.checkout({
                            type: "pack",
                            packSize: size as PackSize,
                          });
                          setPackClientSecret(clientSecret);
                          router.handlePackBuy(size as PackSize); // open modal after secret is ready
                        } catch {
                          // Checkout pre-fetch failed — open modal normally so the
                          // user can retry via the "Comprar" button inside it.
                          packCheckoutInFlightRef.current = false;
                          router.handlePackBuy(size as PackSize);
                        } finally {
                          setPackCheckoutLoading(null);
                        }
                      }}
                      onSchedule={router.handlePackSchedule}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Chat assistant ── */}
          <Chat />
        </>
      )}
    </>
  );
}
