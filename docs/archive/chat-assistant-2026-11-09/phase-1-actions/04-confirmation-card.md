# P1-04: Slot chips and confirmation card

**Tag:** `CHAT-AGENT-P1-04` · **Effort:** M · **Owner:** Claude · **Status:** ⬜ · **Q1:** sign in inside the card

## TL;DR

Render the `actions` that `/api/chat` now returns. A `slots` action becomes a row of chips under
the bot message; tapping one sends «Prefiero el mar 4 nov a las 10:00» as a user message. A
`proposal` action becomes a card with the date/time and **Confirmar reserva**, which calls
`api.book.post({ sessionType: "free15min", … })`, the same call the wizard makes. Signed out,
the card shows the Google sign-in button first; after it, the user taps Confirmar (Q1).

## Context

- `src/components/Chat.tsx`: `Message = { role, text }` (`:54-57`), persisted to sessionStorage
  (`:63-88`, last 20); `sendMessage` (`:206-238`) POSTs `{ message, sessionId }`; bot messages
  go through `BotMessage` (react-markdown).
- The wizard's confirm: `src/components/SingleSessionBooking.tsx:347-370`: `api.book.post`,
  `trackBooking(sessionType)` (BOOKING-ATTRIBUTION-01), errors via
  `errorCodeToKey(code, status)` (`src/constants/errors.ts:60`) and `tErrors`.
- Sign-in inside a surface: `GoogleSignInButton` with `resumeInPlace`
  (`src/components/GoogleSignInButton.tsx:12-16`); session state from `useUserSession()`
  (`isSignedIn`, `isAuthLoading`).
- `api-client` attaches first-touch attribution to `book.post` automatically.
- The chat is a non-modal side panel, `inert` when closed (`CHAT-DRAWER-01`).

## Files affected

| File | Change |
|------|--------|
| `src/components/Chat.tsx` | `Message.actions?: ChatAction[]`; send `timezone` (`Intl.DateTimeFormat().resolvedOptions().timeZone`) with each message; render actions under the bot message |
| `src/components/chat/SlotChips.tsx` (new) | Chips → `sendMessage(t("chat.actions.pickSlot", { label }))` |
| `src/components/chat/FreeCallProposalCard.tsx` (new) | States: `signin` → `ready` → `booking` → `done` / `error` / `expired` |
| `src/app/globals.css` (where `.chat-panel` lives) | `.chat-slot-chip`, `.chat-proposal-card` |
| `messages/es.json`, `messages/en.json` | `chat.actions.*` (pick slot, confirm, booked, expired, sign in first, errors) |
| `src/components/chat/__tests__/FreeCallProposalCard.test.tsx` (new) | RTL: each state |

## The change

- **Proposal card** shows: «Encuentro inicial gratuito · 15 min», the date/time in the visitor's
  locale and timezone (`Intl.DateTimeFormat`), the timezone name, and one button.
- **Signed out:** `GoogleSignInButton resumeInPlace`; after the session flips, the card shows
  Confirmar (no automatic booking after sign-in: the user taps once more).
- **Confirm:** `api.book.post({ startIso, endIso, sessionType: "free15min", timezone })` →
  success: «Reservado. Te hemos enviado un email con el enlace al aula.» + link to
  `/area-personal`; `trackBooking("free15min")`.
- **Errors** reuse `errorCodeToKey`: `SLOT_UNAVAILABLE` → «Ese hueco acaba de ocuparse», plus a
  «Buscar otro hueco» button that sends a message; `FREE_SESSION_ALREADY_USED` → the rule.
- **Expired:** a persisted proposal whose `startIso` is in the past (or within min-notice)
  renders disabled.
- **Only the latest proposal is live.** Older proposal cards in the thread render disabled, so
  a scroll-back tap can't book a slot the conversation moved past.
- Persist `actions` with the message in sessionStorage (they are small).
- Accessibility: card is a `group` with an `aria-label`; buttons are real `<button>`s; the
  result is announced through the existing `role="log" aria-live="polite"`.

## Acceptance criteria

- End to end on dev + test DB: ask → chips → pick → card → confirm → booking row, calendar
  event, confirmation email, the class visible in `/area-personal`.
- Signed-out flow books after the popup sign-in, without reloading the page.
- Double-tap on Confirmar sends one request.
- Both locales render all new strings (`pnpm check:messages`).

## Test plan

- RTL: card states, latest-only rule, expired rendering, error mapping.
- Playwright (optional): stub `/api/chat` with `page.route` to return a fixed `proposal`, then
  run the real `/api/book` against the test DB. Ask before running booking specs (they truncate
  the test DB).
- Manual: phone width (full-screen panel), dark/light, es/en.
- `pnpm test`, `pnpm lint`, `pnpm build`.

## Gotchas

- `useBooking()` is **not** available everywhere the chat is (BookingOverlays only mounts on
  `/`, `/mentoria`, `/area-personal`); the card must not depend on it. It calls `api.book.post`
  directly.
- `useUserSession()` doesn't expose a refetch of `hasBookings`; after a booking, the Navbar
  state updates on the next navigation. Acceptable for v1 (note it in the PR).
- The chat is lazy-loaded (`next/dynamic`); keep the new components inside that chunk.

## Out of scope

- Voice (P2). Calendar matching (P3).
