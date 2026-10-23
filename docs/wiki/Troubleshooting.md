# Troubleshooting

## Devices can't connect

- **Same network?** Every device must be on the chair's Wi-Fi or hotspot.
- **Venue Wi-Fi isolates clients.** Many university, hotel and office networks
  block devices from talking to each other. Use the chair's phone hotspot.
- **No address in the lobby.** On a phone acting as hotspot, Android may not
  report its address. Add it under the QR code (see the phone's hotspot
  settings; often `192.168.43.1`).
- **Windows firewall.** The first time the Windows app hosts, allow it on
  private networks. If you dismissed the prompt, allow the app in Windows
  Security → Firewall → Allow an app.
- **Different app versions.** All devices should run the same version; errors
  may otherwise show as short codes such as `wrongCode`.

## The QR code won't scan

- Type the line shown under the QR instead (`address code`).
- Or scan it with the phone's normal camera app, which opens the join screen.
- The Wi-Fi QR (for joining the hotspot) is different from the join QR.

## Bells or timer seem off

- Joined devices show *synced · N ms*; if it says *reconnecting*, check Wi-Fi.
- Phone volume and silent mode affect bells; Android also vibrates.

## Recording

- Allow microphone access when asked. On Android the app shows a notification
  while it records in the background.
- The first second of a debater's interruption clip can be missing while the
  phone's recorder starts; the chair's room recording has the full audio.

## Transcription

- "Model download failed": check the connection and download again from
  Transcription settings.
- Slow on phones: use the Tiny model, transcribe later on a Windows PC, or use
  a cloud provider.
