import { ScrollView, Text } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { elapsedMs, formatClock, type ClipRef, type Session } from '@debate/core';
import { colors } from '../theme';
import { Btn, Card, Row, styles } from '../ui';
import { describeOutcome } from './TimerScreen';

function ClipPlayer({ clip }: { clip: ClipRef }) {
  const player = useAudioPlayer(clip.uri);
  const status = useAudioPlayerStatus(player);
  return (
    <Row>
      <Btn
        title={status.playing ? 'Pause' : 'Play'}
        onPress={() => {
          if (status.playing) player.pause();
          else {
            if (status.didJustFinish || status.currentTime >= status.duration) void player.seekTo(0);
            player.play();
          }
        }}
      />
      <Text style={styles.muted}>
        {formatClock(status.currentTime)} / {formatClock(clip.durationMs / 1000)}
      </Text>
    </Row>
  );
}

export function ReviewScreen(props: { session: Session; onBack: () => void; onResume: () => void; onDelete: () => void }) {
  const { session } = props;
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
            {r.interruptions.map((i) => (
              <Text key={i.id} style={styles.muted}>
                {formatClock(i.raisedAtSec)} · {i.kind} from {i.raisedBy} · {describeOutcome(i)}
              </Text>
            ))}
            {r.clips.map((c) => (
              <ClipPlayer key={c.id} clip={c} />
            ))}
          </Card>
        );
      })}
    </ScrollView>
  );
}
