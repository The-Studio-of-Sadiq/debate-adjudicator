import { canRaise, pausesTimer } from './interruptions';
import { applyTimerEvent, elapsedMs, timerStatus } from './timer';
import type {
  ClipRef,
  DebateFormat,
  Interruption,
  InterruptionKind,
  Ruling,
  Session,
  SpeechRecord,
  SpeechTemplate,
  TimerEventType,
  Transcript,
} from './types';

/**
 * Every change to a session is an action stamped with host time. The host
 * applies actions with `reduceSession`; in Phase 2 the same actions are what
 * gets broadcast to joined devices, so all of them hold identical state.
 */
export type SessionAction =
  | { type: 'timer'; event: TimerEventType; at: number }
  | { type: 'goto'; index: number; at: number }
  | { type: 'setMotion'; motion: string }
  | { type: 'raise'; id: string; kind: InterruptionKind; raisedBy: string; at: number }
  | { type: 'decidePoi'; id: string; accept: boolean; at: number }
  | { type: 'endPoi'; id: string; at: number }
  | { type: 'expire'; id: string; at: number }
  | { type: 'withdraw'; id: string; at: number }
  | { type: 'rule'; id: string; ruling: Ruling; at: number }
  | { type: 'addClip'; speechIndex: number; clip: ClipRef }
  | { type: 'setTranscript'; transcript: Transcript };

export function createSession(format: DebateFormat, opts: { id: string; now: number; motion?: string }): Session {
  return {
    id: opts.id,
    createdAt: opts.now,
    motion: opts.motion ?? '',
    format,
    currentIndex: 0,
    speeches: format.speeches.map((t) => ({ templateId: t.id, events: [], interruptions: [], clips: [] })),
  };
}

export function currentTemplate(s: Session): SpeechTemplate {
  return s.format.speeches[s.currentIndex]!;
}

export function currentSpeech(s: Session): SpeechRecord {
  return s.speeches[s.currentIndex]!;
}

/** Interruptions waiting on the chair (POO/POP) — while any exist the clock stays paused. */
function hasOpenChairPoint(r: SpeechRecord): boolean {
  return r.interruptions.some((i) => pausesTimer(i.kind) && i.status === 'pending');
}

function updateCurrent(s: Session, fn: (r: SpeechRecord) => SpeechRecord): Session {
  const speeches = s.speeches.slice();
  speeches[s.currentIndex] = fn(speeches[s.currentIndex]!);
  return { ...s, speeches };
}

function updateInterruption(
  r: SpeechRecord,
  id: string,
  from: Interruption['status'][],
  fn: (i: Interruption) => Interruption,
): SpeechRecord | null {
  const idx = r.interruptions.findIndex((i) => i.id === id);
  const target = r.interruptions[idx];
  if (!target || !from.includes(target.status)) return null;
  const interruptions = r.interruptions.slice();
  interruptions[idx] = fn(target);
  return { ...r, interruptions };
}

const sec = (r: SpeechRecord, at: number) => elapsedMs(r.events, at) / 1000;

/** Resume the clock once the last pending POO/POP is resolved. */
function resumeIfChairDone(r: SpeechRecord, kind: InterruptionKind, at: number): SpeechRecord {
  if (!pausesTimer(kind) || hasOpenChairPoint(r) || timerStatus(r.events) !== 'paused') return r;
  return { ...r, events: applyTimerEvent(r.events, { type: 'resume', at }) };
}

export function reduceSession(s: Session, a: SessionAction): Session {
  switch (a.type) {
    case 'setMotion':
      return { ...s, motion: a.motion };

    case 'timer':
      return updateCurrent(s, (r) => {
        // Don't let the timekeeper resume over an unresolved POO/POP.
        if (a.event === 'resume' && hasOpenChairPoint(r)) return r;
        return { ...r, events: applyTimerEvent(r.events, { type: a.event, at: a.at }) };
      });

    case 'goto': {
      if (a.index < 0 || a.index >= s.speeches.length || a.index === s.currentIndex) return s;
      const stopped = updateCurrent(s, (r) => ({ ...r, events: applyTimerEvent(r.events, { type: 'stop', at: a.at }) }));
      return { ...stopped, currentIndex: a.index };
    }

    case 'raise':
      return updateCurrent(s, (r) => {
        if (r.interruptions.some((i) => i.id === a.id)) return r;
        const elapsed = sec(r, a.at);
        if (!canRaise(a.kind, currentTemplate(s), timerStatus(r.events), elapsed).ok) return r;
        const item: Interruption = { id: a.id, kind: a.kind, raisedBy: a.raisedBy, raisedAtSec: elapsed, status: 'pending' };
        const events = pausesTimer(a.kind) ? applyTimerEvent(r.events, { type: 'pause', at: a.at }) : r.events;
        return { ...r, events, interruptions: [...r.interruptions, item] };
      });

    case 'decidePoi':
      return updateCurrent(s, (r) => {
        // Only one POI can hold the floor at a time.
        if (a.accept && r.interruptions.some((i) => i.kind === 'POI' && i.status === 'accepted' && i.endedAtSec === undefined)) return r;
        return (
          updateInterruption(r, a.id, ['pending'], (i) =>
            i.kind !== 'POI' ? i : { ...i, status: a.accept ? 'accepted' : 'declined', resolvedAtSec: sec(r, a.at) },
          ) ?? r
        );
      });

    case 'endPoi':
      return updateCurrent(
        s,
        (r) =>
          updateInterruption(r, a.id, ['accepted'], (i) => (i.endedAtSec !== undefined ? i : { ...i, endedAtSec: sec(r, a.at) })) ?? r,
      );

    case 'expire':
    case 'withdraw':
      return updateCurrent(s, (r) => {
        const next = updateInterruption(r, a.id, ['pending'], (i) => ({
          ...i,
          status: a.type === 'expire' ? 'expired' : 'withdrawn',
          resolvedAtSec: sec(r, a.at),
        }));
        if (!next) return r;
        const kind = next.interruptions.find((i) => i.id === a.id)!.kind;
        return resumeIfChairDone(next, kind, a.at);
      });

    case 'rule':
      return updateCurrent(s, (r) => {
        const next = updateInterruption(r, a.id, ['pending'], (i) =>
          i.kind === 'POI' ? i : { ...i, status: 'ruled', ruling: a.ruling, resolvedAtSec: sec(r, a.at) },
        );
        if (!next) return r;
        return resumeIfChairDone(next, next.interruptions.find((i) => i.id === a.id)!.kind, a.at);
      });

    case 'setTranscript': {
      const known = s.speeches.some((r) => r.clips.some((c) => c.id === a.transcript.clipId));
      if (!known) return s;
      return { ...s, transcripts: { ...s.transcripts, [a.transcript.clipId]: a.transcript } };
    }

    case 'addClip': {
      const target = s.speeches[a.speechIndex];
      if (!target || target.clips.some((c) => c.id === a.clip.id)) return s;
      const speeches = s.speeches.slice();
      speeches[a.speechIndex] = { ...target, clips: [...target.clips, a.clip] };
      return { ...s, speeches };
    }
  }
}
