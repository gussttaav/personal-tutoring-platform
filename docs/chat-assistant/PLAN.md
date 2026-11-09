# Chat assistant: actions, voice and calendar matching

**Branch:** `feat/chat-assistant-actions-voice` · **Tag prefix:** `CHAT-AGENT-PN-NN` · **Started:** 2026-10-31

## Goal

Turn the AI assistant (`CHAT-CLAUDE-01`, `CHAT-GLOBAL-01`) from a Q&A box into something that can
**do** things, starting with one action: **booking the free 15-minute intro call**. Then let the
visitor **talk** to it, and finally let a signed-in visitor **match their own Google Calendar**
against the tutor's free slots.

The order matters. Actions come first because they are the real value and they are independent
of voice. Voice is a thin input/output layer on top of a chat that already acts. Calendar matching
needs Google's OAuth verification, the slowest step, so that task starts early but ships last.

## Decisions (from the evaluation of 2026-10-29 / 10-31)

1. **The model never books.** It gets read-only tools: find slots, propose one. A proposal
   is rendered as a confirmation card. The **user's click** POSTs the existing `/api/book`, which
   already owns CSRF, auth, rate limiting, `checkSlot`, the one-free-call cap, the slot lock, the
   saga and the emails. No second booking path; a prompt injection cannot cause a side effect; the
   user identity comes from the server session, never from tool input.
2. **Claude stays the brain.** The Claude Messages API takes no audio, so voice is speech-to-text
   before `/api/chat` and text-to-speech after it. Realtime speech-to-speech models (OpenAI
   Realtime, Gemini Live) and hosted voice-agent platforms are rejected for now: they would move
   the tools and the booking policy out of this codebase and onto a second provider.
3. **Voice starts with the browser's Web Speech API** (free, no backend, no new vendor). It is a
   cheap adoption test. A server STT/TTS pipeline (P2-03) is **deferred** (Q3, 2026-11-09): voice
   stays on the browser's engines, and P2-03 is reconsidered only if the P2 metrics say so
   ([revisit criteria](phase-2-voice/README.md#when-to-revisit-p2-03)).
4. **Booking by voice still ends in a tap.** No spoken «sí» books a class in v1.
5. **The user's calendar never reaches our server or Claude.** P3 reads free/busy in the browser
   with a short-lived token from Google Identity Services and filters the slot list client-side.
   Only the `calendar.freebusy` scope, asked at the moment of use, never at sign-in.

## Architecture after P1

```
Chat.tsx ──POST /api/chat {message, sessionId, timezone, voice?}──▶ route (thin)
                                                                     │
                                         ChatService.ask(..., toolContext)
                                                                     │
                     ClaudeClient tool loop (≤3 rounds, one deadline) ◀─┐
                         │ tool_use                                     │ tool_result
                         ▼                                              │
                  ChatToolset (services)  ── AvailabilityService ──────┘
                   find_free_call_slots       (Redis avail:* cache + Google freebusy)
                   propose_free_call          BookingService.checkSlot / hasActiveFreeSession
                                                                     │
◀── { reply, sessionId, actions: [slots | proposal] } ───────────────┘

Chat.tsx renders actions:
  slots    → chips («mar 4 · 10:00») that send a user message
  proposal → card [Confirmar] ──▶ api.book.post (existing /api/book) ──▶ BookingService.createBooking
```

## Phases

| Phase | Tasks | Ships |
|-------|-------|-------|
| [1. Actions](phase-1-actions/README.md) | P1-01 … P1-04 | The assistant finds and proposes free-call slots; the user confirms in the chat |
| [2. Voice](phase-2-voice/README.md) | P2-01, P2-01b, P2-02 (P2-03 deferred) | Dictation + read-aloud via the browser; no server speech pipeline for now |
| [3. Calendar matching](phase-3-calendar/README.md) | P3-01 … P3-02 | «Comparar con mi calendario» on the slot list |

P3-01 is a manual Google Cloud console step for Gustavo. Start it as soon as P1 is merged so that
verification runs in parallel with P2.

## Decisions by Gustavo (2026-10-31)

| # | Question | Decision |
|---|----------|----------|
| Q1 | How does a signed-out visitor confirm a proposal? | Signs in with Google **inside the card** (popup, `resumeInPlace`), then taps Confirmar again. No automatic booking after sign-in |
| Q2 | Free call only, or also open the booking screen for paid sessions / packs? | **Free call only.** For a paid session or a pack, the assistant gives the URL (`/mentoria`) and says that, for now, the user books it there themselves |
| Q3 | P2-03 (server STT/TTS): which provider and what budget? | **None for now** (2026-11-09). Browser speech engines only, no speech vendor. TTS would reach no new browser (`speechSynthesis` exists in Firefox too) and would add latency to every spoken turn; STT's gap (Firefox, iOS with Siri off) is mostly covered by the OS keyboard's dictation, and a misheard time can't book anything (decision 4). Revisited with the P2 metrics; if it is, Groq Whisper is the STT candidate and TTS gets its own measure |
| Q4 | P3: revoke the Google grant after reading free/busy, or keep it? | **Keep the grant**, so the next comparison is one click. The access token itself is still never stored |
| Q5 | Must the assistant know, in the next turn, that the card booked the call? | No. The tools re-check `hasActiveFreeSession`, so it learns it on the next booking question |

## Out of scope

- The mobile app (it has no chat).
- Paid sessions and packs from the chat (Stripe inside the panel).
- Rescheduling/cancelling from the chat.
- Outlook / iCloud calendars.
- Storing any audio or any calendar data.

## Conventions for this cycle

- One task = one PR into `staging` (branch off `feat/chat-assistant-actions-voice` or `staging`).
- Each changed file gets the task tag in its top comment block (`CHAT-AGENT-P1-02`, …).
- Customer-facing strings in **both** `messages/es.json` and `messages/en.json` (`pnpm check:messages`).
- Service changes need a service-level test with fakes (`src/services/__tests__/`).
- Update [STATUS.md](STATUS.md) when a task starts, ships or blocks; add a CLAUDE.md gotcha when
  the cycle closes (the assistant's tool contract and the voice/calendar privacy rules).
