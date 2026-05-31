# Task P4-03 — Sentry release tagging via `VERCEL_GIT_COMMIT_SHA`

**Severity:** 🟢 Low
**Effort:** 30 minutes
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

Sentry sees errors but groups them across all deploys. Tagging each event with the git commit SHA (and environment) makes the "Releases" dashboard work, lets you correlate an error spike with a specific commit, and enables regression detection.

## Context

### What Vercel provides

Vercel sets these environment variables automatically on every deploy:

| Variable | Value | Example |
|----------|-------|---------|
| `VERCEL_GIT_COMMIT_SHA` | Full SHA of the deployed commit | `a1b2c3d4e5f6...` |
| `VERCEL_ENV` | `production`, `preview`, or `development` | `production` |
| `VERCEL_GIT_COMMIT_REF` | Branch name | `main` |
| `VERCEL_URL` | Deployment URL | `gustavoai.dev` |

These are exposed automatically in serverless functions. Sentry's Next.js SDK doesn't auto-read them; you wire them in.

### Why it matters

Without release tagging:
- Every error event is grouped with all historical events of the same shape — even if a recent commit fixed it
- "Regression" alerts don't fire because Sentry can't tell which release introduced a fingerprint
- Source maps must be uploaded but aren't tied to a specific release, so resolving an error to a code line is hit-or-miss

With release tagging:
- Sentry "Releases" page shows error counts per deploy
- "Resolved in next release" workflow works
- Alerts can fire on "new in release X" specifically

## Files affected

| File | Change |
|------|--------|
| `sentry.server.config.ts` | Add `release` + `environment` to `Sentry.init` |
| `sentry.edge.config.ts` | Same |
| `src/instrumentation-client.ts` | Same for client SDK |
| `next.config.mjs` | Ensure `withSentryConfig` is given the release explicitly (already does so via webpack plugin, but document) |

## The change

### 1. `sentry.server.config.ts`

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // REFACTOR-P4-03: Release + environment tags
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",

  tracesSampleRate: 0.1,  // your existing value
  // ... other existing options
});
```

### 2. `sentry.edge.config.ts`

Identical change:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  // ... existing options
});
```

### 3. `src/instrumentation-client.ts`

Browser-side Sentry also needs the release. Vercel exposes `VERCEL_GIT_COMMIT_SHA` to the client only if you whitelist it via `NEXT_PUBLIC_`. Add a build-time variable:

```typescript
// src/instrumentation-client.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // REFACTOR-P4-03: NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is set in next.config.mjs
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  // ... existing options
});
```

### 4. `next.config.mjs` — expose to client at build time

```typescript
const nextConfig = {
  // ... existing config ...

  env: {
    // REFACTOR-P4-03: Expose Vercel build-time vars to the browser for Sentry
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },

  // ... rest unchanged ...
};
```

These get inlined at build time, so each deploy's client bundle has its own SHA.

### 5. Verify `withSentryConfig` uploads source maps for the release

Your existing config already enables source map upload via `widenClientFileUpload: true`. The Sentry CLI uses the release name from `release:` in init. When Sentry CLI runs during the build (via the webpack plugin), it should associate maps with `VERCEL_GIT_COMMIT_SHA`.

Double-check by:
1. Deploy a fresh commit
2. In Sentry dashboard → Releases — confirm a new release appears named with the SHA
3. Click the release — confirm "Source Maps" tab shows the uploaded `.map` files

If not working, ensure `SENTRY_AUTH_TOKEN` is set in Vercel env (required for CI uploads).

## Acceptance criteria

- [ ] Server-side Sentry events tagged with `release` = git SHA and `environment` = `VERCEL_ENV`
- [ ] Edge-runtime events same
- [ ] Client-side events same (using `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`)
- [ ] `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` and `NEXT_PUBLIC_VERCEL_ENV` exposed via `next.config.mjs`
- [ ] After a deploy, Sentry Releases page shows the new SHA with associated source maps
- [ ] Triggering a test error in the new deploy shows the error grouped under that release

## Test plan

### Verification

```bash
# 1. Deploy to a preview branch
git checkout -b refactor/p4-03-sentry-release
# ... make the changes ...
git commit -am "REFACTOR-P4-03"
git push
# Wait for Vercel preview deploy

# 2. Note the commit SHA in Vercel's deployment URL or git log
git log -1 --format=%H

# 3. Hit an endpoint that you know triggers an error (or add a temporary throw)
curl https://gustavoai-git-refactor-p4-03-sentry-release.vercel.app/api/intentional-error

# 4. In Sentry → Issues → click the error → "Tags" panel
# Confirm: release = <your SHA>, environment = "preview"

# 5. In Sentry → Releases — the new SHA should appear in the list

# 6. (If source maps): click into a stack frame — code should display
```

### Manual: regression detection

In Sentry, set up an alert:

> Alert when **new** issues appear **in release** matching `?release`

Fire after the first deploy with this change. Subsequent deploys with regressions will alert.

## Notes / gotchas

- **Preview deploys flood the release list.** Sentry's free tier has a release count limit. Consider:
  - Filtering preview releases via `environment != "production"` in the alert rules
  - Or only tagging production: `release: process.env.VERCEL_ENV === "production" ? process.env.VERCEL_GIT_COMMIT_SHA : undefined`
- **`NEXT_PUBLIC_*` exposure:** the SHA is public information once deployed (visible in client bundle). Don't include any secrets via this pattern.
- **`SENTRY_AUTH_TOKEN`:** required for the Sentry CLI to associate source maps with releases. Generate at https://sentry.io/settings/account/api/auth-tokens/ with `project:write` scope. Set in Vercel env (project settings → environment variables) as a build-time variable.
- **Short SHA vs full SHA:** Sentry recommends full SHA. Don't use `VERCEL_GIT_COMMIT_SHA.slice(0, 7)`.
- **Local dev:** `VERCEL_GIT_COMMIT_SHA` is undefined locally. `release` will be `undefined`, which Sentry accepts (release defaults to `unspecified`). Acceptable for dev.

## Out of scope

- Sentry "deploy" tracking (POST to `/api/0/organizations/{org}/releases/{version}/deploys/`). Adds CI steps; the release-on-error tagging is sufficient.
- Replacing `@sentry/nextjs` with a different APM. Works, leave it.
- Custom fingerprinting rules (Sentry → Issues → Fingerprint Rules). Per-release grouping comes naturally with release tagging.
- Performance / web vitals tagging. Adds bundle weight; defer unless you actively use Sentry Performance.
