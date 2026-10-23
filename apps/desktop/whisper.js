// Offline transcription with Whisper (transformers.js on onnxruntime-node).
// Runs in the main process so a long transcription never freezes the UI.
// The renderer decodes audio (Chromium handles webm/m4a) and sends 16 kHz mono PCM.
const { app, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODELS = {
  'tiny.en': 'onnx-community/whisper-tiny.en',
  'base.en': 'onnx-community/whisper-base.en',
  'small.en': 'onnx-community/whisper-small.en',
};

const modelsDir = () => path.join(app.getPath('userData'), 'models');

let loaded = { name: null, pipe: null };

async function getPipeline(name, onProgress) {
  if (loaded.name === name && loaded.pipe) return loaded.pipe;
  const repo = MODELS[name];
  if (!repo) throw new Error(`Unknown model ${name}`);
  // transformers.js is ESM-only; import it by file URL from this CommonJS file.
  const { pipeline, env } = await import(pathToFileURL(require.resolve('@huggingface/transformers')).href);
  env.cacheDir = modelsDir();
  const pipe = pipeline('automatic-speech-recognition', repo, {
    dtype: 'q8',
    device: 'cpu',
    // Fires per file while downloading: { status: 'progress', file, loaded, total }.
    progress_callback: (p) => {
      if (p.status === 'progress' && p.total) onProgress({ stage: 'download', file: p.file, loaded: p.loaded, total: p.total });
    },
  });
  loaded = { name, pipe };
  pipe.catch(() => {
    if (loaded.pipe === pipe) loaded = { name: null, pipe: null };
  });
  return pipe;
}

function isDownloaded(name) {
  const repo = MODELS[name];
  return !!repo && fs.existsSync(path.join(modelsDir(), repo, 'onnx', 'encoder_model_quantized.onnx'));
}

function register() {
  ipcMain.handle('whisper:status', () =>
    Object.fromEntries(Object.keys(MODELS).map((name) => [name, { downloaded: isDownloaded(name) }])),
  );

  // Download (if needed) and load a model ahead of time.
  ipcMain.handle('whisper:prepare', async (e, jobId, model) => {
    await getPipeline(model, (p) => !e.sender.isDestroyed() && e.sender.send('whisper:progress', { jobId, ...p }));
  });

  ipcMain.handle('whisper:transcribe', async (e, jobId, model, pcm) => {
    const progress = (p) => !e.sender.isDestroyed() && e.sender.send('whisper:progress', { jobId, ...p });
    const asr = await getPipeline(model, progress);
    progress({ stage: 'transcribe' });
    const out = await asr(pcm, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
    return (out.chunks ?? []).map((c) => ({
      startMs: (c.timestamp[0] ?? 0) * 1000,
      endMs: (c.timestamp[1] ?? c.timestamp[0] ?? 0) * 1000,
      text: c.text,
    }));
  });

  ipcMain.handle('whisper:delete', async (_e, name) => {
    const repo = MODELS[name];
    if (!repo) return;
    if (loaded.name === name) loaded = { name: null, pipe: null };
    await fs.promises.rm(path.join(modelsDir(), repo), { recursive: true, force: true });
  });
}

module.exports = { register };
