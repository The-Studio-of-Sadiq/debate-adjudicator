# Adding a debate format

Each format is a short definition file: the speeches in order, their timing,
the teams and how speakers are scored. Bells and POI windows are worked out
from the timing, and the ballot uses the teams and scoring, so a new format
works everywhere in the app with no other changes.

Our own formats are **British Parliamentary**, **UADC 7-7-7-4**, **UADC 5-5-5-3**
and **World Schools (WSDC)**. The app also ships 45 formats converted from the
[Debatekeeper format library](https://github.com/czlee/debatekeeper-formats)
(see [below](#formats-from-debatekeeper)); the
[website lists them all](https://the-studio-of-sadiq.github.io/debate-adjudicator/formats/).

## Steps

1. In `packages/core/src/formats/`, copy `_template.ts` to a new file, for
   example `australs.ts`.
2. Fill it in (see below).
3. Register it in `packages/core/src/formats/index.ts`: import it and add it to
   `FEATURED`. Featured formats are shown as buttons on the home screen, in
   that order; every format is in the searchable list.
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
| `speeches` | Speeches in speaking order: a short `role` code (1–4 capitals or digits), its English `name`, its `side`, and `reply: true` for reply speeches. A speech can override `durationSec`, `graceSec`, `poiWindow` or `bells`, and give a `kind` (e.g. `'Rebuttal'`) when the format has more than substantives and replies: Bell settings edits each kind together. |
| `teams` | Who scores together, by role. Every speech belongs to exactly one team. |
| `scoring.kind` | `winloss` for two teams and one winner, `ranked` to place several teams (like BP). |
| `scoring.speech`, `scoring.reply` | Score range and step, e.g. `{ min: 70, max: 80, step: 1 }`; replies can have their own. |
| `info` | Optional: `region`, `level`, `usedAt`, a one-line `description` and `prepSec`. Shown in the format list and on the website. |
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

## Formats from Debatekeeper

`packages/core/src/formats/debatekeeper.ts` is generated from the
[Debatekeeper format library](https://github.com/czlee/debatekeeper-formats)
(MIT License, © Chuan-Zheng Lee and contributors). Don't edit it by hand; run

```bash
npm run formats:import
```

to download the library again and rewrite it, then `npm test`. The script
(`scripts/import-debatekeeper.mjs`) converts each format like this:

- **Sides** come from the speech names (Affirmative/Negative, Proposition/
  Opposition, Government/Opposition, Pro/Contra, In favour/Against).
- **Role codes** are made from the names: "1st Affirmative" → `A1`,
  "Prime Minister's Rebuttal" → `PMR`.
- **Bells and POIs** are copied; the POI window runs from the bell that allows
  POIs to the next bell. NSW-style allowances (a double bell at time, a long
  ring when the allowance ends) become grace time.
- **Scoring:** Debatekeeper has none, so two teams with a 0–100 range, or four
  ranked teams for BP variants. Edit the scoring in a copy of the format if
  your tournament needs a narrower range.

Left out: formats the built-ins already cover (BP, Asian Parliamentary, World
Schools), German Jugend Debattiert (a free-debate segment that belongs to
neither side), Open Parliamentary Debate (nonaligned speakers) and World
Schools with prep times (preparation breaks between speeches). The generated
file lists them with the reason.

To improve one of these formats, fix it in Debatekeeper's library and
re-import, or copy it into its own definition file and add that to `FEATURED`
(with a new `id`).

## Don't code? Request it

Open a [format request](https://github.com/The-Studio-of-Sadiq/debate-adjudicator/issues/new?template=format_request.yml)
with the speaking order, times, POI rules and scoring, ideally with a link to
the rulebook.
