# Status: chat assistant actions, voice and calendar

Legend: ⬜ todo · 🟡 in progress · ✅ done · ⛔ blocked · ⏸ gated (waits on a decision or metric)

| Task | Title | Status | PR / commit | Notes |
|------|-------|--------|-------------|-------|
| P1-01 | [Availability service](phase-1-actions/01-availability-service.md) | ✅ | `chat-agent/p1-01-availability-service` | Deviation: public `lookup(date, duration, config)` returns `null` for a closed date so the route keeps `{slots: []}` (no `timezone`) byte-identical; route still reads the config itself (tz default + response) |
| P1-02 | [Tool loop in the chat](phase-1-actions/02-chat-tool-loop.md) | ✅ | `chat-agent/p1-02-chat-tool-loop` | Deviations: `timezone` is optional (absent → the tutor's, so today's `Chat.tsx` keeps working until P1-04 sends it; P1-04 must send only a `SUPPORTED_TIMEZONES` value or omit it, else 400); tool rounds keep a 5 s reserve for the tools-off last call, and tool runs are raced against the same budget (`TIMEOUT` is_error); a failed turn counts 1 in the kill switch; `ChatService` takes tools by constructor (`new ChatService(model, tools)`), `contextNote` left to P1-03 |
| P1-03 | [Free-call tools + prompt](phase-1-actions/03-free-call-tools.md) | ⬜ | | |
| P1-04 | [Slot chips + confirmation card](phase-1-actions/04-confirmation-card.md) | ⬜ | | Q1 decided: sign in inside the card, then Confirmar |
| P2-01 | [Microphone + dictation](phase-2-voice/01-dictation.md) | ⬜ | | |
| P2-02 | [Read-aloud + voice mode](phase-2-voice/02-read-aloud.md) | ⬜ | | |
| P2-03 | [Server STT/TTS pipeline](phase-2-voice/03-server-speech-pipeline.md) | ⏸ | | Gate: P2 adoption metrics + Q3 (Gustavo answers when the task starts) |
| P3-01 | [Google scope + verification](phase-3-calendar/01-google-verification.md) | ⬜ | | Manual (Gustavo); start right after P1 |
| P3-02 | [Compare with my calendar](phase-3-calendar/02-compare-with-my-calendar.md) | ⏸ | | Gate: P3-01 approved (or test users only); Q4: keep the grant |

## Log

- 2026-10-31: plan written.
- 2026-10-31: Gustavo decided Q1, Q2, Q4, Q5 (see PLAN.md); Q3 deferred to P2-03.
- 2026-11-02: P1-01 done on `chat-agent/p1-01-availability-service`: `AvailabilityService` (`getSlots`, `findSlots` capped at 7 days, `lookup`); route spot-checked old vs new on the test DB, 16/16 compared responses identical (a 17th old-code call was rate-limited).
- 2026-11-02: P1-02 done on `chat-agent/p1-02-chat-tool-loop`: provider-neutral `ChatTool`/`ToolContext`/`ChatAction`/`ChatReply`, bounded manual loop in `ClaudeClient` (3 rounds, 20 s deadline, `tool_choice: none` last call), `ChatRequestSchema`, `/api/chat` returns `actions`, kill switch counts model calls, `maxDuration = 25`. No tools registered. Jest 3007/3007, lint 0 errors, build OK; live check on `pnpm start`: chat answers with `actions: []`, bad timezone → 400.
