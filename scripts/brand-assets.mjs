// Generates every brand asset from the mark's geometry and the brand fonts:
//   docs/brand/*.svg          logo mark and lockups (text outlined, no fonts needed)
//   apps/app/assets/*.png     app icon, Android adaptive icon layers, splash, favicon
//   apps/desktop/icon.png     Windows window/taskbar icon
// Run after changing the mark: npm run brand
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => join(root, ...p);

/**
 * "The House", seen from above: Government's bench (solid) and Opposition's
 * bench (open) face each other across the floor, with the Speaker's chair at
 * its head. Drawn on a 64-unit grid; keep in sync with apps/app/src/Logo.tsx.
 */
export const STROKE = 3.4;
export function markShapes(color) {
  const s = STROKE;
  return [
    `<rect x="8" y="12" width="14" height="40" rx="3" fill="${color}"/>`,
    `<rect x="${42 + s / 2}" y="${12 + s / 2}" width="${14 - s}" height="${40 - s}" rx="${3 - s / 4}" fill="none" stroke="${color}" stroke-width="${s}"/>`,
    `<path d="M25 12h14v3a7 7 0 0 1-14 0z" fill="${color}"/>`,
  ].join('');
}
// The mark's own bounding box inside the 64 grid.
const BOX = { x: 8, y: 12, w: 48, h: 40 };

const svgDoc = (w, h, body, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>`;

const font = (file) => {
  const buf = readFileSync(at('node_modules', '@expo-google-fonts', file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const inter = font('inter/700Bold/Inter_700Bold.ttf');
const serif = font('instrument-serif/400Regular/InstrumentSerif_400Regular.ttf');

/** Text as an SVG path, with optional tracking (in em). Returns { d, width }. */
function textPath(f, text, x, baseline, size, tracking = 0) {
  let cursor = x;
  const parts = [];
  for (const ch of text) {
    parts.push(f.getPath(ch, cursor, baseline, size).toPathData(2));
    cursor += f.getAdvanceWidth(ch, size) + tracking * size;
  }
  return { d: parts.join(''), width: cursor - x - tracking * size };
}

// ── Lockup: mark + "DEBATE" eyebrow + "Adjudicator" in Instrument Serif ──
function lockup(color) {
  const markH = 40;
  const scale = markH / BOX.h;
  const markW = BOX.w * scale;
  const gap = 14;
  const tx = markW + gap;
  const eyebrow = textPath(inter, 'DEBATE', tx + 1, 9.5, 8.5, 0.32);
  const name = textPath(serif, 'Adjudicator', tx, 40, 38);
  const width = Math.ceil(tx + Math.max(eyebrow.width, name.width) + 2);
  const height = 50; // room for the descender of "j"
  const body = `
    <g transform="translate(0 0) scale(${scale}) translate(${-BOX.x} ${-BOX.y})">${markShapes(color)}</g>
    <path d="${eyebrow.d}" fill="${color}"/>
    <path d="${name.d}" fill="${color}"/>`;
  return svgDoc(width * 4, height * 4, body, `0 0 ${width} ${height}`);
}

// ── Icons ──
const markOnly = (color, size, fraction) => {
  // Place the mark's bounding box so its larger side fills `fraction` of the canvas.
  const scale = (size * fraction) / Math.max(BOX.w, BOX.h);
  const ox = (size - BOX.w * scale) / 2 - BOX.x * scale;
  const oy = (size - BOX.h * scale) / 2 - BOX.y * scale;
  return `<g transform="translate(${ox} ${oy}) scale(${scale})">${markShapes(color)}</g>`;
};
const square = (size, bg, fg, fraction, radius = 0) =>
  svgDoc(size, size, `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>${markOnly(fg, size, fraction)}`);
const transparent = (size, fg, fraction) => svgDoc(size, size, markOnly(fg, size, fraction));

async function png(svg, file) {
  mkdirSync(dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log(`  ${file.replace(root, '').replace(/\\/g, '/')}`);
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  console.log(`  ${file.replace(root, '').replace(/\\/g, '/')}`);
}

console.log('Brand SVGs');
write(at('docs/brand/mark.svg'), svgDoc(64, 64, markShapes('#000000')));
write(at('docs/brand/mark-white.svg'), svgDoc(64, 64, markShapes('#ffffff')));
write(at('docs/brand/lockup.svg'), lockup('#000000'));
write(at('docs/brand/lockup-white.svg'), lockup('#ffffff'));

console.log('App icons');
// App icon (iOS/store/legacy Android): white mark on black, full bleed.
await png(square(1024, '#000000', '#ffffff', 0.56), at('apps/app/assets/icon.png'));
// Android adaptive icon: the mark must sit inside the central 66% safe zone.
await png(transparent(1024, '#ffffff', 0.42), at('apps/app/assets/android-icon-foreground.png'));
await png(svgDoc(1024, 1024, '<rect width="1024" height="1024" fill="#000000"/>'), at('apps/app/assets/android-icon-background.png'));
// Themed (monochrome) icon: Android tints the alpha shape itself.
await png(transparent(432, '#ffffff', 0.42), at('apps/app/assets/android-icon-monochrome.png'));
// Splash: black mark for the light splash, white mark for the dark one.
await png(transparent(1024, '#000000', 0.9), at('apps/app/assets/splash-icon.png'));
await png(transparent(1024, '#ffffff', 0.9), at('apps/app/assets/splash-icon-dark.png'));
// Browser tab: a rounded black tile reads on light and dark tab bars.
await png(square(48, '#000000', '#ffffff', 0.62, 10), at('apps/app/assets/favicon.png'));

console.log('Windows icon');
await png(square(512, '#000000', '#ffffff', 0.56, 96), at('apps/desktop/icon.png'));
