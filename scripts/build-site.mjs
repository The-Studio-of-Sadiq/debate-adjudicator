// Builds the static website into site-dist/ (plain HTML, no JavaScript).
//   SITE_URL  absolute base URL used for canonical links, sitemap and social
//             tags (default: the GitHub Pages URL for this repository).
//   REPO_URL  where "source" and "download" links point.
// Docs pages come from docs/wiki/*.md; format tables come from the app's own
// presets in packages/core, so the site can't drift from the app.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { marked } from 'marked';

// The core package uses extensionless TypeScript imports, as bundlers allow;
// teach Node to resolve them so the site reads the app's own format presets.
register('./resolve-ts.mjs', import.meta.url);
const { DEBATEKEEPER, FEATURED, PRESETS, formatRegion } = await import('../packages/core/src/formats/index.ts');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => join(root, ...p);
const OUT = at('site-dist');
const SITE_URL = (process.env.SITE_URL ?? 'https://the-studio-of-sadiq.github.io/debate-adjudicator').replace(/\/+$/, '');
const REPO_URL = (process.env.REPO_URL ?? 'https://github.com/The-Studio-of-Sadiq/debate-adjudicator').replace(/\/+$/, '');
const TODAY = new Date().toISOString().slice(0, 10);
const NAME = 'Debate Adjudicator';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// ── Page shell ──────────────────────────────────────────────────────────────

