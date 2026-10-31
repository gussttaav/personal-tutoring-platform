# Phase 2: voice

**Outcome:** the visitor can dictate a message and hear the reply, on top of the P1 chat. The
first version uses the browser's own speech engines (Web Speech API), so it costs nothing and
adds no vendor. It doubles as an adoption test: P2-03 (a server speech pipeline) is built only
if the numbers say people use voice.

| Task | What | Depends on |
|------|------|------------|
| [P2-01](01-dictation.md) | Allow the microphone, push-to-talk dictation into the input box (editable before sending) | P1 merged (not strictly, but voice is for booking) |
| [P2-02](02-read-aloud.md) | Read replies aloud after a dictated turn; «voice mode» prompt note; adoption events | P2-01 |
| [P2-03](03-server-speech-pipeline.md) | Server STT → chat → TTS, for Firefox and better voices | ⏸ Gate below |

## The P2-03 gate

Run P2-01/02 in production for **4 weeks**, then look at the Vercel Analytics events from P2-02:

- `chat_voice_input` (a dictated message was sent) / `chat_message_sent`
- `chat_voice_unsupported` (the mic button was hidden: Firefox, old browsers)
- `chat_voice_booking` (a booking confirmed in a conversation that used voice)

Build P2-03 only if voice is a meaningful share of chat messages, or if
`chat_voice_unsupported` shows a large audience left out. Gustavo decides, with Q3 (provider and
budget) answered at the same time.

## Privacy

- Chrome's `SpeechRecognition` sends the audio to Google's servers; Safari uses Apple's.
  The privacy policy says so (P2-01).
- We store no audio, ever. P2-03 would send audio to the chosen provider under its data
  processing terms and keep nothing.

## Testing limits

The Browser pane can't grant a real microphone, so dictation is verified by Gustavo on a real
browser (Chrome desktop, Chrome Android, Safari iOS). Unit tests cover everything around the
speech engine with a fake `SpeechRecognition`.
