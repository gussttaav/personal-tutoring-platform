"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import { CREDITS_POLL_INTERVAL_MS, CREDITS_POLL_MAX_ATTEMPTS } from "@/constants";

type PollerState = "idle" | "polling" | "confirmed" | "timeout" | "error";

interface UseCreditsPollerOptions {
  enabled: boolean;
}

export function useCreditsPoller({ enabled }: UseCreditsPollerOptions) {
  const [state, setState] = useState<PollerState>(enabled ? "polling" : "idle");
  const [credits, setCredits] = useState<number | null>(null);
  const [name, setName] = useState("");

  const poll = useCallback(async () => {
    if (!enabled) return;

    setState("polling");
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const data = await api.credits.get();
        if (data.credits > 0) {
          setCredits(data.credits);
          setName(data.name);
          setState("confirmed");
          clearInterval(interval);
        }
      } catch {
        // Swallow — keep retrying
      }

      if (attempts >= CREDITS_POLL_MAX_ATTEMPTS) {
        setState("timeout");
        clearInterval(interval);
      }
    }, CREDITS_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    const cleanup = poll();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [poll]);

  return { state, credits, name };
}
