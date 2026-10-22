import type { Interruption, InterruptionKind, Session, SpeechTemplate, TimerStatus } from './types';

/** A pending POI the speaker hasn't answered is dropped after this many seconds. */
export const POI_EXPIRE_SEC = 10;

/** Default length of an accepted POI before it is auto-closed. */
export const POI_MAX_SEC = 15;

export const INTERRUPTION_NAMES: Record<InterruptionKind, string> = {
  POI: 'Point of Information',
  POO: 'Point of Order',
  POP: 'Point of Personal Privilege',
};

/**
 * POO and POP go to the chair and stop the clock; a POI goes to the speaker
 * and the clock keeps running.
 */
export function pausesTimer(kind: InterruptionKind): boolean {
  return kind !== 'POI';
}

/**
 * The interruption `seat` is speaking in right now, if any: an accepted POI
 * that hasn't ended, or a POO/POP the chair hasn't ruled on yet. A joined
 * device records its microphone exactly while this returns something.
 */
export function liveInterruptionFor(session: Session, seat: string): { speechIndex: number; interruption: Interruption } | null {
  const speechIndex = session.currentIndex;
  const interruption = session.speeches[speechIndex]?.interruptions.find(
    (i) =>
      i.raisedBy === seat &&
      (i.kind === 'POI' ? i.status === 'accepted' && i.endedAtSec === undefined : i.status === 'pending'),
  );
  return interruption ? { speechIndex, interruption } : null;
}

export function canRaise(
  kind: InterruptionKind,
  template: SpeechTemplate,
  status: TimerStatus,
  elapsedSec: number,
): { ok: true } | { ok: false; reason: string } {
  if (status !== 'running') return { ok: false, reason: 'The speech is not running' };
  if (kind !== 'POI') return { ok: true };
  const w = template.poiWindow;
  if (!w) return { ok: false, reason: 'POIs are not allowed in this speech' };
  if (elapsedSec < w.from || elapsedSec >= w.to) return { ok: false, reason: 'Protected time' };
  return { ok: true };
}
