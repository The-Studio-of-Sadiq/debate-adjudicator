// Tries a cloud transcription provider on one recording, outside the app.
//
//   npm run transcribe:try -- path/to/speech.m4a
//
// Reads GROQ_API_KEY (and optionally GROQ_MODEL, TRANSCRIBE_LANGUAGE) from .env;
// copy .env.example to .env first. Prints the timestamped transcript.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const file = process.argv[2];
const key = process.env.GROQ_API_KEY;
const model = process.env.GROQ_MODEL || 'whisper-large-v3';
const language = process.env.TRANSCRIBE_LANGUAGE || 'bn';

if (!file) {
  console.error('Usage: npm run transcribe:try -- <audio file>');
  process.exit(1);
}
if (!key) {
  console.error('GROQ_API_KEY is empty. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const form = new FormData();
form.append('file', new Blob([readFileSync(file)]), basename(file));
form.append('model', model);
form.append('language', language);
form.append('response_format', 'verbose_json');

const started = Date.now();
const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}` },
  body: form,
});
if (!res.ok) {
  console.error(`Groq returned ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const result = await res.json();
for (const s of result.segments ?? []) console.log(`[${clock(s.start)}] ${s.text.trim()}`);
if (!result.segments) console.log(result.text);
console.error(`\n${model}, language ${language}: ${clock(result.duration ?? 0)} of audio in ${((Date.now() - started) / 1000).toFixed(1)} s`);
