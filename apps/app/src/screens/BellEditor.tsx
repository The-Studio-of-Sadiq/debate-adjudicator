import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { formatClock, normalizeBells, type BellPattern, type BellRule, type DebateFormat, type SpeechTemplate } from '@debate/core';
import { ringBell } from '../hooks';
import { colors } from '../theme';
import { Btn, Card, Chip, Row, styles } from '../ui';

const PATTERNS: BellPattern[] = ['single', 'double', 'triple', 'continuous'];

/** Speeches that share timing (e.g. all substantives, all replies) are edited together. */
type Group = 'substantive' | 'reply';
const groupOf = (t: SpeechTemplate): Group => (t.poiWindow ? 'substantive' : 'reply');

function parseClock(v: string): number | null {
  const m = v.trim().match(/^(\d+)(?::(\d{1,2}))?$/);
  if (!m) return null;
  return m[2] === undefined ? Number(m[1]) : Number(m[1]) * 60 + Number(m[2]);
}

function ClockInput({ value, onChange }: { value: number; onChange: (sec: number) => void }) {
  const [text, setText] = useState(formatClock(value));
  return (
    <TextInput
      style={[styles.input, { width: 80, textAlign: 'center' }]}
      value={text}
      onChangeText={setText}
      onBlur={() => {
        const sec = parseClock(text);
        if (sec === null) setText(formatClock(value));
        else {
          onChange(sec);
          setText(formatClock(sec));
        }
      }}
      placeholder="m:ss"
      placeholderTextColor={colors.muted}
    />
  );
}

export function BellEditor(props: { format: DebateFormat; onSave: (f: DebateFormat) => void; onReset: () => void; onClose: () => void }) {
  const [format, setFormat] = useState(props.format);
  const groups = (['substantive', 'reply'] as Group[]).filter((g) => format.speeches.some((s) => groupOf(s) === g));

  function updateGroup(g: Group, fn: (t: SpeechTemplate) => SpeechTemplate) {
    setFormat((f) => ({ ...f, speeches: f.speeches.map((s) => (groupOf(s) === g ? fn(s) : s)) }));
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Bells · {format.name}</Text>
      {groups.map((g) => {
        const sample = format.speeches.find((s) => groupOf(s) === g)!;
        const setBells = (bells: BellRule[]) => updateGroup(g, (t) => ({ ...t, bells }));
        return (
          <Card key={g}>
            <Text style={styles.h2}>{g === 'substantive' ? 'Substantive speeches' : 'Reply speeches'}</Text>
            <Text style={styles.muted}>{format.speeches.filter((s) => groupOf(s) === g).map((s) => s.role).join(' · ')}</Text>

            <Row>
              <Text style={styles.text}>Length</Text>
              <ClockInput value={sample.durationSec} onChange={(v) => updateGroup(g, (t) => ({ ...t, durationSec: v }))} />
              <Text style={styles.text}>Grace</Text>
              <ClockInput value={sample.graceSec} onChange={(v) => updateGroup(g, (t) => ({ ...t, graceSec: v }))} />
            </Row>
            {sample.poiWindow && (
              <Row>
                <Text style={styles.text}>POIs from</Text>
                <ClockInput
                  value={sample.poiWindow.from}
                  onChange={(v) => updateGroup(g, (t) => ({ ...t, poiWindow: { from: v, to: t.poiWindow!.to } }))}
                />
                <Text style={styles.text}>to</Text>
                <ClockInput
                  value={sample.poiWindow.to}
                  onChange={(v) => updateGroup(g, (t) => ({ ...t, poiWindow: { from: t.poiWindow!.from, to: v } }))}
                />
              </Row>
            )}

            {sample.bells.map((b, i) => (
              <View key={`${i}-${b.at}`} style={{ gap: 6, paddingVertical: 6, borderTopWidth: 1, borderColor: colors.border }}>
                <Row>
                  <ClockInput
                    value={b.at}
                    onChange={(v) => setBells(normalizeBells(sample.bells.map((x, j) => (j === i ? { ...x, at: v } : x))))}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, minWidth: 120 }]}
                    value={b.label ?? ''}
                    placeholder="Label"
                    placeholderTextColor={colors.muted}
                    onChangeText={(label) => setBells(sample.bells.map((x, j) => (j === i ? { ...x, label } : x)))}
                  />
                  <Btn title="▶" onPress={() => ringBell(b.pattern)} />
                  <Btn title="✕" color={colors.danger} onPress={() => setBells(sample.bells.filter((_, j) => j !== i))} />
                </Row>
                <Row>
                  {PATTERNS.map((p) => (
                    <Chip
                      key={p}
                      label={p}
                      active={b.pattern === p}
                      onPress={() => setBells(sample.bells.map((x, j) => (j === i ? { ...x, pattern: p } : x)))}
                    />
                  ))}
                </Row>
              </View>
            ))}
            <Btn
              title="+ Add bell"
              onPress={() => setBells(normalizeBells([...sample.bells, { at: (sample.bells.at(-1)?.at ?? 0) + 30, pattern: 'single' }]))}
            />
          </Card>
        );
      })}
      <Row>
        <Btn title="Save" color={colors.accent} onPress={() => props.onSave(format)} />
        <Btn title="Reset to default" onPress={props.onReset} />
        <Btn title="Cancel" onPress={props.onClose} />
      </Row>
    </ScrollView>
  );
}
