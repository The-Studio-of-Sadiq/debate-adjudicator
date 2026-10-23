import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import {
  ballotSpecFor,
  evaluateBallot,
  rangeFor,
  type BallotIssue,
  type ScoreRange,
  type Session,
  type SessionAction,
  type SpeechTemplate,
} from '@debate/core';
import { roleName, teamName, useT, type T } from '../i18n';
import { colors } from '../theme';
import { Btn, Card, Row, styles } from '../ui';

export const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Text field that commits on blur, so typing isn't fought by trimming/validation. */
function CommitField(props: {
  value: string;
  placeholder?: string;
  numeric?: boolean;
  multiline?: boolean;
  width?: number;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(props.value);
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[
        styles.input,
        { width: props.width, flex: props.width || props.multiline ? undefined : 1, minWidth: 120, textAlign: props.numeric ? 'center' : 'left' },
        props.multiline && { minHeight: 120, textAlignVertical: 'top' },
      ]}
      value={focused ? text : props.value}
      placeholder={props.placeholder}
      placeholderTextColor={colors.muted}
      multiline={props.multiline}
      keyboardType={props.numeric ? 'decimal-pad' : 'default'}
      onFocus={() => {
        setText(props.value);
        setFocused(true);
      }}
      onChangeText={setText}
      onBlur={() => {
        setFocused(false);
        props.onCommit(text);
      }}
      onSubmitEditing={props.multiline ? undefined : () => props.onCommit(text)}
    />
  );
}

function SpeakerRow(props: {
  speech: SpeechTemplate;
  range: ScoreRange;
  name: string;
  score: number | undefined;
  onName: (name: string) => void;
  onScore: (score: number | null) => void;
}) {
  const t = useT();
  const { speech: s, range, score } = props;
  const bump = (dir: 1 | -1) => {
    const base = score ?? (range.min + range.max) / 2;
    const next = Math.round((base + dir * range.step) / range.step) * range.step;
    props.onScore(Math.min(range.max, Math.max(range.min, next)));
  };
  return (
    <View style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
      <Text style={styles.text}>
        {s.role} · {roleName(t, s)} <Text style={styles.muted}>({t('ballot.range', { min: range.min, max: range.max })})</Text>
      </Text>
      <Row>
        <CommitField value={props.name} placeholder={t('ballot.name')} onCommit={props.onName} />
        <Btn title="−" onPress={() => bump(-1)} />
        <CommitField
          numeric
          width={80}
          value={score === undefined ? '' : fmtScore(score)}
          placeholder="—"
          onCommit={(text) => {
            const v = parseFloat(text.replace(',', '.'));
            props.onScore(text.trim() === '' || Number.isNaN(v) ? null : v);
          }}
        />
        <Btn title="+" onPress={() => bump(1)} />
      </Row>
    </View>
  );
}

export function issueText(t: T, issue: BallotIssue, speakerOf: (id: string) => string): string {
  switch (issue.code) {
    case 'missingScore':
      return t('ballot.issues.missingScore', { speaker: speakerOf(issue.speechId) });
    case 'outOfRange':
      return t('ballot.issues.outOfRange', { speaker: speakerOf(issue.speechId), min: issue.range.min, max: issue.range.max });
    case 'offStep':
      return t('ballot.issues.offStep', { speaker: speakerOf(issue.speechId), step: issue.step });
    case 'tiedTotals':
      return t('ballot.issues.tiedTotals', { teams: issue.teamIds.map((id) => teamName(t, id)).join(' / ') });
  }
}

export function BallotScreen({ session, dispatch, onBack }: { session: Session; dispatch: (a: SessionAction) => void; onBack: () => void }) {
  const t = useT();
  const spec = ballotSpecFor(session.format);
  const result = evaluateBallot(session.format, session.ballot);
  const scores = session.ballot?.scores ?? {};
  const finalizedAt = session.ballot?.finalizedAt;
  const templateOf = (id: string) => session.format.speeches.find((s) => s.id === id);
  const speakerOf = (id: string) => {
    const s = templateOf(id);
    if (!s) return id;
    const name = session.speakers?.[s.role];
    return name ? `${s.role} (${name})` : s.role;
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Btn title={t('common.back')} onPress={onBack} />
        {finalizedAt ? (
          <Btn title={t('ballot.reopen')} variant="outline" onPress={() => dispatch({ type: 'finalizeBallot', at: null })} />
        ) : (
          <Btn
            title={t('ballot.finalize')}
            variant="primary"
            disabled={!result.complete}
            onPress={() => dispatch({ type: 'finalizeBallot', at: Date.now() })}
          />
        )}
      </Row>
      <Text style={styles.h1}>{t('ballot.title')}</Text>
      {!!session.motion && <Text style={styles.h2}>{session.motion}</Text>}
      <Text style={styles.muted}>{t(spec.kind === 'ranked' ? 'ballot.rankedHint' : 'ballot.winlossHint')}</Text>
      {finalizedAt && <Text style={styles.text}>{t('ballot.finalized', { time: new Date(finalizedAt).toLocaleString() })}</Text>}

      {spec.kind === 'winloss' && result.complete && result.margin !== undefined && (
        <Card style={{ backgroundColor: colors.primary }}>
          <Text style={[styles.h2, { color: colors.onPrimary }]}>
            {t('ballot.winner', { team: teamName(t, result.order[0]!), margin: fmtScore(result.margin) })}
          </Text>
        </Card>
      )}

      {spec.teams.map((team) => {
        const speeches = team.speechIds.map(templateOf).filter((s): s is SpeechTemplate => !!s);
        const rank = result.order.indexOf(team.id) + 1;
        return (
          <Card key={team.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[styles.h2, { color: team.side === 'gov' ? colors.gov : colors.opp }]}>{teamName(t, team.id)}</Text>
              <Text style={styles.text}>
                {result.complete && spec.kind === 'ranked'
                  ? `${t(`ballot.rank_${rank}`)} · ${t('ballot.points', { count: result.points[team.id] })} · `
                  : ''}
                {t('ballot.total', { total: fmtScore(result.totals[team.id] ?? 0) })}
              </Text>
            </Row>
            {speeches.map((s) => (
              <SpeakerRow
                key={s.id}
                speech={s}
                range={rangeFor(spec, session.format, s.id)}
                name={session.speakers?.[s.role] ?? ''}
                score={scores[s.id]}
                onName={(name) => dispatch({ type: 'setSpeaker', role: s.role, name })}
                onScore={(score) => dispatch({ type: 'setScore', speechId: s.id, score })}
              />
            ))}
          </Card>
        );
      })}

      {result.issues.length > 0 && (
        <Card>
          {result.issues.map((issue, i) => (
            <Text key={i} style={styles.alert}>
              ⚠ {issueText(t, issue, speakerOf)}
            </Text>
          ))}
        </Card>
      )}

      <Card>
        <Text style={styles.h2}>{t('ballot.comments')}</Text>
        <CommitField
          multiline
          value={session.ballot?.comments ?? ''}
          onCommit={(comments) => dispatch({ type: 'setBallotComments', comments })}
        />
      </Card>
    </ScrollView>
  );
}
