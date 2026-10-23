import { defineFormat } from './define';

export const BP = defineFormat({
  id: 'bp',
  name: 'British Parliamentary',
  sides: { gov: 'Government', opp: 'Opposition' },
  timing: { speech: { durationSec: 420, graceSec: 20, protectedSec: 60 } },
  speeches: [
    { role: 'PM', name: 'Prime Minister', side: 'gov' },
    { role: 'LO', name: 'Leader of Opposition', side: 'opp' },
    { role: 'DPM', name: 'Deputy Prime Minister', side: 'gov' },
    { role: 'DLO', name: 'Deputy Leader of Opposition', side: 'opp' },
    { role: 'MG', name: 'Member of Government', side: 'gov' },
    { role: 'MO', name: 'Member of Opposition', side: 'opp' },
    { role: 'GW', name: 'Government Whip', side: 'gov' },
    { role: 'OW', name: 'Opposition Whip', side: 'opp' },
  ],
  teams: [
    { id: 'OG', name: 'Opening Government', side: 'gov', roles: ['PM', 'DPM'] },
    { id: 'OO', name: 'Opening Opposition', side: 'opp', roles: ['LO', 'DLO'] },
    { id: 'CG', name: 'Closing Government', side: 'gov', roles: ['MG', 'GW'] },
    { id: 'CO', name: 'Closing Opposition', side: 'opp', roles: ['MO', 'OW'] },
  ],
  scoring: { kind: 'ranked', speech: { min: 50, max: 100, step: 1 } },
  source: 'World Universities Debating Championship (WUDC) rules',
});
