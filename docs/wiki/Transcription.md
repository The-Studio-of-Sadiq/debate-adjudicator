# Transcription

Transcription runs on the chair's device, which holds every recording.

## Language

Set **Language spoken** to the language of the speeches: **English** or
**Bangla (বাংলা)**.

- English works offline and with every cloud provider.
- Bangla needs a cloud provider with a key, because the offline models only
  understand English. In **Auto** mode Bangla always goes to the cloud and never
  falls back to the offline model; **Offline only** can't transcribe it.
- Use **ElevenLabs Scribe** for Bangla. On 20 public Bangla recordings it got
  15% of words wrong, against 82% for Whisper large-v3 on Groq, and most of its
  "errors" were English words written in English, which suits debates where
  speakers switch languages.

## Modes

Home → **Transcription settings**:

| Mode | What happens |
|---|---|
| **Auto** (default) | Cloud if a key is set and you're online, otherwise offline. If the cloud request fails, it falls back to offline. |
| **Offline only** | Audio never leaves the device. |
| **Cloud only** | Fastest and most accurate; needs internet and sends audio to the provider. |

## Offline models

English-only Whisper models, downloaded once (do it on Wi-Fi before an event):

| Model | Android | Windows | Notes |
|---|---|---|---|
| Tiny | 31 MB | 40 MB | Fastest, least accurate |
| **Base** | 57 MB | 76 MB | Recommended |
| Small | 181 MB | 250 MB | Most accurate, slow on phones |

On a Windows PC, Base transcribes roughly 4× faster than real time (a 7-minute
speech in under 2 minutes). Phones are slower; keep the app open while it
works, as the screen stays awake during transcription.

## Cloud providers

One-tap presets:

- **ElevenLabs Scribe**: `https://api.elevenlabs.io/v1`, model `scribe_v2`.
  Best for Bangla. Key from elevenlabs.io → Settings → API keys.
- **OpenAI**: `https://api.openai.com/v1`, model `whisper-1`
- **Groq**: `https://api.groq.com/openai/v1`, model `whisper-large-v3-turbo`.
  Free tier, good for English.

Any other OpenAI-compatible `/audio/transcriptions` API works too: pick OpenAI
or Groq, then change the URL and model.

Paste the API key and **Save**. The key is stored on the device unencrypted,
and audio is sent to the provider you choose.

To try a provider on a recording before a tournament, contributors can use
`npm run transcribe:try` with keys in `.env` (see
[CONTRIBUTING](https://github.com/The-Studio-of-Sadiq/debate-adjudicator/blob/main/CONTRIBUTING.md)).

## Using transcripts

On a round's review screen: **Transcribe** per recording or **Transcribe all**.
Jobs run one at a time. Tap any line to play the audio from that moment; the
line playing is highlighted. Transcripts can be included in the PDF report.
