# P2-02 — The «new course» announcement

**Tag:** `COURSE-C2-P2-02` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1-05 complete (the course is whole)

## TL;DR

Send the `launch:llm-agents` announcement through `POST /api/admin/course-announce`
(`COURSE-P6-02`), once, in both locales, after a dry run. The mechanism exists; what does not is
the **copy**: `emails.courseLaunch.*` was written for one course («el primero», «construyen un
Transformer», «No hay nada que instalar») and is wrong for this one in three sentences.

## Context

- `src/app/api/admin/course-announce/route.ts` — dry-run by default; `kind: launch`, key
  `launch:<slug>`, idempotent via `audit_log`; recipients `subscriptions WHERE type='courses'`,
  localised per `users.locale`.
- `messages/{es,en}.json` → `emails.courseLaunch.{subject,heading,intro,body1,body2,cta,landingCta,unsubscribe}`.
  `subject`/`body1` take `{courseTitle}` and `{lessonCount}`; `intro` says this is the first
  email; `body1` describes a Transformer; `body2` says nothing to install.
- `src/infrastructure/resend/email-functions.ts` — the template that reads those keys.

## Files affected

| File | Change |
|------|--------|
| `messages/es.json`, `messages/en.json` | Split the course-specific sentences into a per-course namespace: `emails.courseLaunch.courses.dl-nlp.{intro,body1,body2}` and `…courses.llm-agents.{…}`; keep `subject`, `heading`, `cta`, `landingCta`, `unsubscribe` shared. Key-for-key |
| `src/infrastructure/resend/email-functions.ts` | Read the per-course keys by slug; fall back to a generic set if a slug has none (so a third course never sends «el primero») |
| `src/infrastructure/resend/__tests__/…` | Per the memory note, templates are untestable in Jest through `getTranslations`; mock the module and test the *caller* picks the slug's namespace |

The `llm-agents` copy, in sense: this is the second course; it continues the first; forty
lessons from the one-column Transformer to a coding agent in your terminal; the last block runs
on a model on your own machine, free; nothing to install until then.

## Acceptance criteria

- [ ] Dry run returns both rendered locales with the `llm-agents` copy and the right recipient
      count; the admin panel shows the resolved key `launch:llm-agents`
- [ ] One confirmed send; a second invocation reaches nobody (idempotent)
- [ ] The `dl-nlp` copy is byte-identical after the split (snapshot the rendered email before)
- [ ] Unsubscribe path unchanged

## Test plan

- The dry run, read by a person, in both languages, before `confirm: true`.
- The caller test above; `pnpm test` green.

## Notes / gotchas

- Send it **once the course is complete**, not at Block 1. The opt-in promised «new courses»,
  and a block is not a course. Block-by-block progress can go out as `update:<slug>:<date>` if
  it ever seems worth it — it probably is not.
- The route chunks; re-POST with `offset: 0` and let the audit log page (its own file-top
  comment explains why).

## Out of scope

- A newsletter, a composer, subscriber management — `P6-02`'s «NOT a newsletter» stands.
