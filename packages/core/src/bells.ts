import type { BellPattern, BellRule } from './types';

/** How often a continuous bell repeats, in seconds. */
export const CONTINUOUS_REPEAT_SEC = 2;

/** Number of rings for each pattern; continuous rings in bursts of 3. */
export const RINGS: Record<BellPattern, number> = {
  single: 1,
  double: 2,
  triple: 3,
  continuous: 3,
};

export interface BellHit {
  rule: BellRule;
  /** The exact speech second this hit belongs to. */
  at: number;
}

/**
 * Bells that should ring when the clock moves from `fromSec` (exclusive) to
 * `toSec` (inclusive). Call it on every UI tick with the previous and current
 * elapsed time; ticks can be irregular and nothing is missed or doubled.
 */
export function bellsBetween(rules: BellRule[], fromSec: number, toSec: number): BellHit[] {
  if (toSec <= fromSec) return [];
  const hits: BellHit[] = [];
  for (const rule of rules) {
    if (rule.pattern !== 'continuous') {
      if (rule.at > fromSec && rule.at <= toSec) hits.push({ rule, at: rule.at });
      continue;
    }
    if (toSec < rule.at) continue;
    // First repeat index strictly after fromSec.
    const first = fromSec < rule.at ? 0 : Math.floor((fromSec - rule.at) / CONTINUOUS_REPEAT_SEC) + 1;
    for (let k = first; rule.at + k * CONTINUOUS_REPEAT_SEC <= toSec; k++) {
      hits.push({ rule, at: rule.at + k * CONTINUOUS_REPEAT_SEC });
    }
  }
  return hits.sort((a, b) => a.at - b.at);
}

/** Sorts rules and rejects bad input from the bell settings screen. */
export function normalizeBells(rules: BellRule[]): BellRule[] {
  return rules
    .filter((r) => Number.isFinite(r.at) && r.at >= 0)
    .map((r) => ({ ...r, at: Math.round(r.at) }))
    .sort((a, b) => a.at - b.at);
}
