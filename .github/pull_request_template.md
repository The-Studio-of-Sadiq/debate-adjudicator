## What and why

<!-- What does this change, and what problem does it solve? -->

## How it was tested

<!-- Devices and platforms (Android, Windows app, web), and what you checked. -->

## Checklist

- [ ] `npm test`, `npm run typecheck` and `npm run check:i18n` pass
- [ ] New round logic is in `packages/core` with tests
- [ ] UI text is in `apps/app/src/i18n/en.ts`; colours come from `useTheme()`
- [ ] Works in both light and dark mode
- [ ] Notes any new native code (needs a new Android build) or protocol change (all devices must update)
