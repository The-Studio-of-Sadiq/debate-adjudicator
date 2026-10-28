// Frames the raw app captures in docs/store/play/captures/ (1116×2040, a
// 372×680 window at 3×) as captioned 1080×1920 Google Play phone screenshots
// in docs/store/play/phone/.
// Run after replacing a capture: npm run store:screenshots
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => join(root, ...p);

const font = (file) => {
  const buf = readFileSync(at('node_modules', '@expo-google-fonts', file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const serif = font('instrument-serif/400Regular/InstrumentSerif_400Regular.ttf');
const interMedium = font('inter/500Medium/Inter_500Medium.ttf');

/** Text centred on x = W/2, as an SVG path (laid out per character, like brand-assets.mjs). */
function centred(f, text, baseline, size) {
  const chars = [...text];
  const width = chars.reduce((w, ch) => w + f.getAdvanceWidth(ch, size), 0);
  let cursor = (W - width) / 2;
  const parts = [];
  // Serialised by hand: opentype's toPathData(2) emits NaN for some coordinates.
  const n = (v) => v.toFixed(2);
  for (const ch of chars) {
    for (const c of f.getPath(ch, cursor, baseline, size).commands) {
      if (c.type === 'Z') parts.push('Z');
      else if (c.type === 'Q') parts.push(`Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`);
      else if (c.type === 'C') parts.push(`C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`);
      else parts.push(`${c.type}${n(c.x)} ${n(c.y)}`);
    }
    cursor += f.getAdvanceWidth(ch, size);
  }
  return parts.join('');
}

const W = 1080;
const H = 1920;
const SHOT_W = 920;
const SHOT_Y = 410;
const RADIUS = 44;

// Order is the order on the store page.
const SHOTS = [
  { capture: 'timer-poi', title: 'Run the room from one phone', sub: 'Timer, phases and bells for 49 formats', dark: true },
  { capture: 'debater-poi', title: 'POIs from the benches', sub: "Debaters' phones stay in sync with the chair", dark: false },
  { capture: 'lobby-request', title: 'Join with a QR code', sub: 'Local Wi-Fi or a hotspot. No accounts.', dark: true },
  { capture: 'ballot', title: 'Ballots that add up', sub: 'Ranks worked out from speaker scores', dark: true },
  { capture: 'review', title: 'Notes, ballot, PDF report', sub: "Everything stays on the chair's device", dark: true },
  { capture: 'formats', title: 'BP, UADC, WSDC and more', sub: '49 formats, every bell editable', dark: true },
];

mkdirSync(at('docs/store/play/phone'), { recursive: true });
for (const [i, s] of SHOTS.entries()) {
  const bg = s.dark ? '#000000' : '#ffffff';
  const fg = s.dark ? '#ffffff' : '#000000';
  const muted = s.dark ? '#9a9a9a' : '#5c5c5c';
  const edge = s.dark ? '#333333' : '#d0d0d0';

  const shotH = H - SHOT_Y + RADIUS; // runs off the bottom edge
  const resized = await sharp(at('docs/store/play/captures', `${s.capture}.png`))
    .resize({ width: SHOT_W })
    .extract({ left: 0, top: 0, width: SHOT_W, height: shotH })
    .toBuffer();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_W}" height="${shotH}"><rect width="${SHOT_W}" height="${shotH}" rx="${RADIUS}" fill="#fff"/></svg>`,
  );
  const rounded = await sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();

  const x = (W - SHOT_W) / 2;
  const frame = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="${bg}"/>
      <path d="${centred(serif, s.title, 212, 92)}" fill="${fg}"/>
      <path d="${centred(interMedium, s.sub, 300, 38)}" fill="${muted}"/>
      <rect x="${x - 3}" y="${SHOT_Y - 3}" width="${SHOT_W + 6}" height="${shotH + 6}" rx="${RADIUS + 3}" fill="${edge}"/>
    </svg>`,
  );
  const file = at('docs/store/play/phone', `${i + 1}-${s.capture}.png`);
  await sharp(frame).composite([{ input: rounded, left: x, top: SHOT_Y }]).png().toFile(file);
  console.log(`  ${file.replace(root, '').replace(/\\/g, '/')}`);
}
