import { describe, expect, it } from 'vitest';
import { BP, UADC } from './formats';
import { bellsBetween, CONTINUOUS_REPEAT_SEC } from './bells';
import { applyTimerEvent, elapsedMs, formatClock, speechPhase, timerStatus } from './timer';
import { createSession, currentSpeech, publicView, reduceSession, type SessionAction } from './session';
import { evaluateBallot } from './ballot';
import type { TimerEvent } from './types';
import { cleanSegments, segmentIndexAt, segmentsFromVerboseJson, segmentsFromWords, transcriptText } from './transcript';

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

describe('transcripts', () => {
  const withClip = () =>
    reduceSession(createSession(BP, { id: 'x', now: T0 }), {
      type: 'addClip',
      speechIndex: 0,
      clip: { id: 'c1', deviceId: 'host', uri: 'file:///c1.m4a', startedAt: T0, durationMs: 60_000 },
    });

  it('stores a transcript only for a known clip', () => {
    const t = { clipId: 'c1', engine: 'whisper-local:base.en', createdAt: T0, segments: [] };
    expect(reduceSession(withClip(), { type: 'setTranscript', transcript: t }).transcripts).toEqual({ c1: t });
    const unknown = reduceSession(withClip(), { type: 'setTranscript', transcript: { ...t, clipId: 'nope' } });
    expect(unknown.transcripts).toBeUndefined();
  });

  it('cleans whisper output and finds the playing segment', () => {
    const segments = cleanSegments([
      { startMs: 4000.4, endMs: 7000, text: '  the  second  ' },
      { startMs: 0, endMs: 3000, text: 'First point.' },
      { startMs: 7000, endMs: 9000, text: '[BLANK_AUDIO]' },
      { startMs: 9000, endMs: 9500, text: ' (applause) ' },
    ]);
    expect(segments).toEqual([
      { startMs: 0, endMs: 3000, text: 'First point.' },
      { startMs: 4000, endMs: 7000, text: 'the second' },
    ]);
    const t = { clipId: 'c', engine: 'x', createdAt: 0, segments };
    expect(transcriptText(t)).toBe('First point. the second');
    expect(segmentIndexAt(t, 5000)).toBe(1);
    expect(segmentIndexAt(t, 3500)).toBe(0);
    expect(segmentIndexAt(t, 60_000)).toBe(-1);
  });

  it('reads OpenAI-style verbose_json', () => {
    expect(segmentsFromVerboseJson({ segments: [{ start: 1.5, end: 3, text: ' Hello ' }] })).toEqual([{ startMs: 1500, endMs: 3000, text: 'Hello' }]);
    expect(segmentsFromVerboseJson({ text: 'Only text', duration: 4 })).toEqual([{ startMs: 0, endMs: 4000, text: 'Only text' }]);
  });

  it('groups word timestamps into lines at sentence ends and pauses', () => {
    const w = (text: string, start: number, end: number, type = 'word') => ({ text, start, end, type });
    const words = [
      w('আমি', 0.5, 0.8), w(' ', 0.8, 0.9, 'spacing'), w('বলছি।', 0.9, 1.4),
      w(' ', 1.4, 1.5, 'spacing'), w('(applause)', 1.5, 2, 'audio_event'),
      w('Next', 2.1, 2.4), w(' ', 2.4, 2.5, 'spacing'), w('point', 2.5, 2.9),
      // A pause of more than a second starts a new line.
      w(' ', 2.9, 4.5, 'spacing'), w('after', 4.5, 4.9), w(' ', 4.9, 5, 'spacing'), w('pause', 5, 5.4),
    ];
    expect(segmentsFromWords(words)).toEqual([
      { startMs: 500, endMs: 1400, text: 'আমি বলছি।' },
      { startMs: 2100, endMs: 2900, text: 'Next point' },
      { startMs: 4500, endMs: 5400, text: 'after pause' },
    ]);
    // A long run without punctuation or pauses is split after 15 seconds.
    const run = Array.from({ length: 40 }, (_, i) => w('word', i * 0.5, i * 0.5 + 0.4));
    expect(segmentsFromWords(run).length).toBe(2);
  });
});

