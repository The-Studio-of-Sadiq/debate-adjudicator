// Starts a new translation of the app.
//   npm run i18n:new -- <code> "<native name>" "<English name>"
//   npm run i18n:new -- bn "বাংলা" "Bangla"
//   npm run i18n:new -- pt-BR "Português (Brasil)" "Portuguese (Brazil)"
// Creates apps/app/src/i18n/<code>.ts from the English dictionary (every
// value starts in English, ready to translate) and registers it in index.ts.
// `npm run check:i18n` then reports how much is translated.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'app', 'src', 'i18n');
const [code, nativeName, englishName] = process.argv.slice(2);

function fail(message) {
  console.error(`✖ ${message}\n\nUsage: npm run i18n:new -- <code> "<native name>" "<English name>"\n  e.g. npm run i18n:new -- bn "বাংলা" "Bangla"`);
  process.exit(1);
}

if (!code || !nativeName || !englishName) fail('Give a language code, its native name and its English name.');
// BCP 47: a 2–3 letter language, optionally a region ("pt-BR") or script ("zh-Hant").
if (!/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/.test(code)) fail(`"${code}" isn't a language code like "bn", "pt-BR" or "zh-Hant".`);
if (code === 'en') fail('English is the reference language; edit en.ts directly.');
const file = join(dir, `${code}.ts`);
if (existsSync(file)) fail(`${code}.ts already exists.`);

const ident = code.replace(/-/g, '_');
const en = readFileSync(join(dir, 'en.ts'), 'utf8');
const body = en.slice(en.indexOf('const en = {'));
if (!body.startsWith('const en = {')) fail('Could not find the dictionary in en.ts.');

const header = `/**
 * ${englishName} (${nativeName}) translation.
 *
 * Every value starts in English: replace it with the ${englishName} text.
 * - Keep the keys (left of the colon) exactly as they are.
 * - Keep {{placeholders}} such as {{time}} or {{count}}; you may move them.
 * - Plurals: keys ending in _one / _other follow your language's plural rules
 *   (https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html);
 *   add _zero, _two, _few or _many variants if your language needs them.
 * - To leave something in English for now, delete that line: it falls back to English.
 * Run \`npm run check:i18n\` to see how much is translated and catch mistakes.
 */
import type { LocaleDictionary } from './types';

`;
const dictionary = body
  .replace('const en = {', `const ${ident}: LocaleDictionary = {`)
  .replace(/export default en;\s*$/, `export default ${ident};\n`);
writeFileSync(file, header + dictionary);

// Register it in index.ts at the marker lines.
const indexFile = join(dir, 'index.ts');
let index = readFileSync(indexFile, 'utf8');
const importMarker = '// i18n:new adds imports above this line.';
const entryMarker = '  // i18n:new adds entries above this line.';
if (!index.includes(importMarker) || !index.includes(entryMarker)) fail('index.ts is missing the i18n:new marker comments.');
const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const key = /^[a-z]+$/.test(code) ? code : quote(code);
index = index
  .replace(importMarker, `import ${ident} from './${code}';\n${importMarker}`)
  .replace(entryMarker, `  ${key}: { name: ${quote(nativeName)}, englishName: ${quote(englishName)}, translation: ${ident} },\n${entryMarker}`);
writeFileSync(indexFile, index);

console.log(`✔ Created apps/app/src/i18n/${code}.ts and registered ${englishName} (${nativeName}).
Next:
  1. Translate the values in ${code}.ts.
  2. Run npm run check:i18n to see progress and catch mistakes.
  3. Pick ${nativeName} under Home → Language to see it in the app.`);
