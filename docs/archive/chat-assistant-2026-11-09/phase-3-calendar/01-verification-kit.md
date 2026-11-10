# P3-01 kit: Google console steps, justification and demo script

> **Outcome (2026-11-04):** the console shows `calendar.freebusy` under **non-sensitive** scopes, so
> steps 1-5 were enough and **steps 4 (Search Console) and 6 (submit), the justification and the
> demo video are not needed**. Kept for reference in case a sensitive scope is ever added.

`CHAT-AGENT-P3-01`. Everything Gustavo needs in Google Cloud console. Claude wrote the privacy policy
section (`src/components/policy/PolicyContent.tsx`, «Tu calendario de Google» / "Your Google
Calendar") on `chat-agent/p3-01-google-verification`; it must be **live on gustavoai.dev** before
step 6, because the reviewers read the production `/privacidad` and `/en/privacidad`.

## Console checklist

Google Cloud console → the project that owns `GOOGLE_CLIENT_ID` → **Google Auth Platform**.

1. **Classification.** *Data access* → *Add or remove scopes* → filter
   `https://www.googleapis.com/auth/calendar.freebusy`. Expected: listed under **sensitive**
   («Your sensitive scopes»). If it lands under **restricted**, stop: that means a third-party
   security assessment, and the plan changes.
2. **Add the scope** and save. Paste the justification below in the field Google shows for
   sensitive scopes. Don't add any other calendar scope (`calendar.readonly`,
   `calendar.events…`): one scope, the narrowest.
3. **Authorized JavaScript origins** (*Clients* → the web client): add
   - `https://gustavoai.dev`
   - the staging origin, i.e. its **stable** branch alias on Vercel (a per-commit preview URL
     changes on every push and Google needs exact origins)
   - `http://localhost:3000`
   Leave the *Authorized redirect URIs* as they are (NextAuth's).
4. **Branding** (*Branding* page): check that the app name, logo, home page
   (`https://gustavoai.dev`), privacy policy (`https://gustavoai.dev/privacidad`) and terms
   (`https://gustavoai.dev/terminos`) are filled in, and that `gustavoai.dev` is under
   *Authorized domains*. Brand verification also needs the domain verified in **Google Search
   Console** with the same Google account that owns the project (still pending from the SEO
   cycle, `docs/seo/PLAN.md`): do that first or the submission bounces.
5. **Testing before approval.** Check the *Audience* page's publishing status. Sign-in already
   works for everyone, so it should say **In production**: leave it there. Moving it back to
   *Testing* would restrict sign-in to the test-user list for the whole site. In production,
   until Google approves the scope, whoever taps «Comparar con mi calendario» sees the
   "Google hasn't verified this app" screen (*Advanced → Go to gustavoai.dev*) and the scope
   has a lifetime cap of 100 users; that is enough for you and a few testers on staging. If the
   page shows a *Test users* list anyway, add your account and the testers' there too.
6. **Submit** (*Verification centre* → *Prepare for verification* / *Submit*), once P3-02 works
   on staging and the video is uploaded. Answer the questionnaire with the justification and the
   video link. Write the submission date in `docs/chat-assistant/STATUS.md`.

Sign-in itself is untouched: NextAuth still asks only for `openid email profile`
(`src/auth.ts`), so declaring the scope doesn't re-prompt anyone, on the web or in the mobile
app (`/api/auth/mobile`, same project).

## Justification (paste into the console)

> gustavoai.dev is a tutoring site. Its AI chat assistant suggests free time slots for a free
> 15-minute intro call with the tutor. A signed-in visitor can tap "Compare with my calendar"
> under the suggested slots; only then do we request read-only free/busy access to their primary
> calendar with Google Identity Services. The browser calls the Calendar API freeBusy endpoint
> for the days of the suggested slots (at most 7 days) and hides the slots that overlap a busy
> interval. We never request event titles, descriptions, attendees or any other event detail;
> calendar.freebusy is the narrowest scope that answers "is this person free at this time".
> The busy intervals and the access token stay in the page's memory: they are not sent to our
> servers or to the AI assistant, not stored and not shared. The scope is never requested at
> sign-in.

## Demo video script (unlisted YouTube, ~2 min, record on staging)

Google wants to see the **real consent screen with the OAuth client id in the address bar**
and **how the data is used**. Record in English or with English captions; show the browser's
address bar throughout. A clean browser profile signed in with a test account works best.

1. **0:00 Intro (5 s).** Show `https://<staging>/` (or gustavoai.dev once live), the site name
   visible. Caption: "gustavoai.dev: book a free intro call from the AI assistant".
2. **Sign in (15 s).** Click sign-in, Google account chooser. Caption: "Sign-in asks only for
   name and email". Back on the site, signed in.
3. **Ask for slots (20 s).** Open «Asistente IA», type «¿Tienes hueco el martes por la
   mañana?» (or the English equivalent). The slot chips appear.
4. **Request the scope (25 s).** Click «Comparar con mi calendario». The Google popup opens:
   **zoom on the address bar** so the `client_id=…` parameter is readable, then on the consent
   text that names the permission ("See your free/busy information" or similar). Click *Allow*.
5. **The data in use (25 s).** Before recording, put a busy event in the test account's calendar
   that overlaps some of the chips (e.g. Tuesday 10:00-11:00). Show the chips before and after:
   the overlapping ones disappear, the label says the list was filtered with your calendar.
   Optionally split the screen with Google Calendar showing that event.
6. **Data stays in the browser (20 s).** Open DevTools → *Network*, filter `freeBusy`: the only
   request carrying the token goes to `www.googleapis.com`. Caption: "Busy times are read in the
   browser; nothing is sent to our servers or to the assistant".
7. **Privacy policy and revocation (15 s).** Scroll `/en/privacidad` to "Your Google Calendar",
   then show `myaccount.google.com/permissions` with the app listed and the *Remove access*
   button. Caption: "Users can revoke access at any time".

## After approval

- Note the approval date in `STATUS.md`; P3-02's ⏸ gate becomes "approved".
- Nothing to deploy: the scope is requested by P3-02's button, not by configuration.
