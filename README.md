# Debate Adjudicator

Timekeeper, bells, per-speech recording and POI/POO/POP log for BP and UADC
debates. Android + Windows. See [PLAN.md](PLAN.md) for the design and roadmap.

## Layout

- `packages/core`: timer engine, bell scheduler, format presets, interruptions, session reducer (pure TS, unit tested)
- `apps/app`: Expo app (Android + web UI)
- `apps/desktop`: Electron shell for Windows, serving the web build

## Commands

```bash
npm install            # also downloads the Electron binary
npm test               # core unit tests
npm run typecheck
npm run web            # UI in a browser at http://localhost:8081
npm run desktop:dev    # Electron window on top of the running `npm run web`
npm run desktop        # build the web bundle and open it in Electron
npm run android        # Expo dev server for Android
```

### Installing on Android

```bash
cd apps/app
npx eas-cli@latest build -p android --profile preview
```

EAS prints a link with an install QR code. On the phone, open it, download the
`.apk` and allow installs from your browser when Android asks.

Joining: scan the chair's QR with **Scan QR code** in the app, or with the
phone's normal camera app; the `debate://` link opens the join screen with the
code filled in.

### Testing host + client on one PC

```bash
npm run export:web -w app
cd apps/desktop
npx electron . --profile=host
npx electron . --profile=client
```

`--profile` gives each instance its own storage and device id. In the host
window, start a round and open **Invite devices**. In the client, choose
**Join** and type the code shown under the QR. The first time it hosts, Windows
may ask to allow the app through the firewall. Allow it on private networks.

Recording on Android needs a development build, not Expo Go, because of the
background-recording config and the TCP socket module: `npx expo run:android` from `apps/app` with
Android Studio installed, or `npx eas-cli@latest build --profile development`.
