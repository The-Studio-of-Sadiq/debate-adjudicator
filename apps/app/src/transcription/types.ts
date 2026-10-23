import type { TranscriptSegment } from '@debate/core';

export type ModelName = 'tiny.en' | 'base.en' | 'small.en';

export type Progress =
  | { stage: 'download'; loaded: number; total: number }
  | { stage: 'decode' }
  | { stage: 'transcribe'; percent?: number }
  | { stage: 'upload' };

/** Offline Whisper on this device. `local.native.ts` = Android, `local.ts` = Windows app. */
export interface LocalEngine {
  available: boolean;
  /** i18n key explaining why it's unavailable. */
  unavailableReason?: string;
  models: { name: ModelName; label: string; sizeMb: number }[];
  isDownloaded(model: ModelName): Promise<boolean>;
  /** Download (if needed) so transcription works offline later. */
  prepare(model: ModelName, onProgress: (p: Progress) => void): Promise<void>;
  deleteModel(model: ModelName): Promise<void>;
  transcribe(uri: string, model: ModelName, onProgress: (p: Progress) => void): Promise<TranscriptSegment[]>;
}

/** Language spoken in the recordings. */
export type SpeechLanguage = 'en' | 'bn';
export const SPEECH_LANGUAGES: SpeechLanguage[] = ['en', 'bn'];
/** The offline models are English-only (`*.en`); other languages need the cloud. */
export const OFFLINE_LANGUAGES: SpeechLanguage[] = ['en'];

/** openai: any OpenAI-compatible `/audio/transcriptions` (OpenAI, Groq). elevenlabs: ElevenLabs Scribe. */
export type CloudProvider = 'openai' | 'elevenlabs';

export interface CloudSettings {
  provider: CloudProvider;
  /** API root, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TranscriptionSettings {
  /** auto: cloud when online and a key is set, otherwise offline. */
  mode: 'auto' | 'local' | 'cloud';
  language: SpeechLanguage;
  model: ModelName;
  cloud: CloudSettings;
}

export const DEFAULT_SETTINGS: TranscriptionSettings = {
  mode: 'auto',
  language: 'en',
  model: 'base.en',
  cloud: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'whisper-1' },
};

/** Known providers offered as one-tap presets. */
export const CLOUD_PRESETS: { label: string; provider: CloudProvider; baseUrl: string; model: string }[] = [
  { label: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'whisper-1' },
  { label: 'Groq', provider: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
  // Far more accurate for Bangla in our tests (15% word errors against 82% for Whisper large-v3).
  { label: 'ElevenLabs Scribe', provider: 'elevenlabs', baseUrl: 'https://api.elevenlabs.io/v1', model: 'scribe_v2' },
];
