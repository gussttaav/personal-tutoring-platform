# P3-02: Compare with my calendar

**Tag:** `CHAT-AGENT-P3-02` · **Effort:** M · **Owner:** Claude · **Status:** ⬜ (P3-01 done; the scope is non-sensitive, so any signed-in user can grant it) · **Q4:** keep the grant

## TL;DR

Add «Comparar con mi calendario» to the slot chips (P1-04). It requests a one-hour access token
for `calendar.freebusy` through Google Identity Services' **token client** (a Google popup),
calls Google's `freeBusy` endpoint **from the browser** for the slots' date range, and hides the
chips that overlap a busy interval. The token lives in memory only; nothing is sent to our server
or to Claude.

## Context

- P1-04 `SlotChips` holds the slots of a `slots` action (`startIso` / `endIso`).
- CSP (`next.config.mjs`): `connect-src` already includes `https://www.googleapis.com`;
  `script-src` does **not** include `https://accounts.google.com` (needed for the GIS script),
  and the GIS popup flow needs no `frame-src` change.
- Sign-in is NextAuth + Google with default scopes (`src/auth.ts:35-38`); the session email is
  available client-side (`useUserSession().googleUser.email`), useful as `login_hint`.

## Files affected

| File | Change |
|------|--------|
| `next.config.mjs` | `script-src` += `https://accounts.google.com` (dev and prod lists) |
| `src/lib/google-calendar-freebusy.ts` (new) | Load GIS script once; `requestFreeBusyToken(loginHint)`; `fetchBusy(token, timeMin, timeMax)` → `{ start, end }[]` |
| `src/lib/slot-overlap.ts` (new, pure) | `filterSlotsByBusy(slots, busy)` |
| `src/components/chat/SlotChips.tsx` | The button (signed-in only), loading state, «N huecos encajan con tu calendario» / «Ninguno encaja», error states |
| `messages/es.json`, `messages/en.json` | `chat.calendar.*` |
| `src/lib/__tests__/slot-overlap.test.ts` (new) | Edge cases |

## The change

- `google.accounts.oauth2.initTokenClient({ client_id: NEXT_PUBLIC_GOOGLE_CLIENT_ID, scope:
  "https://www.googleapis.com/auth/calendar.freebusy", login_hint, prompt: "" })`, called from the
  click handler (popup needs the user gesture). Expose the client id as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  (same value as `GOOGLE_CLIENT_ID`; a client id is public).
- `POST https://www.googleapis.com/calendar/v3/freeBusy` with `Authorization: Bearer <token>`,
  body `{ timeMin, timeMax, items: [{ id: "primary" }] }` covering the chips' range.
- Filter: a chip survives if `slot.start >= busy.end || slot.end <= busy.start` for every busy
  interval. Mark the chip row «filtrado con tu calendario».
- Token: kept in a ref for its lifetime (≤ 1 h) so a second comparison in the same conversation
  doesn't re-open the popup; dropped on «Nueva conversación» and on unmount. **Q4: keep the grant**: never call
  `google.accounts.oauth2.revoke`, so a later comparison (new token, `prompt: ""`) needs one click
  and no consent screen. The user revokes it from myaccount.google.com/permissions (privacy policy, P3-01).
- Nothing about the calendar goes into the next chat message: tapping a chip sends the usual
  «Prefiero …» text.
- Errors: popup closed / consent denied → back to the unfiltered chips, no message; Workspace
  admin blocks the app (`access_denied`) → «Tu organización no permite este acceso»; Google API
  error → «No he podido leer tu calendario».

## Acceptance criteria

- A test user with a busy event on Tuesday 10:00–11:00 sees the 10:00, 10:15, 10:30 and 10:45
  chips disappear; the others stay.
- Network panel: no request to our origin carries calendar data; the token appears only in the
  request to `www.googleapis.com`.
- Signed-out visitors don't see the button.
- Declining consent leaves the chat usable.

## Test plan

- Unit: `filterSlotsByBusy` (touching edges, all-day events, overlapping busy blocks, empty).
- Manual with a test user on staging (Gustavo): consent, filter, decline, second comparison
  without a popup.
- `pnpm test`, `pnpm lint`, `pnpm build`.

## Gotchas

- All-day events come back as busy only if the user's calendar marks them busy; that's Google's
  rule, not ours. Say «según tu calendario» in the copy.
- Third-party cookies are not needed for the token client's popup flow; don't switch to the
  implicit iframe flow.

## Out of scope

- Other calendars (Outlook, iCloud). Writing to the user's calendar (the confirmation email
  already has «Añadir a Google Calendar»).
