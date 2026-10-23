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
  unavailableReason?: string;
  models: { name: ModelName; label: string; sizeMb: number }[];
  isDownloaded(model: ModelName): Promise<boolean>;
  /** Download (if needed) so transcription works offline later. */
  prepare(model: ModelName, onProgress: (p: Progress) => void): Promise<void>;
  deleteModel(model: ModelName): Promise<void>;
  transcribe(uri: string, model: ModelName, onProgress: (p: Progress) => void): Promise<TranscriptSegment[]>;
}

export interface CloudSettings {
  /** OpenAI-compatible API root, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TranscriptionSettings {
  /** auto: cloud when online and a key is set, otherwise offline. */
  mode: 'auto' | 'local' | 'cloud';
  model: ModelName;
  cloud: CloudSettings;
}

export const DEFAULT_SETTINGS: TranscriptionSettings = {
  mode: 'auto',
  model: 'base.en',
  cloud: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'whisper-1' },
};

/** Known OpenAI-compatible providers offered as one-tap presets. */
export const CLOUD_PRESETS: { label: string; baseUrl: string; model: string }[] = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'whisper-1' },
  { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
];
