# Adding a debate format

Each format is a short definition file: the speeches in order, their timing,
the teams and how speakers are scored. Bells and POI windows are worked out
from the timing, and the ballot uses the teams and scoring, so a new format
works everywhere in the app with no other changes.

Built in today: **British Parliamentary**, **UADC (Asian Parliamentary)** and
**World Schools (WSDC)**.

## Steps

1. In `packages/core/src/formats/`, copy `_template.ts` to a new file, for
   example `australs.ts`.
2. Fill it in (see below).
3. Register it in `packages/core/src/formats/index.ts`: import it and add it to
   `PRESETS`. The order there is the order shown in the app.
4. Run `npm test`. Every format is checked, and anything wrong is explained in
   plain English, e.g. `role "PM" is used twice` or
   `team GOV is gov but LO speaks for opp`.

## What goes in a definition

| Field | Meaning |
|---|---|
| `id` | Short and lowercase, e.g. `wsdc`. Saved in rounds, so don't change it later. |
| `name` | Name shown in the app. |
| `sides` | What the two sides are called, e.g. Proposition and Opposition. |
| `timing.speech` | Default speech length, grace period and protected time in **seconds**. `protectedSec` is the time without POIs at each end; `null` means the format has no POIs. |
| `timing.reply` | Length and grace for reply speeches, if any. |
| `speeches` | Speeches in speaking order: a short `role` code (1–4 capitals or digits), its English `name`, its `side`, and `reply: true` for reply speeches. A speech can override `durationSec`, `graceSec`, `poiWindow` or `bells`. |
| `teams` | Who scores together, by role. Every speech belongs to exactly one team. |
| `scoring.kind` | `winloss` for two teams and one winner, `ranked` to place several teams (like BP). |
| `scoring.speech`, `scoring.reply` | Score range and step, e.g. `{ min: 70, max: 80, step: 1 }`; replies can have their own. |
| `source` | Where the rules come from, so others can check them. |

## Example: World Schools

```ts
export const WSDC = defineFormat({
  id: 'wsdc',
  name: 'World Schools (WSDC)',
  sides: { gov: 'Proposition', opp: 'Opposition' },
  timing: {
    speech: { durationSec: 480, graceSec: 20, protectedSec: 60 },
    reply: { durationSec: 240, graceSec: 20 },
  },
  speeches: [
    { role: 'P1', name: 'First Proposition', side: 'gov' },
    { role: 'O1', name: 'First Opposition', side: 'opp' },
    // … P2, O2, P3, O3 …
    { role: 'OR', name: 'Opposition Reply', side: 'opp', reply: true },
    { role: 'PR', name: 'Proposition Reply', side: 'gov', reply: true },
  ],
  teams: [
    { id: 'PROP', name: 'Proposition', side: 'gov', roles: ['P1', 'P2', 'P3', 'PR'] },
    { id: 'OPP', name: 'Opposition', side: 'opp', roles: ['O1', 'O2', 'O3', 'OR'] },
  ],
  scoring: { kind: 'winloss', speech: { min: 60, max: 80, step: 1 }, reply: { min: 30, max: 40, step: 0.5 } },
});
```

## Names in other languages

The English names in the definition are used unless a translation provides
them: add the role codes under `roles`, team ids under `teams` and the format
id under `formats` in `apps/app/src/i18n/en.ts` (and in other languages), as
the built-in formats do. See [Translating the app](Translating.md).

## Don't code? Request it

Open a [format request](https://github.com/The-Studio-of-Sadiq/debate-adjudicator/issues/new?template=format_request.yml)
with the speaking order, times, POI rules and scoring, ideally with a link to
the rulebook.
