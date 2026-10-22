import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StatusBar as RNStatusBar, Platform, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CHAIR_CAPS, createSession, PRESETS, reduceSession, type DebateFormat, type Session, type SessionAction } from '@debate/core';
import type { JoinRequest } from './src/net/useClient';
import { useHosting } from './src/net/useHosting';
import { BellEditor } from './src/screens/BellEditor';
import { ClientScreen } from './src/screens/ClientScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { JoinScreen } from './src/screens/JoinScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { TimerScreen } from './src/screens/TimerScreen';
import {
  deleteSession,
  loadIdentity,
  loadSession,
  makeId,
  resetCustomFormat,
  saveCustomFormat,
  saveSession,
  type Identity,
} from './src/storage';
import { colors } from './src/theme';
import { Btn, Row } from './src/ui';

type Screen =
  | { name: 'home' }
  | { name: 'bells'; format: DebateFormat }
  | { name: 'timer' }
  | { name: 'lobby' }
  | { name: 'review' }
  | { name: 'join' }
  | { name: 'client'; req: JoinRequest };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);

  const dispatch = useCallback((a: SessionAction) => setSession((s) => (s ? reduceSession(s, a) : s)), []);
  const hosting = useHosting(session, dispatch, identity?.name || 'Chair');

  useEffect(() => {
    void loadIdentity().then(setIdentity);
  }, []);

  // Persist every change so a crash or closed app never loses a round.
  useEffect(() => {
    if (!session) return;
    const id = setTimeout(() => void saveSession(session), 300);
    return () => clearTimeout(id);
  }, [session]);

  // Leaving the round's screens closes the room.
  const { stop: stopHosting } = hosting;
  useEffect(() => {
    if (screen.name === 'home' || screen.name === 'join' || screen.name === 'client') stopHosting();
  }, [screen.name, stopHosting]);

  let body;
  if (screen.name === 'bells') {
    body = (
      <BellEditor
        format={screen.format}
        onClose={() => setScreen({ name: 'home' })}
        onSave={async (f) => {
          await saveCustomFormat(f);
          setScreen({ name: 'home' });
        }}
        onReset={async () => {
          await resetCustomFormat(screen.format.id);
          setScreen({ name: 'bells', format: PRESETS.find((p) => p.id === screen.format.id) ?? screen.format });
        }}
      />
    );
  } else if (screen.name === 'timer' && session && identity) {
    const joined = hosting.members.filter((m) => m.status === 'approved' && m.connected).length;
    const waiting = hosting.members.filter((m) => m.status === 'pending').length;
    body = (
      <TimerScreen
        session={session}
        dispatch={dispatch}
        caps={CHAIR_CAPS}
        record
        deviceId={identity.deviceId}
        onRing={hosting.ring}
        onExit={() => setScreen({ name: 'review' })}
        banner={
          <Row>
            <Btn
              title={hosting.active ? `Devices: ${joined}${waiting ? ` · ${waiting} waiting` : ''}` : 'Invite devices'}
              color={waiting ? colors.warn : undefined}
              onPress={() => setScreen({ name: 'lobby' })}
            />
            {hosting.active && <Text style={{ color: colors.muted }}>Code {hosting.info?.token}</Text>}
          </Row>
        }
      />
    );
  } else if (screen.name === 'lobby' && session) {
    body = <LobbyScreen hosting={hosting} session={session} hostName={identity?.name || 'Chair'} onBack={() => setScreen({ name: 'timer' })} />;
  } else if (screen.name === 'review' && session) {
    body = (
      <ReviewScreen
        session={session}
        onBack={() => setScreen({ name: 'home' })}
        onResume={() => setScreen({ name: 'timer' })}
        onDelete={async () => {
          await deleteSession(session.id);
          setSession(null);
          setScreen({ name: 'home' });
        }}
      />
    );
  } else if (screen.name === 'join' && identity) {
    body = (
      <JoinScreen
        identity={identity}
        onBack={() => setScreen({ name: 'home' })}
        onJoin={(req) => {
          setIdentity(req.identity);
          setScreen({ name: 'client', req });
        }}
      />
    );
  } else if (screen.name === 'client') {
    body = <ClientScreen req={screen.req} onLeave={() => setScreen({ name: 'home' })} />;
  } else {
    body = (
      <HomeScreen
        onStart={(format, motion) => {
          setSession(createSession(format, { id: makeId(), now: Date.now(), motion }));
          setScreen({ name: 'timer' });
        }}
        onEditBells={(format) => setScreen({ name: 'bells', format })}
        onJoin={() => setScreen({ name: 'join' })}
        onOpen={async (id) => {
          const s = await loadSession(id);
          if (!s) return;
          setSession(s);
          setScreen({ name: 'review' });
        }}
      />
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 }}
    >
      <StatusBar style="light" />
      {body}
    </SafeAreaView>
  );
}
