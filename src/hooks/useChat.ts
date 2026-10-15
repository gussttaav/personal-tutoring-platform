"use client";

/**
 * useChat — the AI assistant's page-wide open state.
 *
 * CHAT-GLOBAL-01: the chat used to own its `isOpen` and was mounted per page (`/`, `/mentoria`),
 * so the only way to reach it from outside was the `open-chat` window event, which nothing
 * heard on the other pages. Now `ChatProvider` (root layout) holds the state and mounts the
 * chat once, and every entry point reads it here: the Navbar's assistant icon (the one
 * always-visible entry point; there is no floating button) and the Footer link.
 * `open-chat` still works for the landing CTAs that dispatch it; the provider listens.
 *
 * `available` is false where the chat is left out (`isChatRoute`): entry points hide
 * themselves there instead of offering a dead control. Outside the provider (isolated
 * component tests) the hook answers that same "not available" value with no-op actions.
 */

import { createContext, useContext } from "react";

export const OPEN_CHAT_EVENT = "open-chat";

export interface ChatValue {
  /** The chat is offered on this route (`isChatRoute`). */
  available: boolean;
  isOpen: boolean;
  /** Not opened yet this visit: the entry points show the pulsing dot. */
  unseen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const noop = () => {};

export const ChatContext = createContext<ChatValue>({
  available: false,
  isOpen: false,
  unseen: false,
  open: noop,
  close: noop,
  toggle: noop,
});

export function useChat(): ChatValue {
  return useContext(ChatContext);
}
