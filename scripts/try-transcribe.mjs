// Tries a cloud transcription provider on one recording, outside the app.
//
//   npm run transcribe:try -- path/to/speech.m4a
//
// Reads the provider, language and key from .env (copy .env.example to .env
// first) and prints the timestamped transcript, grouped into lines the same
// way the app groups them.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { register } from 'node:module';

register('./resolve-ts.mjs', import.meta.url);
const { segmentsFromVerboseJson, segmentsFromWords } = await import('../packages/core/src/transcript.ts');

const file = process.argv[2];
const provider = process.env.TRANSCRIBE_PROVIDER || (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'groq');
const language = process.env.TRANSCRIBE_LANGUAGE || 'bn';

const PROVIDERS = {
  elevenlabs: {
    key: 'ELEVENLABS_API_KEY',
    model: process.env.ELEVENLABS_MODEL || 'scribe_v2',
    url: 'https://api.elevenlabs.io/v1/speech-to-text',
    headers: (key) => ({ 'xi-api-key': key }),
    fields: (model) => ({ model_id: model, language_code: language, timestamps_granularity: 'word', tag_audio_events: 'false' }),
    segments: (json) => (json.words?.length ? segmentsFromWords(json.words) : segmentsFromVerboseJson({ text: json.text })),
  },
  groq: {
    key: 'GROQ_API_KEY',
    model: process.env.GROQ_MODEL || 'whisper-large-v3',
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    fields: (model) => ({ model, language, response_format: 'verbose_json' }),
    segments: (json) => segmentsFromVerboseJson(json),
  },
};

const p = PROVIDERS[provider];
if (!file) {
  console.error('Usage: npm run transcribe:try -- <audio file>');
  process.exit(1);
}
if (!p) {
  console.error(`TRANSCRIBE_PROVIDER must be ${Object.keys(PROVIDERS).join(' or ')}, not "${provider}".`);
  process.exit(1);
}
const key = process.env[p.key];
if (!key) {
  console.error(`${p.key} is empty. Copy .env.example to .env and add your key.`);
  process.exit(1);
}

const form = new FormData();
form.append('file', new Blob([readFileSync(file)]), basename(file));
for (const [k, v] of Object.entries(p.fields(p.model))) form.append(k, v);

const started = Date.now();
const res = await fetch(p.url, { method: 'POST', headers: p.headers(key), body: form });
if (!res.ok) {
  console.error(`${provider} returned ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms / 1000) % 60)).padStart(2, '0')}`;
const segments = p.segments(await res.json());
for (const s of segments) console.log(`[${clock(s.startMs)}] ${s.text}`);
console.error(`\n${provider} ${p.model}, language ${language}: ${segments.length} lines in ${((Date.now() - started) / 1000).toFixed(1)} s`);
