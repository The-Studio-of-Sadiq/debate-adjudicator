import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { errorText, useT, type T } from '../i18n';
import { CLOUD_PRESETS, localEngine, offlineSupports, SPEECH_LANGUAGES, type ModelName, type Progress, type TranscriptionSettings } from '../transcription';
import { loadTranscriptionSettings, saveTranscriptionSettings } from '../storage';
import { useTheme } from '../theme';
import { Btn, Card, Chip, Row } from '../ui';

const MODES: TranscriptionSettings['mode'][] = ['auto', 'local', 'cloud'];

export function progressText(t: T, p: Progress | undefined): string {
  if (!p) return t('transcription.progress.starting');
  if (p.stage === 'download') return t('transcription.progress.download', { percent: p.total ? Math.round((p.loaded / p.total) * 100) : 0 });
  if (p.stage === 'decode') return t('transcription.progress.decode');
  if (p.stage === 'upload') return t('transcription.progress.upload');
  return p.percent != null
    ? t('transcription.progress.transcribePercent', { percent: Math.round(p.percent) })
    : t('transcription.progress.transcribe');
}

export function TranscriptionSettingsScreen({ onBack }: { onBack: () => void }) {
  const { colors, styles } = useTheme();
  const t = useT();
  const [settings, setSettings] = useState<TranscriptionSettings | null>(null);
  const [downloaded, setDownloaded] = useState<Partial<Record<ModelName, boolean>>>({});
  const [busy, setBusy] = useState<{ model: ModelName; progress?: Progress } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const refreshModels = useCallback(async () => {
    const entries = await Promise.all(localEngine.models.map(async (m) => [m.name, await localEngine.isDownloaded(m.name)] as const));
    setDownloaded(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    void loadTranscriptionSettings().then(setSettings);
    void refreshModels();
  }, [refreshModels]);

  if (!settings) return null;

  const update = (patch: Partial<TranscriptionSettings>) => {
    setSaved(false);
    setSettings({ ...settings, ...patch });
  };
  const updateCloud = (patch: Partial<TranscriptionSettings['cloud']>) => update({ cloud: { ...settings.cloud, ...patch } });

  async function download(model: ModelName) {
    setError(null);
    setBusy({ model });
    try {
      await localEngine.prepare(model, (progress) => setBusy({ model, progress }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      void refreshModels();
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Btn title={t('common.back')} onPress={onBack} />
        <Btn
          title={saved ? t('common.saved') : t('common.save')}
          variant="primary"
          onPress={async () => {
            await saveTranscriptionSettings(settings);
            setSaved(true);
          }}
        />
      </Row>
      <Text style={styles.h1}>{t('transcription.title')}</Text>

      <Card>
        <Text style={styles.h2}>{t('transcription.speechLanguage')}</Text>
        <Row>
          {SPEECH_LANGUAGES.map((l) => (
            <Chip key={l} label={t(`transcription.languages.${l}`)} active={settings.language === l} onPress={() => update({ language: l })} />
          ))}
        </Row>
        {!offlineSupports(settings) && <Text style={styles.muted}>{t('transcription.cloudOnlyLanguage')}</Text>}
        {!offlineSupports(settings) && settings.mode === 'local' && <Text style={styles.alert}>⚠ {t('transcription.offlineEnglishOnly')}</Text>}
      </Card>

      <Card>
        <Text style={styles.h2}>{t('transcription.whenCloud')}</Text>
        <Row>
          {MODES.map((m) => (
            <Chip key={m} label={t(`transcription.modes.${m}`)} active={settings.mode === m} onPress={() => update({ mode: m })} />
          ))}
        </Row>
        <Text style={styles.muted}>{t(`transcription.modes.${settings.mode}Hint`)}</Text>
      </Card>

      <Card>
        <Text style={styles.h2}>{t('transcription.offlineModel')}</Text>
        {!localEngine.available && <Text style={styles.alert}>⚠ {t(localEngine.unavailableReason!)}</Text>}
        <Text style={styles.muted}>{t('transcription.offlineHint')}</Text>
        {localEngine.models.map((m) => (
          <View key={m.name} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Chip
                label={t('transcription.modelSize', { label: t(`transcription.models.${m.name}`), size: m.sizeMb })}
                active={settings.model === m.name}
                onPress={() => update({ model: m.name })}
              />
              {busy?.model === m.name ? (
                <Text style={styles.muted}>{progressText(t, busy.progress)}</Text>
              ) : downloaded[m.name] ? (
                <Row>
                  <Text style={styles.text}>{t('transcription.downloaded')}</Text>
                  <Btn
                    title={t('common.delete')}
                    variant="outline"
                    disabled={!!busy}
                    onPress={async () => {
                      await localEngine.deleteModel(m.name);
                      void refreshModels();
                    }}
                  />
                </Row>
              ) : (
                <Btn title={t('transcription.download')} disabled={!!busy} onPress={() => void download(m.name)} />
              )}
            </Row>
          </View>
        ))}
        {error && <Text style={styles.alert}>⚠ {errorText(t, error)}</Text>}
      </Card>

      <Card>
        <Text style={styles.h2}>{t('transcription.cloudTitle')}</Text>
        <Text style={styles.muted}>{t('transcription.cloudHint')}</Text>
        <Row>
          {CLOUD_PRESETS.map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              active={settings.cloud.provider === p.provider && settings.cloud.baseUrl === p.baseUrl}
              onPress={() => updateCloud({ provider: p.provider, baseUrl: p.baseUrl, model: p.model })}
            />
          ))}
        </Row>
        <TextInput
          style={styles.input}
          placeholder={t('transcription.baseUrl')}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          value={settings.cloud.baseUrl}
          onChangeText={(baseUrl) => updateCloud({ baseUrl })}
        />
        <TextInput
          style={styles.input}
          placeholder={t('transcription.model')}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          value={settings.cloud.model}
          onChangeText={(model) => updateCloud({ model })}
        />
        <TextInput
          style={styles.input}
          placeholder={t('transcription.apiKey')}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          secureTextEntry
          value={settings.cloud.apiKey}
          onChangeText={(apiKey) => updateCloud({ apiKey })}
        />
      </Card>
    </ScrollView>
  );
}
