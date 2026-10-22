import { describe, expect, it } from 'vitest';
import { BP, UADC } from './formats';
import { bellsBetween, CONTINUOUS_REPEAT_SEC } from './bells';
import { applyTimerEvent, elapsedMs, formatClock, speechPhase, timerStatus } from './timer';
import { createSession, currentSpeech, reduceSession, type SessionAction } from './session';
import type { TimerEvent } from './types';

const T0 = 1_000_000;
const s = (n: number) => T0 + n * 1000;

describe('formats', () => {
  it('BP has 8 seven-minute speeches with POIs between 1:00 and 6:00', () => {
    expect(BP.speeches.map((x) => x.role)).toEqual(['PM', 'LO', 'DPM', 'DLO', 'MG', 'MO', 'GW', 'OW']);
    for (const sp of BP.speeches) {
      expect(sp.durationSec).toBe(420);
      expect(sp.poiWindow).toEqual({ from: 60, to: 360 });
    }
  });

  it('UADC ends with opposition reply first, replies have no POIs', () => {
    const roles = UADC.speeches.map((x) => x.role);
    expect(roles.slice(-2)).toEqual(['OR', 'GR']);
    const replies = UADC.speeches.slice(-2);
    for (const r of replies) {
      expect(r.durationSec).toBe(240);
      expect(r.poiWindow).toBeNull();
    }
  });
});

describe('timer', () => {
  it('computes elapsed across pauses', () => {
    let ev: TimerEvent[] = [];
    ev = applyTimerEvent(ev, { type: 'start', at: s(0) });
    ev = applyTimerEvent(ev, { type: 'pause', at: s(30) });
    ev = applyTimerEvent(ev, { type: 'resume', at: s(50) });
    expect(elapsedMs(ev, s(60))).toBe(40_000);
    expect(timerStatus(ev)).toBe('running');
    ev = applyTimerEvent(ev, { type: 'stop', at: s(70) });
    expect(elapsedMs(ev, s(999))).toBe(50_000);
  });

  it('ignores invalid transitions and clock going backwards', () => {
    let ev: TimerEvent[] = applyTimerEvent([], { type: 'pause', at: s(0) });
    expect(ev).toEqual([]);
    ev = applyTimerEvent(ev, { type: 'start', at: s(10) });
    ev = applyTimerEvent(ev, { type: 'pause', at: s(5) });
    expect(elapsedMs(ev, s(100))).toBe(0);
  });

  it('reports phases', () => {
    const pm = BP.speeches[0]!;
    expect(speechPhase(pm, 30)).toBe('protected');
    expect(speechPhase(pm, 61)).toBe('poi-open');
    expect(speechPhase(pm, 361)).toBe('closing');
    expect(speechPhase(pm, 425)).toBe('grace');
    expect(speechPhase(pm, 441)).toBe('overtime');
  });

  it('formats clock', () => {
    expect(formatClock(247)).toBe('4:07');
    expect(formatClock(-12)).toBe('-0:12');
  });
});

describe('bells', () => {
  const rules = BP.speeches[0]!.bells;

  it('rings each bell exactly once across irregular ticks', () => {
    const ticks = [0, 0.3, 59.9, 60.2, 200, 359.99, 360, 419, 420.5];
    const hits = ticks.slice(1).flatMap((t, i) => bellsBetween(rules, ticks[i]!, t));
    expect(hits.map((h) => [h.at, h.rule.pattern])).toEqual([
      [60, 'single'],
      [360, 'single'],
      [420, 'double'],
    ]);
  });

  it('repeats the continuous bell after grace', () => {
    const hits = bellsBetween(rules, 439, 440 + CONTINUOUS_REPEAT_SEC * 2);
    expect(hits.map((h) => h.at)).toEqual([440, 442, 444]);
    expect(bellsBetween(rules, 444, 445)).toEqual([]);
  });

  it('does not ring when the clock does not advance', () => {
    expect(bellsBetween(rules, 60, 60)).toEqual([]);
  });
});

describe('session', () => {
  const run = (...actions: SessionAction[]) =>
    actions.reduce(reduceSession, createSession(BP, { id: 'x', now: T0 }));

  it('accepts a POI only in the open window', () => {
    const early = run({ type: 'timer', event: 'start', at: s(0) }, { type: 'raise', id: 'p1', kind: 'POI', raisedBy: 'LO', at: s(30) });
    expect(currentSpeech(early).interruptions).toHaveLength(0);

    const ok = run(
      { type: 'timer', event: 'start', at: s(0) },
      { type: 'raise', id: 'p1', kind: 'POI', raisedBy: 'LO', at: s(90) },
      { type: 'decidePoi', id: 'p1', accept: true, at: s(92) },
      { type: 'endPoi', id: 'p1', at: s(105) },
    );
    const poi = currentSpeech(ok).interruptions[0]!;
    expect(poi).toMatchObject({ status: 'accepted', raisedAtSec: 90, resolvedAtSec: 92, endedAtSec: 105 });
    // POIs don't stop the clock.
    expect(elapsedMs(currentSpeech(ok).events, s(120))).toBe(120_000);
  });

  it('only lets one POI hold the floor at a time', () => {
    const st = run(
      { type: 'timer', event: 'start', at: s(0) },
      { type: 'raise', id: 'a', kind: 'POI', raisedBy: 'LO', at: s(90) },
      { type: 'raise', id: 'b', kind: 'POI', raisedBy: 'DLO', at: s(90) },
      { type: 'decidePoi', id: 'a', accept: true, at: s(91) },
      { type: 'decidePoi', id: 'b', accept: true, at: s(92) },
    );
    expect(currentSpeech(st).interruptions.map((i) => i.status)).toEqual(['accepted', 'pending']);
  });

  it('POO pauses the clock until the chair rules', () => {
    const st = run(
      { type: 'timer', event: 'start', at: s(0) },
      { type: 'raise', id: 'o1', kind: 'POO', raisedBy: 'LO', at: s(100) },
      { type: 'timer', event: 'resume', at: s(105) }, // blocked: not ruled yet
      { type: 'rule', id: 'o1', ruling: 'not-well-taken', at: s(130) },
    );
    const sp = currentSpeech(st);
    expect(sp.interruptions[0]).toMatchObject({ status: 'ruled', ruling: 'not-well-taken' });
    expect(timerStatus(sp.events)).toBe('running');
    expect(elapsedMs(sp.events, s(140))).toBe(110_000);
  });

  it('POP is allowed in protected time and withdrawing resumes', () => {
    const st = run(
      { type: 'timer', event: 'start', at: s(0) },
      { type: 'raise', id: 'pp', kind: 'POP', raisedBy: 'PM', at: s(10) },
      { type: 'withdraw', id: 'pp', at: s(15) },
    );
    const sp = currentSpeech(st);
    expect(sp.interruptions[0]!.status).toBe('withdrawn');
    expect(elapsedMs(sp.events, s(20))).toBe(15_000);
  });

  it('moving to the next speech stops the current one', () => {
    const st = run({ type: 'timer', event: 'start', at: s(0) }, { type: 'goto', index: 1, at: s(400) });
    expect(st.currentIndex).toBe(1);
    expect(timerStatus(st.speeches[0]!.events)).toBe('stopped');
  });
});
