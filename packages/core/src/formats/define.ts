import type { BallotSpec, BellRule, DebateFormat, FormatInfo, ScoreRange, Side, SpeechTemplate } from '../types';

/**
 * A debate format, written as data. Copy `_template.ts` to add one, then
 * register it in `index.ts`. `npm test` validates every registered format.
 */
export interface FormatDefinition {
  /** Short, lowercase and unique, e.g. "wsdc". Stored in saved rounds; don't change it later. */
  id: string;
  /** English name shown in the app, e.g. "World Schools (WSDC)". */
  name: string;
  /** What the two sides are called. */
  sides: { gov: string; opp: string };
  /** Default timing; individual speeches can override it. Times are in seconds. */
  timing: {
    speech: {
      durationSec: number;
      /** Seconds after time is up before the speaker counts as overtime. */
      graceSec: number;
      /** Seconds without POIs at the start and end of a speech; null if the format has no POIs. */
      protectedSec: number | null;
    };
    /** Timing for reply speeches, if the format has them. */
    reply?: { durationSec: number; graceSec: number };
  };
  /** Speeches in speaking order. */
  speeches: SpeechDefinition[];
  /** Teams, by the roles of their speeches. Every speech belongs to exactly one team. */
  teams: { id: string; name: string; side: Side; roles: string[] }[];
  scoring: {
    /** ranked: teams placed 1st, 2nd, … (BP). winloss: one winner of two teams. */
    kind: 'ranked' | 'winloss';
    /** Range for substantive speeches. */
    speech: ScoreRange;
    /** Range for reply speeches, if they're scored differently. */
    reply?: ScoreRange;
  };
  /** Where and by whom the format is used; shown in the format list and on the website. */
  info?: FormatInfo;
  /** Where the rules come from: a rulebook name or URL. */
  source?: string;
}

export interface SpeechDefinition {
  /** Short code shown on the timer and chips, e.g. "PM". Unique within the format. */
  role: string;
  /** English name, e.g. "Prime Minister". */
  name: string;
  side: Side;
  /** Reply speeches use the reply timing and score range. */
  reply?: boolean;
  /**
   * Speeches of the same kind share timing in Bell settings, e.g. "Rebuttal".
   * Leave it out for plain substantive and reply speeches.
   */
  kind?: string;
  /** Overrides for this speech only. */
  durationSec?: number;
  graceSec?: number;
  poiWindow?: { from: number; to: number } | null;
  bells?: BellRule[];
}

/**
 * Bells for a speech with protected time at both ends: single when POIs open,
 * single when they close, double at time, continuous once grace runs out.
 */
export function standardBells(durationSec: number, protectedSec: number, graceSec: number): BellRule[] {
  return [
    { at: protectedSec, pattern: 'single', label: 'POIs open' },
    { at: durationSec - protectedSec, pattern: 'single', label: 'POIs closed' },
    { at: durationSec, pattern: 'double', label: 'Time' },
    { at: durationSec + graceSec, pattern: 'continuous', label: 'Grace over' },
  ];
}

/** Bells for a speech without POIs (and for replies): a one-minute warning, double at time. */
export function replyBells(durationSec: number, graceSec: number): BellRule[] {
  return [
    { at: durationSec - 60, pattern: 'single', label: '1 minute left' },
    { at: durationSec, pattern: 'double', label: 'Time' },
    { at: durationSec + graceSec, pattern: 'continuous', label: 'Grace over' },
  ];
}

