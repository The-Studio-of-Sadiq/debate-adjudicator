import { segmentsFromVerboseJson, segmentsFromWords, type TimedWord, type TranscriptSegment } from '@debate/core';
import { extensionOf, formDataFile } from '../files';
import type { CloudSettings, Progress, SpeechLanguage } from './types';

const MIME: Record<string, string> = { m4a: 'audio/mp4', mp4: 'audio/mp4', webm: 'audio/webm', wav: 'audio/wav', mp3: 'audio/mpeg' };

async function audioFile(uri: string) {
  const ext = extensionOf(uri);
  return formDataFile(uri, `clip.${ext}`, MIME[ext] ?? 'application/octet-stream');
}

/** POST a form and return the JSON, or throw with the provider's own message. */
async function post(url: string, headers: Record<string, string>, form: FormData): Promise<unknown> {
  const res = await fetch(url, { method: 'POST', headers, body: form });
  if (!res.ok) {
    let detail = '';
    try {
      // OpenAI: { error: { message } }. ElevenLabs: { detail: { message } } or { detail: "…" }.
      const body = (await res.json()) as { error?: { message?: string }; detail?: string | { message?: string } };
      detail = body.error?.message ?? (typeof body.detail === 'string' ? body.detail : body.detail?.message) ?? '';
    } catch {
      // Not JSON; the status says enough.
    }
    throw new Error(`Cloud transcription failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}

const root = (s: CloudSettings) => s.baseUrl.replace(/\/+$/, '');

/**
 * OpenAI-compatible `/audio/transcriptions` (OpenAI, Groq, …). Asks for
 * segment timestamps so the transcript can be synced to playback.
 */
async function transcribeOpenAI(uri: string, settings: CloudSettings, language: SpeechLanguage): Promise<TranscriptSegment[]> {
  const form = new FormData();
  form.append('file', await audioFile(uri));
  form.append('model', settings.model);
  form.append('language', language);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  return segmentsFromVerboseJson(await post(`${root(settings)}/audio/transcriptions`, { Authorization: `Bearer ${settings.apiKey}` }, form));
}

/** ElevenLabs Scribe: word timestamps, grouped into lines here. */
async function transcribeElevenLabs(uri: string, settings: CloudSettings, language: SpeechLanguage): Promise<TranscriptSegment[]> {
  const form = new FormData();
  form.append('file', await audioFile(uri));
  form.append('model_id', settings.model);
  form.append('language_code', language);
  form.append('timestamps_granularity', 'word');
  form.append('tag_audio_events', 'false');
  const body = (await post(`${root(settings)}/speech-to-text`, { 'xi-api-key': settings.apiKey }, form)) as { words?: TimedWord[]; text?: string };
  return body.words?.length ? segmentsFromWords(body.words) : segmentsFromVerboseJson({ text: body.text });
}

export async function transcribeCloud(
  uri: string,
  settings: CloudSettings,
  language: SpeechLanguage,
  onProgress: (p: Progress) => void,
): Promise<TranscriptSegment[]> {
  if (!settings.apiKey) throw new Error('transcription.noApiKey');
  onProgress({ stage: 'upload' });
  return settings.provider === 'elevenlabs' ? transcribeElevenLabs(uri, settings, language) : transcribeOpenAI(uri, settings, language);
}
