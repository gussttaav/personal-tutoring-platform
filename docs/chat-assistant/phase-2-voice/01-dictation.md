# P2-01: Microphone and dictation

**Tag:** `CHAT-AGENT-P2-01` · **Effort:** S · **Owner:** Claude (+ Gustavo for device tests) · **Status:** ⬜

## TL;DR

Allow the microphone for the site's own origin and add a push-to-talk button to the chat
composer. While held/toggled, the browser's `SpeechRecognition` fills the input box with the
transcript; the user reviews it (dates and times get misheard) and sends it as usual. The button
only renders where the API exists.

## Context

- `next.config.mjs:105`: global `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  With `microphone=()` the page can't use the mic at all, Web Speech included. Only
  `/sesion/:token*` allows it (`:126`).
- CSP already allows `media-src 'self' blob: mediastream:`; Web Speech needs no `connect-src`
  change (the browser does the network call).
- Composer: `src/components/Chat.tsx:296-308` (input + send button, inline SVG icons, not the
  icon font).
- Locales: es (default), en (British spelling on the site).

## Files affected

| File | Change |
|------|--------|
| `next.config.mjs` | Global `microphone=(self)` (camera and geolocation stay denied) |
| `src/hooks/useDictation.ts` (new) | Wraps `SpeechRecognition ?? webkitSpeechRecognition`: `supported`, `listening`, `start()`, `stop()`, interim + final transcript, error codes |
| `src/components/Chat.tsx` | Mic button left of send; transcript into `input`; `voiceTurn` flag for P2-02 |
| `src/app/globals.css` | `.chat-mic`, listening state (pulse; respects `prefers-reduced-motion`) |
| `messages/es.json`, `messages/en.json` | `chat.voice.*` (start, stop, listening, denied, no speech, unsupported) |
| `src/components/policy/PolicyContent.tsx` (privacy copy, both locales) | A paragraph on dictation: processed by the browser's speech service (Google in Chrome, Apple in Safari); nothing stored by us |
| `src/hooks/__tests__/useDictation.test.ts` (new) | Fake recognition object |

## The change

- `recognition.lang = locale === "en" ? "en-GB" : "es-ES"`, `interimResults = true`,
  `continuous = false` (one utterance per press; it stops on silence).
- Interim text shows in the input greyed; final text replaces it. The user can edit, then send
  (Enter or the send button). **No auto-send** in v1.
- Errors: `not-allowed` → a one-line hint about the browser's mic permission; `no-speech` →
  «No te he oído»; anything else → reset the button silently.
- Stop listening when the panel closes, on «Nueva conversación», and on unmount.
- The button has `aria-pressed` and a label that changes with state.

## Acceptance criteria

- Chrome desktop, Chrome Android, Safari iOS: dictate «¿tienes hueco el martes por la tarde?» in
  es and «any free slot on Tuesday afternoon?» in en; the text lands in the input; sending works.
- Firefox: no mic button, nothing else changes.
- `/sesion/<token>` still gets camera + mic (Zoom); other routes still deny the camera.
- Response headers checked with `curl -I` on `/` and `/sesion/x`.

## Test plan

- Unit: hook state machine with a fake recognition (start → interim → final → end; errors).
- Manual on devices (Gustavo).
- `pnpm test`, `pnpm lint`, `pnpm build`.

## Gotchas

- iOS Safari exposes `webkitSpeechRecognition` only when Siri/dictation is enabled; treat a
  `start()` throw as unsupported.
- The headers block applies to `/(.*)` and the `/sesion` block overrides it; keep that order.
- Chat is mounted on every page (`CHAT-GLOBAL-01`), so the policy change is global by necessity.

## Out of scope

- Reading replies aloud (P2-02). Server transcription (P2-03).
