import { segmentsFromVerboseJson, type TranscriptSegment } from '@debate/core';
import { extensionOf, formDataFile } from '../files';
import type { CloudSettings, Progress } from './types';

const MIME: Record<string, string> = { m4a: 'audio/mp4', mp4: 'audio/mp4', webm: 'audio/webm', wav: 'audio/wav', mp3: 'audio/mpeg' };

/**
 * OpenAI-compatible `/audio/transcriptions` (OpenAI, Groq, …). Asks for
 * segment timestamps so the transcript can be synced to playback.
 */
export async function transcribeCloud(uri: string, settings: CloudSettings, onProgress: (p: Progress) => void): Promise<TranscriptSegment[]> {
  if (!settings.apiKey) throw new Error('transcription.noApiKey');
  const ext = extensionOf(uri);
  const form = new FormData();
  form.append('file', await formDataFile(uri, `clip.${ext}`, MIME[ext] ?? 'application/octet-stream'));
  form.append('model', settings.model);
  form.append('language', 'en');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');

  onProgress({ stage: 'upload' });
  const res = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.apiKey}` },
    body: form,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
    } catch {
      // Not JSON; the status says enough.
    }
    throw new Error(`Cloud transcription failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return segmentsFromVerboseJson(await res.json());
}
