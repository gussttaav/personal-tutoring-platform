# gustavoai.dev — Project Context

## Stack
Next.js 14 (App Router) · TypeScript strict · NextAuth v5 · Stripe ·
Google Calendar · Zoom Video SDK · Upstash Redis · Gemini · Resend

## Architectural Principles
- **No database yet.** Redis is source of truth. Migration to Supabase planned.
- **Server/client boundary is strict.** Never import server-only modules in client components.
- **All secrets server-side.** Anything in `NEXT_PUBLIC_*` is public.
- **Repository pattern incoming.** New data access goes through interfaces in
  `src/domain/repositories/`, not direct `kv.ts` calls.

## Conventions
- Zod schemas live in `src/lib/schemas.ts` — never inline in route handlers.
- Structured logging via `log()` from `src/lib/logger.ts` — no `console.*`.
- Singletons: `stripe` from `@/lib/stripe`, `kv` from `@/lib/redis`.
- User-facing text is Spanish. Error messages go through `friendlyError()`.

## Gotchas
- NextAuth v5 is in beta. Session shape: `session.user.email`, `session.user.name`.
- Upstash Redis REST API does NOT support MULTI/EXEC — use Lua via `kv.eval()`.
- Vercel serverless functions cap at 25s (Hobby) / 60s (Pro). SSE uses 24s.
- `setTimeout` does NOT work reliably in serverless — use QStash for delays > 10s.
- Zoom Video SDK != Zoom Meetings API. JWT signing only; no REST for session mgmt.
- `GOOGLE_PRIVATE_KEY` needs `\\n` → `\n` replacement (already handled in calendar.ts).

## Commit & Code Documentation Convention
Each fix gets an ID like `SEC-01`, `PERF-04`, etc. When modifying a file 
for a specific task, prepend a comment block documenting the fix, matching 
the style already present in kv.ts, calendar.ts, and webhook/route.ts.

## Testing
- `npm test` — Jest unit tests
- Tests live in `src/lib/__tests__/`
- New business logic requires a test

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (must pass before PR)
- `npm run lint` — must pass

## Active Refactor
See `docs/refactor/` for the current plan and phase status.
Always read `docs/refactor/STATUS.md` before making architectural changes.

## Refactor Hygiene
- Only modify files listed in the task's Scope section
- Do not refactor adjacent code "while you're there"
- Do not rename variables unless explicitly asked
- Preserve existing comments unless they're now incorrect

## Do Not
- Add `console.log` — use `log()`
- Create new Redis clients — import `kv` from `@/lib/redis`
- Put business logic in route handlers — it belongs in `src/services/`
- Reproduce race conditions in credit operations — use atomic Lua scripts
