import type { Transcript, TranscriptSegment } from './types';

/**
 * Whisper marks silence and noise with bracketed tags like "[BLANK_AUDIO]" or
 * "(applause)"; they aren't speech, so drop them.
 */
const NON_SPEECH = /^\s*[[(][^\])]*[\])]\s*$/;

export function cleanSegments(raw: TranscriptSegment[]): TranscriptSegment[] {
  return raw
    .map((s) => ({ startMs: Math.max(0, Math.round(s.startMs)), endMs: Math.max(0, Math.round(s.endMs)), text: s.text.replace(/\s+/g, ' ').trim() }))
    .filter((s) => s.text && !NON_SPEECH.test(s.text))
    .sort((a, b) => a.startMs - b.startMs);
}

export function transcriptText(t: Transcript): string {
  return t.segments.map((s) => s.text).join(' ');
}

/** Index of the segment playing at `ms`, or -1. */
export function segmentIndexAt(t: Transcript, ms: number): number {
  for (let i = t.segments.length - 1; i >= 0; i--) {
    if (t.segments[i]!.startMs <= ms) return ms <= t.segments[i]!.endMs + 1500 ? i : -1;
  }
  return -1;
}

/** OpenAI-compatible `verbose_json` transcription response → segments. */
export function segmentsFromVerboseJson(json: unknown): TranscriptSegment[] {
  const body = json as { segments?: { start: number; end: number; text: string }[]; text?: string; duration?: number };
  if (Array.isArray(body.segments) && body.segments.length) {
    return cleanSegments(body.segments.map((s) => ({ startMs: s.start * 1000, endMs: s.end * 1000, text: s.text })));
  }
  // Models that return plain text only: one segment for the whole clip.
  return body.text ? cleanSegments([{ startMs: 0, endMs: (body.duration ?? 0) * 1000, text: body.text }]) : [];
}
