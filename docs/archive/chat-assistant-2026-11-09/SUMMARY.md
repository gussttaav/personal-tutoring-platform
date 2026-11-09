# Chat assistant summary: actions, voice and calendar

**Date range:** 2026-10-31 (plan) → 2026-11-09 (archive)
**Tasks completed:** 11 shipped (8 planned + 3 follow-ups) · 1 deferred by decision (P2-03)
**Tag convention:** `CHAT-AGENT-PN-NN`
**Branch:** every task branch was merged into `feat/chat-assistant-actions-voice` (no PRs; the task
branches are deleted). At archive time that branch is **not yet on `staging`**.
**Verification:** each task's tests, lint and build are in [STATUS.md](STATUS.md). Gustavo confirmed on
2026-11-09 that every manual check is done (a real booking from the chat card, dictation and
read-aloud on real devices, the real Google consent for the calendar comparison) and that
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set on Vercel.

The decisions behind the cycle (the model never books, Claude stays the brain, browser voice first,
booking by voice ends in a tap, the calendar never reaches the server) and Gustavo's answers Q1–Q5
are in [PLAN.md](PLAN.md). The rules that outlive the cycle are in `CLAUDE.md`'s Gotchas (the three
`CHAT-AGENT` entries).

---

## Tasks completed

### Phase 1 — Actions
| # | Task | Tag | Commit / branch |
|---|------|-----|-----------------|
| 01 | Availability service | `CHAT-AGENT-P1-01` | `chat-agent/p1-01-availability-service` |
| 02 | Tool loop in the chat | `CHAT-AGENT-P1-02` | `chat-agent/p1-02-chat-tool-loop` |
| 02b | A budget-stopped tool round falls back to the tools-off call (follow-up) | `CHAT-AGENT-P1-02b` | `chat-agent/p1-02b-budget-fallback` |
| 02c | The history's action summary on the visitor's clock (follow-up) | `CHAT-AGENT-P1-02c` | `dd3a95c` |
| 03 | Free-call tools + prompt | `CHAT-AGENT-P1-03` | `chat-agent/p1-03-free-call-tools` |
| 04 | Slot chips + confirmation card | `CHAT-AGENT-P1-04` | `chat-agent/p1-04-confirmation-card` |
| — | First suggestion chip offers the free call (asked by Gustavo, follow-up) | `CHAT-AGENT-P1-04` | `chat-agent/booking-suggestion-chip` |

### Phase 2 — Voice
| # | Task | Tag | Commit / branch |
|---|------|-----|-----------------|
| 01 | Microphone + dictation | `CHAT-AGENT-P2-01` | `chat-agent/p2-01-dictation` |
| 01b | Continuous dictation, send on stop (touch); growing composer (follow-up) | `CHAT-AGENT-P2-01b` | `chat-agent/p2-01b-continuous-dictation` |
| 02 | Read-aloud + voice mode | `CHAT-AGENT-P2-02` | `chat-agent/p2-02-read-aloud` |
| 03 | Server STT/TTS pipeline | `CHAT-AGENT-P2-03` | ⏸ deferred (see below) |

### Phase 3 — Calendar matching
| # | Task | Tag | Commit / branch |
|---|------|-----|-----------------|
| 01 | Google scope + privacy policy (`calendar.freebusy` turned out non-sensitive: no verification) | `CHAT-AGENT-P3-01` | `chat-agent/p3-01-google-verification` |
| 02 | «Comparar con mi calendario» | `CHAT-AGENT-P3-02` | `b153a86` |

---

## Key wins

- **The assistant books the free intro call without a second booking path.** Read-only tools find
  and re-check slots; the reply carries `slots` (chips) and a `proposal` (a card), and the only write
  is the visitor's «Confirmar» on the existing `/api/book`. A prompt injection can't cause a side
  effect, and identity comes from the server session.
- **Voice for free.** Dictation and read-aloud run on the browser's own engines (no vendor, no audio
  on the server), with a short spoken-style reply only when the answer will be heard.
- **Calendar matching that never touches the server.** A Google free/busy token, asked at the
  moment of use, read and applied in the browser; the token lives in memory only.
- **Times stay on the visitor's clock end to end.** The tools, the chips, the card and (since P1-02c)
  the history the model reads next turn all speak the visitor's timezone.

## Deferred

- **P2-03, server STT/TTS** (Q3, 2026-11-09): no speech provider for now. Revisit 4 weeks after the
  cycle reaches production, with the P2 adoption events (`src/lib/chat-analytics.ts`); the criteria
  are in [phase-2-voice/README.md](phase-2-voice/README.md#when-to-revisit-p2-03). If revived: server
  STT (Groq Whisper) and a separately gated TTS.

## Seen, not changed

- `morning` in `find_free_call_slots` means before 12:00 on the visitor's clock, so for a visitor far
  west of the tutor (Bogotá) it starts at 03:00. The reply then names the late-morning slots and
  sets 3:00–6:45 apart as «de madrugada» while the chips show all of them, and asked later the model
  may call that split an omission (2 of 7 live conversations, 2026-11-09).
- Earlier notes on each task (the suggestion chips returning after a reload, Chrome's network voices,
  long English voice replies) are in the [STATUS.md](STATUS.md) Log.
