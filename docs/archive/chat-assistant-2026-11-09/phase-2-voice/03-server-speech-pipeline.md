# P2-03: Server speech pipeline (gated)

**Tag:** `CHAT-AGENT-P2-03` · **Effort:** M · **Owner:** Claude · **Status:** Deferred (Q3, 2026-11-09)

> **Deferred.** Gustavo decided to keep voice on the browser's speech engines, with no STT or TTS
> provider for now. Why, and when to reconsider: [README](README.md#why-p2-03-is-deferred). This
> page is kept as the design note to start from if it comes back; read "If it comes back" first.

## TL;DR

Replace the browser speech engines with a hosted speech-to-text and text-to-speech provider,
behind our own route, so voice works in every browser (Firefox included) with natural voices.
The chat logic in the middle is the unchanged P1 path.

## Shape

```
MediaRecorder (webm/opus, ≤ 60 s) ──POST /api/chat/voice (multipart)──▶
   rate limit (own limiter) → STT provider → ChatService.ask(..., voice: true)
   → TTS provider → { transcript, reply, actions, audio (base64 mp3) }
```

- Provider keys server-side only; nothing reaches the browser but the result.
- Show the transcript in the thread as the user's message (they can see what was heard).
- One route, inside the serverless time limit: STT (~1 s) + chat (P1 deadline) + TTS (~1 s).
  If that gets tight, split into `/api/chat/transcribe` then the normal `/api/chat` + `/api/chat/speak`.
- Request body: a 60 s opus clip is a few hundred KB, under Vercel's 4.5 MB body limit.

## Decisions to make at the gate

| Topic | Options |
|-------|---------|
| STT provider | Compare current offerings for Spanish accuracy, latency and price per minute at the time of the gate |
| TTS provider | Same, plus voice quality in es-ES and en-GB |
| Budget | A daily cap like `chat:requests:<date>`, e.g. `chat:voice:seconds:<date>` |
| Data processing | Provider DPA, no retention/training on our audio; privacy policy updated |

## Files (expected)

`src/infrastructure/speech/{ISpeechToText,ITextToSpeech}.ts` + one adapter each,
`src/services/VoiceChatService.ts` (STT → `ChatService` → TTS), `src/app/api/chat/voice/route.ts`,
`src/lib/ratelimit.ts` (`chatVoiceRatelimit`), CSP unchanged (server-side calls), `Chat.tsx`
switches from `useDictation` / `useReadAloud` to the recorder + audio playback when the server
pipeline is enabled (env flag).

## If it comes back

Evaluated on 2026-11-09, before the deferral:

- **Split it in two.** STT and TTS solve different problems and needn't ship together.
  - **P2-03a, server STT.** This is where the real gaps are: Firefox and iOS with Siri off have
    no `SpeechRecognition`, and dates/times can be misheard. Groq Whisper is the candidate
    (Gustavo has a free-tier key). Shape: `POST /api/chat/transcribe` (multipart) → transcript,
    then the normal `/api/chat`; the browser engine can stay where it exists, with the server as
    the fallback, or replace it if device tests show it mishears times.
  - **P2-03b, server TTS, gated separately.** It reaches no new browser (`speechSynthesis` exists
    in Firefox), so its only gain is voice quality: one voice on every device, and better
    pronunciation of the English terms in Spanish replies («machine learning», «NLP»), where
    Windows' local voices and Linux's espeak are weakest. Its costs: a round trip before the
    first word on every spoken turn (`/api/chat` answers JSON, nothing to stream into), a second
    vendor (Groq has no good es-ES TTS that we know of), a new iOS autoplay unlock in place of
    `prime()`, base64 audio (+33%) in the response, and the reply text always leaving the device
    (today a local voice is preferred). Money is the smallest cost: a ~250-char spoken reply at
    typical neural TTS prices (~15 dollars per million characters, check at the time) is well
    under a cent. Build it only with evidence the browser voices put people off: add a
    `chat_read_aloud_off` event on the header toggle (with OS family) first.
- **Cheaper steps before buying TTS:** have the voice-mode note ask the model to avoid English
  terms where a Spanish one exists, and let `pickVoice` prefer the Microsoft «Online (Natural)»
  voices Edge exposes on Windows (network voices, which it ranks below local ones today).

## Out of scope until decided

Realtime / streaming voice (barge-in, interruptions). That would need WebRTC or WebSockets,
which Vercel serverless functions can't hold.
