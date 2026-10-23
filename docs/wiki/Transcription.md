# Transcription

Transcription runs on the chair's device, which holds every recording.

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

Any OpenAI-compatible `/audio/transcriptions` API works. One-tap presets:

- **OpenAI**: `https://api.openai.com/v1`, model `whisper-1`
- **Groq**: `https://api.groq.com/openai/v1`, model `whisper-large-v3-turbo`

Paste the API key and **Save**. The key is stored on the device unencrypted,
and audio is sent to the provider you choose.

## Using transcripts

On a round's review screen: **Transcribe** per recording or **Transcribe all**.
Jobs run one at a time. Tap any line to play the audio from that moment; the
line playing is highlighted. Transcripts can be included in the PDF report.
