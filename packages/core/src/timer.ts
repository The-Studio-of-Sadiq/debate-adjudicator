import type { SpeechTemplate, TimerEvent, TimerEventType, TimerStatus } from './types';

const NEXT_STATUS: Record<TimerStatus, Partial<Record<TimerEventType, TimerStatus>>> = {
  idle: { start: 'running' },
  running: { pause: 'paused', stop: 'stopped' },
  paused: { resume: 'running', stop: 'stopped' },
  stopped: {},
};

export function timerStatus(events: TimerEvent[]): TimerStatus {
  let status: TimerStatus = 'idle';
  for (const e of events) status = NEXT_STATUS[status][e.type] ?? status;
  return status;
}

export function canApply(events: TimerEvent[], type: TimerEventType): boolean {
  return NEXT_STATUS[timerStatus(events)][type] !== undefined;
}

/** Returns a new event list, or the same list if the transition is invalid. */
export function applyTimerEvent(events: TimerEvent[], event: TimerEvent): TimerEvent[] {
  if (!canApply(events, event.type)) return events;
  const last = events[events.length - 1];
  // Never let time run backwards, e.g. from a slightly skewed client clock.
  const at = last && event.at < last.at ? last.at : event.at;
  return [...events, { type: event.type, at }];
}

/**
 * Elapsed running time in ms, derived purely from events. Every device that
 * has the same events and a synced clock computes the same value.
 */
export function elapsedMs(events: TimerEvent[], now: number): number {
  let total = 0;
  let runningSince: number | null = null;
  for (const e of events) {
    if (e.type === 'start' || e.type === 'resume') {
      runningSince = e.at;
    } else if (runningSince !== null) {
      total += e.at - runningSince;
      runningSince = null;
    }
  }
  if (runningSince !== null) total += Math.max(0, now - runningSince);
  return total;
}

export type SpeechPhase = 'protected' | 'poi-open' | 'closing' | 'grace' | 'overtime';

/** Phase of the speech at a given time, used for colour coding and POI rules. */
export function speechPhase(t: SpeechTemplate, elapsedSec: number): SpeechPhase {
  if (elapsedSec >= t.durationSec + t.graceSec) return 'overtime';
  if (elapsedSec >= t.durationSec) return 'grace';
  if (!t.poiWindow) return elapsedSec >= t.durationSec - 60 ? 'closing' : 'protected';
  if (elapsedSec < t.poiWindow.from) return 'protected';
  if (elapsedSec < t.poiWindow.to) return 'poi-open';
  return 'closing';
}

/** "4:07", or "-0:12" style for negatives (time remaining past zero). */
export function formatClock(totalSec: number): string {
  const sign = totalSec < 0 ? '-' : '';
  const s = Math.floor(Math.abs(totalSec));
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
