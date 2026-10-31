# Phase 3: match the visitor's Google Calendar

**Outcome:** under the slot chips (P1-04), a signed-in visitor can tap «Comparar con mi
calendario». Google asks for permission to see their free/busy times; the chips that clash with
their calendar disappear. Their calendar data stays in the browser: not on our server, not in
Claude's context.

| Task | What | Who |
|------|------|-----|
| [P3-01](01-google-verification.md) | Add the `calendar.freebusy` scope in Google Cloud, privacy policy text, submit for verification | Gustavo (console), Claude (policy text, demo script) |
| [P3-02](02-compare-with-my-calendar.md) | The button, the Google Identity Services token flow, client-side filtering | Claude |

Start P3-01 right after P1 merges: Google's review can take weeks. P3-02 can be built and tested
before approval with **test users** on the OAuth consent screen.
