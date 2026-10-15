"use client";

/**
 * ChatProvider — the AI assistant, once per app.
 *
 * CHAT-GLOBAL-01: mounted in the root layout (`[locale]/layout.tsx`), so the chat is on every
 * page `isChatRoute` allows (everything but the classroom, admin and the auth popups),
 * booking screens and the personal area included. It used to be mounted by `/` (`HomeChat`)
 * and `/mentoria` (`InteractiveShell`) only, and unmounted while a booking screen was up, so
 * «Pregunta al asistente IA» did nothing anywhere else. Living in the layout, it also survives
 * client navigations: an open conversation stays open on the next page.
 *
 * `Chat` comes in through `next/dynamic` with `ssr: false`: react-markdown + remark-gfm stay out
 * of every route's first-load JS (lessons and posts never carried them, and they should not
 * start to), and the chunk loads after hydration. The open state lives HERE, not in `Chat`, so
 * an `open-chat` dispatched before that chunk arrives still opens the panel once it does.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { isChatRoute } from "@/lib/chat-routes";
import { ChatContext, OPEN_CHAT_EVENT, type ChatValue } from "@/hooks/useChat";

const Chat = dynamic(() => import("@/components/Chat"), { ssr: false });

export default function ChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const available = isChatRoute(pathname);
  const [isOpen, setIsOpen] = useState(false);
  const [unseen, setUnseen] = useState(true);

  const open = useCallback(() => { setIsOpen(true); setUnseen(false); }, []);
  const close = useCallback(() => { setIsOpen(false); }, []);
  const toggle = useCallback(() => { setIsOpen((prev) => !prev); setUnseen(false); }, []);

  // The landing CTAs («Pregunta al asistente IA» in the closing band and the areas section)
  // dispatch this event rather than importing the hook.
  useEffect(() => {
    window.addEventListener(OPEN_CHAT_EVENT, open);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, open);
  }, [open]);

  const value = useMemo<ChatValue>(
    () => ({ available, isOpen: available && isOpen, unseen, open, close, toggle }),
    [available, isOpen, unseen, open, close, toggle],
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
      {available && <Chat />}
    </ChatContext.Provider>
  );
}
