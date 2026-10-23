# Security Policy

## Reporting a vulnerability

Please **don't** open a public issue for security problems. Instead, report
them privately through GitHub: on the repository page, open **Security →
Report a vulnerability**. If that isn't available, contact the maintainers of
The Studio of Sadiq privately via the organisation page.

Include what you found, how to reproduce it, and the impact you expect. We aim
to acknowledge reports within a week.

## Supported versions

Only the latest code on `master` is supported.

## Security model, in brief

Knowing these helps judge whether something is a vulnerability:

- **Local network only.** Devices talk over plain TCP on the room's Wi-Fi or a
  phone hotspot (port 47800 by default). Traffic is **not encrypted**; anyone
  on the same network can observe it.
- **Joining** needs the 6-character code shown with the QR, and the chair
  approves every device. A device's role is enforced on the chair's device for
  every action, and actions are re-timestamped with the chair's clock.
- **Private data stays with the chair:** flow notes, ballots and transcripts
  are never sent to joined devices.
- **Uploaded clips** are only accepted for an interruption raised by the
  sender's own seat; file names are validated before anything is written.
- **Cloud transcription is opt-in.** When configured, audio is sent to the
  chosen provider. The API key is stored on the device **unencrypted**.
- **PDF export (Windows)** renders the report in a hidden window with
  JavaScript disabled; all user text in the report is escaped.
