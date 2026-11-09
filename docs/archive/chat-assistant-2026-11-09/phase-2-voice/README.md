# Phase 2: voice

**Outcome:** the visitor can dictate a message and hear the reply, on top of the P1 chat. The
first version uses the browser's own speech engines (Web Speech API), so it costs nothing and
adds no vendor. It doubles as an adoption test. P2-03 (a server speech pipeline) is **deferred**
(Q3, 2026-11-09): there is no speech provider for now, and the numbers below decide whether to
reconsider it.

| Task | What | Depends on |
|------|------|------------|
| [P2-01](01-dictation.md) | Allow the microphone, push-to-talk dictation into the input box (editable before sending) | P1 merged (not strictly, but voice is for booking) |
| [P2-02](02-read-aloud.md) | Read replies aloud after a dictated turn; «voice mode» prompt note; adoption events | P2-01 |
| P2-01b | Continuous dictation, send on stop (touch); growing composer | P2-02 (asked by Gustavo, see STATUS) |
| [P2-03](03-server-speech-pipeline.md) | Server STT → chat → TTS, for Firefox and better voices | Deferred (see below) |

## Why P2-03 is deferred

Gustavo decided on 2026-11-09 (Q3 in [PLAN](../PLAN.md)) to keep voice on the browser's engines,
with no STT or TTS provider:

- **TTS reaches no new browser.** `speechSynthesis` exists in every current browser, Firefox
  included; only the mic (`SpeechRecognition`) is missing there. A server TTS would only change
  how the voice sounds, at the cost of a round trip before the first word on every spoken turn
  (`/api/chat` answers the whole reply as JSON), a second vendor, a new iOS autoplay unlock and
  base64 audio in the response.
- **STT's gap is smaller than the event suggests.** Where the mic button is hidden (Firefox, iOS
  with Siri/dictation off), the OS keyboard's dictation (iOS keyboard, Gboard, Win+H, macOS
  dictation) still types into the composer.
- **A misheard date or time can't book anything.** Desktop dictation lands in the input for
  review; on touch (P2-01b) it is sent, but booking always ends in a tap on a card that shows the
  real slot (PLAN decision 4), so a mishearing costs a turn.

What it costs: the real-device checks (Chrome desktop / Android, Safari macOS / iOS) are the only
QA of voice, and the open P2-01b questions (does Android Chrome stop at a pause? is iOS continuous
mode reliable?) are fixed in the browser path, e.g. an auto-restart in `useDictation`.

## When to revisit P2-03

**4 weeks after the cycle reaches production**, look at the Vercel Analytics events from P2-02:

- `chat_voice_input` (a dictated message was sent) / `chat_message_sent`
- `chat_voice_unsupported` (the mic button was hidden: Firefox, iOS with dictation off, old
  browsers). It counts browsers without the Web Speech API, not people unable to dictate (see
  above).
- `chat_voice_booking` (a booking confirmed in a conversation that used voice)

Reconsider P2-03 only if voice is a meaningful share of chat messages, or if
`chat_voice_unsupported` shows a large audience left out. If it comes back, split it: server STT
first (Groq Whisper is the candidate; Gustavo has a free-tier key), and server TTS only with its
own evidence that the browser voices put people off (e.g. a new `chat_read_aloud_off` event on the
header toggle, by OS family). See [03-server-speech-pipeline.md](03-server-speech-pipeline.md).

## Privacy

- Chrome's `SpeechRecognition` sends the audio to Google's servers; Safari uses Apple's.
  The privacy policy says so (P2-01).
- We store no audio, ever. A revived P2-03 would send audio to the chosen provider under its
  data processing terms and keep nothing.

## Testing limits

The Browser pane can't grant a real microphone, so dictation is verified by Gustavo on a real
browser (Chrome desktop, Chrome Android, Safari iOS). Unit tests cover everything around the
speech engine with a fake `SpeechRecognition`.
