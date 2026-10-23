import {
  ballotSpecFor,
  elapsedMs,
  evaluateBallot,
  formatClock,
  type Session,
  type Transcript,
} from '@debate/core';
import { dateTime, formatName, i18n, isRTL, outcomeText, roleName, teamName, type T } from './i18n';
import { fmtScore } from './screens/BallotScreen';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function transcriptHtml(t: T, tr: Transcript | undefined): string {
  if (!tr?.segments.length) return '';
  const lines = tr.segments.map((s) => `<p class="seg"><span class="time" dir="ltr">${formatClock(s.startMs / 1000)}</span> ${esc(s.text)}</p>`).join('');
  return `<div class="transcript"><h4>${esc(t('report.transcript'))}</h4>${lines}</div>`;
}

/**
 * Printable round report: ballot first, then each speech with timing,
 * interruptions, flow notes and (optionally) transcripts. Pure black on white.
 * Written in the interface language, mirrored for right-to-left languages
 * (the styles use start/end, not left/right); times and scores stay left to right.
 */
export function buildReportHtml(session: Session, t: T, opts: { includeTranscripts: boolean }): string {
  const spec = ballotSpecFor(session.format);
  const result = evaluateBallot(session.format, session.ballot);
  const hasScores = Object.keys(session.ballot?.scores ?? {}).length > 0;
  const templateOf = (id: string) => session.format.speeches.find((s) => s.id === id);
  const speakerName = (role: string) => session.speakers?.[role] ?? '';

  let ballot = '';
  if (hasScores) {
    const rows = spec.teams
      .map((team) => {
        const speakers = team.speechIds
          .map(templateOf)
          .filter((s) => !!s)
          .map((s) => {
            const score = session.ballot?.scores[s!.id];
            return `${esc(s!.role)}${speakerName(s!.role) ? ` · ${esc(speakerName(s!.role))}` : ''}: <b dir="ltr">${score === undefined ? '—' : fmtScore(score)}</b>`;
          })
          .join('<br>');
        const rank = result.order.indexOf(team.id) + 1;
        const outcome = !result.complete
          ? '—'
          : spec.kind === 'ranked'
            ? `${esc(t(`ballot.rank_${rank}`))} · ${esc(t('ballot.points', { count: result.points[team.id] }))}`
            : rank === 1
              ? '✓'
              : '';
        return `<tr><td>${esc(teamName(t, team.id, team.name))}</td><td>${speakers}</td><td class="num">${fmtScore(result.totals[team.id] ?? 0)}</td><td>${outcome}</td></tr>`;
      })
      .join('');
    const winner =
      spec.kind === 'winloss' && result.complete && result.margin !== undefined
        ? `<p class="result">${esc(t('ballot.winner', { team: teamName(t, result.order[0]!, spec.teams.find((x) => x.id === result.order[0])?.name), margin: fmtScore(result.margin) }))}</p>`
        : '';
    const status = session.ballot?.finalizedAt
      ? `<p>${esc(t('ballot.finalized', { time: dateTime(session.ballot.finalizedAt) }))}</p>`
      : `<p class="warn">${esc(t('report.notFinal'))}</p>`;
    const comments = session.ballot?.comments?.trim()
      ? `<h3>${esc(t('report.comments'))}</h3><p class="pre">${esc(session.ballot.comments.trim())}</p>`
      : '';
    ballot = `<h2>${esc(t('report.ballot'))}</h2>${status}${winner}
      <table><thead><tr><th>${esc(t('report.team'))}</th><th>${esc(t('report.speaker'))} / ${esc(t('report.score'))}</th><th>${esc(
        t('report.total'),
      )}</th><th>${esc(t('report.result'))}</th></tr></thead><tbody>${rows}</tbody></table>${comments}`;
  }

  const speeches = session.format.speeches
    .map((tpl, idx) => {
      const r = session.speeches[idx]!;
      if (!r.events.length) return '';
      const used = elapsedMs(r.events, r.events.at(-1)?.at ?? 0) / 1000;
      const over = used - tpl.durationSec;
      const name = speakerName(tpl.role);
      const interruptions = r.interruptions
        .map((i) => {
          const clip = r.clips.find((c) => c.interruptionId === i.id);
          const line = esc(t('interruptions.logLine', { time: formatClock(i.raisedAtSec), kind: i.kind, seat: i.raisedBy, outcome: outcomeText(t, i) }));
          return `<li>${line}${opts.includeTranscripts && clip ? transcriptHtml(t, session.transcripts?.[clip.id]) : ''}</li>`;
        })
        .join('');
      const notes = (session.notes ?? [])
        .filter((n) => n.speechIndex === idx)
        .sort((a, b) => a.atSec - b.atSec)
        .map((n) => `<li><span class="time" dir="ltr">${formatClock(n.atSec)}</span> ${esc(n.text)}</li>`)
        .join('');
      const room = r.clips.find((c) => !c.interruptionId);
      return `<section>
        <h3>${esc(tpl.role)} · ${esc(roleName(t, tpl))}${name ? ` · ${esc(name)}` : ''}</h3>
        <p>${esc(t('report.time'))}: <b dir="ltr">${formatClock(used)}</b>${over > 0 ? ` (${esc(t('review.overBy', { seconds: Math.round(over) }))})` : ''}</p>
        ${interruptions ? `<h4>${esc(t('report.interruptions'))}</h4><ul>${interruptions}</ul>` : ''}
        ${notes ? `<h4>${esc(t('report.notes'))}</h4><ul>${notes}</ul>` : ''}
        ${opts.includeTranscripts && room ? transcriptHtml(t, session.transcripts?.[room.id]) : ''}
      </section>`;
    })
    .join('');

  const lang = i18n.language;
  return `<!doctype html><html lang="${esc(lang)}" dir="${isRTL(lang) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(t('report.title'))}</title><style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #000; background: #fff; font-size: 11pt; line-height: 1.4; }
    h1 { font-family: 'Instrument Serif', Georgia, 'Times New Roman', serif; font-weight: 400; font-size: 28pt; margin: 0 0 4pt; } h2 { font-size: 15pt; border-bottom: 2px solid #000; padding-bottom: 2pt; margin-top: 18pt; }
    h3 { font-size: 12pt; margin: 14pt 0 4pt; } h4 { font-size: 10pt; margin: 8pt 0 2pt; text-transform: uppercase; letter-spacing: .04em; } [dir=rtl] h4 { letter-spacing: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 6pt; } th, td { border: 1px solid #000; padding: 4pt 6pt; vertical-align: top; text-align: start; }
    th { background: #000; color: #fff; } td.num { text-align: end; font-weight: bold; }
    .meta { color: #333; } .result { font-size: 13pt; font-weight: bold; border: 2px solid #000; padding: 6pt; }
    .warn { font-weight: bold; } .pre { white-space: pre-wrap; } .time { font-variant-numeric: tabular-nums; color: #555; unicode-bidi: isolate; }
    section { page-break-inside: avoid; border-top: 1px solid #999; } ul { margin: 2pt 0; padding-inline-start: 16pt; }
    .transcript { border-inline-start: 2px solid #000; padding-inline-start: 8pt; margin: 4pt 0; } .seg { margin: 1pt 0; }
    footer { margin-top: 24pt; font-size: 8pt; color: #555; }
  </style></head><body>
    <h1>${esc(t('report.title'))}</h1>
    <p class="meta">${esc(t('report.motion'))}: <b>${esc(session.motion || t('common.untitledMotion'))}</b><br>
    ${esc(t('report.format'))}: ${esc(formatName(t, session.format))} · ${esc(t('report.date'))}: ${esc(dateTime(session.createdAt))}</p>
    ${ballot}
    <h2>${esc(t('report.speeches'))}</h2>
    ${speeches}
    <footer>${esc(t('report.generated', { date: dateTime(Date.now()) }))}</footer>
  </body></html>`;
}

export function reportFileName(session: Session, t: T): string {
  const d = new Date(session.createdAt);
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${t('report.fileName', { date: stamp }).replace(/[^\w.-]+/g, '-').replace(/^-+/, '')}.pdf`;
}
