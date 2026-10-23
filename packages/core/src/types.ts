export type BellPattern = 'single' | 'double' | 'triple' | 'continuous';

export interface BellRule {
  /** Seconds into the speech. */
  at: number;
  pattern: BellPattern;
  label?: string;
}

export type Side = 'gov' | 'opp';

export interface SpeechTemplate {
  id: string;
  /** Short role code shown on the timer, e.g. "PM", "DLO". */
  role: string;
  name: string;
  side: Side;
  durationSec: number;
  /** Seconds after durationSec before the speaker counts as overtime. */
  graceSec: number;
  /** Window in which POIs may be offered; null when POIs are not allowed. */
  poiWindow: { from: number; to: number } | null;
  bells: BellRule[];
  /** Reply speeches use the reply timing and score range. */
  reply?: boolean;
  /** Speeches of the same kind share timing in Bell settings, e.g. "Rebuttal". */
  kind?: string;
}

export interface DebateFormat {
  id: string;
  name: string;
  speeches: SpeechTemplate[];
  /** What the two sides are called, e.g. Proposition / Opposition. */
  sides?: { gov: string; opp: string };
  /** Teams and scoring. Missing on sessions saved before format definitions. */
  ballot?: BallotSpec;
  info?: FormatInfo;
  /** Where the rules come from (rulebook name or URL). */
  source?: string;
}

/** Where a format is used, for the format list and the website. All English. */
export interface FormatInfo {
  /** Country or region, e.g. "New Zealand" or "World". */
  region?: string;
  /** e.g. "High school", "University". */
  level?: string;
  /** Tournaments or leagues that use it. */
  usedAt?: string;
  /** One line: team sizes, speech lengths, POIs. */
  description?: string;
  /** Preparation time before the round, in seconds. */
  prepSec?: number;
}

export interface ScoreRange {
  min: number;
  max: number;
  step: number;
}

export interface TeamSpec {
  id: string;
  /** English team name; translated via the app's teams.* keys when present. */
  name?: string;
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

export type TimerEventType = 'start' | 'pause' | 'resume' | 'stop';

export interface TimerEvent {
  type: TimerEventType;
  /** Host clock, epoch milliseconds. */
  at: number;
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped';

export type InterruptionKind = 'POI' | 'POO' | 'POP';

export type InterruptionStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'ruled'
  | 'withdrawn';

export type Ruling = 'well-taken' | 'not-well-taken' | 'under-consideration';

export interface Interruption {
  id: string;
  kind: InterruptionKind;
  /** Role code or name of the person raising it. */
  raisedBy: string;
  /** Speech time (seconds) when it was raised. */
  raisedAtSec: number;
  status: InterruptionStatus;
  ruling?: Ruling;
  /** Speech time when the decision or ruling was made. */
  resolvedAtSec?: number;
  /** Speech time when an accepted POI finished. */
  endedAtSec?: number;
}

export interface ClipRef {
  id: string;
  /** Device that captured the clip. */
  deviceId: string;
  uri: string;
  /** Host epoch ms when the recording started. */
  startedAt: number;
  durationMs: number;
  interruptionId?: string;
}

export interface SpeechRecord {
  templateId: string;
  events: TimerEvent[];
  interruptions: Interruption[];
  clips: ClipRef[];
}

export interface TranscriptSegment {
  /** Milliseconds from the start of the clip. */
  startMs: number;
  endMs: number;
  text: string;
}

export interface Transcript {
  clipId: string;
  /** e.g. "whisper-local:base.en" or "cloud:whisper-1". */
  engine: string;
  createdAt: number;
  segments: TranscriptSegment[];
}

/** An adjudicator's flow note, pinned to a moment in a speech. */
export interface Note {
  id: string;
  speechIndex: number;
  /** Speech time in seconds when the note was taken. */
  atSec: number;
  text: string;
}

export interface Ballot {
  /** Speaker score per speech template id. */
  scores: Record<string, number>;
  comments?: string;
  /** Set when the chair marks the ballot final. */
  finalizedAt?: number;
}

export interface Session {
  id: string;
  createdAt: number;
  motion: string;
  format: DebateFormat;
  currentIndex: number;
  speeches: SpeechRecord[];
  /** Transcripts keyed by clip id. Missing on sessions saved before Phase 4. */
  transcripts?: Record<string, Transcript>;
  /** Speaker names keyed by speech role code (PM, LO, …). */
  speakers?: Record<string, string>;
  notes?: Note[];
  ballot?: Ballot;
}
