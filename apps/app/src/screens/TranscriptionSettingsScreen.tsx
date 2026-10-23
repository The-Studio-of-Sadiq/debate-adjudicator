import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { CLOUD_PRESETS, localEngine, type ModelName, type Progress, type TranscriptionSettings } from '../transcription';
import { loadTranscriptionSettings, saveTranscriptionSettings } from '../storage';
import { colors } from '../theme';
import { Btn, Card, Chip, Row, styles } from '../ui';

const MODES: { mode: TranscriptionSettings['mode']; label: string; hint: string }[] = [
  { mode: 'auto', label: 'Auto', hint: 'Cloud when online and a key is set, otherwise offline. Falls back to offline if the cloud fails.' },
  { mode: 'local', label: 'Offline only', hint: 'Audio never leaves this device.' },
  { mode: 'cloud', label: 'Cloud only', hint: 'Fastest and most accurate, but needs internet and sends audio to the provider.' },
];

export function progressText(p: Progress | undefined): string {
  if (!p) return 'Starting…';
  if (p.stage === 'download') return `Downloading model ${p.total ? Math.round((p.loaded / p.total) * 100) : 0}%`;
  if (p.stage === 'decode') return 'Preparing audio…';
  if (p.stage === 'upload') return 'Uploading to cloud…';
  return p.percent != null ? `Transcribing ${Math.round(p.percent)}%` : 'Transcribing…';
}

export function TranscriptionSettingsScreen({ onBack }: { onBack: () => void }) {
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
        <Btn title="← Back" onPress={onBack} />
        <Btn
          title={saved ? 'Saved ✓' : 'Save'}
          color={colors.accent}
          onPress={async () => {
            await saveTranscriptionSettings(settings);
            setSaved(true);
          }}
        />
      </Row>
      <Text style={styles.h1}>Transcription</Text>

      <Card>
        <Text style={styles.h2}>When to use the cloud</Text>
        <Row>
          {MODES.map((m) => (
            <Chip key={m.mode} label={m.label} active={settings.mode === m.mode} onPress={() => update({ mode: m.mode })} />
          ))}
        </Row>
        <Text style={styles.muted}>{MODES.find((m) => m.mode === settings.mode)!.hint}</Text>
      </Card>

      <Card>
        <Text style={styles.h2}>Offline model</Text>
        {!localEngine.available && <Text style={[styles.text, { color: colors.warn }]}>{localEngine.unavailableReason}</Text>}
        <Text style={styles.muted}>Download once on Wi-Fi; after that transcription works with no internet. English only.</Text>
        {localEngine.models.map((m) => (
          <View key={m.name} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Chip label={`${m.label} · ${m.sizeMb} MB`} active={settings.model === m.name} onPress={() => update({ model: m.name })} />
              {busy?.model === m.name ? (
                <Text style={styles.muted}>{progressText(busy.progress)}</Text>
              ) : downloaded[m.name] ? (
                <Row>
                  <Text style={{ color: colors.ok }}>Downloaded ✓</Text>
                  <Btn
                    title="Delete"
                    disabled={!!busy}
                    onPress={async () => {
                      await localEngine.deleteModel(m.name);
                      void refreshModels();
                    }}
                  />
                </Row>
              ) : (
                <Btn title="Download" disabled={!!busy} onPress={() => void download(m.name)} />
              )}
            </Row>
          </View>
        ))}
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
      </Card>

      <Card>
        <Text style={styles.h2}>Cloud provider (optional)</Text>
        <Text style={styles.muted}>Any OpenAI-compatible transcription API. Audio is sent to the provider; the key stays on this device.</Text>
        <Row>
          {CLOUD_PRESETS.map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              active={settings.cloud.baseUrl === p.baseUrl}
              onPress={() => updateCloud({ baseUrl: p.baseUrl, model: p.model })}
            />
          ))}
        </Row>
        <TextInput
          style={styles.input}
          placeholder="API base URL"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          value={settings.cloud.baseUrl}
          onChangeText={(baseUrl) => updateCloud({ baseUrl })}
        />
        <TextInput
          style={styles.input}
          placeholder="Model, e.g. whisper-1"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          value={settings.cloud.model}
          onChangeText={(model) => updateCloud({ model })}
        />
        <TextInput
          style={styles.input}
          placeholder="API key"
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
