import { Directory, File, Paths } from 'expo-file-system';
// The package's exports map only covers subpaths, so import its index explicitly.
import { initWhisper, type WhisperContext } from 'whisper.rn/index';
import AudioDecoder from '../../modules/audio-decoder';
import { makeId } from '../storage';
import type { LocalEngine, ModelName, Progress } from './types';

// Quantized whisper.cpp models from the official repository.
const MODEL_FILES: Record<ModelName, string> = {
  'tiny.en': 'ggml-tiny.en-q5_1.bin',
  'base.en': 'ggml-base.en-q5_1.bin',
  'small.en': 'ggml-small.en-q5_1.bin',
};
const MODEL_URL = (file: string) => `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${file}`;
/** Anything smaller is a failed or partial download. */
const MIN_MODEL_BYTES = 10 * 1024 * 1024;

const modelsDir = () => {
  const dir = new Directory(Paths.document, 'models');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
};
const modelFile = (model: ModelName) => new File(modelsDir(), MODEL_FILES[model]);

let loaded: { model: ModelName; ctx: Promise<WhisperContext> } | null = null;

async function download(model: ModelName, onProgress: (p: Progress) => void) {
  const target = modelFile(model);
  if (target.exists && target.size > MIN_MODEL_BYTES) return;
  // Download beside the target and move it in place only when complete.
  const part = new File(modelsDir(), `${MODEL_FILES[model]}.part`);
  if (part.exists) part.delete();
  const task = File.createDownloadTask(MODEL_URL(MODEL_FILES[model]), part, {
    onProgress: ({ bytesWritten, totalBytes }) => onProgress({ stage: 'download', loaded: bytesWritten, total: totalBytes }),
  });
  const done = await task.downloadAsync();
  if (!done || done.size < MIN_MODEL_BYTES) throw new Error('transcription.downloadFailed');
  if (target.exists) target.delete();
  done.move(target);
}

async function context(model: ModelName, onProgress: (p: Progress) => void): Promise<WhisperContext> {
  if (loaded?.model === model) return loaded.ctx;
  if (loaded) void (await loaded.ctx.catch(() => null))?.release();
  const ctx = (async () => {
    await download(model, onProgress);
    return initWhisper({ filePath: modelFile(model).uri });
  })();
  loaded = { model, ctx };
  ctx.catch(() => {
    if (loaded?.ctx === ctx) loaded = null;
  });
  return ctx;
}

export const localEngine: LocalEngine = AudioDecoder
  ? {
      available: true,
      models: [
        { name: 'tiny.en', label: 'Tiny (fastest)', sizeMb: 31 },
        { name: 'base.en', label: 'Base (recommended)', sizeMb: 57 },
        { name: 'small.en', label: 'Small (most accurate, slow)', sizeMb: 181 },
      ],
      isDownloaded: async (model) => {
        const f = modelFile(model);
        return f.exists && f.size > MIN_MODEL_BYTES;
      },
      prepare: async (model, onProgress) => {
        await context(model, onProgress);
      },
      deleteModel: async (model) => {
        if (loaded?.model === model) {
          void (await loaded.ctx.catch(() => null))?.release();
          loaded = null;
        }
        const f = modelFile(model);
        if (f.exists) f.delete();
      },
      async transcribe(uri, model, onProgress) {
        const whisper = await context(model, onProgress);
        onProgress({ stage: 'decode' });
        const wav = new File(Paths.cache, `whisper-${makeId()}.wav`);
        try {
          await AudioDecoder!.decodeToWav16k(uri, wav.uri);
          onProgress({ stage: 'transcribe', percent: 0 });
          const { promise } = whisper.transcribe(wav.uri, {
            language: 'en',
            onProgress: (percent) => onProgress({ stage: 'transcribe', percent }),
          });
          const result = await promise;
          // whisper.cpp reports segment times in 10 ms units.
          return result.segments.map((s) => ({ startMs: s.t0 * 10, endMs: s.t1 * 10, text: s.text }));
        } finally {
          if (wav.exists) wav.delete();
        }
      },
    }
  : {
      available: false,
      unavailableReason: 'transcription.unavailableBuild',
      models: [],
      isDownloaded: async () => false,
      prepare: () => Promise.reject(new Error('transcription.unavailableBuild')),
      deleteModel: async () => {},
      transcribe: () => Promise.reject(new Error('transcription.unavailableBuild')),
    };
