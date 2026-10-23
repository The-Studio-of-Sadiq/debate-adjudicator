// Translation checks. Run: npm run check:i18n
// 1. Code: every t('…') key used in the app exists in the English dictionary.
//    Static keys (t('a.b')) are checked exactly; template keys (t(`a.${x}`))
//    by their static prefix.
// 2. Languages: for every other dictionary in src/i18n, fails on keys that
//    English doesn't have and on placeholders English doesn't use; warns when
//    a placeholder is dropped; reports how much is translated.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const i18nDir = join(root, 'src', 'i18n');
const { default: en } = await import(pathToFileURL(join(i18nDir, 'en.ts')).href);

const PLURAL = /_(zero|one|two|few|many|other)$/;

/** Flatten { a: { b: 'x' } } into Map { 'a.b' => 'x' }. */
function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else if (v && typeof v === 'object') flatten(v, key, out);
  }
  return out;
}
const placeholders = (s) => new Set([...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]));

const enFlat = flatten(en);
const keys = new Set(enFlat.keys());
// i18next plural forms: "x_one"/"x_other" are used as t('x', { count }).
for (const k of enFlat.keys()) if (PLURAL.test(k)) keys.add(k.replace(PLURAL, ''));

// ── 1. Keys used in code ──
const files = [];
(function collect(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p);
    else if (/\.tsx?$/.test(name) && !p.startsWith(i18nDir)) files.push(p);
  }
})(join(root, 'src'));
files.push(join(root, 'App.tsx'));

const problems = [];
const warnings = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const where = relative(root, file);
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z][\w.-]*)'/g)) if (!keys.has(m[1])) problems.push(`${where}: missing key "${m[1]}"`);
  for (const m of src.matchAll(/\bt\(\s*`([a-zA-Z][\w.-]*)\$\{/g)) {
    if (![...keys].some((k) => k.startsWith(m[1]))) problems.push(`${where}: no keys under "${m[1]}…"`);
  }
  // Keys chosen by a ternary or passed around as values: 'section.key' literals that look like ours.
  const sections = Object.keys(en).join('|');
  for (const m of src.matchAll(new RegExp(`'((?:${sections})\\.[\\w.-]+)'`, 'g'))) {
    if (!keys.has(m[1])) problems.push(`${where}: missing key "${m[1]}"`);
  }
}

// ── 2. Other languages ──
const report = [];
const locales = readdirSync(i18nDir).filter((f) => /^[a-z]{2,3}(-[A-Za-z]+)*\.ts$/.test(f) && f !== 'en.ts');
for (const f of locales) {
  const code = f.replace(/\.ts$/, '');
  const { default: dict } = await import(pathToFileURL(join(i18nDir, f)).href);
  const flat = flatten(dict ?? {});
  let translated = 0;
  for (const [key, value] of flat) {
    const base = key.replace(PLURAL, '');
    // A language may add plural forms English lacks (e.g. _few); compare them with English's _other.
    const reference = enFlat.get(key) ?? enFlat.get(`${base}_other`) ?? enFlat.get(base);
    if (reference === undefined) {
      problems.push(`${f}: "${key}" isn't in English (typo, or a key that was removed?)`);
      continue;
    }
    const want = placeholders(reference);
    const have = placeholders(value);
    for (const p of have) if (!want.has(p)) problems.push(`${f}: "${key}" uses {{${p}}}, which English doesn't have`);
    for (const p of want) if (!have.has(p) && p !== 'count') warnings.push(`${f}: "${key}" drops {{${p}}}`);
    if (!value.trim()) problems.push(`${f}: "${key}" is empty (delete the line to fall back to English)`);
    if (enFlat.has(key) && value !== reference) translated++;
  }
  const total = enFlat.size;
  const pct = Math.floor((translated / total) * 100);
  report.push(`${code}: ${translated}/${total} strings translated (${pct}%)`);
}

if (warnings.length) console.warn(['Warnings:', ...new Set(warnings)].join('\n  '));
if (report.length) console.log(['Languages:', ...report].join('\n  '));
if (problems.length) {
  console.error(['Problems:', ...new Set(problems)].join('\n  '));
  process.exit(1);
}
console.log(`i18n OK: ${keys.size} keys, ${files.length} files, ${locales.length + 1} language(s)`);
