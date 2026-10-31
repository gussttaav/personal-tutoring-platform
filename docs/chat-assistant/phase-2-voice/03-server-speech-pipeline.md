# P2-03: Server speech pipeline (gated)

**Tag:** `CHAT-AGENT-P2-03` · **Effort:** M · **Owner:** Claude · **Status:** ⏸ (gate in [README](README.md), Q3)

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

## Out of scope until decided

Realtime / streaming voice (barge-in, interruptions). That would need WebRTC or WebSockets,
which Vercel serverless functions can't hold.
