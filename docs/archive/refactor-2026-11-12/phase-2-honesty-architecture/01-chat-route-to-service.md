# P2-01 — `/api/chat` becomes a thin route

**Tag:** `REFACTOR-R5-P2-01` · **Severity:** 🟡 · **Effort:** M · **Owner:** Claude · **Status:** ✅

## TL;DR

`src/app/api/chat/route.ts` has grown to ~235 lines. Besides parsing and mapping errors, it:
1. Looks up the user and overlays their private prices. It does this with `hasUserOverrides` and
   then `getPublicPricing`, which reads `user_pricing` **twice** per turn and rebuilds a price map
   that `PricingService.resolve()` already computes.
2. Assembles the system prompt, the `ToolContext` and the `contextNote`.
3. Owns the daily kill switch: `kv.get` before the call, `kv.incrby` + `kv.expire` after. It's the
   only route that imports the Redis client.

Move (1)–(3) into the service layer: a `ChatService.reply()` that takes the request's facts and
returns the answer. Add one `PricingService` method that returns the four effective prices from a
single `resolve()`. The route keeps CSRF, the rate limits, the body parse, the request-scoped reads
(ISR display figures, schedule config, prompt content, the `NEXT_LOCALE` cookie) and error mapping.
Behaviour, the response shape and every log line stay the same.

## Context

`src/app/api/chat/route.ts`:
- `:51-64`: `MAX_DAILY_CHAT_REQUESTS` and `countModelCalls` (kv `incrby` / `expire`)
- `:112-124`: kill-switch pre-check (`kv.get`), 503 when over
- `:150-154`: cached reads (`getDisplayPrices`, `getPackValidityDays`, `getScheduleConfig`). These are Next `unstable_cache` loaders, so they stay in the route.
- `:161`: `userService.findByEmail`, which serves both the prices and the `ToolContext`
- `:163-182`: private-price overlay via `pricingService.hasUserOverrides` (one `listForUser`) and `pricingService.getPublicPricing` (`resolve` → a second `listForUser`)
- `:184-194`: `buildChatSystemPrompt(...)`
- `:197-211`: `ToolContext` (identity from the session) + `buildContextNote`
- `:216-232`: response, the 502 path, `finally → countModelCalls`

`src/services/ChatService.ts:63-98`: `ask()` already owns the Redis history (`kv` is imported there),
so the kill switch belongs beside it.

`src/services/PricingService.ts:48-58`: `resolve(userId?)`, the one merge point (CLAUDE.md).
`:195-197`: `hasUserOverrides` (used only by the chat route).

`src/services/index.ts:107-115`: `chatService` wiring (model + free-call tools).

## Files affected

| File | Change |
|------|--------|
| `src/services/ChatService.ts` | New `reply()`; kill switch (`isOverDailyCap`, `countModelCalls`) moves here; constructor takes `UserService` + `PricingService` |
| `src/services/PricingService.ts` | New `getEffectivePriceCents(userId?)` → `{ session1h, session2h, pack5, pack10 }` from one `resolve()` |
| `src/services/index.ts` | Pass `userService`, `pricingService` into `ChatService` |
| `src/domain/errors.ts`, `src/lib/http-errors.ts` | New `ChatCapacityError` (`CHAT_CAPACITY`) → 503 |
| `src/app/api/chat/route.ts` | Thin: CSRF → rate limits → parse → cached reads → `chatService.reply()` → map |
| `src/services/__tests__/ChatService.test.ts` | Tests for `reply()`: price overlay, `ToolContext` identity, kill switch counting |
| `src/services/__tests__/PricingService.test.ts` | `getEffectivePriceCents` with and without overrides; one `listForUser` call |
| `src/app/api/chat/__tests__/route.test.ts` | Mocks move from `kv` / `pricingService` to `chatService.reply`; same assertions on status + body |

## The change

```ts
// src/services/PricingService.ts
// REFACTOR-R5-P2-01: the four effective prices (public, or this student's overrides) from
// ONE resolve() — the chat prompt used to read user_pricing twice per turn to get these.
async getEffectivePriceCents(userId?: string): Promise<Record<"session1h" | "session2h" | "pack5" | "pack10", number>> {
  const byKey = new Map((await this.resolve(userId)).map((r) => [r.productKey, r.amountCents]));
  const need = (k: ProductKey) => {
    const v = byKey.get(k);
    if (v == null) throw new Error(`No price configured for product ${k}`);
    return v;
  };
  return { session1h: need("session1h"), session2h: need("session2h"), pack5: need("pack5"), pack10: need("pack10") };
}
```

