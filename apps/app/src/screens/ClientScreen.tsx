import { ScrollView, Text } from 'react-native';
import { capabilitiesFor } from '@debate/core';
import { useClient, type JoinRequest } from '../net/useClient';
import { colors } from '../theme';
import { Btn, Card, Row, styles } from '../ui';
import { ROLE_LABEL } from './LobbyScreen';
import { TimerScreen } from './TimerScreen';

const STATUS_TEXT = {
  connecting: 'Connecting…',
  pending: 'Waiting for the chair to approve you…',
  joined: 'Joined',
  reconnecting: 'Connection lost, reconnecting…',
  rejected: 'Not admitted',
  closed: 'Left the room',
};

export function ClientScreen({ req, onLeave }: { req: JoinRequest; onLeave: () => void }) {
  const c = useClient(req);
  const session = c.client?.session;
  const member = c.client?.member;

  if (!session || !member || (c.status !== 'joined' && c.status !== 'reconnecting')) {
    const room = c.client?.hostName || req.info.name || req.info.hosts[0];
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Card>
          <Text style={styles.h2}>{room}</Text>
          <Text style={[styles.text, { color: c.status === 'rejected' ? colors.danger : colors.text }]}>{STATUS_TEXT[c.status]}</Text>
          {!!c.detail && <Text style={styles.muted}>{c.detail}</Text>}
          {c.status === 'connecting' && (
            <Text style={styles.muted}>Make sure you're on the same Wi-Fi or hotspot as the chair. Trying {req.info.hosts.join(', ')}.</Text>
          )}
          <Btn title={c.status === 'rejected' ? 'Back' : 'Cancel'} onPress={onLeave} />
        </Card>
      </ScrollView>
    );
  }

  const rtt = c.client?.clock.rtt;
  return (
    <TimerScreen
      session={session}
      caps={capabilitiesFor(member, session)}
      clock={c.hostNow}
      dispatch={(a) => c.client?.request(a)}
      onRing={(p) => c.client?.ring(p)}
      record={false}
      deviceId={req.identity.deviceId}
      exitLabel="Leave"
      onExit={onLeave}
      banner={
        <Card style={{ paddingVertical: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.text}>
              {c.client?.hostName} · you: {ROLE_LABEL[member.role]}
              {member.seat ? ` ${member.seat}` : ''}
            </Text>
            <Text style={[styles.muted, c.status === 'reconnecting' && { color: colors.warn }]}>
              {c.status === 'reconnecting' ? STATUS_TEXT.reconnecting : rtt != null ? `synced · ${Math.round(rtt)} ms` : 'syncing…'}
            </Text>
          </Row>
          {c.denied && <Text style={{ color: colors.warn }}>{c.denied}</Text>}
        </Card>
      }
    />
  );
}
