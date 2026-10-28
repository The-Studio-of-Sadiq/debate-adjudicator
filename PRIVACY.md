# Privacy policy

**Debate Adjudicator** · The Studio of Sadiq · Effective 28 October 2026

Debate Adjudicator is a free, open-source app for running debate rounds:
timer and bells, points of information from debaters' phones, recordings,
transcription, flow notes and ballots. This policy explains what the app does
with your information, on Android and Windows.

**In short:** there are no accounts and we run no servers. We don't collect,
receive, sell or share any of your data. Everything the app records stays on
your devices, unless you choose a cloud transcription service, in which case
audio goes from your device straight to that service. On Android, Google's
QR code scanner sends Google technical diagnostics, described below.

## What the app stores, and where

Everything below is stored **only on the device you use**, in the app's
private storage:

- Rounds: the format, motion, speech times, bell settings and points raised.
- Names you type in: your own name and debaters' names.
- Flow notes, ballots (speaker scores and comments) and transcripts.
- Audio recordings of speeches and of accepted points of information.
- Settings, including any cloud transcription API key you enter.
- A random device ID the app creates so devices in a room can recognise each
  other. It isn't linked to your identity or your phone's hardware IDs.

We (The Studio of Sadiq) never receive any of this.

## Devices in the same room

When the chair invites devices, phones and PCs connect **directly to each
other over the local Wi-Fi network or a phone hotspot**. Nothing passes
through the internet or through our servers (we have none). Within a room:

- Joined devices receive what they need to run the round: the timer, speech
  order, debaters' names and seats, and the points raised.
- A debater's device sends the chair the recording of that debater's own
  accepted point of information, or point of order or privilege.
- The chair's flow notes, ballot and transcripts **stay on the chair's
  device** and are never sent to other devices.

## Permissions

- **Microphone:** to record speeches and points of information. The app
  records only while a speech or point is being recorded, which the screen
  shows.
- **Camera:** to scan the chair's QR code to join a round. Images are read on
  the device and not stored. On Android, scanning uses Google's code scanner
  from Google Play services (see below). You can also join by typing the
  code instead of scanning it.
- **Notifications and foreground service:** to keep the timer, bells and an
  ongoing recording running while the screen is off or another app is open.
- **Network access:** for the local connections between devices in a room,
  and, only when you use them, for the downloads and cloud services below.

## Services the app can contact

The app contacts the internet only for these features:

- **QR code scanning on Android.** The scanner is Google's code scanner
  (part of Google ML Kit, provided by Google Play services). When it's used,
  Google collects technical information for diagnostics and usage analytics:
  device details (such as manufacturer, model and Android version), the app's
  package name and version, performance figures and error codes. Google
  sends it over HTTPS and says it doesn't pass it to third parties. Google
  doesn't say that camera images or scan results are sent, and the app sends
  neither. This is handled by Google under the
  [Google Privacy Policy](https://policies.google.com/privacy); details are in
  [Google's ML Kit data disclosure](https://developers.google.com/ml-kit/android-data-disclosure).
  We don't receive any of it. To avoid it, type the join code instead of
  scanning.
- **Offline transcription models.** When you tap **Download** in
  Transcription settings, the app downloads the model from Hugging Face
  (huggingface.co). This sends a normal download request, which includes your
  IP address. No audio or other data is sent. After that, transcription runs
  entirely on your device.
- **Cloud transcription (optional, off by default).** If you enter your own
  API key for a provider such as ElevenLabs, OpenAI or Groq, or any address
  you type in, the recordings you transcribe are sent from your device
  directly to that provider. The provider handles them under its own privacy
  policy and terms; read them before you enable it. Your key is stored only
  on your device and sent only to that provider.

Apart from Google's diagnostics for the QR code scanner, the app contains
**no advertising, analytics, tracking or crash-reporting** code, ours or
anyone else's.

## Sharing reports

When you export a round's PDF report, the app hands it to the share sheet
(Android) or a save dialog (Windows). It goes only where you choose to send
or save it.

## Keeping and deleting your data

Your data stays on your device until you delete it. You can delete rounds and
offline models in the app, clear a cloud API key in Transcription settings,
or uninstall the app, which removes everything it stored. Because we hold no
copy of your data, there is nothing for us to delete or export on our side.

## Children

The app is meant for debaters, adjudicators and organisers aged 13 and over.
It doesn't knowingly collect personal information from anyone, including
children, because it doesn't collect personal information at all.

## Security

Connections between devices in a room require the chair's join code and the
chair's approval. Data at rest relies on your device's own protections (its
lock screen and storage encryption). Anyone who can open the app on your
device can see the rounds stored in it.

## Changes to this policy

If the app's handling of data changes, we'll update this policy and its
effective date, and note the change in the
[changelog](https://github.com/The-Studio-of-Sadiq/debate-adjudicator/blob/main/CHANGELOG.md).

## Contact

Debate Adjudicator is developed by **The Studio of Sadiq**. For privacy
questions or requests, [open an issue on GitHub](https://github.com/The-Studio-of-Sadiq/debate-adjudicator/issues/new/choose);
for security problems, follow the
[security policy](https://github.com/The-Studio-of-Sadiq/debate-adjudicator/blob/main/SECURITY.md).
The source code is public, so anyone can check what the app does:
[github.com/The-Studio-of-Sadiq/debate-adjudicator](https://github.com/The-Studio-of-Sadiq/debate-adjudicator).
