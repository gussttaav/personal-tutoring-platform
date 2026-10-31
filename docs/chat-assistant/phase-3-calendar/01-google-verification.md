# P3-01: Google scope and verification

**Tag:** `CHAT-AGENT-P3-01` · **Effort:** S (work) / weeks (Google's review) · **Owner:** Gustavo + Claude · **Status:** ⬜

## TL;DR

Declare `https://www.googleapis.com/auth/calendar.freebusy` on the existing OAuth client's consent
screen, update the privacy policy, and submit the app for verification. Sign-in itself keeps
asking only for `openid email profile`; the calendar scope is requested later, by P3-02, only
when the user taps the button.

## Steps

1. **Check the scope's classification** in Google Cloud console → *Google Auth Platform* →
   *Data access*. We expect *sensitive* (not *restricted*): brand verification + justification
   + demo video, no third-party security assessment. If it shows *restricted*, stop and re-plan.
2. **Add the scope** to *Data access* with the justification (draft below).
3. **Authorized JavaScript origins** on the OAuth client: `https://gustavoai.dev`, the staging
   origin, `http://localhost:3000` (Google Identity Services' token client checks the origin).
4. **Privacy policy** (`src/components/policy/PolicyContent.tsx`, es + en; bump `lastUpdated` in
   `src/app/[locale]/privacidad/page.tsx`): what is read (busy intervals of the primary calendar,
   no event details), when (only after the user taps the button and consents), where it goes
   (stays in the browser; never sent to our servers or to the AI assistant), retention (none), how
   to revoke (myaccount.google.com/permissions). Add the Google API Services User Data Policy
   *Limited Use* statement.
5. **Demo video** (unlisted YouTube): sign in → open chat → ask for slots → «Comparar con mi
   calendario» → consent screen showing the scope → filtered chips. Record on staging once P3-02
   works with a test user.
6. **Submit** for verification. Until approved, add Gustavo's and a few testers' accounts as
   test users (or accept the "unverified app" screen for them).

## Justification draft (for the console)

> gustavoai.dev lets visitors book a free 15-minute call with the tutor from an AI chat
> assistant. When the visitor asks to compare the tutor's free slots with their own calendar,
> the site requests read-only free/busy access to their primary calendar, reads the busy
> intervals for the next 7 days in the browser, and hides the slots that clash. Event details are
> never requested. The data is not sent to our servers, not stored, and not shared.

## Acceptance criteria

- Scope listed on the consent screen config; privacy policy live in both locales.
- Verification submitted (record the date in STATUS.md); test users can use P3-02 meanwhile.

## Gotchas

- Changing the consent screen must not re-prompt existing users at sign-in: the scope is only
  *declared*, never requested by NextAuth (`src/auth.ts:35-38` stays as is).
- The mobile app uses the same Google project for sign-in (`/api/auth/mobile`); its consent is
  unaffected for the same reason.