describe('ballots', () => {
  const scored = (format: typeof BP, scores: Record<string, number>) =>
    Object.entries(scores).reduce(
      (s, [speechId, score]) => reduceSession(s, { type: 'setScore', speechId, score }),
      createSession(format, { id: 'b', now: T0 }),
    );

  it('ranks BP teams from speaker totals and awards 3/2/1/0', () => {
    const s = scored(BP, { pm: 76, dpm: 75, lo: 78, dlo: 77, mg: 74, gw: 73, mo: 72, ow: 71 });
    const r = evaluateBallot(BP, s.ballot);
    expect(r.issues).toEqual([]);
    expect(r.order).toEqual(['OO', 'OG', 'CG', 'CO']);
    expect(r.totals).toEqual({ OG: 151, OO: 155, CG: 147, CO: 143 });
    expect(r.points).toEqual({ OO: 3, OG: 2, CG: 1, CO: 0 });
  });

  it('flags missing scores, out-of-range scores and tied team totals', () => {
    const partial = evaluateBallot(BP, scored(BP, { pm: 76 }).ballot);
    expect(partial.complete).toBe(false);
    expect(partial.issues.filter((i) => i.code === 'missingScore')).toHaveLength(7);

    const bad = evaluateBallot(BP, scored(BP, { pm: 120, dpm: 75, lo: 75, dlo: 75, mg: 74, gw: 73, mo: 72, ow: 71 }).ballot);
    expect(bad.issues).toContainEqual({ code: 'outOfRange', speechId: 'pm', range: { min: 50, max: 100, step: 1 } });

    const tied = evaluateBallot(BP, scored(BP, { pm: 75, dpm: 75, lo: 76, dlo: 74, mg: 74, gw: 73, mo: 72, ow: 71 }).ballot);
    expect(tied.issues).toEqual([{ code: 'tiedTotals', teamIds: ['OG', 'OO'] }]);
  });

  it('scores UADC replies on the half scale and reports the margin', () => {
    const s = scored(UADC, { pm: 76, dpm: 75, gw: 74, gr: 37.5, lo: 75, dlo: 75, ow: 74, or: 38 });
    const r = evaluateBallot(UADC, s.ballot);
    expect(r.issues).toEqual([]);
    expect(r.order).toEqual(['GOV', 'OPP']);
    expect(r.margin).toBe(0.5);
    expect(evaluateBallot(UADC, scored(UADC, { gr: 75 }).ballot).issues).toContainEqual({
      code: 'outOfRange',
      speechId: 'gr',
      range: { min: 35, max: 40, step: 0.5 },
    });
    expect(evaluateBallot(UADC, scored(UADC, { gr: 37.25 }).ballot).issues).toContainEqual({ code: 'offStep', speechId: 'gr', step: 0.5 });
  });

  it('reopens a finalised ballot when a score changes', () => {
    let s = scored(BP, { pm: 75 });
    s = reduceSession(s, { type: 'finalizeBallot', at: T0 });
    expect(s.ballot?.finalizedAt).toBe(T0);
    s = reduceSession(s, { type: 'setScore', speechId: 'pm', score: 76 });
    expect(s.ballot?.finalizedAt).toBeUndefined();
  });
});

describe('notes, speakers and privacy', () => {
  it('keeps notes, ballot and transcripts off joined devices', () => {
    let s = createSession(BP, { id: 'p', now: T0 });
    s = reduceSession(s, { type: 'addNote', note: { id: 'n1', speechIndex: 0, atSec: 42, text: '  weak mechanism ' } });
    s = reduceSession(s, { type: 'setScore', speechId: 'pm', score: 75 });
    s = reduceSession(s, { type: 'setSpeaker', role: 'PM', name: 'Rafi' });
    expect(s.notes).toEqual([{ id: 'n1', speechIndex: 0, atSec: 42, text: 'weak mechanism' }]);

    const shared = publicView(s);
    expect(shared.notes).toBeUndefined();
    expect(shared.ballot).toBeUndefined();
    expect(shared.transcripts).toBeUndefined();
    expect(shared.speakers).toEqual({ PM: 'Rafi' });
  });

  it('edits, empties and deletes notes', () => {
    let s = reduceSession(createSession(BP, { id: 'p', now: T0 }), { type: 'addNote', note: { id: 'n1', speechIndex: 0, atSec: 1, text: 'a' } });
    s = reduceSession(s, { type: 'editNote', id: 'n1', text: 'b' });
    expect(s.notes?.[0]?.text).toBe('b');
    s = reduceSession(s, { type: 'editNote', id: 'n1', text: '   ' });
    expect(s.notes).toEqual([]);
    expect(reduceSession(s, { type: 'addNote', note: { id: 'x', speechIndex: 99, atSec: 1, text: 'a' } }).notes).toEqual([]);
  });

  it('ignores speakers for seats the format does not have', () => {
    const s = reduceSession(createSession(UADC, { id: 'u', now: T0 }), { type: 'setSpeaker', role: 'MG', name: 'X' });
    expect(s.speakers).toBeUndefined();
  });
});
