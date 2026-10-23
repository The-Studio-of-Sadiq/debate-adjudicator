import { defineFormat } from './define';

export const UADC = defineFormat({
  id: 'uadc',
  name: 'UADC (Asian Parliamentary)',
  sides: { gov: 'Government', opp: 'Opposition' },
  timing: {
    speech: { durationSec: 420, graceSec: 20, protectedSec: 60 },
    reply: { durationSec: 240, graceSec: 20 },
  },
  speeches: [
    { role: 'PM', name: 'Prime Minister', side: 'gov' },
    { role: 'LO', name: 'Leader of Opposition', side: 'opp' },
    { role: 'DPM', name: 'Deputy Prime Minister', side: 'gov' },
    { role: 'DLO', name: 'Deputy Leader of Opposition', side: 'opp' },
    { role: 'GW', name: 'Government Whip', side: 'gov' },
    { role: 'OW', name: 'Opposition Whip', side: 'opp' },
    // Opposition replies first.
    { role: 'OR', name: 'Opposition Reply', side: 'opp', reply: true },
    { role: 'GR', name: 'Government Reply', side: 'gov', reply: true },
  ],
  teams: [
    { id: 'GOV', name: 'Government', side: 'gov', roles: ['PM', 'DPM', 'GW', 'GR'] },
    { id: 'OPP', name: 'Opposition', side: 'opp', roles: ['LO', 'DLO', 'OW', 'OR'] },
  ],
  scoring: {
    kind: 'winloss',
    speech: { min: 70, max: 80, step: 1 },
    reply: { min: 35, max: 40, step: 0.5 },
  },
  source: 'United Asian Debating Championship (Asian Parliamentary) rules',
});
