import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { formatClock, normalizeBells, type BellPattern, type BellRule, type DebateFormat, type SpeechTemplate } from '@debate/core';
import { ringBell } from '../hooks';
import { formatName, useT } from '../i18n';
import { useTheme } from '../theme';
import { Btn, Card, Chip, Row } from '../ui';

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
  const { colors, styles } = useTheme();
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
  const { colors, styles } = useTheme();
  const t = useT();
  const [format, setFormat] = useState(props.format);
  const groups = (['substantive', 'reply'] as Group[]).filter((g) => format.speeches.some((s) => groupOf(s) === g));

  function updateGroup(g: Group, fn: (s: SpeechTemplate) => SpeechTemplate) {
    setFormat((f) => ({ ...f, speeches: f.speeches.map((s) => (groupOf(s) === g ? fn(s) : s)) }));
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{t('bells.title', { format: formatName(t, format) })}</Text>
      {groups.map((g) => {
        const sample = format.speeches.find((s) => groupOf(s) === g)!;
        const setBells = (bells: BellRule[]) => updateGroup(g, (s) => ({ ...s, bells }));
        return (
          <Card key={g}>
            <Text style={styles.h2}>{t(g === 'substantive' ? 'bells.substantive' : 'bells.reply')}</Text>
            <Text style={styles.muted}>{format.speeches.filter((s) => groupOf(s) === g).map((s) => s.role).join(' · ')}</Text>

            <Row>
              <Text style={styles.text}>{t('bells.length')}</Text>
              <ClockInput value={sample.durationSec} onChange={(v) => updateGroup(g, (s) => ({ ...s, durationSec: v }))} />
              <Text style={styles.text}>{t('bells.grace')}</Text>
              <ClockInput value={sample.graceSec} onChange={(v) => updateGroup(g, (s) => ({ ...s, graceSec: v }))} />
            </Row>
            {sample.poiWindow && (
              <Row>
                <Text style={styles.text}>{t('bells.poisFrom')}</Text>
                <ClockInput
                  value={sample.poiWindow.from}
                  onChange={(v) => updateGroup(g, (s) => ({ ...s, poiWindow: { from: v, to: s.poiWindow!.to } }))}
                />
                <Text style={styles.text}>{t('bells.to')}</Text>
                <ClockInput
                  value={sample.poiWindow.to}
                  onChange={(v) => updateGroup(g, (s) => ({ ...s, poiWindow: { from: s.poiWindow!.from, to: v } }))}
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
                    placeholder={t('bells.label')}
                    placeholderTextColor={colors.muted}
                    onChangeText={(label) => setBells(sample.bells.map((x, j) => (j === i ? { ...x, label } : x)))}
                  />
                  <Btn title="▶" onPress={() => ringBell(b.pattern)} />
                  <Btn title="✕" variant="outline" onPress={() => setBells(sample.bells.filter((_, j) => j !== i))} />
                </Row>
                <Row>
                  {PATTERNS.map((p) => (
                    <Chip
                      key={p}
                      label={t(`bells.patterns.${p}`)}
                      active={b.pattern === p}
                      onPress={() => setBells(sample.bells.map((x, j) => (j === i ? { ...x, pattern: p } : x)))}
                    />
                  ))}
                </Row>
              </View>
            ))}
            <Btn
              title={t('bells.addBell')}
              onPress={() => setBells(normalizeBells([...sample.bells, { at: (sample.bells.at(-1)?.at ?? 0) + 30, pattern: 'single' }]))}
            />
          </Card>
        );
      })}
      <Row>
        <Btn title={t('common.save')} variant="primary" onPress={() => props.onSave(format)} />
        <Btn title={t('bells.reset')} onPress={props.onReset} />
        <Btn title={t('common.cancel')} variant="outline" onPress={props.onClose} />
      </Row>
    </ScrollView>
  );
}