/** Turns a definition into the format the app runs. Throws if it's invalid. */
export function defineFormat(def: FormatDefinition): DebateFormat {
  const problems = validateFormat(def);
  if (problems.length) throw new Error(`Format "${def.id}" is invalid:\n- ${problems.join('\n- ')}`);

  const speeches: SpeechTemplate[] = def.speeches.map((s) => {
    const base = s.reply ? def.timing.reply! : def.timing.speech;
    const durationSec = s.durationSec ?? base.durationSec;
    const graceSec = s.graceSec ?? base.graceSec;
    const protectedSec = s.reply ? null : def.timing.speech.protectedSec;
    const poiWindow = s.poiWindow !== undefined ? s.poiWindow : protectedSec === null ? null : { from: protectedSec, to: durationSec - protectedSec };
    const bells = s.bells ?? (poiWindow ? standardBells(durationSec, poiWindow.from, graceSec) : replyBells(durationSec, graceSec));
    return { id: s.role.toLowerCase(), role: s.role, name: s.name, side: s.side, durationSec, graceSec, poiWindow, bells, reply: !!s.reply, ...(s.kind && { kind: s.kind }) };
  });

  const ballot: BallotSpec = {
    kind: def.scoring.kind,
    teams: def.teams.map((t) => ({ id: t.id, name: t.name, side: t.side, speechIds: t.roles.map((r) => r.toLowerCase()) })),
    range: def.scoring.speech,
    replyRange: def.scoring.reply,
  };

  return { id: def.id, name: def.name, speeches, sides: def.sides, ballot, ...(def.info && { info: def.info }), source: def.source };
}

const validRange = (r: ScoreRange) => r.min < r.max && r.step > 0 && Number.isFinite(r.min) && Number.isFinite(r.max);

/** Human-readable problems with a definition; empty when it's valid. */
export function validateFormat(def: FormatDefinition): string[] {
  const p: string[] = [];
  if (!/^[a-z0-9-]{2,24}$/.test(def.id)) p.push('id must be 2–24 lowercase letters, digits or dashes');
  if (!def.name.trim()) p.push('name is empty');
  if (!def.speeches.length) p.push('there are no speeches');

  const { speech, reply } = def.timing;
  if (speech.durationSec <= 0) p.push('timing.speech.durationSec must be positive');
  if (speech.graceSec < 0) p.push('timing.speech.graceSec must not be negative');
  if (speech.protectedSec !== null && (speech.protectedSec < 0 || speech.protectedSec * 2 >= speech.durationSec)) {
    p.push('timing.speech.protectedSec must leave a POI window in the middle of the speech');
  }
  if (def.speeches.some((s) => s.reply) && !reply) p.push('there are reply speeches but no timing.reply');

  const roles = new Set<string>();
  for (const s of def.speeches) {
    if (!/^[A-Z0-9]{1,4}$/.test(s.role)) p.push(`role "${s.role}" must be 1–4 capital letters or digits`);
    if (roles.has(s.role)) p.push(`role "${s.role}" is used twice`);
    roles.add(s.role);
    const duration = s.durationSec ?? (s.reply ? reply?.durationSec : speech.durationSec) ?? 0;
    const grace = s.graceSec ?? (s.reply ? reply?.graceSec : speech.graceSec) ?? 0;
    if (s.poiWindow && (s.poiWindow.from < 0 || s.poiWindow.to > duration || s.poiWindow.from >= s.poiWindow.to)) {
      p.push(`${s.role}: poiWindow must lie inside the speech`);
    }
    for (const b of s.bells ?? []) {
      if (b.at < 0 || b.at > duration + grace) p.push(`${s.role}: bell at ${b.at}s is outside the speech and grace period`);
    }
  }

  const assigned = new Map<string, string>();
  for (const t of def.teams) {
    for (const r of t.roles) {
      if (!roles.has(r)) p.push(`team ${t.id}: unknown role "${r}"`);
      else if (assigned.has(r)) p.push(`role "${r}" is in both team ${assigned.get(r)} and team ${t.id}`);
      else assigned.set(r, t.id);
      const s = def.speeches.find((x) => x.role === r);
      if (s && s.side !== t.side) p.push(`team ${t.id} is ${t.side} but ${r} speaks for ${s.side}`);
    }
  }
  for (const r of roles) if (!assigned.has(r)) p.push(`role "${r}" isn't in any team`);
  if (new Set(def.teams.map((t) => t.id)).size !== def.teams.length) p.push('team ids must be unique');
  if (def.scoring.kind === 'winloss' && def.teams.length !== 2) p.push('a winloss format needs exactly two teams');
  if (def.scoring.kind === 'ranked' && def.teams.length < 2) p.push('a ranked format needs at least two teams');
  if (!validRange(def.scoring.speech)) p.push('scoring.speech must have min < max and a positive step');
  if (def.scoring.reply && !validRange(def.scoring.reply)) p.push('scoring.reply must have min < max and a positive step');
  return p;
}
