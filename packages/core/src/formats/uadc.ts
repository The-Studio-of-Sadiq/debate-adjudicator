import { defineFormat, type FormatDefinition } from './define';

/** UADC with the given speech and reply lengths; everything else is shared. */
function uadc(id: string, name: string, speechSec: number, replySec: number): FormatDefinition {
  return {
    id,
    name,
    sides: { gov: 'Government', opp: 'Opposition' },
    timing: {
      speech: { durationSec: speechSec, graceSec: 20, protectedSec: 60 },
      reply: { durationSec: replySec, graceSec: 20 },
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
    info: { region: 'Asia', level: 'University', description: `3 vs 3, ${speechSec / 60}-minute speeches, ${replySec / 60}-minute replies, POIs allowed`, prepSec: 1800 },
    source: 'United Asian Debating Championship (Asian Parliamentary) rules',
  };
}

/** 7-minute speeches, 4-minute replies. The id stays "uadc" so older saved rounds still match. */
export const UADC = defineFormat(uadc('uadc', 'UADC 7-7-7-4', 420, 240));

/** 5-minute speeches, 3-minute replies, common at shorter and school tournaments. */
export const UADC_5553 = defineFormat(uadc('uadc-5553', 'UADC 5-5-5-3', 300, 180));
