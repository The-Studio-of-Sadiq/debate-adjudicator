// Template for a new debate format. To add one:
//   1. Copy this file to e.g. `australs.ts` and fill it in.
//   2. Register it in `index.ts` (import it and add it to PRESETS).
//   3. Run `npm test`: every registered format is validated, and the test
//      lists anything that's wrong in plain English.
// Times are in seconds. See docs/wiki/Adding-a-format.md for the details.
import { defineFormat } from './define';

export const TEMPLATE = defineFormat({
  // Lowercase and unique. It's saved in rounds, so don't change it later.
  id: 'my-format',
  name: 'My Format',
  // What the two sides are called.
  sides: { gov: 'Government', opp: 'Opposition' },
  timing: {
    // protectedSec: no POIs for this long at the start and end of each speech.
    // Use null if the format has no POIs.
    speech: { durationSec: 420, graceSec: 20, protectedSec: 60 },
    // Delete if there are no reply speeches.
    reply: { durationSec: 240, graceSec: 20 },
  },
  // In speaking order. Roles are 1–4 capital letters or digits.
  // Bells are worked out from the timing; add `bells: [...]` to a speech to set them yourself.
  speeches: [
    { role: 'G1', name: 'First Government', side: 'gov' },
    { role: 'O1', name: 'First Opposition', side: 'opp' },
    { role: 'OR', name: 'Opposition Reply', side: 'opp', reply: true },
    { role: 'GR', name: 'Government Reply', side: 'gov', reply: true },
  ],
  // Every speech belongs to exactly one team.
  teams: [
    { id: 'GOV', name: 'Government', side: 'gov', roles: ['G1', 'GR'] },
    { id: 'OPP', name: 'Opposition', side: 'opp', roles: ['O1', 'OR'] },
  ],
  scoring: {
    // 'winloss' for two teams with one winner, 'ranked' to place several teams (like BP).
    kind: 'winloss',
    speech: { min: 70, max: 80, step: 1 },
    // Delete if replies use the same range as other speeches.
    reply: { min: 35, max: 40, step: 0.5 },
  },
  // Where the rules come from, so others can check them.
  source: 'Name of the rulebook or a link to it',
});
