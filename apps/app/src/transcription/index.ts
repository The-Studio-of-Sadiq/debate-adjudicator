import * as Network from 'expo-network';
import { cleanSegments, type TranscriptSegment } from '@debate/core';
import { transcribeCloud } from './cloud';
import { localEngine } from './local';
import { OFFLINE_LANGUAGES, type Progress, type TranscriptionSettings } from './types';

export { localEngine };
export * from './types';

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!(state.isInternetReachable ?? state.isConnected);
  } catch {
    return false;
  }
}

/** Whether the offline models can transcribe the chosen language (English only). */
export const offlineSupports = (settings: TranscriptionSettings) => OFFLINE_LANGUAGES.includes(settings.language);

/** Which engine `transcribeClip` will try first with these settings right now. */
export async function plannedEngine(settings: TranscriptionSettings): Promise<'cloud' | 'local'> {
  if (settings.mode === 'cloud') return 'cloud';
  // Other languages can only go to the cloud; offline would return English nonsense.
  if (settings.mode === 'auto' && !offlineSupports(settings)) return 'cloud';
  if (settings.mode === 'auto' && settings.cloud.apiKey && (await isOnline())) return 'cloud';
  return 'local';
}

/**
 * Transcribe one recording. In auto mode a failed cloud request falls back
 * to offline Whisper (English only), so a flaky connection never blocks the
 * adjudicator.
 */
export async function transcribeClip(
  uri: string,
  settings: TranscriptionSettings,
  onProgress: (p: Progress) => void,
): Promise<{ engine: string; segments: TranscriptSegment[] }> {
  if ((await plannedEngine(settings)) === 'cloud') {
    try {
      return { engine: `cloud:${settings.cloud.model}`, segments: await transcribeCloud(uri, settings.cloud, settings.language, onProgress) };
    } catch (e) {
      if (settings.mode === 'cloud' || !localEngine.available || !offlineSupports(settings)) throw e;
    }
  }
  if (!offlineSupports(settings)) throw new Error('transcription.offlineEnglishOnly');
  if (!localEngine.available) throw new Error(localEngine.unavailableReason ?? 'Offline transcription is not available');
  const raw = await localEngine.transcribe(uri, settings.model, onProgress);
  return { engine: `whisper-local:${settings.model}`, segments: cleanSegments(raw) };
}