```ts
// src/services/ChatService.ts (sketch)
// REFACTOR-R5-P2-01: everything /api/chat did besides HTTP — prices, prompt, ToolContext,
// kill switch — lives here. Identity still comes from the server session (CHAT-AGENT-P1-02).
export interface ChatReplyRequest {
  message:   string;
  sessionId: string | null;
  email:     string | null;          // from getSession(), never from the body
  timezone?: string;                 // already validated against SUPPORTED_TIMEZONES
  voice?:    boolean;
  locale:    "es" | "en";            // NEXT_LOCALE cookie
  display:   { prices: DisplayPrices; packValidityDays: number; schedule: ScheduleConfig; content: ChatPromptContent };
}

async reply(req: ChatReplyRequest): Promise<{ reply: string; sessionId: string; actions: ChatAction[]; timezone: string }> {
  if (await this.isOverDailyCap()) throw new ChatCapacityError();     // was route :112-124
  let modelCalls = 0;
  try {
    const user = req.email ? await this.users.findByEmail(req.email) : null;
    // Anonymous → the cached public figures; signed in → one resolve() (private prices if any).
    const priceCents = user
      ? await this.pricing.getEffectivePriceCents(user.id)
      : fromDisplay(req.display.prices);
    const systemPrompt = buildChatSystemPrompt({ ...priceCents, /* policy figures as today */ }, req.display.content);
    const toolContext: ToolContext = {
      userId: user?.id ?? null, email: req.email, timezone: req.timezone ?? req.display.schedule.timezone,
      locale: req.locale, now: new Date(),
    };
    const result = await this.ask({ message: req.message, sessionId: req.sessionId, systemPrompt, toolContext,
      contextNote: buildContextNote(toolContext, { voice: req.voice }) });
    modelCalls = result.modelCalls;
    log("info", "Chat reply", { service: "chat", modelCalls, actions: result.actions.map((a) => a.type) });
    return { reply: result.reply, sessionId: result.sessionId, actions: result.actions, timezone: toolContext.timezone };
  } catch (err) {
    modelCalls = 1;                  // a failed turn counts as one call, as before
    throw err;
  } finally {
    await this.countModelCalls(modelCalls);
  }
}
```

The route's `try` maps `ChatCapacityError` → 503 (same body as today) and any other error → the
existing 502 + `log("error", "Chat model error", …)`. Keep the error copy where it is: it's Spanish
inline today, and translating it is not this task's job.

One subtle point: today a signed-in user **without** overrides gets the cached display prices (no
DB read). With `getEffectivePriceCents(user.id)`, every signed-in turn does one `resolve()`: one
`pricing` read plus one `user_pricing` read. That's acceptable (today a student *with* overrides
pays three), but if you want to keep the zero-read path, take `listForUser` once inside
`getEffectivePriceCents` and return `null` for "no overrides". Pick one and note it in STATUS.md.

## Acceptance criteria

- [ ] `route.ts` imports neither `@/infrastructure/redis/client` nor `pricingService` / `userService`
- [ ] Response JSON unchanged: `{ reply, sessionId, actions, timezone }`; 503 body unchanged when over the cap; 502 unchanged on model error
- [ ] The kill-switch counter increments by `modelCalls` after a reply, by 1 after a failed turn, and expires after 24 h on first write
- [ ] A student with overrides: `user_pricing` read once per turn; the prompt carries their prices
- [ ] `ToolContext.email` / `userId` come only from the session; a body field named `email` is ignored (the schema already strips it)
- [ ] `hasUserOverrides` either deleted (if now unused: grep first) or left with its other callers
- [ ] File-top blocks carry `REFACTOR-R5-P2-01`

## Test plan

- **Existing:** `src/app/api/chat/__tests__/route.test.ts` (CHAT-AGENT-P1-02 cases), `ChatService.test.ts`, `PricingService.test.ts`, the chat-tools tests. Behaviour assertions stay. Only the mocks move.
- **New (service):** `reply()` with a fake model returning `modelCalls: 3` → `kv.incrby(key, 3)`; the model throws → `incrby(key, 1)` and the error propagates; over the cap → `ChatCapacityError`, model not called.
- **New (service):** signed-in user with overrides → `buildChatSystemPrompt` receives the override amounts; the pricing repo's `listForUser` called once.
- **New (pricing):** `getEffectivePriceCents()` = public; `getEffectivePriceCents(id)` with one override → that key overridden, others public.
- **Manual:** `pnpm dev`, open the assistant signed out and signed in (with a private price set at `/admin/students/<email>`), and ask «¿cuánto cuesta una clase de una hora?» → the right figure each time.

## Notes / gotchas

- **Keep the cached loaders in the route.** `getDisplayPrices` / `getScheduleConfig` are Next ISR
  (`unstable_cache`) functions. Calling them from a service would tie the service layer to Next.
  The route passes their results in as `display`.
- **`cache_control` on the system prompt** (`CHAT-CLAUDE-01`) is keyed on the prompt text. Moving the
  assembly doesn't change the text, so the cache hit rate is unchanged. Don't reorder the prompt sections.
- `ChatService` already imports `kv` for history. That's the existing (accepted) exception to "services
  receive infrastructure by injection". Don't widen it to a second Redis client.
- The `todayKey` date is UTC (`toISOString().slice(0, 10)`). Keep it, because the counter's day is an ops convention.

## Out of scope

- Translating the route's inline Spanish error strings.
- Binding the chat `sessionId` to the user (by design, see PLAN → Deferred).
- Any prompt-content change.
