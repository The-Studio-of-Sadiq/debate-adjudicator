import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { elapsedMs, formatClock, segmentIndexAt, type ClipRef, type Session, type Transcript } from '@debate/core';
import { errorText, formatName, outcomeText, roleName, useT } from '../i18n';
import { exportPdf } from '../pdf';
import { buildReportHtml, reportFileName } from '../report';
import type { JobState } from '../transcription/useTranscriptionJobs';
import { useTheme } from '../theme';
import { Btn, Card, Chip, Row } from '../ui';
import { progressText } from './TranscriptionSettingsScreen';

/** Player plus its transcript; tapping a line plays from that moment. */
function ClipPlayer(props: { clip: ClipRef; transcript?: Transcript; job?: JobState; onTranscribe: () => void }) {
  const { colors, styles } = useTheme();
  const t = useT();
  const { clip, transcript, job } = props;
  const player = useAudioPlayer(clip.uri);
  const status = useAudioPlayerStatus(player);
  const playingIdx = transcript && status.playing ? segmentIndexAt(transcript, status.currentTime * 1000) : -1;

  const playFrom = (sec: number) => {
    void player.seekTo(sec);
    player.play();
  };

  return (
    <View style={{ gap: 6 }}>
      <Row>
        <Btn
          title={status.playing ? t('review.pause') : t('review.play')}
          onPress={() => {
            if (status.playing) player.pause();
            else if (status.didJustFinish || status.currentTime >= status.duration) playFrom(0);
            else player.play();
          }}
        />
        <Text style={styles.muted}>
          {formatClock(status.currentTime)} / {formatClock(status.duration || clip.durationMs / 1000)}
        </Text>
        {job?.status === 'queued' && <Text style={styles.muted}>{t('review.waitingToTranscribe')}</Text>}
        {job?.status === 'running' && <Text style={styles.text}>{progressText(t, job.progress)}</Text>}
        {!job || job.status === 'error' ? (
          <Btn title={transcript ? t('review.retranscribe') : t('review.transcribe')} onPress={props.onTranscribe} />
        ) : null}
      </Row>
      {job?.status === 'error' && <Text style={styles.alert}>⚠ {errorText(t, job.error)}</Text>}
      {transcript && (
        <View style={{ gap: 2, backgroundColor: colors.surfaceHi, borderRadius: 10, padding: 10 }}>
          {transcript.segments.length === 0 && <Text style={styles.muted}>{t('review.noSpeech')}</Text>}
          {transcript.segments.map((s, i) => (
            <Pressable key={i} onPress={() => playFrom(s.startMs / 1000)}>
              <Text
                style={[
                  styles.text,
                  i === playingIdx && { backgroundColor: colors.primary, color: colors.onPrimary, fontWeight: '600' },
                ]}
              >
                <Text style={i === playingIdx ? undefined : styles.muted}>{formatClock(s.startMs / 1000)} </Text>
                {s.text}
              </Text>
            </Pressable>
          ))}
          <Text style={[styles.muted, { fontSize: 11 }]}>
            {t(transcript.engine.startsWith('cloud') ? 'review.engineCloud' : 'review.engineOffline', { model: transcript.engine.split(':')[1] })}
          </Text>
        </View>
      )}
    </View>
  );
}

