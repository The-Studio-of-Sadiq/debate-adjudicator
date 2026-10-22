import { currentSpeech, currentTemplate, type SessionAction } from '../session';
import type { Session } from '../types';
import type { Member } from './protocol';

/** What a joined device's UI may offer. The host enforces the same rules in `authorize`. */
export interface Capabilities {
  controlTimer: boolean;
  ringBell: boolean;
  /** Seat this device raises interruptions as; null = cannot raise. */
  raiseAs: string | null;
  /** May accept/decline POIs (only while holding the floor). */
  decidePoi: boolean;
  /** May rule on POO/POP. Only the chair. */
  rule: boolean;
}

export const CHAIR_CAPS: Capabilities = { controlTimer: true, ringBell: true, raiseAs: null, decidePoi: true, rule: true };

export function capabilitiesFor(member: Member, session: Session): Capabilities {
  const speaking = member.role === 'debater' && member.seat === currentTemplate(session).role;
  return {
    controlTimer: member.role === 'timekeeper',
    ringBell: member.role === 'timekeeper',
    raiseAs: member.role === 'debater' && member.seat && !speaking ? member.seat : null,
    decidePoi: speaking,
    rule: false,
  };
}

/** Host-side check for an action requested by a joined device. */
export function authorize(member: Member, action: SessionAction, session: Session): boolean {
  if (member.status !== 'approved') return false;
  const caps = capabilitiesFor(member, session);
  switch (action.type) {
    case 'timer':
    case 'goto':
      return caps.controlTimer;
    case 'raise': {
      if (caps.raiseAs === null || action.raisedBy !== caps.raiseAs) return false;
      // POIs only come from the other side of the house.
      const seat = session.format.speeches.find((s) => s.role === caps.raiseAs);
      return action.kind !== 'POI' || (!!seat && seat.side !== currentTemplate(session).side);
    }
    case 'withdraw': {
      const target = currentSpeech(session).interruptions.find((i) => i.id === action.id);
      return !!target && target.raisedBy === member.seat;
    }
    case 'decidePoi':
      return caps.decidePoi;
    case 'endPoi': {
      if (caps.decidePoi) return true;
      const target = currentSpeech(session).interruptions.find((i) => i.id === action.id);
      return !!target && target.raisedBy === member.seat;
    }
    default:
      // rule, expire, setMotion, addClip: host only (clip upload arrives in Phase 4).
      return false;
  }
}
