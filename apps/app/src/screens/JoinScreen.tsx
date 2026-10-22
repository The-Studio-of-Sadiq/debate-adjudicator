import { useRef, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BP, parseJoin, UADC, type MemberRole } from '@debate/core';
import type { JoinRequest } from '../net/useClient';
import { saveIdentity, type Identity } from '../storage';
import { colors } from '../theme';
import { Btn, Card, Chip, Row, styles } from '../ui';
import { ROLE_LABEL } from './LobbyScreen';

// Every seat across the presets; the chair confirms or corrects it on approval.
const SEATS = [...new Set([...BP.speeches, ...UADC.speeches].map((s) => s.role))];
const ROLES: MemberRole[] = ['debater', 'timekeeper', 'wing', 'viewer'];

function Scanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  // The camera reports the same code many times a second; act on the first.
  const done = useRef(false);
  if (!permission) return null;
  if (!permission.granted) {
    return (
      <Row>
        <Text style={styles.text}>Camera access is needed to scan.</Text>
        <Btn title="Allow camera" onPress={() => void requestPermission()} />
        <Btn title="Cancel" onPress={onClose} />
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
      <Btn title="Cancel scan" onPress={onClose} />
    </View>
  );
}

export function JoinScreen(props: { identity: Identity; onJoin: (req: JoinRequest) => void; onBack: () => void }) {
  const [name, setName] = useState(props.identity.name);
  const [role, setRole] = useState<MemberRole>('debater');
  const [seat, setSeat] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function join(text: string) {
    const info = parseJoin(text);
    if (!info) {
      setError(text.startsWith('WIFI:') ? "That's the Wi-Fi QR. Scan it with your camera app, then scan the join QR here." : 'Not a valid join code');
      return;
    }
    if (!name.trim()) {
      setError('Enter your name first');
      return;
    }
    const identity = { ...props.identity, name: name.trim() };
    void saveIdentity(identity);
    props.onJoin({ info, identity, want: { role, seat: role === 'debater' ? seat : undefined } });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Btn title="← Back" onPress={props.onBack} style={{ alignSelf: 'flex-start' }} />
      <Text style={styles.h1}>Join a round</Text>

      <Card>
        <Text style={styles.h2}>You</Text>
        <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />
        <Row>
          {ROLES.map((r) => (
            <Chip key={r} label={ROLE_LABEL[r]} active={role === r} onPress={() => setRole(r)} />
          ))}
        </Row>
        {role === 'debater' && (
          <>
            <Text style={styles.muted}>Your seat (the chair can change it):</Text>
            <Row>
              {SEATS.map((s) => (
                <Chip key={s} label={s} active={seat === s} onPress={() => setSeat(seat === s ? undefined : s)} />
              ))}
            </Row>
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.h2}>Room</Text>
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
          <Btn title="Scan QR code" color={colors.accent} big onPress={() => setScanning(true)} />
        )}
        <Text style={styles.muted}>Or type what's under the chair's QR code:</Text>
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
          <Btn title="Join" color={colors.accent} onPress={() => join(code)} />
        </Row>
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
      </Card>
    </ScrollView>
  );
}
