import { describe, expect, it } from 'vitest';
import { ballotSpecFor, evaluateBallot, rangeFor } from '../ballot';
import { createSession, reduceSession } from '../session';
import type { DebateFormat } from '../types';
import { TEMPLATE } from './_template';
import { BP, PRESETS, UADC, WSDC, defineFormat, validateFormat, type FormatDefinition } from './index';

const minimal = (): FormatDefinition => ({
  id: 'test',
  name: 'Test',
  sides: { gov: 'Gov', opp: 'Opp' },
  timing: { speech: { durationSec: 300, graceSec: 15, protectedSec: 60 } },
  speeches: [
    { role: 'G1', name: 'Gov 1', side: 'gov' },
    { role: 'O1', name: 'Opp 1', side: 'opp' },
  ],
  teams: [
    { id: 'G', name: 'Gov', side: 'gov', roles: ['G1'] },
    { id: 'O', name: 'Opp', side: 'opp', roles: ['O1'] },
  ],
  scoring: { kind: 'winloss', speech: { min: 60, max: 80, step: 1 } },
});

describe('format definitions', () => {
  it('builds every preset and the template without problems', () => {
    expect(PRESETS.map((f) => f.id)).toEqual(['bp', 'uadc', 'wsdc']);
    expect(new Set(PRESETS.map((f) => f.id)).size).toBe(PRESETS.length);
    expect(TEMPLATE.speeches.length).toBeGreaterThan(0);
  });

  it('keeps BP and UADC exactly as before', () => {
    expect(BP.speeches[0]).toEqual({
      id: 'pm',
      role: 'PM',
      name: 'Prime Minister',
      side: 'gov',
      durationSec: 420,
      graceSec: 20,
      poiWindow: { from: 60, to: 360 },
      bells: [
        { at: 60, pattern: 'single', label: 'POIs open' },
        { at: 360, pattern: 'single', label: 'POIs closed' },
        { at: 420, pattern: 'double', label: 'Time' },
        { at: 440, pattern: 'continuous', label: 'Grace over' },
      ],
      reply: false,
    });
    const or = UADC.speeches.find((s) => s.role === 'OR')!;
    expect(or).toMatchObject({ durationSec: 240, poiWindow: null, reply: true });
    expect(or.bells.map((b) => [b.at, b.pattern])).toEqual([
      [180, 'single'],
      [240, 'double'],
      [260, 'continuous'],
    ]);
  });

  it('defines WSDC: 8-minute speeches, POIs 1:00–7:00, 4-minute replies, opposition replies first', () => {
    expect(WSDC.speeches.map((s) => s.role)).toEqual(['P1', 'O1', 'P2', 'O2', 'P3', 'O3', 'OR', 'PR']);
    expect(WSDC.speeches[0]).toMatchObject({ durationSec: 480, poiWindow: { from: 60, to: 420 } });
    expect(WSDC.sides).toEqual({ gov: 'Proposition', opp: 'Opposition' });
    expect(rangeFor(ballotSpecFor(WSDC), WSDC, 'pr')).toEqual({ min: 30, max: 40, step: 0.5 });
  });

  it('scores a WSDC ballot with its own teams and ranges', () => {
    let s = createSession(WSDC, { id: 'w', now: 0 });
    const scores: Record<string, number> = { p1: 72, p2: 71, p3: 73, pr: 36, o1: 70, o2: 70, o3: 71, or: 35.5 };
    for (const [speechId, score] of Object.entries(scores)) s = reduceSession(s, { type: 'setScore', speechId, score });
    const r = evaluateBallot(WSDC, s.ballot);
    expect(r.issues).toEqual([]);
    expect(r.order).toEqual(['PROP', 'OPP']);
    expect(r.margin).toBe(5.5);
  });

  it('lets a format without POIs score every speech on the main range', () => {
    const def = minimal();
    def.timing.speech.protectedSec = null;
    const f = defineFormat(def);
    expect(f.speeches[0]!.poiWindow).toBeNull();
    expect(f.speeches[0]!.bells.map((b) => b.at)).toEqual([240, 300, 315]);
    expect(rangeFor(ballotSpecFor(f), f, 'g1')).toEqual({ min: 60, max: 80, step: 1 });
  });

  it('still scores rounds saved before formats carried their own rules', () => {
    // A saved UADC round: no ballot spec, no reply flags.
    const legacy: DebateFormat = {
      id: 'uadc',
      name: 'UADC (Asian Parliamentary)',
      speeches: UADC.speeches.map(({ reply: _reply, ...s }) => s),
    };
    expect(ballotSpecFor(legacy).teams.map((t) => t.id)).toEqual(['GOV', 'OPP']);
    expect(rangeFor(ballotSpecFor(legacy), legacy, 'gr')).toEqual({ min: 35, max: 40, step: 0.5 });
  });
});

describe('validateFormat', () => {
  it('accepts a minimal valid definition', () => {
    expect(validateFormat(minimal())).toEqual([]);
  });

  it('explains common mistakes', () => {
    const bad = minimal();
    bad.id = 'Bad Id';
    bad.speeches.push({ role: 'G1', name: 'Dup', side: 'gov' });
    bad.speeches.push({ role: 'GR', name: 'Reply', side: 'gov', reply: true });
    bad.teams[1]!.roles.push('XX');
    bad.teams[0]!.roles.push('O1');
    bad.scoring.speech = { min: 80, max: 60, step: 1 };
    const problems = validateFormat(bad);
    expect(problems).toEqual(
      expect.arrayContaining([
        'id must be 2–24 lowercase letters, digits or dashes',
        'role "G1" is used twice',
        'there are reply speeches but no timing.reply',
        'team O: unknown role "XX"',
        'team G is gov but O1 speaks for opp',
        'role "GR" isn\'t in any team',
        'scoring.speech must have min < max and a positive step',
      ]),
    );
    expect(() => defineFormat(bad)).toThrow(/Format "Bad Id" is invalid/);
  });

  it('rejects bells outside the speech and impossible POI windows', () => {
    const bad = minimal();
    bad.speeches[0]!.bells = [{ at: 999, pattern: 'single' }];
    bad.speeches[1]!.poiWindow = { from: 200, to: 100 };
    bad.timing.speech.protectedSec = 200;
    expect(validateFormat(bad)).toEqual(
      expect.arrayContaining([
        'G1: bell at 999s is outside the speech and grace period',
        'O1: poiWindow must lie inside the speech',
        'timing.speech.protectedSec must leave a POI window in the middle of the speech',
      ]),
    );
  });
});
