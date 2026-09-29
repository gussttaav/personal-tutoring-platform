"use client";

/**
 * PRICING-STUDENT-01: applies the signed-in student's private prices, if they
 * have any, over the public ones baked into the static page.
 *
 * REFACTOR-R4-P2-03: rendered by CommerceProviders, so it runs (and fetches
 * `/api/pricing`) only on the booking pages, not on every page load.
 *
 * Why a client fetch at all: `/` and `/mentoria` are statically prerendered and
 * shared by every visitor (SEO-01 — Googlebot crawls cookieless and must get a
 * 200), and src/middleware.ts cannot decode the session JWT at the Edge. So the
 * server cannot know who is viewing at render time. It remains authoritative for
 * the amount Stripe is charged (PricingService.getAmount); this component only
 * corrects what is displayed.
 *
 * Wraps children so it can OWN the syncing flag: `syncing` is derived from the
 * session status during render, not written from an effect. Were it set in an
 * effect, there would be one committed frame where the session had resolved but
 * the fetch had not started — and a student on a private price would see the
 * public price flash, then a skeleton, then their own price.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { api } from "@/lib/api-client";
import { publicPricingToDisplay } from "@/lib/pricing-format";
import { PricesSyncingProvider, usePricesOverlay } from "@/components/pricing/PricesProvider";

export function UserPricingSync({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const { apply, clear } = usePricesOverlay();

  const email = session?.user?.email ?? null;

  // The email this component has finished resolving prices for — set when the
  // fetch settles, success or failure. Compared against the live session email so
  // the flag is correct in the same render the session resolves in.
  const [settledFor, setSettledFor] = useState<string | null>(null);

  const syncing = status === "loading" || (status === "authenticated" && settledFor !== email);

  // Tracks the email a fetch was started for, so a re-render with a new session
  // object reference (NextAuth rebuilds it every cycle) doesn't refetch.
  const fetchedForEmail = useRef<string | null>(null);

  const fetchOwnPrices = useCallback(
    async (forEmail: string) => {
      try {
        const pricing = await api.pricing.get();
        if (pricing.hasCustomPricing) {
          apply(publicPricingToDisplay(pricing, locale));
        }
      } catch {
        // Silent: the student keeps seeing public prices. The server still charges
        // their real price, so this degrades display only.
      } finally {
        setSettledFor(forEmail);
      }
    },
    [apply, locale],
  );

  // Fires once per login, keyed on the email string rather than the session
  // object — same reasoning as useUserSession.
  useEffect(() => {
    if (status !== "authenticated" || !email) return;
    if (fetchedForEmail.current === email) return;

    fetchedForEmail.current = email;
    fetchOwnPrices(email);
  }, [status, email, fetchOwnPrices]);

  // Reset on sign-out so the next student in the same tab can't inherit the
  // previous one's prices. Ref writes belong in an effect.
  useEffect(() => {
    if (status === "unauthenticated") {
      fetchedForEmail.current = null;
    }
  }, [status]);

  // State cleared via the render-phase "adjust state on input change" pattern
  // already used in useUserSession.
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === "unauthenticated") {
      setSettledFor(null);
      clear();
    }
  }

  return <PricesSyncingProvider value={syncing}>{children}</PricesSyncingProvider>;
}
