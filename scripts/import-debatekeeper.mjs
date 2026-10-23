// Converts the Debatekeeper format library (MIT, https://github.com/czlee/debatekeeper-formats)
// into format definitions: packages/core/src/formats/debatekeeper.ts.
//
//   npm run formats:import                 # download the current library
//   npm run formats:import -- --from dir   # or read XML files from a folder
//
// Debatekeeper describes timing only, so the script also works out sides, role
// codes, teams and scoring. Formats it can't represent are listed, with the
// reason, at the top of the generated file.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const INDEX = 'https://formats.debatekeeper.czlee.nz/v1/formats.json';
const OUT = new URL('../packages/core/src/formats/debatekeeper.ts', import.meta.url);

const LICENSE = `MIT License

Copyright (c) 2021 Chuan-Zheng Lee and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

// Formats we leave out on purpose. Others are left out automatically when a
// speech belongs to neither side.
const SKIP = {
  'bp.xml': 'same as the built-in British Parliamentary',
  'asian.xml': 'same as the built-in UADC 7-7-7-4',
  'worldschools.xml': 'same as the built-in World Schools (WSDC)',
  'wsdc-prep.xml': 'has timed preparation breaks between speeches, which the timer has no slot for',
};

// Side words in speech names: [pattern, side, side name, team id].
const SIDE_WORDS = [
  [/affirmative/i, 'gov', 'Affirmative', 'AFF'],
  [/negative/i, 'opp', 'Negative', 'NEG'],
  [/proposition/i, 'gov', 'Proposition', 'PROP'],
  [/opposition/i, 'opp', 'Opposition', 'OPP'],
  [/government|minister/i, 'gov', 'Government', 'GOV'],
  [/^pro\b/i, 'gov', 'Pro', 'PRO'],
  [/^contra\b/i, 'opp', 'Contra', 'CON'],
  [/in favour/i, 'gov', 'In favour', 'FOR'],
  [/^against\b/i, 'opp', 'Against', 'AGST'],
];

const BP_ROLES = ['PM', 'LO', 'DPM', 'DLO', 'MG', 'MO', 'GW', 'OW'];

// Bell-settings group names for formats with more than substantives and replies.
const KINDS = {
  'pm-const': 'PM constructive',
  'leader-opp': 'Leader of the Opposition',
  'lo-rebuttal': 'LO rebuttal',
  'pm-rebuttal': 'PM rebuttal',
};
const PLAIN_KINDS = new Set(['all', 'speech', 'regular', 'substantive', 'team', 'reply']);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  isArray: (n) => ['speech', 'speech-type', 'bell', 'period-type', 'name', 'info', 'region', 'level', 'used-at', 'description', 'short-name'].includes(n),
});
const text = (v) => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : (v['#text'] ?? ''));
/** The English (or untagged) entry of a translated element. */
const english = (arr) => {
  if (!arr?.length) return undefined;
  return arr.find((x) => typeof x !== 'object' || !x['@xml:lang'] || x['@xml:lang'] === 'en') ?? arr[0];
};
const list = (arr) => (arr ?? []).map(text).filter(Boolean).join(', ') || undefined;
const seconds = (mmss) => {
  const [m, s] = mmss.split(':').map(Number);
  return m * 60 + s;
};

function minutesLeft(sec) {
  if (sec % 60 === 0) return `${sec / 60} minute${sec === 60 ? '' : 's'} left`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} left`;
}

/** One Debatekeeper speech type → our timing for every speech of that type. */
function convertType(t) {
  const length = seconds(t['@length']);
  const raw = (t.bell ?? []).map((b) => ({
    at: b['@time'] === 'finish' ? length : seconds(b['@time']),
    number: Number(b['@number'] ?? 1),
    next: b['@next-period'],
  }));
  // NSW-style allowances: a double bell when time is up, then a long ring when
  // the allowance runs out. Time-up is the double bell; the allowance is grace.
  const finish = raw.find((b) => b.at === length);
  const early = raw.find((b) => b.at < length && b.number === 2);
  const time = finish && finish.number > 2 && early ? early.at : length;

  let poiWindow = null;
  const open = raw.findIndex((b) => b.next === 'pois-allowed');
  if (open >= 0) poiWindow = { from: raw[open].at, to: raw[open + 1]?.at ?? time };
  if (t['@first-period'] === 'pois-allowed') poiWindow = { from: 0, to: raw[0]?.at ?? time };

  const bells = [];
  raw.forEach((b, i) => {
    if (b.number === 0) return; // a silent change of period, not a bell
    const pattern = b.number === 1 ? 'single' : b.number === 2 ? 'double' : b.number === 3 ? 'triple' : 'continuous';
    const label =
      b.next === 'pois-allowed' ? 'POIs open'
      : i > 0 && raw[i - 1].next === 'pois-allowed' && b.at < time ? 'POIs closed'
      : b.at === time ? 'Time'
      : b.at > time ? 'Grace over'
      : minutesLeft(time - b.at);
    // Two bells at the same moment: keep the later (louder) one.
    if (bells.at(-1)?.at === b.at) bells.pop();
    bells.push({ at: b.at, pattern, label });
  });
  return { durationSec: time, graceSec: length - time, poiWindow, bells };
}

