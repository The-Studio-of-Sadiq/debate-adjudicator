import { useCallback, useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import { AudioModule } from 'expo-audio';
import { capabilitiesFor, type ClipRef } from '@debate/core';
import { extensionOf, readAsBase64 } from '../files';
import { netReason, useT } from '../i18n';
import { useClient, type JoinRequest } from '../net/useClient';
import { useTheme } from '../theme';
import { Btn, Card, Row } from '../ui';
import { TimerScreen } from './TimerScreen';

export function ClientScreen({ req, onLeave }: { req: JoinRequest; onLeave: () => void }) {
  const { styles } = useTheme();
  const t = useT();
  const c = useClient(req);
  const session = c.client?.session;
  const member = c.client?.member;
  const client = c.client;
  const deviceId = req.identity.deviceId;

  // Ask for the mic as soon as someone is seated, not in the middle of their POI.
  const isDebater = member?.role === 'debater';
  useEffect(() => {
    if (isDebater) void AudioModule.requestRecordingPermissionsAsync();
  }, [isDebater]);

  const sendClip = useCallback(
    async (clip: ClipRef, target: { speechIndex: number; interruptionId: string }) => {
      if (!client) throw new Error('notConnected');
      const base64 = await readAsBase64(clip.uri);
      await client.uploadClip(
        `${target.interruptionId}-${deviceId}`,
        { ...target, startedAt: clip.startedAt, durationMs: clip.durationMs, ext: extensionOf(clip.uri) },
        base64,
      );
    },
    [client, deviceId],
  );

  if (!session || !member || (c.status !== 'joined' && c.status !== 'reconnecting')) {
    const room = c.client?.hostName || req.info.name || req.info.hosts[0];
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Card>
          <Text style={styles.h2}>{room}</Text>
          <Text style={c.status === 'rejected' ? styles.alert : styles.text}>
            {c.status === 'rejected' ? '⚠ ' : ''}
            {t(`client.status.${c.status}`)}
          </Text>
          {!!c.detail && <Text style={styles.muted}>{netReason(t, c.detail)}</Text>}
          {c.status === 'connecting' && <Text style={styles.muted}>{t('client.sameNetwork', { hosts: req.info.hosts.join(', ') })}</Text>}
          <Btn title={c.status === 'rejected' ? t('common.back') : t('common.cancel')} onPress={onLeave} />
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
      deviceId={deviceId}
      mySeat={member.role === 'debater' ? member.seat : undefined}
      onInterruptionClip={sendClip}
      exitLabel={t('timer.leave')}
      onExit={onLeave}
      banner={
        <Card style={{ paddingVertical: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.text}>
              {t('client.you', { host: c.client?.hostName, role: t(`memberRoles.${member.role}`) })}
              {member.seat ? ` ${member.seat}` : ''}
            </Text>
            <Text style={c.status === 'reconnecting' ? styles.alert : styles.muted}>
              {c.status === 'reconnecting'
                ? `⚠ ${t('client.status.reconnecting')}`
                : rtt != null
                  ? t('client.synced', { ms: Math.round(rtt) })
                  : t('client.syncing')}
            </Text>
          </Row>
          {c.denied && <Text style={styles.alert}>⚠ {netReason(t, c.denied)}</Text>}
        </Card>
      }
    />
  );
}
