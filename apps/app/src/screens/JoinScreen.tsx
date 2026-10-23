import { useRef, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseJoin, PRESETS, type MemberRole } from '@debate/core';
import { useT } from '../i18n';
import type { JoinRequest } from '../net/useClient';
import { saveIdentity, type Identity } from '../storage';
import { useTheme } from '../theme';
import { Btn, Card, Chip, Row } from '../ui';
import { ROLES } from './LobbyScreen';

// Every seat across the presets; the chair confirms or corrects it on approval.
const SEATS = [...new Map(PRESETS.flatMap((f) => f.speeches).map((s) => [s.role, s])).values()];

function Scanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const { styles } = useTheme();
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  // The camera reports the same code many times a second; act on the first.
  const done = useRef(false);
  if (!permission) return null;
  if (!permission.granted) {
    return (
      <Row>
        <Text style={styles.text}>{t('join.cameraNeeded')}</Text>
        <Btn title={t('join.allowCamera')} variant="primary" onPress={() => void requestPermission()} />
        <Btn title={t('common.cancel')} variant="outline" onPress={onClose} />
      </Row>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 300, borderRadius: 14, overflow: 'hidden' }}>
        <CameraView
          style={{ flex: 1 }}
          facing={Platform.OS === 'web' ? 'front' : 'back'}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(r) => {
            if (done.current) return;
            done.current = true;
            onCode(r.data);
          }}
        />
      </View>
      <Btn title={t('join.cancelScan')} variant="outline" onPress={onClose} />
    </View>
  );
}

/**
 * Android: Google's system code scanner (Play services). It detects far more
 * reliably than an embedded preview and needs no camera permission.
 * Resolves with the scanned text, or null if the user backed out.
 */
function scanWithSystemScanner(): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const sub = CameraView.onModernBarcodeScanned((r) => {
      if (settled) return;
      settled = true;
      sub.remove();
      resolve(r.data);
    });
    CameraView.launchScanner({ barcodeTypes: ['qr'] }).then(
      // The promise settles when the scanner closes; give the scan event a moment to arrive.
      () =>
        setTimeout(() => {
          if (settled) return;
          settled = true;
          sub.remove();
          resolve(null);
        }, 500),
      () => {
        if (settled) return;
        settled = true;
        sub.remove();
        resolve(null);
      },
    );
  });
}

const useSystemScanner = Platform.OS === 'android' && CameraView.isModernBarcodeScannerAvailable;

export function JoinScreen(props: {
  identity: Identity;
  /** Join payload from a deep link (QR scanned with the phone's camera app). */
  initialCode?: string;
  onJoin: (req: JoinRequest) => void;
  onBack: () => void;
}) {
  const { colors, styles } = useTheme();
  const t = useT();
  const [name, setName] = useState(props.identity.name);
  const [role, setRole] = useState<MemberRole>('debater');
  const [seat, setSeat] = useState<string | undefined>();
  const [code, setCode] = useState(props.initialCode ?? '');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startScan() {
    setError(null);
    if (!useSystemScanner) {
      setScanning(true);
      return;
    }
    const text = await scanWithSystemScanner();
    if (text) {
      setCode(text);
      join(text);
    }
  }

  function join(text: string) {
    const info = parseJoin(text);
    if (!info) {
      setError(t(text.startsWith('WIFI:') ? 'join.wifiQrScanned' : 'join.invalidCode'));
      return;
    }
    if (!name.trim()) {
      setError(t('join.nameFirst'));
      return;
    }
    const identity = { ...props.identity, name: name.trim() };
    void saveIdentity(identity);
    props.onJoin({ info, identity, want: { role, seat: role === 'debater' ? seat : undefined } });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Btn title={t('common.back')} onPress={props.onBack} style={{ alignSelf: 'flex-start' }} />
      <Text style={styles.h1}>{t('join.title')}</Text>

      <Card>
        <Text style={styles.h2}>{t('join.you')}</Text>
        <TextInput style={styles.input} placeholder={t('join.namePlaceholder')} placeholderTextColor={colors.muted} value={name} onChangeText={setName} />
        <Row>
          {ROLES.map((r) => (
            <Chip key={r} label={t(`memberRoles.${r}`)} active={role === r} onPress={() => setRole(r)} />
          ))}
        </Row>
        {role === 'debater' && (
          <>
            <Text style={styles.muted}>{t('join.seatHint')}</Text>
            <Row>
              {SEATS.map((s) => (
                <Chip key={s.role} label={s.role} dim={s.side === 'opp'} active={seat === s.role} onPress={() => setSeat(seat === s.role ? undefined : s.role)} />
              ))}
            </Row>
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.h2}>{t('join.room')}</Text>
        {scanning ? (
          <Scanner
            onCode={(text) => {
              setScanning(false);
              setCode(text);
              join(text);
            }}
            onClose={() => setScanning(false)}
          />
        ) : (
          <Btn title={t('join.scan')} variant="primary" big onPress={() => void startScan()} />
        )}
        {!!props.initialCode && <Text style={styles.muted}>{t('join.fromLink')}</Text>}
        <Text style={styles.muted}>{t('join.typeHint')}</Text>
        <Row>
          <TextInput
            style={[styles.input, { flex: 1, minWidth: 200 }]}
            placeholder="192.168.1.5 ABC234"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            value={code}
            onChangeText={setCode}
            onSubmitEditing={() => join(code)}
          />
          <Btn title={t('common.join')} variant="primary" onPress={() => join(code)} />
        </Row>
        {error && <Text style={styles.alert}>⚠ {error}</Text>}
      </Card>
    </ScrollView>
  );
}
