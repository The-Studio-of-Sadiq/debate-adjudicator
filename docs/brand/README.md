# Brand

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="lockup-white.svg">
  <img src="lockup.svg" alt="Debate Adjudicator" width="360">
</picture>

## The mark: "The House"

The debating chamber seen from above. **Government's bench** (solid) and
**Opposition's bench** (open) face each other across the floor, and the
**Speaker's chair** sits at the head of the floor between them.

- Solid and open stand for the two sides of the house, and for the app's dark
  and light themes.
- The chair hangs between the benches, never above one, so the mark can't be
  read as letters (an earlier draft read as "i0").

| File | Use |
|---|---|
| [`mark.svg`](mark.svg) / [`mark-white.svg`](mark-white.svg) | The mark alone: icons, favicons, small spaces |
| [`lockup.svg`](lockup.svg) / [`lockup-white.svg`](lockup-white.svg) | Mark with the wordmark: headers, documents, slides |

Lettering in the lockups is outlined, so they render correctly without the
fonts installed.

### Rules

- **Colour:** black on light backgrounds, white on dark. Nothing else: no
  colours, gradients, shadows or outlines.
- **Clear space:** keep at least the width of one bench clear on every side.
- **Minimum size:** mark 16 px tall; lockup 120 px wide.
- **Don't** rotate, stretch, recolour one bench, swap which bench is solid, or
  move the chair onto a bench.
- In the app, use `<Logo />` and `<Lockup />` from `apps/app/src/Logo.tsx`.

## Typography: "Parliament"

| Role | Font | Size / weight | Where |
|---|---|---|---|
| Clock | Inter ExtraBold, tabular figures | up to 200 / 800 | The speech timer |
| Display | Instrument Serif | 34 / 400 | Screen titles, the wordmark |
| Title | Instrument Serif | 24 / 400 | Motions |
| Heading | Inter SemiBold | 18 / 600 | Section headings |
| Body | Inter Regular | 15 / 400 | Text |
| Label | Inter Medium | 13 / 500 | Secondary text |
| Eyebrow | Inter Bold, caps, +0.32 em | 11 / 700 | "DEBATE" above the wordmark |
| Code | Inter Bold, tabular | 28 / 700 | Join codes |

Both families are under the SIL Open Font License and ship inside the app, so
text looks the same offline. On Android every weight is its own font family,
so styles pick a weight with `fontFamily` (`FONTS.semibold` …), never
`fontWeight`. The styles live in `apps/app/src/theme.tsx`.

## Colour

Strictly monochrome; the app has light and dark themes built from black,
white and greys. State is shown with brightness, filled vs outlined shapes
and words, never with colour alone.

## Regenerating assets

The mark's geometry lives in [`scripts/brand-assets.mjs`](../../scripts/brand-assets.mjs)
(and is mirrored in `apps/app/src/Logo.tsx`). After changing it, run:

```bash
npm run brand
```

This rewrites the SVGs above, the app icon, the Android adaptive and themed
icon layers, the light and dark splash images, the favicon and the Windows
window icon.
