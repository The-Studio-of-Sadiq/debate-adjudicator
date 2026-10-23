import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { DEFAULT_PORT, encodeJoin, wifiQrPayload, type Member, type MemberRole, type Session } from '@debate/core';
import { errorText, useT } from '../i18n';
import type { Hosting } from '../net/useHosting';
import { transport } from '../net/transport';
import { QrCode } from '../QrCode';
import { colors } from '../theme';
import { Btn, Card, Chip, Row, styles } from '../ui';

export const ROLES: MemberRole[] = ['debater', 'timekeeper', 'wing', 'viewer'];

function RolePicker(props: { session: Session; role: MemberRole; seat?: string; onChange: (role: MemberRole, seat?: string) => void }) {
  const t = useT();
  return (
    <View style={{ gap: 6 }}>
      <Row>
        {ROLES.map((r) => (
          <Chip key={r} label={t(`memberRoles.${r}`)} active={props.role === r} onPress={() => props.onChange(r, props.seat)} />
        ))}
      </Row>
      {props.role === 'debater' && (
        <Row>
          {props.session.format.speeches.map((s) => (
            <Chip key={s.role} label={s.role} active={props.seat === s.role} dim={s.side === 'opp'} onPress={() => props.onChange('debater', s.role)} />
          ))}
        </Row>
      )}
    </View>
  );
}

function PendingRow({ m, session, hosting }: { m: Member; session: Session; hosting: Hosting }) {
  const t = useT();
  const [role, setRole] = useState(m.role);
  const validSeat = m.seat && session.format.speeches.some((s) => s.role === m.seat) ? m.seat : undefined;
  const [seat, setSeat] = useState<string | undefined>(validSeat);
  const needsSeat = role === 'debater' && !seat;
  return (
    <View style={{ gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceHi }}>
      <Text style={styles.text}>
        {t('lobby.wantsToJoin', { name: m.name, role: t(`memberRoles.${m.role}`) })}
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
        <Btn
          title={needsSeat ? t('lobby.pickSeat') : t('common.approve')}
          variant="primary"
          disabled={needsSeat}
          onPress={() => hosting.approve(m.deviceId, role, seat)}
        />
        <Btn title={t('common.reject')} variant="outline" onPress={() => hosting.remove(m.deviceId)} />
      </Row>
    </View>
  );
}

export function LobbyScreen({ hosting, session, hostName, onBack }: { hosting: Hosting; session: Session; hostName: string; onBack: () => void }) {
  const t = useT();
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
        <Btn title={t('lobby.backToTimer')} onPress={onBack} />
        {hosting.active && <Btn title={t('lobby.stopHosting')} variant="outline" onPress={hosting.stop} />}
      </Row>
      <Text style={styles.h1}>{t('lobby.title')}</Text>

      {!transport.available && <Text style={styles.alert}>{t(transport.unavailableReason!)}</Text>}
      {hosting.error && <Text style={styles.alert}>{t('lobby.startFailed', { error: errorText(t, hosting.error) })}</Text>}

      {info && (
        <Card style={{ alignItems: 'center' }}>
          {info.addresses.length > 0 ? (
            <>
              <QrCode value={encodeJoin({ hosts: info.addresses, port: info.port, token: info.token, name: hostName })} size={qrSize} />
              <Text style={styles.muted}>{t('lobby.scanOrType')}</Text>
              <Text style={[styles.h1, { fontVariant: ['tabular-nums'], letterSpacing: 1 }]}>{typedCode}</Text>
            </>
          ) : (
            <Text style={styles.alert}>{t('lobby.noAddress')}</Text>
          )}
          <Row>
            <TextInput
              style={[styles.input, { width: 200 }]}
              placeholder={t('lobby.addAddress')}
              placeholderTextColor={colors.muted}
              value={extraIp}
              onChangeText={setExtraIp}
              keyboardType="numeric"
            />
            <Btn
              title={t('common.add')}
              disabled={!/^(\d{1,3}\.){3}\d{1,3}$/.test(extraIp.trim())}
              onPress={() => {
                hosting.addAddress(extraIp.trim());
                setExtraIp('');
              }}
            />
          </Row>
          <Text style={styles.muted}>{t('lobby.addresses', { list: info.addresses.join(', ') || t('common.none'), port: info.port })}</Text>
        </Card>
      )}

      <Card>
        <Text style={styles.h2}>{t('lobby.requests', { count: pending.length })}</Text>
        {pending.length === 0 && <Text style={styles.muted}>{t('lobby.nobodyWaiting')}</Text>}
        {pending.map((m) => (
          <PendingRow key={m.deviceId} m={m} session={session} hosting={hosting} />
        ))}
      </Card>

      <Card>
        <Text style={styles.h2}>{t('lobby.inRoom', { count: approved.length })}</Text>
        {approved.length === 0 && <Text style={styles.muted}>{t('lobby.noDevices')}</Text>}
        {approved.map((m) => (
          <View key={m.deviceId} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.text}>
                <Text style={{ color: m.connected ? colors.text : colors.muted }}>{m.connected ? '● ' : '○ '}</Text>
                {m.name} · {t(`memberRoles.${m.role}`)}
                {m.seat ? ` · ${m.seat}` : ''}
                {m.connected ? '' : ` (${t('lobby.offline')})`}
              </Text>
              <Btn title={t('common.remove')} variant="outline" onPress={() => hosting.remove(m.deviceId)} />
            </Row>
            <RolePicker session={session} role={m.role} seat={m.seat} onChange={(r, s) => hosting.setRole(m.deviceId, r, s)} />
          </View>
        ))}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.h2}>{t('lobby.wifiQr')}</Text>
          <Btn title={showWifi ? t('common.hide') : t('common.show')} onPress={() => setShowWifi((v) => !v)} />
        </Row>
        <Text style={styles.muted}>{t('lobby.wifiHint')}</Text>
        {showWifi && (
          <View style={{ gap: 8, alignItems: 'center' }}>
            <TextInput
              style={[styles.input, { alignSelf: 'stretch' }]}
              placeholder={t('lobby.ssid')}
              placeholderTextColor={colors.muted}
              value={ssid}
              onChangeText={setSsid}
            />
            <TextInput
              style={[styles.input, { alignSelf: 'stretch' }]}
              placeholder={t('lobby.password')}
              placeholderTextColor={colors.muted}
              value={wifiPass}
              onChangeText={setWifiPass}
              secureTextEntry
            />
            {!!ssid && <QrCode value={wifiQrPayload(ssid, wifiPass)} size={Math.min(qrSize, 220)} />}
          </View>
        )}
      </Card>

      <Text style={styles.muted}>{t('lobby.help')}</Text>
    </ScrollView>
  );
}
