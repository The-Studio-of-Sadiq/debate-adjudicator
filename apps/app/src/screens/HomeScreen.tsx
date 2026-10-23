import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput } from 'react-native';
import { PRESETS, type DebateFormat } from '@debate/core';
import { transport } from '../net/transport';
import { listSessions, loadCustomFormats, type SessionSummary } from '../storage';
import { colors } from '../theme';
import { Btn, Card, Chip, Row, styles } from '../ui';

export function HomeScreen(props: {
  onStart: (format: DebateFormat, motion: string) => void;
  onEditBells: (format: DebateFormat) => void;
  onOpen: (id: string) => void;
  onJoin: () => void;
  onTranscriptionSettings: () => void;
}) {
  const [formats, setFormats] = useState<DebateFormat[]>(PRESETS);
  const [formatId, setFormatId] = useState(PRESETS[0]!.id);
  const [motion, setMotion] = useState('');
  const [history, setHistory] = useState<SessionSummary[]>([]);

  const refresh = useCallback(async () => {
    const custom = await loadCustomFormats();
    setFormats(PRESETS.map((p) => custom[p.id] ?? p));
    setHistory(await listSessions());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const format = formats.find((f) => f.id === formatId)!;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Debate Adjudicator</Text>

      <Card>
        <Text style={styles.h2}>New round</Text>
        <Row>
          {formats.map((f) => (
            <Chip key={f.id} label={f.name} active={f.id === formatId} onPress={() => setFormatId(f.id)} />
          ))}
        </Row>
        <Text style={styles.muted}>
          {format.speeches.map((s) => s.role).join(' → ')}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Motion (optional)"
          placeholderTextColor={colors.muted}
          value={motion}
          onChangeText={setMotion}
        />
        <Row>
          <Btn title="Start round" color={colors.accent} big onPress={() => props.onStart(format, motion.trim())} />
          <Btn title="Bell settings" onPress={() => props.onEditBells(format)} />
        </Row>
      </Card>

      <Card>
        <Text style={styles.h2}>Join a round</Text>
        <Text style={styles.muted}>Debaters, timekeepers and wing adjudicators: scan the chair's QR code.</Text>
        <Btn title="Join" big disabled={!transport.available} onPress={props.onJoin} style={{ alignSelf: 'flex-start' }} />
        {!transport.available && <Text style={styles.muted}>{transport.unavailableReason}</Text>}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.h2}>History</Text>
          <Btn title="Transcription settings" onPress={props.onTranscriptionSettings} />
        </Row>
        {history.length === 0 && <Text style={styles.muted}>No rounds yet.</Text>}
        {history.map((h) => (
          <Pressable key={h.id} onPress={() => props.onOpen(h.id)} style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
            <Text style={styles.text}>{h.motion || 'Untitled motion'}</Text>
            <Text style={styles.muted}>
              {h.formatName} · {new Date(h.createdAt).toLocaleString()}
            </Text>
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}
