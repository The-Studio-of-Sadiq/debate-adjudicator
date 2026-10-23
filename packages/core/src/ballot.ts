import { PRESETS } from './formats';
import type { Ballot, BallotSpec, DebateFormat, ScoreRange, Side } from './types';

export type { BallotSpec, ScoreRange, TeamSpec } from './types';

/**
 * Scoring rules for a format: from its definition, or for rounds saved before
 * formats carried their own rules, from the built-in format with the same id.
 * Anything else gets a two-sided win/loss ballot.
 */
export function ballotSpecFor(format: DebateFormat): BallotSpec {
  const known = format.ballot ?? PRESETS.find((p) => p.id === format.id)?.ballot;
  if (known) return known;
  return {
    kind: 'winloss',
    teams: (['gov', 'opp'] as Side[]).map((side) => ({
      id: side.toUpperCase(),
      name: format.sides?.[side] ?? (side === 'gov' ? 'Government' : 'Opposition'),
      side,
      speechIds: format.speeches.filter((s) => s.side === side).map((s) => s.id),
    })),
    range: { min: 50, max: 100, step: 1 },
  };
}

/** Reply speeches have their own range; older saved rounds mark replies only by having no POIs. */
export function rangeFor(spec: BallotSpec, format: DebateFormat, speechId: string): ScoreRange {
  const speech = format.speeches.find((s) => s.id === speechId);
  const isReply = speech?.reply ?? speech?.poiWindow === null;
  return isReply && spec.replyRange ? spec.replyRange : spec.range;
}

/** Problems that keep a ballot from being final. Codes are translated by the app. */
export type BallotIssue =
  | { code: 'missingScore'; speechId: string }
  | { code: 'outOfRange'; speechId: string; range: ScoreRange }
  | { code: 'offStep'; speechId: string; step: number }
  | { code: 'tiedTotals'; teamIds: string[] };

export interface BallotResult {
  totals: Record<string, number>;
  /** Team ids, best first. Only meaningful when there are no issues. */
  order: string[];
  /** BP team points (3/2/1/0) or 1/0 for win/loss. */
  points: Record<string, number>;
  /** Win/loss margin in speaker points. */
  margin?: number;
  issues: BallotIssue[];
  complete: boolean;
}

export function evaluateBallot(format: DebateFormat, ballot: Ballot | undefined): BallotResult {
  const spec = ballotSpecFor(format);
  const scores = ballot?.scores ?? {};
  const issues: BallotIssue[] = [];
  const totals: Record<string, number> = {};

  for (const team of spec.teams) {
    totals[team.id] = 0;
    for (const id of team.speechIds) {
      if (!format.speeches.some((s) => s.id === id)) continue;
      const score = scores[id];
      if (score === undefined) {
        issues.push({ code: 'missingScore', speechId: id });
        continue;
      }
      const range = rangeFor(spec, format, id);
      if (score < range.min || score > range.max) issues.push({ code: 'outOfRange', speechId: id, range });
      else if (Math.abs(score / range.step - Math.round(score / range.step)) > 1e-9) issues.push({ code: 'offStep', speechId: id, step: range.step });
      totals[team.id]! += score;
    }
  }

  const order = spec.teams.map((t) => t.id).sort((a, b) => totals[b]! - totals[a]!);
  // A ballot must rank teams strictly; equal totals can't be split.
  const complete0 = !issues.some((i) => i.code === 'missingScore');
  if (complete0) {
    const byTotal = new Map<number, string[]>();
    for (const id of order) byTotal.set(totals[id]!, [...(byTotal.get(totals[id]!) ?? []), id]);
    for (const ids of byTotal.values()) if (ids.length > 1) issues.push({ code: 'tiedTotals', teamIds: ids });
  }

  const points: Record<string, number> = {};
  order.forEach((id, i) => (points[id] = spec.kind === 'ranked' ? spec.teams.length - 1 - i : i === 0 ? 1 : 0));
  const margin = spec.kind === 'winloss' && order.length === 2 ? totals[order[0]!]! - totals[order[1]!]! : undefined;

  return { totals, order, points, margin, issues, complete: issues.length === 0 };
}
