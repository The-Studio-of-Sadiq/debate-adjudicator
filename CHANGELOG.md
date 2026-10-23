# Changelog

Notable changes, newest first. The project follows the phases in
[PLAN.md](PLAN.md); versions map to phases until the first public release.

## [0.5.0] – Phase 5: adjudicator tools

- Flow notes on the chair's timer, stamped with the speech time.
- Speaker names per seat, filled in when a seated debater is approved.
- Ballots: BP (50–100, ranks and 3/2/1/0 points from totals) and UADC
  (70–80, replies 35–40 in 0.5 steps, winner and margin); invalid or tied
  ballots can't be marked final.
- PDF round report with ballot, timings, interruptions, notes and optional
  transcripts (share sheet on Android, save dialog on Windows).
- Notes, ballots and transcripts stay on the chair's device.
- Monochrome light and dark themes with a "match device" option.
- All UI text translatable (i18next) with a language picker; network error
  reasons are sent as codes. **Devices must all run this version.**

## [0.4.0] – Phase 4: transcription

- Offline Whisper transcription on Windows (transformers.js) and Android
  (whisper.rn plus a MediaCodec decoder module).
- Optional OpenAI-compatible cloud provider with automatic offline fallback.
- Transcripts synced to audio: tap a line to play from there.

## [0.3.0] – Phase 3: interruption audio

- A debater's phone records their accepted POI or their POO/POP and sends it
  to the chair over the local network, retrying after reconnects.
- Windows app saves rounds and recordings to disk immediately (no loss on crash).
- Android QR scanning via Google's code scanner; `debate://` join links.

## [0.2.0] – Phase 2: local multi-device

- QR or typed-code join, chair approval, roles (timekeeper, debater, wing, viewer).
- Clock sync so every device shows the same time and rings bells together.
- POI/POO/POP raised and answered from joined devices; automatic readmission
  after a dropped connection.

## [0.1.0] – Phase 1: single device

- BP and UADC presets, timer with phase display, scheduled and manual bells,
  bell editor, per-speech recording, round history and review.
