# Debate Adjudicator App — Plan

A local-first session tool for debate adjudicators: timekeeper, bells, per-speech
recording, interruption log (POI / POO / POP) and offline transcription.
Runs on **Android** and **Windows**. English only for now.

## Decisions (agreed)

| Topic | Decision |
|---|---|
| Main user | Adjudicators. The **core adjudicator's phone is the host**. |
| Platforms | Android + Windows (no iOS for now) |
| Language | English (`*.en` Whisper models) |
| Network | Local only: QR invite, same Wi-Fi or host hotspot. No accounts, no cloud needed. |
| Transcription | Offline first (Whisper on device). Optional cloud provider when internet is available. |
| Priority | Timing + recording first. Ballots/scoring later. |
| Formats | BP and UADC presets, everything editable, custom presets savable |
| Stack | TypeScript monorepo: Expo (React Native) for Android + web, Electron wraps the web build for Windows |

## Architecture

```
debate-app/
├── packages/core/   pure TS, no UI: formats, timer engine, bell scheduler,
│                    interruptions, data models, network protocol
├── apps/app/        Expo app → Android build + web build (shared UI)
└── apps/desktop/    Electron shell → loads the web build, adds Node services
                     (WebSocket host, whisper.cpp, file storage)
```

### Timer model
The timer is never "ticked" over the network. A speech is a list of events
(`start`, `pause`, `resume`, `stop`) stamped with host time. Elapsed time is
computed from those events, so every device derives the same value. Clients
estimate their clock offset to the host with a ping exchange.

### Bells
Each speech type has a bell schedule: `{ at: seconds, pattern }` where pattern is
`single | double | triple | continuous`. Continuous bells repeat after the grace
period until the speech is stopped.

### Interruptions
| Type | Who decides | Timer | Outcomes |
|---|---|---|---|
| **POI** — Point of Information | The speaker holding the floor | Keeps running | accepted / declined / expired |
| **POO** — Point of Order | Chair / core adjudicator | Paused while it's raised | well taken / not well taken / under consideration |
| **POP** — Point of Personal Privilege | Chair / core adjudicator | Paused while it's raised | well taken / not well taken / under consideration |

POIs are only allowed in the unprotected window of a speech (e.g. 1:00–6:00 in a
7-minute speech). Every interruption is logged with the speech time it happened at.

### Recording flow
- Every participant's device records **its own audio**: a speaker's phone records
  their speech, a POI/POO/POP raiser's phone records their interruption once
  accepted.
- Clips are tagged `{ sessionId, speechId, speakerRole, startOffset }` and
  **forwarded to the core adjudicator's device over the LAN** when the clip ends
  (retried until acknowledged).
- The host can also record the room as a backup track.
- The core adjudicator's device assembles the timeline and runs transcription
  (on device, or via a cloud provider if online and configured).

### Network (Phase 2, built)
Newline-delimited JSON over plain TCP, port 47800 (falls back to a free port).
Android uses `react-native-tcp-socket`; Windows runs Node `net` in Electron's
main process, bridged to the UI over IPC (`apps/desktop/net.js`). Browsers
can't open sockets, so the plain web build can neither host nor join.

- The host is the single source of truth. It re-stamps every remote action
  with its own clock, checks it against the member's role
  (`packages/core/src/net/permissions.ts`), applies it, and pushes the whole
  session snapshot to every approved device.
- Clients estimate their clock offset from ping/pong (best of the last 10 round
  trips) and draw the timer from host time, so each device rings its own
  scheduled bells at the same moment. Manual bells from the chair or the
  timekeeper are broadcast.
- Device ids persist, so a device that drops off Wi-Fi is readmitted
  without approval and keeps its role.

| Role | Can do |
|---|---|
| Chair (host) | Everything, including rulings on POO/POP and inviting devices |
| Timekeeper | Start/pause/stop, next speech, manual bells |
| Debater (seat) | Raise POI (other side only) / POO / POP as their seat, withdraw their own; accept or decline POIs while holding the floor |
| Wing / Viewer | Synced timer and bells |

```
Core adjudicator (host)  ── hotspot / same Wi-Fi ──  Debaters, wing adjudicators
  shows QR: debate://join?ip=…&port=…&session=…&token=…
  ← join request         → approve + assign role (speaker seat / wing / viewer)
  ↔ clock-sync ping
  → speech events (start/pause/resume/stop at host-time)
  ← interruption request (POI/POO/POP) → accept/decline/ruling
  ← audio clip upload    → ack
```
Venue Wi-Fi often blocks device-to-device traffic (client isolation), so
**host hotspot** is the recommended mode.

## Format presets

### British Parliamentary (BP)
8 speeches × 7:00: PM, LO, DPM, DLO, MG, MO, GW, OW.
Bells: 1:00 single (POIs open), 6:00 single (POIs close), 7:00 double,
7:20 continuous (grace over).

### UADC (Asian Parliamentary style)
6 substantive × 7:00: PM, LO, DPM, DLO, GW, OW (same bells as BP),
then reply speeches × 4:00, **Opposition reply first**: OR, GR.
Reply bells: 3:00 single, 4:00 double, 4:20 continuous. No POIs in replies.
Rules vary by tournament year, so everything is editable.

## Phases

1. ✅ **Single-device MVP**: presets, timer, bells, per-speech recording, session history.
2. ✅ **Local multi-device**: QR join + approval, roles, synced timer and bells, Wi-Fi QR for hotspots.
   Interruptions are already raised and answered from joined devices.
3. ✅ **Interruption audio**: a debater's device records their accepted POI (until it ends)
   or their POO/POP (until the chair rules), uploads it in chunks over the LAN, and the
   chair's device attaches it to that interruption. Uploads queue and retry across
   reconnects; the host only accepts audio for an interruption the sender's seat raised.
   The Windows app now stores rounds and recordings on disk, so a crash loses nothing.
4. ✅ **Transcription**: on the chair's device, per clip or "Transcribe all" from the
   review screen. Transcripts are stored on the round with segment timestamps;
   tapping a line plays the audio from there.
   - Windows: Whisper via transformers.js on onnxruntime-node in Electron's main
     process; the window decodes audio (webm/m4a) to 16 kHz PCM with Web Audio.
     base.en ≈ 4× faster than real time on CPU.
   - Android: whisper.rn (whisper.cpp) with q5_1 models from Hugging Face; a local
     Expo module (`apps/app/modules/audio-decoder`) decodes m4a to 16 kHz WAV with
     MediaCodec, since whisper.cpp only reads WAV.
   - Cloud (optional): any OpenAI-compatible `/audio/transcriptions` API (OpenAI,
     Groq). "Auto" mode uses it when online with a key and falls back to offline.
   - Models download once from settings (tiny / base / small, English).
5. **Adjudicator tools**: timestamped flow notes, ballots (BP ranks, UADC scores), PDF export.
   Speakers recording their own speech on their phone can reuse the Phase 3 clip upload.
