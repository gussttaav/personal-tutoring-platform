"use client";

// REFACTOR-P3-05: replaced the polling SSE EventSource with a Supabase Realtime
// broadcast subscription. The browser fetches the channel name + current state
// from /api/payment-confirmation/channel and subscribes for live confirmation —
// one WebSocket per tab, zero polling. Public API is unchanged.
//
// Webhook-before-subscribe race: the channel endpoint returns the current
// confirmation state, so a late subscriber (webhook already fired) resolves
// immediately. We also re-check state on every SUBSCRIBED (incl. reconnects),
// mirroring useSessionChatStream, to recover a broadcast that landed in a gap.

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type SSEState = "idle" | "connecting" | "confirmed" | "timeout" | "error";

interface UseSSECreditsOptions {
  /** The Stripe PaymentIntent ID (pi_xxx). Pass null to stay idle. */
  paymentIntentId: string | null;
}

interface SSECreditsResult {
  state: SSEState;
  credits: number | null;
  name: string;
  packSize: number | null;
}

export function useSSECredits({ paymentIntentId }: UseSSECreditsOptions): SSECreditsResult {
  const [state, setState] = useState<SSEState>(paymentIntentId ? "connecting" : "idle");
  const [credits, setCredits] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [packSize, setPackSize] = useState<number | null>(null);

  // Reset to "connecting" when a new payment intent arrives (render-phase
  // "adjust state on input change" — not a synchronous set inside the effect).
  const [prevPaymentIntentId, setPrevPaymentIntentId] = useState(paymentIntentId);
  if (paymentIntentId !== prevPaymentIntentId) {
    setPrevPaymentIntentId(paymentIntentId);
    if (paymentIntentId) setState("connecting");
  }

  useEffect(() => {
    if (!paymentIntentId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabaseBrowser.channel> | null = null;

    const applyConfirmed = (d: { credits: number; name: string; packSize: number | null }) => {
      setCredits(d.credits);
      setName(d.name);
      setPackSize(d.packSize);
      setState("confirmed");
    };

    // Fetch channel name + current state. Returns channelName, or null if already
    // resolved (race) / failed.
    const fetchState = async (): Promise<string | null> => {
      try {
        const res = await fetch(
          `/api/payment-confirmation/channel?payment_intent_id=${encodeURIComponent(paymentIntentId)}`,
        );
        if (cancelled || !res.ok) return null;
        const data = await res.json();
        if (cancelled) return null;
        if (data.confirmed) {
          applyConfirmed(data); // race: webhook already fired
          return null;
        }
        return data.channelName as string;
      } catch {
        return null;
      }
    };

    (async () => {
      const channelName = await fetchState();
      if (cancelled || !channelName) return;

      channel = supabaseBrowser
        .channel(channelName)
        .on("broadcast", { event: "confirmed" }, ({ payload }) => {
          if (!payload || typeof payload !== "object") return;
          applyConfirmed(payload as { credits: number; name: string; packSize: number | null });
        })
        .subscribe((status) => {
          // On reconnect, re-check state in case the broadcast landed during the gap.
          if (status === "SUBSCRIBED") void fetchState();
        });
    })();

    // Client-side timeout fallback (was the server `timeout` event) → manual refresh prompt.
    const timer = setTimeout(() => {
      if (!cancelled) setState((s) => (s === "confirmed" ? s : "timeout"));
    }, 30_000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabaseBrowser.removeChannel(channel);
    };
  }, [paymentIntentId]);

  return { state, credits, name, packSize };
}