export function ReviewScreen(props: {
  session: Session;
  jobs: Record<string, JobState>;
  onTranscribe: (clips: ClipRef[]) => void;
  onBallot: () => void;
  onBack: () => void;
  onResume: () => void;
  onDelete: () => void;
}) {
  const { colors, styles } = useTheme();
  const t = useT();
  const { session, jobs } = props;
  const [includeTranscripts, setIncludeTranscripts] = useState(true);
  const [exportState, setExportState] = useState<{ busy?: boolean; message?: string; alert?: boolean } | null>(null);
  const allClips = session.speeches.flatMap((r) => r.clips);
  const untranscribed = allClips.filter((c) => !session.transcripts?.[c.id] && !jobs[c.id]);
  const clipProps = (c: ClipRef) => ({
    clip: c,
    transcript: session.transcripts?.[c.id],
    job: jobs[c.id],
    onTranscribe: () => props.onTranscribe([c]),
  });

  async function doExport() {
    setExportState({ busy: true, message: t('review.exporting') });
    try {
      const html = buildReportHtml(session, t, { includeTranscripts });
      const path = await exportPdf(html, reportFileName(session, t), t('review.exportPdf'));
      setExportState(path ? { message: t('review.exported', { path }) } : null);
    } catch (e) {
      setExportState({ message: t('review.exportFailed', { error: errorText(t, e instanceof Error ? e.message : String(e)) }), alert: true });
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Btn title={t('timer.rounds')} onPress={props.onBack} />
        <Row>
          <Btn title={t('review.openTimer')} onPress={props.onResume} />
          <Btn title={t('common.delete')} variant="outline" onPress={props.onDelete} />
        </Row>
      </Row>
      <Text style={styles.h1}>{session.motion || t('common.untitledMotion')}</Text>
      <Text style={styles.muted}>
        {formatName(t, session.format)} · {new Date(session.createdAt).toLocaleString()}
      </Text>

      <Card>
        <Row>
          <Btn title={session.ballot?.finalizedAt ? t('review.ballotFinal') : t('review.ballot')} variant="primary" onPress={props.onBallot} />
          <Btn title={t('review.exportPdf')} disabled={exportState?.busy} onPress={() => void doExport()} />
          <Chip label={t('review.includeTranscripts')} active={includeTranscripts} onPress={() => setIncludeTranscripts((v) => !v)} />
          {untranscribed.length > 0 && (
            <Btn title={t('review.transcribeAll', { count: untranscribed.length })} onPress={() => props.onTranscribe(untranscribed)} />
          )}
        </Row>
        {exportState?.message && <Text style={exportState.alert ? styles.alert : styles.muted}>{exportState.message}</Text>}
      </Card>

      {session.format.speeches.map((tpl, idx) => {
        const r = session.speeches[idx]!;
        const used = elapsedMs(r.events, r.events.at(-1)?.at ?? 0) / 1000;
        const over = used - tpl.durationSec;
        const notes = (session.notes ?? []).filter((n) => n.speechIndex === idx).sort((a, b) => a.atSec - b.atSec);
        const speaker = session.speakers?.[tpl.role];
        return (
          <Card key={tpl.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[styles.h2, { color: tpl.side === 'gov' ? colors.gov : colors.opp }]}>
                {tpl.role} · {roleName(t, tpl)}
                {speaker ? ` · ${speaker}` : ''}
              </Text>
              <Text style={over > tpl.graceSec ? styles.alert : styles.text}>
                {r.events.length
                  ? `${formatClock(used)}${over > 0 ? ` (${t('review.overBy', { seconds: Math.round(over) })})` : ''}`
                  : t('review.notDelivered')}
              </Text>
            </Row>
            {r.clips
              .filter((c) => !c.interruptionId)
              .map((c) => (
                <View key={c.id} style={{ gap: 4 }}>
                  <Text style={styles.muted}>{t('review.roomRecording')}</Text>
                  <ClipPlayer {...clipProps(c)} />
                </View>
              ))}
            {r.interruptions.map((i) => {
              const clip = r.clips.find((c) => c.interruptionId === i.id);
              return (
                <View key={i.id} style={{ gap: 4, paddingLeft: 10, borderLeftWidth: 2, borderColor: colors.border }}>
                  <Text style={styles.muted}>
                    {t('interruptions.logLine', { time: formatClock(i.raisedAtSec), kind: i.kind, seat: i.raisedBy, outcome: outcomeText(t, i) })}
                  </Text>
                  {clip && <ClipPlayer {...clipProps(clip)} />}
                </View>
              );
            })}
            {notes.length > 0 && (
              <View style={{ gap: 2 }}>
                <Text style={styles.muted}>{t('review.notes')}</Text>
                {notes.map((n) => (
                  <Text key={n.id} style={styles.text}>
                    <Text style={styles.muted}>{formatClock(n.atSec)} </Text>
                    {n.text}
                  </Text>
                ))}
              </View>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}
