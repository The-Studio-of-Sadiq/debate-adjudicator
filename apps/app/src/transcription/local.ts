import { makeId } from '../storage';
import type { LocalEngine, ModelName, Progress } from './types';

/** Exposed by apps/desktop/preload.js (Whisper runs in Electron's main process). */
type BridgeProgress = { jobId: string; stage: 'download' | 'transcribe'; loaded?: number; total?: number };
interface WhisperBridge {
  status(): Promise<Record<ModelName, { downloaded: boolean }>>;
  prepare(jobId: string, model: ModelName): Promise<void>;
  transcribe(jobId: string, model: ModelName, pcm: Float32Array): Promise<{ startMs: number; endMs: number; text: string }[]>;
  deleteModel(model: ModelName): Promise<void>;
  onProgress(cb: (p: BridgeProgress) => void): () => void;
}

const bridge = (globalThis as { debateWhisper?: WhisperBridge }).debateWhisper;

/** Chromium decodes webm and m4a; an OfflineAudioContext at 16 kHz resamples for us. */
async function decodeTo16kMono(uri: string): Promise<Float32Array> {
  const bytes = await (await fetch(uri)).arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 16000);
  const audio = await ctx.decodeAudioData(bytes);
  if (audio.numberOfChannels === 1) return audio.getChannelData(0).slice();
  const mono = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const data = audio.getChannelData(c);
    for (let i = 0; i < data.length; i++) mono[i]! += data[i]! / audio.numberOfChannels;
  }
  return mono;
}

function withProgress<T>(onProgress: (p: Progress) => void, run: (jobId: string) => Promise<T>): Promise<T> {
  const jobId = makeId();
  // A model is several files; add them up so the bar moves once, not per file.
  const files = new Map<string, { loaded: number; total: number }>();
  const off = bridge!.onProgress((p) => {
    if (p.jobId !== jobId) return;
    if (p.stage === 'download' && p.total) {
      files.set(String((p as { file?: string }).file ?? ''), { loaded: p.loaded ?? 0, total: p.total });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      onProgress({ stage: 'download', loaded, total });
    } else if (p.stage === 'transcribe') onProgress({ stage: 'transcribe' });
  });
  return run(jobId).finally(off);
}

export const localEngine: LocalEngine = bridge
  ? {
      available: true,
      models: [
        { name: 'tiny.en', label: 'Tiny (fastest)', sizeMb: 40 },
        { name: 'base.en', label: 'Base (recommended)', sizeMb: 76 },
        { name: 'small.en', label: 'Small (most accurate)', sizeMb: 250 },
      ],
      isDownloaded: async (model) => (await bridge.status())[model]?.downloaded ?? false,
      prepare: (model, onProgress) => withProgress(onProgress, (jobId) => bridge.prepare(jobId, model)),
      deleteModel: (model) => bridge.deleteModel(model),
      async transcribe(uri, model, onProgress) {
        onProgress({ stage: 'decode' });
        const pcm = await decodeTo16kMono(uri);
        return withProgress(onProgress, (jobId) => bridge.transcribe(jobId, model, pcm));
      },
    }
  : {
      available: false,
      unavailableReason: 'transcription.unavailableBrowser',
      models: [],
      isDownloaded: async () => false,
      prepare: () => Promise.reject(new Error('transcription.unavailableBrowser')),
      deleteModel: async () => {},
      transcribe: () => Promise.reject(new Error('transcription.unavailableBrowser')),
    };
