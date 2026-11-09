# P2-02: Read-aloud and voice mode

**Tag:** `CHAT-AGENT-P2-02` · **Effort:** S · **Owner:** Claude · **Status:** ⬜

## TL;DR

When a turn was dictated, speak the reply with `speechSynthesis`, and ask the model for a reply
that works spoken (short, no markdown, no URLs). A header toggle lets the user turn read-aloud
off. Fire analytics events so the P2-03 gate has numbers.

## Context

- Replies are markdown (`BotMessage`, `src/components/Chat.tsx:121-129`) and often contain links
  and lists, which sound bad read verbatim.
- P1-02 adds `voice?: boolean` to `ChatRequestSchema` and a per-request mid-conversation system
  message (`contextNote`); voice mode is one more line there, so the cached system prompt is
  untouched.
- Vercel Analytics custom events: `src/lib/booking-analytics.ts` (`trackBooking`) is the
  precedent for `track()` calls.

## Files affected

| File | Change |
|------|--------|
| `src/lib/chat-speech.ts` (new, pure) | `toSpeakableText(markdown)`: strip markdown, drop URLs, links → their text, lists → sentences, cap length |
| `src/hooks/useReadAloud.ts` (new) | Voice for the locale (prefer a local voice for `es-ES` / `en-GB`), `speak(text)`, `cancel()` |
| `src/components/Chat.tsx` | Send `voice: true` on dictated turns; speak the reply; cancel on new input/close; header toggle (persisted in localStorage, try/catch) |
| `src/app/api/chat/route.ts` | `voice` → add «Responde en 1–3 frases, para ser leída en voz alta: sin markdown, sin enlaces, sin listas.» to `contextNote` |
| `src/lib/chat-analytics.ts` (new) | `chat_message_sent`, `chat_voice_input`, `chat_voice_unsupported`, `chat_voice_booking` |
| `messages/es.json`, `messages/en.json` | `chat.voice.readAloudOn/Off` |
| `src/lib/__tests__/chat-speech.test.ts` (new) | Speakable-text cases |

## The change

- A proposal card in voice mode: the reply says «Te propongo el martes a las diez. Confírmalo en
  la tarjeta.»; the card itself is unchanged (booking still ends in a tap, PLAN decision 4).
- Speak only bot messages that answer a dictated turn, not typed ones, unless the toggle says
  «always» (two states are enough: on for voice turns / off).
- `speechSynthesis.cancel()` before each new `speak`, when the user starts dictating, on close.

## Acceptance criteria

- A dictated question gets a short reply that is spoken in the page's language; a typed one is
  not spoken.
- Toggle off → nothing is spoken; the choice survives a reload.
- Events visible in Vercel Analytics on a preview deployment.

## Test plan

- Unit: `toSpeakableText` (headings, bold, links, lists, code, long text cap).
- Manual on devices (Gustavo): es/en, Chrome/Safari, phone speaker.
- `pnpm test`, `pnpm lint`, `pnpm build`.

## Gotchas

- `speechSynthesis.getVoices()` is empty until `voiceschanged` fires in Chrome.
- iOS only speaks after a user gesture: the send tap counts, a reply arriving seconds later may
  not. Prime it with an empty utterance inside the send handler.

## Out of scope

- Server TTS (P2-03). Auto-send after silence. Spoken confirmation of bookings.
