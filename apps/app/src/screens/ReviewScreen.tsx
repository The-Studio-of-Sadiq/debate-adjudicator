import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { elapsedMs, formatClock, segmentIndexAt, type ClipRef, type Session, type Transcript } from '@debate/core';
import type { JobState } from '../transcription/useTranscriptionJobs';
import { colors } from '../theme';
import { Btn, Card, Row, styles } from '../ui';
import { progressText } from './TranscriptionSettingsScreen';
import { describeOutcome } from './TimerScreen';

/** Player plus its transcript; tapping a line plays from that moment. */
function ClipPlayer(props: { clip: ClipRef; transcript?: Transcript; job?: JobState; onTranscribe: () => void }) {
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
          title={status.playing ? 'Pause' : 'Play'}
          onPress={() => {
            if (status.playing) player.pause();
            else if (status.didJustFinish || status.currentTime >= status.duration) playFrom(0);
            else player.play();
          }}
        />
        <Text style={styles.muted}>
          {formatClock(status.currentTime)} / {formatClock(status.duration || clip.durationMs / 1000)}
        </Text>
        {job?.status === 'queued' && <Text style={styles.muted}>Waiting to transcribe…</Text>}
        {job?.status === 'running' && <Text style={[styles.muted, { color: colors.accent }]}>{progressText(job.progress)}</Text>}
        {!job || job.status === 'error' ? (
          <Btn title={transcript ? 'Re-transcribe' : 'Transcribe'} onPress={props.onTranscribe} />
        ) : null}
      </Row>
      {job?.status === 'error' && <Text style={{ color: colors.danger }}>{job.error}</Text>}
      {transcript && (
        <View style={{ gap: 2, backgroundColor: colors.surfaceHi, borderRadius: 10, padding: 10 }}>
          {transcript.segments.length === 0 && <Text style={styles.muted}>No speech detected.</Text>}
          {transcript.segments.map((s, i) => (
            <Pressable key={i} onPress={() => playFrom(s.startMs / 1000)}>
              <Text style={[styles.text, i === playingIdx && { color: colors.accent }]}>
                <Text style={styles.muted}>{formatClock(s.startMs / 1000)} </Text>
                {s.text}
              </Text>
            </Pressable>
          ))}
          <Text style={[styles.muted, { fontSize: 11 }]}>
            {transcript.engine.startsWith('cloud') ? 'Cloud' : 'Offline'} · {transcript.engine.split(':')[1]}
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
  onBack: () => void;
  onResume: () => void;
  onDelete: () => void;
}) {
  const { session, jobs } = props;
  const allClips = session.speeches.flatMap((r) => r.clips);
  const untranscribed = allClips.filter((c) => !session.transcripts?.[c.id] && !jobs[c.id]);
  const clipProps = (c: ClipRef) => ({
    clip: c,
    transcript: session.transcripts?.[c.id],
    job: jobs[c.id],
    onTranscribe: () => props.onTranscribe([c]),
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Btn title="← Rounds" onPress={props.onBack} />
        <Row>
          <Btn title="Open timer" color={colors.accent} onPress={props.onResume} />
          <Btn title="Delete" color={colors.danger} onPress={props.onDelete} />
        </Row>
      </Row>
      <Text style={styles.h1}>{session.motion || 'Untitled motion'}</Text>
      <Text style={styles.muted}>
        {session.format.name} · {new Date(session.createdAt).toLocaleString()}
      </Text>
      {untranscribed.length > 0 && (
        <Btn
          title={`Transcribe all (${untranscribed.length})`}
          color={colors.accent}
          style={{ alignSelf: 'flex-start' }}
          onPress={() => props.onTranscribe(untranscribed)}
        />
      )}

      {session.format.speeches.map((t, idx) => {
        const r = session.speeches[idx]!;
        const used = elapsedMs(r.events, r.events.at(-1)?.at ?? 0) / 1000;
        const over = used - t.durationSec;
        return (
          <Card key={t.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[styles.h2, { color: t.side === 'gov' ? colors.gov : colors.opp }]}>
                {t.role} · {t.name}
              </Text>
              <Text style={[styles.text, { color: over > t.graceSec ? colors.danger : colors.text }]}>
                {r.events.length ? `${formatClock(used)}${over > 0 ? ` (+${Math.round(over)}s)` : ''}` : 'Not delivered'}
              </Text>
            </Row>
            {r.clips
              .filter((c) => !c.interruptionId)
              .map((c) => (
                <View key={c.id} style={{ gap: 4 }}>
                  <Text style={styles.muted}>Room recording</Text>
                  <ClipPlayer {...clipProps(c)} />
                </View>
              ))}
            {r.interruptions.map((i) => {
              const clip = r.clips.find((c) => c.interruptionId === i.id);
              return (
                <View key={i.id} style={{ gap: 4, paddingLeft: 10, borderLeftWidth: 2, borderColor: colors.border }}>
                  <Text style={styles.muted}>
                    {formatClock(i.raisedAtSec)} · {i.kind} from {i.raisedBy} · {describeOutcome(i)}
                  </Text>
                  {clip && <ClipPlayer {...clipProps(clip)} />}
                </View>
              );
            })}
          </Card>
        );
      })}
    </ScrollView>
  );
}
