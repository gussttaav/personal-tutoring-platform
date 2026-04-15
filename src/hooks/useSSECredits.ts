"use client";

/**
 *
 * Opens a single Server-Sent Events connection to /api/sse?payment_intent_id=...
 * and waits for the server to push a "credits_ready" event.
 * No polling, no repeated /api/credits calls.
 */

import { useState, useEffect } from "react";

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

  useEffect(() => {
    if (!paymentIntentId) return;

    setState("connecting");

    const url = `/api/sse?payment_intent_id=${encodeURIComponent(paymentIntentId)}`;
    const es = new EventSource(url);

    es.addEventListener("credits_ready", (e) => {
      try {
        const data = JSON.parse(e.data) as {
          credits: number;
          name: string;
          packSize: number | null;
        };
        setCredits(data.credits);
        setName(data.name);
        setPackSize(data.packSize);
        setState("confirmed");
      } catch {
        setState("error");
      } finally {
        es.close();
      }
    });

    es.addEventListener("timeout", () => {
      setState("timeout");
      es.close();
    });

    es.onerror = () => {
      // EventSource auto-reconnects on network errors; only mark as error
      // if the connection was never established (readyState CLOSED immediately)
      if (es.readyState === EventSource.CLOSED) {
        setState("error");
      }
    };

    return () => {
      es.close();
    };
  }, [paymentIntentId]);

  return { state, credits, name, packSize };
}
