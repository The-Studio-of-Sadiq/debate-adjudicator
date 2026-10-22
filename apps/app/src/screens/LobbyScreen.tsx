import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { DEFAULT_PORT, encodeJoin, wifiQrPayload, type Member, type MemberRole, type Session } from '@debate/core';
import type { Hosting } from '../net/useHosting';
import { transport } from '../net/transport';
import { QrCode } from '../QrCode';
import { colors } from '../theme';
import { Btn, Card, Chip, Row, styles } from '../ui';

export const ROLE_LABEL: Record<MemberRole, string> = {
  timekeeper: 'Timekeeper',
  debater: 'Debater',
  wing: 'Wing adjudicator',
  viewer: 'Viewer',
};
const ROLES: MemberRole[] = ['debater', 'timekeeper', 'wing', 'viewer'];

function RolePicker(props: { session: Session; role: MemberRole; seat?: string; onChange: (role: MemberRole, seat?: string) => void }) {
  const taken = props.session.format.speeches.map((s) => s.role);
  return (
    <View style={{ gap: 6 }}>
      <Row>
        {ROLES.map((r) => (
          <Chip key={r} label={ROLE_LABEL[r]} active={props.role === r} onPress={() => props.onChange(r, props.seat)} />
        ))}
      </Row>
      {props.role === 'debater' && (
        <Row>
          {taken.map((s) => (
            <Chip
              key={s}
              label={s}
              active={props.seat === s}
              color={props.session.format.speeches.find((x) => x.role === s)?.side === 'gov' ? colors.gov : colors.opp}
              onPress={() => props.onChange('debater', s)}
            />
          ))}
        </Row>
      )}
    </View>
  );
}

function PendingRow({ m, session, hosting }: { m: Member; session: Session; hosting: Hosting }) {
  const [role, setRole] = useState(m.role);
  const validSeat = m.seat && session.format.speeches.some((s) => s.role === m.seat) ? m.seat : undefined;
  const [seat, setSeat] = useState<string | undefined>(validSeat);
  const needsSeat = role === 'debater' && !seat;
  return (
    <View style={{ gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceHi }}>
      <Text style={styles.text}>
        {m.name} wants to join as {ROLE_LABEL[m.role]}
        {m.seat ? ` (${m.seat})` : ''}
      </Text>
      <RolePicker
        session={session}
        role={role}
        seat={seat}
        onChange={(r, s) => {
          setRole(r);
          setSeat(s);
        }}
      />
      <Row>
        <Btn title={needsSeat ? 'Pick a seat' : 'Approve'} color={colors.ok} disabled={needsSeat} onPress={() => hosting.approve(m.deviceId, role, seat)} />
        <Btn title="Reject" color={colors.danger} onPress={() => hosting.remove(m.deviceId)} />
      </Row>
    </View>
  );
}

