# Contributing

Thanks for helping improve Debate Adjudicator. This guide covers setting up
the project, how the code is organised, and what a pull request needs.

## Setup

Requirements: Node.js 22 or newer (24 recommended) and npm 10+. Windows is
needed only to run the desktop app; Android builds run in the cloud with EAS.

```bash
git clone https://github.com/The-Studio-of-Sadiq/debate-adjudicator.git
cd debate-adjudicator
npm install          # also downloads the Electron binary
npm test
```

Run the app:

```bash
npm run web          # UI in a browser (no networking or offline transcription)
npm run desktop      # Windows app (builds the web bundle first)
npm run android      # Expo dev server; needs a development build on the phone
```

To test hosting and joining on one PC, see "Testing host + client on one PC"
in the [README](README.md#testing-host--client-on-one-pc).

## Project layout

| Path | What lives there |
|---|---|
| `packages/core` | Pure TypeScript, no UI: formats, timer, bells, interruptions, ballots, the session reducer and the LAN protocol (host/client controllers). Everything here is unit tested. |
| `apps/app` | The Expo app: screens, platform adapters (`*.native.ts` for Android, plain `.ts` for the Windows app/web), i18n, theme. |
| `apps/app/modules/audio-decoder` | Local Expo module (Kotlin) that decodes recordings for Whisper on Android. |
| `apps/desktop` | Electron shell for Windows: serves the web build and provides LAN sockets, file storage, Whisper and PDF export over IPC. |
| `site/`, `scripts/build-site.mjs` | The website: static HTML generated from `docs/wiki` and the format presets (`npm run site`), published by `.github/workflows/pages.yml`. |
| `scripts/brand-assets.mjs` | Logo files, app icons and the social preview image (`npm run brand`). |

[PLAN.md](PLAN.md) explains the design: how the timer stays in sync, the
roles, the protocol, and the phase history.

## Before opening a pull request

Run all checks; CI runs the same ones:

```bash
npm test             # core unit and network tests
npm run typecheck    # core and app
npm run check:i18n   # every t('…') key exists in the English dictionary
```

And keep to these conventions:

- **Logic goes in `packages/core` with tests.** Screens should stay thin. If you
  change how a round behaves (timer, interruptions, ballots, protocol), add or
  update a test in `packages/core/src/*.test.ts`.
- **No hard-coded UI text.** Add strings to `apps/app/src/i18n/en.ts` and use
  `t('section.key')`. Values that cross the network are codes, not sentences
  (see `RejectReason` and friends in `net/protocol.ts`).
- **No hard-coded colours.** Use `const { colors, styles } = useTheme()` so the
  light and dark themes both work. The UI is monochrome on purpose: convey
  state with brightness, filled vs outlined controls and words.
- **Privacy:** the chair's flow notes, ballot and transcripts must never reach
  joined devices. The host sends `publicView(session)`; keep new private fields
  out of it and extend the privacy test.
- **Expo APIs change between SDKs.** Check the docs for the SDK version in
  `apps/app/package.json` before using an Expo API, and add packages with
  `npx expo install` so versions match.
- **Native code** (anything needing a new development build) should be called
  out in the pull request description.

## Pull requests

1. Branch from `main` (`feature/…`, `fix/…`).
2. Keep the change focused; explain what and why in the description, and how
   you tested it (devices, platforms).
3. Make sure CI is green.

## Adding a language

Copy `apps/app/src/i18n/en.ts` to e.g. `bn.ts`, translate the values (keep the
keys, `{{placeholders}}` and `_one`/`_other` plural suffixes), register it in
`LANGUAGES` in `apps/app/src/i18n/index.ts`, and add its name under
`language` in every dictionary.

## Reporting bugs and ideas

Use the issue templates. For security problems, follow [SECURITY.md](SECURITY.md)
instead of opening a public issue.

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE) and that you'll follow the [Code of Conduct](CODE_OF_CONDUCT.md).
