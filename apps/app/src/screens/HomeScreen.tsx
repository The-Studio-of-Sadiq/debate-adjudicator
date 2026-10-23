import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput } from 'react-native';
import { PRESETS, type DebateFormat } from '@debate/core';
import { LANGUAGES, useT, type LanguagePreference } from '../i18n';
import { transport } from '../net/transport';
import { listSessions, loadCustomFormats, type SessionSummary } from '../storage';
import { Lockup } from '../Logo';
import { useTheme, type ThemePreference } from '../theme';
import { Btn, Card, Chip, Row } from '../ui';
import { FormatPicker } from './FormatPicker';

// Remembered while the app runs, so visiting Bell settings doesn't reset the choice.
let lastFormatId = PRESETS[0]!.id;

export function HomeScreen(props: {
  onStart: (format: DebateFormat, motion: string) => void;
  onEditBells: (format: DebateFormat) => void;
  onOpen: (id: string) => void;
  onJoin: () => void;
  onTranscriptionSettings: () => void;
  language: LanguagePreference;
  onLanguage: (pref: LanguagePreference) => void;
  themePref: ThemePreference;
  onThemePref: (pref: ThemePreference) => void;
}) {
  const { colors, styles } = useTheme();
  const t = useT();
  const [formats, setFormats] = useState<DebateFormat[]>(PRESETS);
  const [formatId, setFormatIdState] = useState(lastFormatId);
  const setFormatId = (id: string) => {
    lastFormatId = id;
    setFormatIdState(id);
  };
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

  const format = formats.find((f) => f.id === formatId) ?? formats[0]!;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Lockup />

      <Card>
        <Text style={styles.h2}>{t('home.newRound')}</Text>
        <FormatPicker formats={formats} selectedId={formatId} onSelect={setFormatId} />
        {!!format.info?.description && <Text style={styles.text}>{format.info.description}</Text>}
        <Text style={styles.muted}>{format.speeches.map((s) => s.role).join(' → ')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('home.motionPlaceholder')}
          placeholderTextColor={colors.muted}
          value={motion}
          onChangeText={setMotion}
        />
        <Row>
          <Btn title={t('home.startRound')} variant="primary" big onPress={() => props.onStart(format, motion.trim())} />
          <Btn title={t('home.bellSettings')} onPress={() => props.onEditBells(format)} />
        </Row>
      </Card>

      <Card>
        <Text style={styles.h2}>{t('home.joinTitle')}</Text>
        <Text style={styles.muted}>{t('home.joinHint')}</Text>
        <Btn title={t('common.join')} big disabled={!transport.available} onPress={props.onJoin} style={{ alignSelf: 'flex-start' }} />
        {!transport.available && <Text style={styles.muted}>{t(transport.unavailableReason!)}</Text>}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.h2}>{t('home.history')}</Text>
          <Btn title={t('home.transcriptionSettings')} onPress={props.onTranscriptionSettings} />
        </Row>
        {history.length === 0 && <Text style={styles.muted}>{t('home.noRounds')}</Text>}
        {history.map((h) => (
          <Pressable key={h.id} onPress={() => props.onOpen(h.id)} style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
            <Text style={styles.text}>{h.motion || t('common.untitledMotion')}</Text>
            <Text style={styles.muted}>
              {h.formatName} · {new Date(h.createdAt).toLocaleString()}
            </Text>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Text style={styles.h2}>{t('appearance.title')}</Text>
        <Row>
          {(['system', 'dark', 'light'] as ThemePreference[]).map((p) => (
            <Chip key={p} label={t(`appearance.${p}`)} active={props.themePref === p} onPress={() => props.onThemePref(p)} />
          ))}
        </Row>
      </Card>

      <Card>
        <Text style={styles.h2}>{t('language.title')}</Text>
        <Row>
          <Chip label={t('language.system')} active={props.language === 'system'} onPress={() => props.onLanguage('system')} />
          {Object.entries(LANGUAGES).map(([code, lang]) => (
            <Chip
              key={code}
              label={lang.name}
              active={props.language === code}
              onPress={() => props.onLanguage(code as LanguagePreference)}
            />
          ))}
        </Row>
      </Card>
    </ScrollView>
  );
}