export function LobbyScreen({ hosting, session, hostName, onBack }: { hosting: Hosting; session: Session; hostName: string; onBack: () => void }) {
  const { width } = useWindowDimensions();
  const [extraIp, setExtraIp] = useState('');
  const [showWifi, setShowWifi] = useState(false);
  const [ssid, setSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');

  useEffect(() => {
    if (!hosting.active) void hosting.start();
    // Start once when the lobby opens; hosting keeps running after it closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const info = hosting.info;
  const pending = hosting.members.filter((m) => m.status === 'pending');
  const approved = hosting.members.filter((m) => m.status === 'approved');
  const qrSize = Math.min(width - 64, 280);
  const typedCode = info && info.addresses[0] ? `${info.addresses[0]}${info.port === DEFAULT_PORT ? '' : `:${info.port}`} ${info.token}` : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Btn title="← Timer" onPress={onBack} />
        {hosting.active && <Btn title="Stop hosting" color={colors.danger} onPress={hosting.stop} />}
      </Row>
      <Text style={styles.h1}>Invite devices</Text>

      {!transport.available && <Text style={[styles.text, { color: colors.warn }]}>{transport.unavailableReason}</Text>}
      {hosting.error && <Text style={[styles.text, { color: colors.danger }]}>Could not start hosting: {hosting.error}</Text>}

      {info && (
        <Card style={{ alignItems: 'center' }}>
          {info.addresses.length > 0 ? (
            <>
              <QrCode value={encodeJoin({ hosts: info.addresses, port: info.port, token: info.token, name: hostName })} size={qrSize} />
              <Text style={styles.muted}>Scan in the app, or type:</Text>
              <Text style={[styles.h1, { fontVariant: ['tabular-nums'], letterSpacing: 1 }]}>{typedCode}</Text>
            </>
          ) : (
            <Text style={[styles.text, { color: colors.warn }]}>
              No network address found. Join a Wi-Fi network or turn on this phone's hotspot, then add its address below.
            </Text>
          )}
          <Row>
            <TextInput
              style={[styles.input, { width: 170 }]}
              placeholder="Add address, e.g. 192.168.43.1"
              placeholderTextColor={colors.muted}
              value={extraIp}
              onChangeText={setExtraIp}
              keyboardType="numeric"
            />
            <Btn
              title="Add"
              disabled={!/^(\d{1,3}\.){3}\d{1,3}$/.test(extraIp.trim())}
              onPress={() => {
                hosting.addAddress(extraIp.trim());
                setExtraIp('');
              }}
            />
          </Row>
          <Text style={styles.muted}>
            Addresses: {info.addresses.join(', ') || 'none'} · port {info.port}
          </Text>
        </Card>
      )}

      <Card>
        <Text style={styles.h2}>Requests ({pending.length})</Text>
        {pending.length === 0 && <Text style={styles.muted}>Nobody is waiting.</Text>}
        {pending.map((m) => (
          <PendingRow key={m.deviceId} m={m} session={session} hosting={hosting} />
        ))}
      </Card>

      <Card>
        <Text style={styles.h2}>In the room ({approved.length})</Text>
        {approved.length === 0 && <Text style={styles.muted}>No devices yet.</Text>}
        {approved.map((m) => (
          <View key={m.deviceId} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.text}>
                <Text style={{ color: m.connected ? colors.ok : colors.muted }}>● </Text>
                {m.name} · {ROLE_LABEL[m.role]}
                {m.seat ? ` · ${m.seat}` : ''}
                {m.connected ? '' : ' (offline)'}
              </Text>
              <Btn title="Remove" onPress={() => hosting.remove(m.deviceId)} />
            </Row>
            <RolePicker session={session} role={m.role} seat={m.seat} onChange={(r, s) => hosting.setRole(m.deviceId, r, s)} />
          </View>
        ))}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.h2}>Wi-Fi QR</Text>
          <Btn title={showWifi ? 'Hide' : 'Show'} onPress={() => setShowWifi((v) => !v)} />
        </Row>
        <Text style={styles.muted}>Lets people join this phone's hotspot (or the room's Wi-Fi) by scanning with their camera.</Text>
        {showWifi && (
          <View style={{ gap: 8, alignItems: 'center' }}>
            <TextInput style={[styles.input, { alignSelf: 'stretch' }]} placeholder="Network name (SSID)" placeholderTextColor={colors.muted} value={ssid} onChangeText={setSsid} />
            <TextInput style={[styles.input, { alignSelf: 'stretch' }]} placeholder="Password" placeholderTextColor={colors.muted} value={wifiPass} onChangeText={setWifiPass} secureTextEntry />
            {!!ssid && <QrCode value={wifiQrPayload(ssid, wifiPass)} size={Math.min(qrSize, 220)} />}
          </View>
        )}
      </Card>

      <Text style={styles.muted}>
        Can't connect? Venue Wi-Fi often blocks devices from seeing each other. Use this phone's hotspot instead. On Windows, allow the app
        through the firewall on private networks when asked.
      </Text>
    </ScrollView>
  );
}
