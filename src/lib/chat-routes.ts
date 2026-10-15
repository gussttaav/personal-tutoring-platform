/**
 * lib/chat-routes.ts
 *
 * CHAT-GLOBAL-01: where the AI assistant is offered.
 *
 * The chat is mounted once, in the root layout (`ChatProvider`), so it is on every page unless
 * this says otherwise. It is left out of:
 *   - `/sesion/<token>`: the classroom (pre-join, waiting room, Zoom room and the post-class
 *     review). The room has its own chat with the tutor; a second one would only get in the way.
 *   - `/admin/*`: the tutor's panel, not a visitor's page.
 *   - `/auth/*`: the Google sign-in popup windows.
 *
 * Matched by whole SEGMENT, not string prefix: `/sesion-confirmada` (a booking result page)
 * keeps the chat even though it starts with `/sesion`.
 */

const EXCLUDED_SECTIONS = ["sesion", "admin", "auth"] as const;

/** `pathname` is locale-free (`usePathname` from `@/i18n/navigation`). */
export function isChatRoute(pathname: string): boolean {
  const first = pathname.split("/").find(Boolean) ?? "";
  return !(EXCLUDED_SECTIONS as readonly string[]).includes(first);
}