/** @param {{ path: string, title: string, description: string, body: string, jsonLd?: object[], nav?: string, noindex?: boolean }} p */
function page(p) {
  const depth = p.path.split('/').filter(Boolean).length;
  const rel = depth ? '../'.repeat(depth) : './';
  const url = `${SITE_URL}/${p.path}`;
  const fullTitle = p.path === '' ? `${NAME}: ${p.title}` : `${p.title} · ${NAME}`;
  const navLink = (href, label, key) => `<a href="${rel}${href}"${p.nav === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(p.description)}">
${p.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`}
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${rel}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${rel}apple-touch-icon.png">
<link rel="manifest" href="${rel}site.webmanifest">
<link rel="stylesheet" href="${rel}style.css">
<meta property="og:type" content="${p.path === '' ? 'website' : 'article'}">
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/img/social-preview.png">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta property="og:image:alt" content="${NAME}: run the debate room from one phone.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${SITE_URL}/img/social-preview.png">
${(p.jsonLd ?? []).map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${rel}" aria-label="${NAME} home">
      <img class="on-light" src="${rel}img/lockup.svg" alt="${NAME}" width="168" height="34">
      <img class="on-dark" src="${rel}img/lockup-white.svg" alt="${NAME}" width="168" height="34">
    </a>
    <nav class="nav" aria-label="Main">
      ${navLink('#features', 'Features', 'features')}
      ${navLink('#how-it-works', 'How it works', 'how')}
      ${navLink('formats/', 'Formats', 'formats')}
      ${navLink('docs/', 'Docs', 'docs')}
      ${navLink('#get-the-app', 'Get the app', 'get')}
    </nav>
  </div>
</header>
<main id="main">
${p.body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <span>© ${new Date().getFullYear()} The Studio of Sadiq · MIT License</span>
    <nav aria-label="Footer">
      <a href="${rel}docs/">Docs</a>
      <a href="${rel}formats/">Formats</a>
      <a href="${rel}privacy/">Privacy</a>
      <a href="${REPO_URL}">Source code</a>
      <a href="${REPO_URL}/blob/main/CONTRIBUTING.md">Contribute</a>
      <a href="${REPO_URL}/blob/main/SECURITY.md">Security</a>
    </nav>
  </div>
</footer>
</body>
</html>
`;
}

function write(path, html) {
  const file = join(OUT, path, path.endsWith('.html') || path.endsWith('.xml') || path.endsWith('.txt') || path.endsWith('.webmanifest') ? '' : 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// ── Landing page ────────────────────────────────────────────────────────────

const FEATURES = [
  ['Timekeeping that just works', `${PRESETS.length} formats: British Parliamentary, UADC 7-7-7-4 and 5-5-5-3, World Schools, Australs, Canadian, American and dozens of school and league formats. Protected time, POI windows, grace and bells you can retime.`],
  ['One room, many devices', 'Debaters, the timekeeper and wing adjudicators join by QR code over the room’s Wi-Fi or a phone hotspot. Every screen shows the same second.'],
  ['POIs and points of order', 'Debaters offer POIs from their phones; the speaker accepts or declines. Points of order pause the clock until the chair rules.'],
  ['Recordings', 'The chair records every speech. A debater’s phone records their own accepted POI or point and sends it to the chair.'],
  ['Offline transcription', 'Whisper runs on the device, with no internet needed. Optionally use a cloud provider when you’re online. Tap a line to hear it.'],
  ['Ballots and reports', 'Speaker scores give BP ranks or the UADC winner automatically, with checks for missing, invalid or tied scores. Export a PDF report.'],
  ['Private by design', 'No accounts and no cloud. Flow notes, ballots and transcripts never leave the chair’s device.'],
  ['Made for any room', 'Black-and-white light and dark themes, readable across a room and for colour-blind adjudicators. In 17 languages, including right-to-left Arabic and Urdu.'],
];

const FAQ = [
  ['Does it need the internet?', 'No. Rounds, joining, bells, recording and transcription all work offline. Devices only need to be on the same Wi-Fi network or the chair’s phone hotspot. The internet is used only if you choose a cloud transcription provider.'],
  ['Which debate formats are supported?', `${PRESETS.length} of them: British Parliamentary (BP), UADC 7-7-7-4 and 5-5-5-3 (Asian Parliamentary), World Schools (WSDC), and ${DEBATEKEEPER.length} more from the Debatekeeper format library, including Australs, Canadian and American Parliamentary, and school and league formats from Australia, New Zealand, Europe and beyond. Speech lengths, grace periods, POI windows and bells can be changed in Bell settings, and new formats can be added with a short definition file.`],
  ['Is it available in my language?', 'The interface is in 17 languages: English, Bangla, Spanish, French, Portuguese, German, Russian, Turkish, Hindi, Chinese (Simplified), Japanese, Korean, Indonesian, Malay, Vietnamese, Arabic and Urdu (with the layout mirrored right to left). It follows your device’s language, or you can pick one under Home → Language. Adding another language takes one command and one file to translate; corrections and new languages are welcome.'],
  ['Do debaters have to install the app?', 'Only to take part from their own phone, to offer POIs or see the synced timer. The chair can run a whole round alone and raise points on anyone’s behalf.'],
  ['What happens if the Wi-Fi drops?', 'Joined devices reconnect automatically and keep their role. Recordings waiting to be sent to the chair are retried until they arrive.'],
  ['Who can see my notes and ballot?', 'Only the chair. Notes, ballots and transcripts stay on the chair’s device and are never sent to other devices.'],
  ['Which devices does it run on?', 'Android phones and tablets, and Windows PCs. The chair can use either.'],
  ['Is it free?', 'Yes. It is open source under the MIT License.'],
];

function formatTable(format) {
  const sideName = (side) => format.sides?.[side] ?? (side === 'gov' ? 'Government' : 'Opposition');
  const rows = format.speeches
    .map((s) => {
      const poi = s.poiWindow ? `${clock(s.poiWindow.from)}–${clock(s.poiWindow.to)}` : 'None';
      const bells = s.bells.map((b) => `${clock(b.at)} ${esc(b.pattern)}`).join('<br>');
      const length = s.graceSec ? `${clock(s.durationSec)} + ${clock(s.graceSec)}` : clock(s.durationSec);
      return `<tr><td><b>${esc(s.role)}</b> ${esc(s.name)}</td><td>${esc(sideName(s.side))}${s.reply ? ' (reply)' : ''}</td><td class="num">${length}</td><td class="num">${poi}</td><td class="bells">${bells}</td></tr>`;
    })
    .join('');
  return `<div class="table-wrap"><table>
    <thead><tr><th>Speech</th><th>Side</th><th>Length + grace</th><th>POIs</th><th>Bells</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function landing() {
  const description =
    `Free, offline-first app for debate adjudicators: synced timer and bells over local Wi-Fi, POIs and points of order from debaters’ phones, recordings, offline transcription, ballots and PDF reports for BP, UADC, WSDC and ${PRESETS.length - 4} more formats. Android and Windows.`;
  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <span class="eyebrow">For debate adjudicators</span>
      <h1>Run the debate room from one phone.</h1>
      <p class="lede">${NAME} keeps time, rings the bells on every device, takes POIs and points of order from debaters’ phones, records and transcribes the speeches, and fills in the ballot. Offline, for British Parliamentary, UADC, World Schools and <a href="formats/">${PRESETS.length - 4} more formats</a>.</p>
      <div class="actions">
        <a class="btn primary" href="#get-the-app">Get the app</a>
        <a class="btn" href="docs/">Read the docs</a>
      </div>
    </div>
    <div class="shots">
      <img class="shot" src="img/timer-dark.png" alt="The chair’s timer at 1:05 with POIs open, recording, and a pending POI from DLO with Accept, Decline and Withdraw buttons" width="1280" height="860">
      <img class="shot" src="img/debater-phone-light.png" alt="A debater’s phone in light mode showing the same synced timer and buttons to offer a POI, Point of Order or Point of Personal Privilege" width="780" height="1688">
    </div>
  </div>
</section>

<section id="features">
  <div class="wrap">
    <span class="eyebrow">Features</span>
    <h2>Everything the chair needs, nothing they don’t.</h2>
    <div class="grid">
      ${FEATURES.map(([t, d]) => `<div class="card"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('\n      ')}
    </div>
  </div>
</section>

<section id="how-it-works">
  <div class="wrap">
    <span class="eyebrow">How it works</span>
    <h2>From motion to ballot in four steps.</h2>
    <ol class="steps">
      <li><h3>Start the round</h3><p>The chair picks the format, enters the motion and taps <b>Invite devices</b> to show a QR code.</p></li>
      <li><h3>Join from any phone</h3><p>Debaters, the timekeeper and wings scan the code and pick their seat or role. The chair approves each one.</p></li>
      <li><h3>Run the speeches</h3><p>One clock for the whole room. Bells ring everywhere at once; POIs and points arrive on the chair’s screen.</p></li>
      <li><h3>Decide and report</h3><p>Transcribe the recordings, score the speakers, mark the ballot final and export a PDF report.</p></li>
    </ol>
    <div class="gallery">
      <figure><img class="shot" src="img/lobby-dark.png" alt="Invite devices screen with a QR code, the join code 192.168.0.79 D7JJFF, and a pending request from Tanvir to join as LO" width="1280" height="840" loading="lazy"><figcaption>Invite devices with a QR code or a short join code, then approve each request.</figcaption></figure>
      <figure><img class="shot" src="img/ballot-dark.png" alt="BP ballot with speaker names and scores; Opening Government placed second with 151 points" width="1280" height="1000" loading="lazy"><figcaption>Ranks and team points follow from the speaker scores.</figcaption></figure>
      <figure><img class="shot" src="img/transcript-dark.png" alt="Room recording with a timestamped transcript transcribed offline" width="1280" height="860" loading="lazy"><figcaption>Offline transcripts, synced to the audio.</figcaption></figure>
    </div>
  </div>
</section>

<section id="formats">
  <div class="wrap">
    <span class="eyebrow">Formats</span>
    <h2>${PRESETS.length} formats, ready to go.</h2>
    <p class="lede">These are the default timings. Every length, grace period, POI window and bell can be changed on the device, and new formats can be <a href="docs/adding-a-format/">added with a short definition file</a>.</p>
    ${FEATURED.map((f) => `<h3 style="margin-top:32px"><a href="formats/${f.id}/">${esc(f.name)}</a></h3>${f.info?.description ? `<p>${esc(f.info.description)}</p>` : ''}${formatTable(f)}`).join('\n    ')}
    <h3 style="margin-top:40px">And ${DEBATEKEEPER.length} more</h3>
    <p>${DEBATEKEEPER.slice(0, 12).map((f) => `<a href="formats/${f.id}/">${esc(f.name)}</a>`).join(' · ')} …</p>
    <div class="actions"><a class="btn" href="formats/">Browse all ${PRESETS.length} formats</a></div>
  </div>
</section>

<section id="privacy">
  <div class="wrap two">
    <div>
      <span class="eyebrow">Offline and private</span>
      <h2>No accounts. No cloud. No signal needed.</h2>
    </div>
    <div>
      <p>Devices talk to each other directly over the room’s Wi-Fi or the chair’s phone hotspot, so it works in basements, halls and anywhere the venue internet gives up.</p>
      <p>Speech-to-text runs on the device with Whisper. Cloud transcription is available, but only if you add your own provider and key.</p>
      <p>The chair’s flow notes, ballot and transcripts stay on the chair’s device. Other devices only ever receive what they need to run the room.</p>
    </div>
  </div>
</section>

<section id="get-the-app">
  <div class="wrap two">
    <div>
      <span class="eyebrow">Get the app</span>
      <h2>Android and Windows.</h2>
      <p class="lede">${NAME} is free and open source. Builds are made from the source code; see the install guide for the current steps.</p>
      <div class="actions">
        <a class="btn primary" href="${REPO_URL}#install">Install guide</a>
        <a class="btn" href="${REPO_URL}">Source code</a>
      </div>
    </div>
    <div class="callout">
      <h3>Before your first tournament</h3>
      <ul>
        <li>Download a transcription model on Wi-Fi (Home → Transcription settings).</li>
        <li>Check the bells for your tournament’s rules (Home → Bell settings).</li>
        <li>Plan to run the room from your phone’s hotspot; venue Wi-Fi often blocks devices from seeing each other.</li>
      </ul>
      <p><a href="docs/chair-guide/">Read the chair guide →</a></p>
    </div>
  </div>
</section>

<section id="faq">
  <div class="wrap">
    <span class="eyebrow">FAQ</span>
    <h2>Questions adjudicators ask.</h2>
    ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n    ')}
  </div>
</section>

<section id="contribute">
  <div class="wrap two">
    <div>
      <span class="eyebrow">Open source</span>
      <h2>Help make it better.</h2>
    </div>
    <div>
      <p>${NAME} is MIT-licensed and built in the open by The Studio of Sadiq. Bug reports, new debate formats and translations are all welcome.</p>
      <p><a href="docs/translating/">Translate the app</a> · <a href="docs/adding-a-format/">Add a debate format</a></p>
      <div class="actions">
        <a class="btn" href="${REPO_URL}/blob/main/CONTRIBUTING.md">How to contribute</a>
        <a class="btn" href="${REPO_URL}/issues/new/choose">Report a bug or idea</a>
      </div>
    </div>
  </div>
</section>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: NAME,
      description,
      applicationCategory: 'EducationalApplication',
      applicationSubCategory: 'Debate adjudication',
      operatingSystem: 'Android, Windows',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      license: 'https://opensource.org/licenses/MIT',
      url: `${SITE_URL}/`,
      image: `${SITE_URL}/img/social-preview.png`,
      screenshot: ['timer-dark', 'debater-phone-light', 'lobby-dark', 'ballot-dark', 'transcript-dark'].map((s) => `${SITE_URL}/img/${s}.png`),
      featureList: FEATURES.map(([t]) => t),
      isAccessibleForFree: true,
      codeRepository: REPO_URL,
      author: { '@type': 'Organization', name: 'The Studio of Sadiq', url: 'https://github.com/The-Studio-of-Sadiq' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: `${SITE_URL}/` },
  ];
  write('', page({ path: '', title: 'Run the debate room from one phone', description, body, jsonLd }));
}

// ── Format library: an index and a page per format ──────────────────────────

const regionOf = (f) => formatRegion(f) ?? 'Other';
const DK_CREDIT = 'Timings from the <a href="https://github.com/czlee/debatekeeper-formats">Debatekeeper format library</a> by Chuan-Zheng Lee and contributors, used under the MIT License.';

const crumbsLd = (crumbs) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map(([name, item], n) => ({ '@type': 'ListItem', position: n + 1, name, item })),
});

function formatPages() {
  const regions = new Map();
  for (const f of PRESETS) regions.set(regionOf(f), [...(regions.get(regionOf(f)) ?? []), f]);
  const ordered = [...regions].sort(([a], [b]) => (a === 'World' ? -1 : b === 'World' ? 1 : a.localeCompare(b)));
  const rows = (list) =>
    list.map((f) => `<tr><td><a href="${f.id}/"><b>${esc(f.name)}</b></a></td><td>${esc(f.info?.level ?? '')}</td><td>${esc(f.info?.description ?? '')}</td></tr>`).join('');

  const indexBody = `
<section>
  <div class="wrap">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="../">Home</a></li><li aria-current="page">Formats</li></ol></nav>
    <span class="eyebrow">Format library</span>
    <h1>${PRESETS.length} debate formats</h1>
    <p class="lede">Every format ${NAME} knows, with its speeches, POI windows and bells. Pick one on the home screen (search by name, country or level) and adjust the timings in Bell settings if your tournament differs.</p>
    <p>Missing one? <a href="../docs/adding-a-format/">Add it with a short definition file</a> or <a href="${REPO_URL}/issues/new?template=format_request.yml">request it</a>.</p>
    ${ordered.map(([region, list]) => `<h2 style="margin-top:40px">${esc(region)}</h2><div class="table-wrap"><table><thead><tr><th>Format</th><th>Level</th><th>Summary</th></tr></thead><tbody>${rows(list)}</tbody></table></div>`).join('\n    ')}
    <p style="margin-top:32px">${DK_CREDIT}</p>
  </div>
</section>`;
  write(
    'formats/',
    page({
      path: 'formats/',
      title: 'Debate formats',
      description: `Speech times, POI windows and bells for ${PRESETS.length} debate formats: BP, UADC, World Schools, Australs, Canadian, American Parliamentary and more.`,
      body: indexBody,
      nav: 'formats',
      jsonLd: [
        crumbsLd([
          ['Home', `${SITE_URL}/`],
          ['Formats', `${SITE_URL}/formats/`],
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: PRESETS.map((f, n) => ({ '@type': 'ListItem', position: n + 1, name: f.name, url: `${SITE_URL}/formats/${f.id}/` })),
        },
      ],
    }),
  );

  for (const f of PRESETS) {
    const imported = DEBATEKEEPER.includes(f);
    const summary = f.info?.description ?? `${f.speeches.length} speeches`;
    const facts = [
      ['Region', f.info?.region],
      ['Level', f.info?.level],
      ['Used at', f.info?.usedAt],
      ['Sides', f.sides && `${f.sides.gov} and ${f.sides.opp}`],
      ['Speeches', String(f.speeches.length)],
      ['Preparation', f.info?.prepSec && `${Math.round(f.info.prepSec / 60)} minutes`],
      ['Result', f.ballot?.kind === 'ranked' ? `${f.ballot.teams.length} teams ranked` : 'One winning team'],
    ].filter(([, v]) => v);
    const body = `
<section>
  <div class="wrap">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="../../">Home</a></li><li><a href="../">Formats</a></li><li aria-current="page">${esc(f.name)}</li></ol></nav>
    <span class="eyebrow">Debate format</span>
    <h1>${esc(f.name)}</h1>
    <p class="lede">${esc(summary)}.</p>
    <div class="table-wrap"><table style="min-width:0"><tbody>${facts.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>
    <h2 style="margin-top:40px">Speeches and bells</h2>
    <p>Times are minutes:seconds from the start of each speech.</p>
    ${formatTable(f)}
    <p style="margin-top:24px">In ${NAME}, choose <b>${esc(f.name)}</b> on the home screen. Bell settings change any of these timings on your device.</p>
    ${imported ? `<p>${DK_CREDIT} Debatekeeper has no scoring rules, so the ballot accepts scores from ${f.ballot.range.min} to ${f.ballot.range.max}.</p>` : f.source ? `<p>Rules: ${esc(f.source)}.</p>` : ''}
    <p><a href="../">← All formats</a></p>
  </div>
</section>`;
    write(
      `formats/${f.id}/`,
      page({
        path: `formats/${f.id}/`,
        title: `${f.name} timings`,
        description: `${f.name}: ${summary}. Speech order, POI windows and bell times, ready to use in ${NAME}.`,
        body,
        nav: 'formats',
        jsonLd: [
          crumbsLd([
            ['Home', `${SITE_URL}/`],
            ['Formats', `${SITE_URL}/formats/`],
            [f.name, `${SITE_URL}/formats/${f.id}/`],
          ]),
        ],
      }),
    );
  }
  return ['formats/', ...PRESETS.map((f) => `formats/${f.id}/`)];
}

// ── Docs pages from docs/wiki ───────────────────────────────────────────────

// [file in docs/wiki, URL slug, search description (≤ 160 chars)]
const GUIDES = [
  ['Home', '', 'How to use Debate Adjudicator: guides for chairs, debaters and timekeepers, transcription, ballots, troubleshooting, translating and adding formats.'],
  ['Chair-guide', 'chair-guide', 'Run a debate round as the chair: set up the network, invite devices by QR code, time speeches, rule on points of order, then ballot and report.'],
  ['Joining-a-round', 'joining-a-round', 'Join a debate round from your phone as a debater, timekeeper or wing adjudicator: scan the QR code, offer POIs and points of order, keep time.'],
  ['Transcription', 'transcription', 'Transcribe debate speeches in English or Bangla: offline with Whisper, or with ElevenLabs Scribe, OpenAI or Groq. Models, languages and settings.'],
  ['Ballots-and-reports', 'ballots-and-reports', 'Score BP, UADC and WSDC ballots: speaker ranges, ranks and team points, winner and margin, checks before marking final, and PDF reports.'],
  ['Troubleshooting', 'troubleshooting', 'Fix common problems: devices that can’t connect on venue Wi-Fi, QR codes that won’t scan, bells, recording and transcription issues.'],
  ['Translating', 'translating', 'Translate Debate Adjudicator into your language: create a dictionary with one command, translate one file, and check coverage and mistakes.'],
  ['Adding-a-format', 'adding-a-format', 'Add a debate format to Debate Adjudicator: define speeches, timing, POI rules, teams and scoring in one short file, validated by the tests.'],
];
const slugOf = Object.fromEntries(GUIDES.map(([file, slug]) => [file, slug]));

function docs() {
  const parsed = GUIDES.map(([file, slug, description]) => {
    const md = readFileSync(at('docs/wiki', `${file}.md`), 'utf8');
    const title = md.match(/^#\s+(.+)$/m)?.[1].trim() ?? file;
    return { file, slug, md, title: slug === '' ? 'Documentation' : title, description };
  });

  parsed.forEach((g, i) => {
    const path = g.slug ? `docs/${g.slug}/` : 'docs/';
    const fromDir = g.slug ? '../' : './';
    const renderer = new marked.Renderer();
    renderer.link = ({ href, text }) => {
      let target = href;
      const local = href.match(/^([\w-]+)\.md(#.*)?$/);
      if (local && local[1] in slugOf) {
        const slug = slugOf[local[1]];
        target = `${fromDir}${slug ? `${slug}/` : ''}${local[2] ?? ''}`;
      } else if (/^(\.\.\/)+[\w.-]+\.md$/.test(href)) {
        target = `${REPO_URL}/blob/main/${href.replace(/^(\.\.\/)+/, '')}`;
      }
      return `<a href="${esc(target)}">${text}</a>`;
    };
    const html = marked
      .parse(g.md, { renderer, gfm: true })
      .replace(/<table>/g, '<div class="table-wrap"><table>')
      .replace(/<\/table>/g, '</table></div>');

    const docsRel = g.slug ? '../' : './';
    const navItems = parsed
      .map((x) => {
        const href = x.slug ? `${docsRel}${x.slug}/` : docsRel;
        return `<li><a href="${href}"${x === g ? ' aria-current="page"' : ''}>${esc(x.slug ? x.title : 'Overview')}</a></li>`;
      })
      .join('');
    const prev = parsed[i - 1];
    const next = parsed[i + 1];
    const link = (x, label) => (x ? `<a href="${x.slug ? `${docsRel}${x.slug}/` : docsRel}">${label}</a>` : '<span></span>');
    const crumbs = [
      ['Home', `${SITE_URL}/`],
      ['Docs', `${SITE_URL}/docs/`],
      ...(g.slug ? [[g.title, `${SITE_URL}/${path}`]] : []),
    ];
    const body = `
<div class="wrap docs">
  <nav class="docs-nav" aria-label="Docs"><ul>${navItems}</ul></nav>
  <article class="prose">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${crumbs
      .map(([name], n) => (n === crumbs.length - 1 ? `<li aria-current="page">${esc(name)}</li>` : `<li><a href="${n === 0 ? `${docsRel}../` : docsRel}">${esc(name)}</a></li>`))
      .join('')}</ol></nav>
    ${html}
    <div class="pager">${link(prev, `← ${prev ? esc(prev.slug ? prev.title : 'Overview') : ''}`)}${link(next, `${next ? esc(next.title) : ''} →`)}</div>
  </article>
</div>`;
    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: g.title,
        description: g.description,
        url: `${SITE_URL}/${path}`,
        dateModified: TODAY,
        image: `${SITE_URL}/img/social-preview.png`,
        isPartOf: { '@type': 'WebSite', name: NAME, url: `${SITE_URL}/` },
        about: { '@type': 'SoftwareApplication', name: NAME },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map(([name, item], n) => ({ '@type': 'ListItem', position: n + 1, name, item })),
      },
    ];
    write(path, page({ path, title: g.title, description: g.description, body, jsonLd, nav: 'docs' }));
  });
  return parsed.map((g) => (g.slug ? `docs/${g.slug}/` : 'docs/'));
}

// ── Build ───────────────────────────────────────────────────────────────────

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

cpSync(at('site/static'), OUT, { recursive: true });
mkdirSync(join(OUT, 'img'), { recursive: true });
for (const f of ['timer-dark', 'debater-phone-light', 'lobby-dark', 'ballot-dark', 'transcript-dark']) cpSync(at('docs/screenshots', `${f}.png`), join(OUT, 'img', `${f}.png`));
for (const f of ['lockup.svg', 'lockup-white.svg', 'social-preview.png']) cpSync(at('docs/brand', f), join(OUT, 'img', f));
mkdirSync(join(OUT, 'fonts'), { recursive: true });
for (const [pkg, file] of [
  ['inter/400Regular', 'Inter_400Regular.ttf'],
  ['inter/600SemiBold', 'Inter_600SemiBold.ttf'],
  ['inter/800ExtraBold', 'Inter_800ExtraBold.ttf'],
  ['instrument-serif/400Regular', 'InstrumentSerif_400Regular.ttf'],
]) {
  cpSync(at('node_modules/@expo-google-fonts', pkg, file), join(OUT, 'fonts', file));
}

landing();
const docPaths = docs();
const formatPaths = formatPages();

// The privacy policy (PRIVACY.md), linked from app stores, so it keeps a stable URL: /privacy/
{
  const md = readFileSync(at('PRIVACY.md'), 'utf8');
  const html = marked.parse(md);
  write(
    'privacy/',
    page({
      path: 'privacy/',
      title: 'Privacy policy',
      description: `${NAME} has no accounts, ads or servers: recordings, notes and ballots stay on your devices. What the app stores, what it shares and when.`,
      body: `<section><div class="wrap"><article class="prose">${html}</article></div></section>`,
    }),
  );
}

write(
  '404.html',
  page({
    path: '404/',
    title: 'Page not found',
    description: 'This page does not exist on the Debate Adjudicator website. Try the home page or the documentation.',
    noindex: true,
    body: `<section><div class="wrap"><h1>Page not found.</h1><p class="lede">That page isn’t here. Try the <a href="${SITE_URL}/">home page</a> or the <a href="${SITE_URL}/docs/">docs</a>.</p></div></section>`,
  }).replace(/(href|src)="\.\.\//g, `$1="${SITE_URL}/`),
);

const urls = ['', ...docPaths, ...formatPaths, 'privacy/'];
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}/${u}</loc><lastmod>${TODAY}</lastmod><priority>${u === '' ? '1.0' : u === 'docs/' || u === 'formats/' ? '0.8' : u.startsWith('formats/') ? '0.6' : '0.7'}</priority></url>`).join('\n')}
</urlset>
`,
);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
write(
  'site.webmanifest',
  JSON.stringify(
    {
      name: NAME,
      short_name: 'Adjudicator',
      start_url: './',
      display: 'browser',
      background_color: '#000000',
      theme_color: '#000000',
      icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
    },
    null,
    2,
  ),
);
// Serve files as-is on GitHub Pages (no Jekyll processing).
writeFileSync(join(OUT, '.nojekyll'), '');

console.log(`Built ${urls.length} pages into site-dist/ for ${SITE_URL}`);
if (!existsSync(join(OUT, 'index.html'))) process.exit(1);
