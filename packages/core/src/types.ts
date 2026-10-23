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
}

export interface DebateFormat {
  id: string;
  name: string;
  speeches: SpeechTemplate[];
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

export interface Session {
  id: string;
  createdAt: number;
  motion: string;
  format: DebateFormat;
  currentIndex: number;
  speeches: SpeechRecord[];
  /** Transcripts keyed by clip id. Missing on sessions saved before Phase 4. */
  transcripts?: Record<string, Transcript>;
}
