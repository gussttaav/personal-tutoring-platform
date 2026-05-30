"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/app/api/chat-session/route";
import { supabaseBrowser } from "@/lib/supabase-browser";

export interface UseSessionChatStream {
  messages:     ChatMessage[];
  send:         (text: string) => Promise<void>;
  lastIncoming: ChatMessage | null;
  // Typing indicator: true while the other participant is composing.
  remoteTyping: boolean;
  // Emit our own typing state to the other side (ephemeral, best-effort).
  setTyping:    (typing: boolean) => void;
}

// Ephemeral typing-broadcast payload (never persisted).
interface TypingPayload {
  email:  string;
  typing: boolean;
}

// REFACTOR-P3-01: replaced the polling SSE EventSource with a Supabase Realtime
// broadcast subscription. The browser fetches the channel name + message
// backlog from /api/chat-session/channel (server-only secret signs the name)
// and subscribes directly — one persistent WebSocket per tab, zero polling,
// sub-second delivery.
//
// The public API is unchanged so ZoomRoomSession.tsx is not affected:
//   - `enabled` gates the subscription
//   - `userEmail` drives lastIncoming (set on NON-self messages so callers can
//     react with badge + ding without opening a parallel subscription)
//   - `send` still POSTs to /api/chat-session (the broadcast is fired by the
//     server inside postChatMessage)
//
// REFACTOR-P3-01 (reliability fix): the broadcast subscription only delivers
// messages from the moment it (re)subscribes. If the WebSocket drops and
// reconnects mid-session, messages broadcast during the gap are persisted but
// never delivered live. We detect reconnects via the subscribe() status
// callback and re-fetch the backlog from /api/chat-session/channel, reusing
// seenIdsRef/ingest to dedup so nothing is shown twice.
export function useSessionChatStream(
  eventId:   string,
  userEmail: string | undefined,
  enabled:   boolean,
): UseSessionChatStream {
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [lastIncoming, setLastIncoming] = useState<ChatMessage | null>(null);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const seenIdsRef = useRef(new Set<string>());

  // Live channel kept in a ref so setTyping() can broadcast from outside the
  // subscribe effect. Cleared on unsubscribe so setTyping no-ops when gone.
  const channelRef = useRef<ReturnType<typeof supabaseBrowser.channel> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabaseBrowser.channel> | null = null;
    // Auto-clears remoteTyping if a `typing:false` is dropped/never sent.
    let typingClearTimer: ReturnType<typeof setTimeout> | null = null;

    const ingest = (msg: ChatMessage) => {
      if (seenIdsRef.current.has(msg.id)) return;
      seenIdsRef.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
      if (userEmail && msg.senderEmail !== userEmail) {
        setLastIncoming(msg);
      }
    };

    // Fetch the channel name + message backlog. Returns the channel name so the
    // initial run can subscribe; reconnect runs ignore it and just re-ingest.
    const fetchBacklog = async (): Promise<string | null> => {
      try {
        const res = await fetch(
          `/api/chat-session/channel?eventId=${encodeURIComponent(eventId)}`,
        );
        if (cancelled || !res.ok) return null;
        const { channelName, initialMessages } = (await res.json()) as {
          channelName:     string;
          initialMessages: ChatMessage[];
        };
        if (cancelled) return null;

        initialMessages.forEach(ingest);
        return channelName;
      } catch {
        /* network blip — caller can reload to retry */
        return null;
      }
    };

    (async () => {
      const channelName = await fetchBacklog();
      if (cancelled || !channelName) return;

      // Track disconnects so a SUBSCRIBED that follows one is treated as a
      // reconnect. The first SUBSCRIBED (right after the initial fetch above)
      // leaves this false, so it does not trigger a redundant refetch.
      let disconnectedSinceSubscribe = false;

      channel = supabaseBrowser
        .channel(channelName)
        .on("broadcast", { event: "message" }, ({ payload }) => {
          if (!payload || typeof payload !== "object") return;
          ingest(payload as ChatMessage);
        })
        // Ephemeral typing signal from the other participant. Best-effort: not
        // persisted, ignored if it's our own echo, and auto-cleared after 4s in
        // case a trailing `typing:false` is dropped.
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (!payload || typeof payload !== "object") return;
          const { email, typing } = payload as TypingPayload;
          if (!userEmail || email === userEmail) return;
          if (typingClearTimer) clearTimeout(typingClearTimer);
          if (typing) {
            setRemoteTyping(true);
            typingClearTimer = setTimeout(() => setRemoteTyping(false), 4000);
          } else {
            setRemoteTyping(false);
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // Reconnect: re-fetch the backlog to recover anything broadcast
            // during the gap. ingest() dedups via seenIdsRef, so already-shown
            // messages are skipped and lastIncoming fires only for new ones.
            if (disconnectedSinceSubscribe) void fetchBacklog();
            disconnectedSinceSubscribe = false;
          } else if (
            status === "CLOSED" ||
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT"
          ) {
            disconnectedSinceSubscribe = true;
          }
        });

      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (typingClearTimer) clearTimeout(typingClearTimer);
      setRemoteTyping(false);
      channelRef.current = null;
      if (channel) void supabaseBrowser.removeChannel(channel);
    };
  }, [enabled, eventId, userEmail]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await fetch("/api/chat-session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ eventId, text: trimmed }),
    });
  }, [eventId]);

  // Broadcast our typing state directly over the existing channel (no server
  // round-trip). No-ops if we have no identity or the channel isn't live yet.
  const setTyping = useCallback((typing: boolean) => {
    if (!userEmail) return;
    void channelRef.current?.send({
      type:    "broadcast",
      event:   "typing",
      payload: { email: userEmail, typing } satisfies TypingPayload,
    });
  }, [userEmail]);

  return { messages, send, lastIncoming, remoteTyping, setTyping };
}
