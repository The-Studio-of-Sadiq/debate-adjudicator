import type { Ballot, DebateFormat, Side } from './types';

export interface ScoreRange {
  min: number;
  max: number;
  step: number;
}

export interface TeamSpec {
  id: string;
  side: Side;
  /** Speech template ids whose scores count for this team. */
  speechIds: string[];
}

export interface BallotSpec {
  /** ranked: BP-style 1st–4th. winloss: one winner between two teams. */
  kind: 'ranked' | 'winloss';
  teams: TeamSpec[];
  range: ScoreRange;
  /** Reply speeches are scored on their own, smaller scale. */
  replyRange?: ScoreRange;
}

const BP_SPEC: BallotSpec = {
  kind: 'ranked',
  teams: [
    { id: 'OG', side: 'gov', speechIds: ['pm', 'dpm'] },
    { id: 'OO', side: 'opp', speechIds: ['lo', 'dlo'] },
    { id: 'CG', side: 'gov', speechIds: ['mg', 'gw'] },
    { id: 'CO', side: 'opp', speechIds: ['mo', 'ow'] },
  ],
  range: { min: 50, max: 100, step: 1 },
};

const UADC_SPEC: BallotSpec = {
  kind: 'winloss',
  teams: [
    { id: 'GOV', side: 'gov', speechIds: ['pm', 'dpm', 'gw', 'gr'] },
    { id: 'OPP', side: 'opp', speechIds: ['lo', 'dlo', 'ow', 'or'] },
  ],
  range: { min: 70, max: 80, step: 1 },
  replyRange: { min: 35, max: 40, step: 0.5 },
};

/** Scoring rules for a format; unknown formats get a two-sided win/loss ballot. */
export function ballotSpecFor(format: DebateFormat): BallotSpec {
  if (format.id === 'bp') return BP_SPEC;
  if (format.id === 'uadc') return UADC_SPEC;
  return {
    kind: 'winloss',
    teams: (['gov', 'opp'] as Side[]).map((side) => ({
      id: side.toUpperCase(),
      side,
      speechIds: format.speeches.filter((s) => s.side === side).map((s) => s.id),
    })),
    range: { min: 50, max: 100, step: 1 },
  };
}

export function rangeFor(spec: BallotSpec, format: DebateFormat, speechId: string): ScoreRange {
  const isReply = format.speeches.find((s) => s.id === speechId)?.poiWindow === null;
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
