// Fails if the code uses a translation key that isn't in the English dictionary.
// Static keys (t('a.b')) are checked exactly; template keys (t(`a.${x}`)) are
// checked by their static prefix. Run: npm run check:i18n -w app
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { default: en } = await import(new URL('../src/i18n/en.ts', import.meta.url).href);

const keys = new Set();
(function walk(obj, prefix) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      keys.add(key);
      // i18next plural forms: "x_one"/"x_other" are used as t('x', { count }).
      const plural = key.match(/^(.*)_(zero|one|two|few|many|other)$/);
      if (plural) keys.add(plural[1]);
    } else walk(v, key);
  }
})(en, '');

const files = [];
(function collect(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p);
    else if (/\.(tsx?|ts)$/.test(name) && !p.includes(`${join('src', 'i18n')}`)) files.push(p);
  }
})(join(root, 'src'));
files.push(join(root, 'App.tsx'));

const problems = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  // t('key' / t("key" — also the `t(cond ? 'a' : 'b')` form via the quoted-literal scan below.
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z][\w.-]*)'/g)) if (!keys.has(m[1])) problems.push(`${relative(root, file)}: missing key "${m[1]}"`);
  for (const m of src.matchAll(/\bt\(\s*`([a-zA-Z][\w.-]*)\$\{/g)) {
    const prefix = m[1];
    if (![...keys].some((k) => k.startsWith(prefix))) problems.push(`${relative(root, file)}: no keys under "${prefix}…"`);
  }
  // Keys chosen by a ternary or passed around as values: 'section.key' literals that look like ours.
  for (const m of src.matchAll(/'((?:common|timer|notes|interruptions|lobby|join|client|net|review|transcription|ballot|report|home|bells|language)\.[\w.-]+)'/g)) {
    if (!keys.has(m[1])) problems.push(`${relative(root, file)}: missing key "${m[1]}"`);
  }
}

if (problems.length) {
  console.error([...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log(`i18n OK: ${keys.size} keys, ${files.length} files checked`);