const ORDINALS = { '1st': 1, first: 1, '2nd': 2, second: 2, '3rd': 3, third: 3, '4th': 4, fourth: 4, '5th': 5, fifth: 5 };
const STOP = new Set(['of', 'the', 'for', 'team', 'speaker', 'speech', 'and']);

/** "1st Affirmative" → "A1", "Prime Minister's Rebuttal" → "PMR". */
const SIDE_LETTERS = { affirmative: 'A', negative: 'N', proposition: 'P', opposition: 'O', government: 'G', pro: 'P', contra: 'C', favour: 'F', against: 'A' };

function roleCode(name) {
  const words = name.replace(/in favour/i, 'Favour').replace(/['’]s\b/g, '').split(/[\s\-–—]+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  let letters = '';
  let digits = '';
  for (const w of words) {
    const lower = w.toLowerCase();
    if (ORDINALS[lower]) digits += ORDINALS[lower];
    else if (/^\d+$/.test(w)) digits += w;
    else letters += SIDE_LETTERS[lower] ?? w[0].toUpperCase();
  }
  return (letters + digits).slice(0, 4);
}

function convert(file, xml) {
  const d = parser.parse(xml)['debate-format'];
  const name = text(english(d.name));
  const types = Object.fromEntries((d['speech-types']?.['speech-type'] ?? []).map((t) => [t['@ref'], t]));
  const speeches = (d.speeches?.speech ?? []).map((s) => ({ name: text(english(s.name)), type: s['@type'] }));

  // Sides come from the speech names.
  const sideNames = {};
  const sideTeams = {};
  for (const s of speeches) {
    const hits = SIDE_WORDS.filter(([re]) => re.test(s.name));
    if (new Set(hits.map((h) => h[1])).size !== 1) return { skip: `“${s.name}” doesn't belong to one side` };
    const [, side, sideName, team] = hits[0];
    s.side = side;
    sideNames[side] ??= sideName;
    sideTeams[side] ??= team;
  }
  if (!sideNames.gov || !sideNames.opp) return { skip: 'only one side speaks' };

  const timing = Object.fromEntries(Object.entries(types).map(([ref, t]) => [ref, convertType(t)]));
  const usedTypes = new Set(speeches.map((s) => s.type));
  const plain = [...usedTypes].every((ref) => PLAIN_KINDS.has(ref)) && [...usedTypes].filter((ref) => ref !== 'reply').length <= 1;

  const roles = new Set();
  const out = speeches.map((s) => {
    let role = roleCode(s.name);
    for (let n = 2; roles.has(role); n++) role = role.slice(0, 3) + n;
    roles.add(role);
    const reply = /reply/i.test(s.name) || s.type === 'reply';
    const kind = plain ? undefined : (KINDS[s.type] ?? s.type[0].toUpperCase() + s.type.slice(1).replace(/-/g, ' '));
    return { role, name: s.name, side: s.side, ...(reply && { reply }), ...(kind && { kind }), ...timing[s.type] };
  });

  const bp = BP_ROLES.every((r) => roles.has(r)) && roles.size === BP_ROLES.length;
  const teams = bp
    ? [
        { id: 'OG', name: 'Opening Government', side: 'gov', roles: ['PM', 'DPM'] },
        { id: 'OO', name: 'Opening Opposition', side: 'opp', roles: ['LO', 'DLO'] },
        { id: 'CG', name: 'Closing Government', side: 'gov', roles: ['MG', 'GW'] },
        { id: 'CO', name: 'Closing Opposition', side: 'opp', roles: ['MO', 'OW'] },
      ]
    : ['gov', 'opp'].map((side) => ({ id: sideTeams[side], name: sideNames[side], side, roles: out.filter((s) => s.side === side).map((s) => s.role) }));

  const first = out.find((s) => !s.reply);
  const firstReply = out.find((s) => s.reply);
  const info = english(d.info);
  const prep = d['prep-time']?.['@length'] ?? d['prep-time-controlled']?.['@length'];
  const id = basename(file, '.xml');
  if (!/^[a-z0-9-]{2,24}$/.test(id)) return { skip: `the file name doesn't make a valid id` };

  return {
    def: {
      id,
      name,
      sides: bp ? { gov: 'Government', opp: 'Opposition' } : { gov: sideNames.gov, opp: sideNames.opp },
      timing: {
        speech: { durationSec: first.durationSec, graceSec: first.graceSec, protectedSec: null },
        ...(firstReply && { reply: { durationSec: firstReply.durationSec, graceSec: firstReply.graceSec } }),
      },
      speeches: out,
      teams,
      // Debatekeeper has no scoring rules: a range wide enough for any scale.
      scoring: bp ? { kind: 'ranked', speech: { min: 50, max: 100, step: 1 } } : { kind: 'winloss', speech: { min: 0, max: 100, step: 0.5 } },
      info: {
        region: list(info?.region),
        level: list(info?.level),
        usedAt: list(info?.['used-at']),
        description: text(english(info?.description)) || undefined,
        prepSec: prep ? seconds(prep) : undefined,
      },
      source: `Debatekeeper format library: https://formats.debatekeeper.czlee.nz/v1/formats/${file}`,
    },
  };
}

async function loadFiles() {
  const from = process.argv.indexOf('--from');
  if (from > 0) {
    const dir = process.argv[from + 1];
    return readdirSync(dir).filter((f) => f.endsWith('.xml')).map((f) => [f, readFileSync(join(dir, f), 'utf8')]);
  }
  const index = await (await fetch(INDEX)).json();
  return Promise.all(index.formats.map(async (f) => [f.filename, await (await fetch(f.url)).text()]));
}

/** A JS literal on one line: `{ role: 'A1', side: 'gov' }`. */
function literal(v) {
  if (Array.isArray(v)) return `[${v.map(literal).join(', ')}]`;
  if (v && typeof v === 'object') {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    return `{ ${entries.map(([k, x]) => `${k}: ${literal(x)}`).join(', ')} }`;
  }
  if (typeof v === 'string') return `'${JSON.stringify(v).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;
  return JSON.stringify(v);
}

// One speech per line keeps the file readable and the diffs small.
function serialize(def) {
  const { speeches, teams, scoring, info, source, ...head } = def;
  return [
    '  {',
    ...Object.entries(head).map(([k, v]) => `    ${k}: ${literal(v)},`),
    '    speeches: [',
    ...speeches.map((s) => `      ${literal(s)},`),
    '    ],',
    '    teams: [',
    ...teams.map((t) => `      ${literal(t)},`),
    '    ],',
    `    scoring: ${literal(scoring)},`,
    `    info: ${literal(info)},`,
    `    source: ${literal(source)},`,
    '  },',
  ].join('\n');
}

const files = (await loadFiles()).sort(([a], [b]) => a.localeCompare(b));
const defs = [];
const skipped = [];
for (const [file, xml] of files) {
  if (SKIP[file]) skipped.push([file, SKIP[file]]);
  else {
    const r = convert(file, xml);
    if (r.skip) skipped.push([file, r.skip]);
    else defs.push(r.def);
  }
}
defs.sort((a, b) => a.name.localeCompare(b.name));

const source = `// Generated by scripts/import-debatekeeper.mjs; don't edit by hand. Run
// \`npm run formats:import\` to update it.
//
// Converted from the Debatekeeper format library by Chuan-Zheng Lee and
// contributors: https://github.com/czlee/debatekeeper-formats
// Debatekeeper has no teams or scoring rules, so every format here has two
// teams and a 0–100 score range (BP variants: four ranked teams, 50–100).
//
// Not converted:
${skipped.map(([f, why]) => `// - ${f}: ${why}`).join('\n')}
//
// The format library is used under its license:
//
${LICENSE.split('\n').map((l) => `// ${l}`.trimEnd()).join('\n')}

import { defineFormat, type FormatDefinition } from './define';

const DEFINITIONS: FormatDefinition[] = [
${defs.map(serialize).join('\n')}
];

export const DEBATEKEEPER = DEFINITIONS.map(defineFormat);
`;
writeFileSync(OUT, source);
console.log(`${defs.length} formats written to packages/core/src/formats/debatekeeper.ts; ${skipped.length} skipped:`);
for (const [f, why] of skipped) console.log(`  ${f}: ${why}`);
