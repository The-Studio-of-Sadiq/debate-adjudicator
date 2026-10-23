import { defineFormat } from './define';

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
    { role: 'P2', name: 'Second Proposition', side: 'gov' },
    { role: 'O2', name: 'Second Opposition', side: 'opp' },
    { role: 'P3', name: 'Third Proposition', side: 'gov' },
    { role: 'O3', name: 'Third Opposition', side: 'opp' },
    // Opposition replies first; the reply is given by the first or second speaker.
    { role: 'OR', name: 'Opposition Reply', side: 'opp', reply: true },
    { role: 'PR', name: 'Proposition Reply', side: 'gov', reply: true },
  ],
  teams: [
    { id: 'PROP', name: 'Proposition', side: 'gov', roles: ['P1', 'P2', 'P3', 'PR'] },
    { id: 'OPP', name: 'Opposition', side: 'opp', roles: ['O1', 'O2', 'O3', 'OR'] },
  ],
  scoring: {
    kind: 'winloss',
    speech: { min: 60, max: 80, step: 1 },
    reply: { min: 30, max: 40, step: 0.5 },
  },
  source: 'World Schools Debating Championships rules',
});
