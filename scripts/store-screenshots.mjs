// Frames the raw app captures as captioned Google Play screenshots:
//   captures/ (1116×2040, a 372×680 window at 3×)         → phone/ at 1080×1920
//   captures-tablet/ (2560×1440, a 1280×720 window at 2×) → tablet-10/ at 2560×1440
//                                                           and tablet-7/ at 1920×1080
//   captures-desktop/ (2560×1440, a 1600×900 window at 1.6×) → desktop/ at 2560×1440
// (all under docs/store/play/). Run after replacing a capture: npm run store:screenshots
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

/** Text centred on x = frameW/2, as an SVG path. */
function centred(f, text, baseline, size, frameW = W) {
  const width = [...text].reduce((w, ch) => w + f.getAdvanceWidth(ch, size), 0);
  return title(f, text, (frameW - width) / 2, baseline, size);
}

/** Text starting at x, as an SVG path (laid out per character, like brand-assets.mjs). */
function title(f, text, x, baseline, size) {
  const chars = [...text];
  let cursor = x;
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

// ── Tablets: the whole capture inside a tablet bezel, under the caption ──
const TW = 2560;
const TH = 1440;
const SCREEN_W = 1792; // 16:9 in whole pixels: 1792×1008
const SCREEN_H = (SCREEN_W * 9) / 16;
const SCREEN_Y = 370;
const BEZEL = 26;
const TABLET_TITLES = { 'timer-poi': 'Run the room from one tablet' };

mkdirSync(at('docs/store/play/tablet-10'), { recursive: true });
mkdirSync(at('docs/store/play/tablet-7'), { recursive: true });
for (const [i, s] of SHOTS.entries()) {
  const bg = s.dark ? '#000000' : '#ffffff';
  const fg = s.dark ? '#ffffff' : '#000000';
  const muted = s.dark ? '#9a9a9a' : '#5c5c5c';
  const body = s.dark ? '#161616' : '#ececec';
  const edge = s.dark ? '#3a3a3a' : '#cfcfcf';

  const r = 18;
  const screen = await sharp(at('docs/store/play/captures-tablet', `${s.capture}.png`))
    .resize({ width: SCREEN_W, height: SCREEN_H })
    .composite([{
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SCREEN_W}" height="${SCREEN_H}"><rect width="${SCREEN_W}" height="${SCREEN_H}" rx="${r}" fill="#fff"/></svg>`),
      blend: 'dest-in',
    }])
    .png()
    .toBuffer();

  const x = (TW - SCREEN_W) / 2;
  const frame = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}">
      <rect width="${TW}" height="${TH}" fill="${bg}"/>
      <path d="${centred(serif, TABLET_TITLES[s.capture] || s.title, 200, 118, TW)}" fill="${fg}"/>
      <path d="${centred(interMedium, s.sub, 290, 48, TW)}" fill="${muted}"/>
      <rect x="${x - BEZEL}" y="${SCREEN_Y - BEZEL}" width="${SCREEN_W + 2 * BEZEL}" height="${SCREEN_H + 2 * BEZEL}"
        rx="${r + BEZEL}" fill="${body}" stroke="${edge}" stroke-width="3"/>
    </svg>`,
  );
  const name = `${i + 1}-${s.capture}.png`;
  const big = await sharp(frame).composite([{ input: screen, left: x, top: SCREEN_Y }]).png().toBuffer();
  for (const [dir, w, h] of [['tablet-10', TW, TH], ['tablet-7', 1920, 1080]]) {
    const file = at('docs/store/play', dir, name);
    await sharp(big).resize(w, h).png().toFile(file);
    console.log(`  ${file.replace(root, '').replace(/\\/g, '/')}`);
  }
}

// ── Desktop: the capture in an app window (title bar with the mark, the
// name and window controls), under the caption ──
const WIN_W = 1760; // content, 16:9: 1760×990
const WIN_H = (WIN_W * 9) / 16;
const BAR = 48;
const WIN_Y = 372;
const DESKTOP_TITLES = { 'timer-poi': 'Run the room from your laptop' };
// The mark on its 64-unit grid (keep in sync with brand-assets.mjs).
const markPath = (color, x, y, s) =>
  `<g transform="translate(${x} ${y}) scale(${s}) translate(-8 -12)">
    <rect x="8" y="12" width="14" height="40" rx="3" fill="${color}"/>
    <rect x="43.7" y="13.7" width="10.6" height="36.6" rx="2.15" fill="none" stroke="${color}" stroke-width="3.4"/>
    <path d="M25 12h14v3a7 7 0 0 1-14 0z" fill="${color}"/>
  </g>`;

mkdirSync(at('docs/store/play/desktop'), { recursive: true });
for (const [i, s] of SHOTS.entries()) {
  const bg = s.dark ? '#000000' : '#ffffff';
  const fg = s.dark ? '#ffffff' : '#000000';
  const muted = s.dark ? '#9a9a9a' : '#5c5c5c';
  const bar = s.dark ? '#1c1c1c' : '#f0f0f0';
  const edge = s.dark ? '#3a3a3a' : '#cfcfcf';

  const content = await sharp(at('docs/store/play/captures-desktop', `${s.capture}.png`))
    .resize({ width: WIN_W, height: WIN_H })
    .png()
    .toBuffer();
  const x = (TW - WIN_W) / 2;
  const top = WIN_Y - BAR;
  const r = 14;
  const cy = top + BAR / 2;
  const right = x + WIN_W;
  const frame = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}">
      <rect width="${TW}" height="${TH}" fill="${bg}"/>
      <path d="${centred(serif, DESKTOP_TITLES[s.capture] || s.title, 196, 118, TW)}" fill="${fg}"/>
      <path d="${centred(interMedium, s.sub, 284, 48, TW)}" fill="${muted}"/>
      <rect x="${x - 2}" y="${top - 2}" width="${WIN_W + 4}" height="${WIN_H + BAR + 4}" rx="${r + 2}" fill="${edge}"/>
      <rect x="${x}" y="${top}" width="${WIN_W}" height="${WIN_H + BAR}" rx="${r}" fill="${bar}"/>
      ${markPath(fg, x + 20, cy - 9, 18 / 40)}
      <path d="${title(interMedium, 'Debate Adjudicator', x + 58, cy + 8, 22)}" fill="${fg}"/>
      <g stroke="${fg}" stroke-width="1.6" fill="none">
        <path d="M${right - 150} ${cy}h14"/>
        <rect x="${right - 98}" y="${cy - 7}" width="14" height="14"/>
        <path d="M${right - 38} ${cy - 7}l14 14M${right - 24} ${cy - 7}l-14 14"/>
      </g>
    </svg>`,
  );
  const file = at('docs/store/play/desktop', `${i + 1}-${s.capture}.png`);
  await sharp(frame).composite([{ input: content, left: x, top: WIN_Y }]).png().toFile(file);
  console.log(`  ${file.replace(root, '').replace(/\\/g, '/')}`);
}
