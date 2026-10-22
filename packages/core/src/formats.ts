import type { BellRule, DebateFormat, Side, SpeechTemplate } from './types';

/**
 * Bells for a speech with protected time at both ends: single when POIs open,
 * single when they close, double at time, continuous once grace runs out.
 */
export function standardBells(durationSec: number, protectedSec: number, graceSec: number): BellRule[] {
  return [
    { at: protectedSec, pattern: 'single', label: 'POIs open' },
    { at: durationSec - protectedSec, pattern: 'single', label: 'POIs closed' },
    { at: durationSec, pattern: 'double', label: 'Time' },
    { at: durationSec + graceSec, pattern: 'continuous', label: 'Grace over' },
  ];
}

/** Bells for a reply speech: no POIs, a one-minute warning, double at time. */
export function replyBells(durationSec: number, graceSec: number): BellRule[] {
  return [
    { at: durationSec - 60, pattern: 'single', label: '1 minute left' },
    { at: durationSec, pattern: 'double', label: 'Time' },
    { at: durationSec + graceSec, pattern: 'continuous', label: 'Grace over' },
  ];
}

function substantive(role: string, name: string, side: Side, durationSec = 420, protectedSec = 60, graceSec = 20): SpeechTemplate {
  return {
    id: role.toLowerCase(),
    role,
    name,
    side,
    durationSec,
    graceSec,
    poiWindow: { from: protectedSec, to: durationSec - protectedSec },
    bells: standardBells(durationSec, protectedSec, graceSec),
  };
}

function reply(role: string, name: string, side: Side, durationSec = 240, graceSec = 20): SpeechTemplate {
  return {
    id: role.toLowerCase(),
    role,
    name,
    side,
    durationSec,
    graceSec,
    poiWindow: null,
    bells: replyBells(durationSec, graceSec),
  };
}

export const BP: DebateFormat = {
  id: 'bp',
  name: 'British Parliamentary',
  speeches: [
    substantive('PM', 'Prime Minister', 'gov'),
    substantive('LO', 'Leader of Opposition', 'opp'),
    substantive('DPM', 'Deputy Prime Minister', 'gov'),
    substantive('DLO', 'Deputy Leader of Opposition', 'opp'),
    substantive('MG', 'Member of Government', 'gov'),
    substantive('MO', 'Member of Opposition', 'opp'),
    substantive('GW', 'Government Whip', 'gov'),
    substantive('OW', 'Opposition Whip', 'opp'),
  ],
};

export const UADC: DebateFormat = {
  id: 'uadc',
  name: 'UADC (Asian Parliamentary)',
  speeches: [
    substantive('PM', 'Prime Minister', 'gov'),
    substantive('LO', 'Leader of Opposition', 'opp'),
    substantive('DPM', 'Deputy Prime Minister', 'gov'),
    substantive('DLO', 'Deputy Leader of Opposition', 'opp'),
    substantive('GW', 'Government Whip', 'gov'),
    substantive('OW', 'Opposition Whip', 'opp'),
    // Opposition replies first.
    reply('OR', 'Opposition Reply', 'opp'),
    reply('GR', 'Government Reply', 'gov'),
  ],
};

export const PRESETS: DebateFormat[] = [BP, UADC];
