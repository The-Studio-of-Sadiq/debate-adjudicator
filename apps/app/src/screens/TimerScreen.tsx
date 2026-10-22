import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import {
  canRaise,
  currentSpeech,
  currentTemplate,
  elapsedMs,
  formatClock,
  INTERRUPTION_NAMES,
  liveInterruptionFor,
  POI_EXPIRE_SEC,
  POI_MAX_SEC,
  speechPhase,
  timerStatus,
  type BellPattern,
  type Capabilities,
  type ClipRef,
  type Interruption,
  type InterruptionKind,
  type Session,
  type SessionAction,
} from '@debate/core';
import { useBells, useNow, useSpeechRecorder } from '../hooks';
import { makeId } from '../storage';
import { colors, phaseColor, phaseLabel } from '../theme';
import { Btn, Card, Chip, Row, styles } from '../ui';

const KINDS: InterruptionKind[] = ['POI', 'POO', 'POP'];

export function TimerScreen(props: {
  session: Session;
  dispatch: (a: SessionAction) => void;
  onExit: () => void;
  exitLabel?: string;
  /** What this device may do: the chair has everything, joined devices get their role's subset. */
  caps: Capabilities;
  /** Clock to draw the timer with; joined devices pass the synced host clock. */
  clock?: () => number;
  /** Record speeches on this device. */
  record: boolean;
  deviceId: string;
  onRing: (pattern: BellPattern) => void;
  /** Extra header content, e.g. the invite button or connection status. */
  banner?: ReactNode;
  /** This device's seat. With `onInterruptionClip`, its mic records that seat's live POI/POO/POP. */
  mySeat?: string;
  /** Deliver a recorded interruption clip (to the chair). Rejects with a reason on failure. */
  onInterruptionClip?: (clip: ClipRef, target: { speechIndex: number; interruptionId: string }) => Promise<void>;
}) {
  useKeepAwake();
  const { session, dispatch, caps } = props;
  const clock = props.clock ?? Date.now;
  const { width } = useWindowDimensions();
  const template = currentTemplate(session);
  const speech = currentSpeech(session);
  const status = timerStatus(speech.events);
  const now = useNow(status === 'running' || speech.interruptions.some((i) => i.status === 'pending' || isLivePoi(i)), 100, clock);
  const elapsedSec = elapsedMs(speech.events, now) / 1000;
  const phase = speechPhase(template, elapsedSec);
  const [autoRecord, setAutoRecord] = useState(true);
  const [picking, setPicking] = useState<InterruptionKind | null>(null);
  const recorder = useSpeechRecorder(props.deviceId, clock);

  // Every device rings its own scheduled bells from the shared, synced clock.
  useBells(template, elapsedSec, status === 'running');

  // A debater's device records them while their POI has the floor, or while
  // their POO/POP is being heard, then sends the clip to the chair.
  const myLive = props.mySeat ? liveInterruptionFor(session, props.mySeat) : null;
  const liveKey = myLive ? `${myLive.speechIndex}:${myLive.interruption.id}` : null;
  const recordingFor = useRef<{ speechIndex: number; id: string; kind: InterruptionKind } | null>(null);
  const [clipStatus, setClipStatus] = useState<{ text: string; ok?: boolean } | null>(null);
  const deliverClip = props.onInterruptionClip;
  useEffect(() => {
    if (!deliverClip) return;
    const current = recordingFor.current;
    if (myLive && !current) {
      recordingFor.current = { speechIndex: myLive.speechIndex, id: myLive.interruption.id, kind: myLive.interruption.kind };
      setClipStatus({ text: `Recording your ${myLive.interruption.kind}…` });
      void recorder.start();
    } else if (!myLive && current) {
      recordingFor.current = null;
      void (async () => {
        const clip = await recorder.stop();
        if (!clip) {
          setClipStatus({ text: `Your ${current.kind} wasn't recorded`, ok: false });
          return;
        }
        setClipStatus({ text: `Sending your ${current.kind} audio to the chair…` });
        try {
          await deliverClip(clip, { speechIndex: current.speechIndex, interruptionId: current.id });
          setClipStatus({ text: `${current.kind} audio sent to the chair ✓`, ok: true });
        } catch (e) {
          setClipStatus({ text: `Couldn't send ${current.kind} audio: ${e instanceof Error ? e.message : String(e)}`, ok: false });
        }
      })();
    }
    // Only react when the live interruption itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, deliverClip]);

  // The chair's device drops POIs the speaker ignored and closes POIs that run too long.
  useEffect(() => {
    if (!caps.rule) return;
    for (const i of speech.interruptions) {
      if (i.kind === 'POI' && i.status === 'pending' && elapsedSec - i.raisedAtSec >= POI_EXPIRE_SEC) {
        dispatch({ type: 'expire', id: i.id, at: clock() });
      }
      if (isLivePoi(i) && elapsedSec - (i.resolvedAtSec ?? i.raisedAtSec) >= POI_MAX_SEC) {
        dispatch({ type: 'endPoi', id: i.id, at: clock() });
      }
    }
  }, [caps.rule, elapsedSec, speech.interruptions, dispatch, clock]);

  async function finishRecording(speechIndex: number) {
    if (!props.record) return;
    const clip = await recorder.stop();
    if (clip) dispatch({ type: 'addClip', speechIndex, clip });
  }

  async function start() {
    dispatch({ type: 'timer', event: 'start', at: clock() });
    if (props.record && autoRecord) await recorder.start();
  }

  async function stop() {
    dispatch({ type: 'timer', event: 'stop', at: clock() });
    await finishRecording(session.currentIndex);
  }

  async function goto(index: number) {
    const from = session.currentIndex;
    dispatch({ type: 'goto', index, at: clock() });
    await finishRecording(from);
  }

  function raise(kind: InterruptionKind, raisedBy: string) {
    dispatch({ type: 'raise', id: makeId(), kind, raisedBy, at: clock() });
    setPicking(null);
  }

  // POIs come from the other side; POO/POP can come from anyone.
  const eligibleRoles = (kind: InterruptionKind) =>
    session.format.speeches.filter((s) => (kind === 'POI' ? s.side !== template.side : s.id !== template.id)).map((s) => s.role);

  const mySeat = caps.raiseAs ? session.format.speeches.find((s) => s.role === caps.raiseAs) : undefined;
  const canRaiseKind = (k: InterruptionKind) => {
    if (!canRaise(k, template, status, elapsedSec).ok) return false;
    if (caps.rule) return true;
    if (!mySeat) return false;
    return k !== 'POI' || mySeat.side !== template.side;
  };

  const clockSize = Math.min(width * 0.26, 200);
  const remaining = template.durationSec - elapsedSec;
  const pending = speech.interruptions.filter((i) => i.status === 'pending');
  const livePoi = speech.interruptions.find(isLivePoi);
  const isLast = session.currentIndex === session.speeches.length - 1;
  const showInterruptions = caps.rule || caps.raiseAs !== null || caps.decidePoi || speech.interruptions.length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Btn
          title={props.exitLabel ?? '← Rounds'}
          onPress={async () => {
            await finishRecording(session.currentIndex);
            props.onExit();
          }}
        />
        <Text style={styles.muted}>
          {session.format.name} · Speech {session.currentIndex + 1}/{session.speeches.length}
        </Text>
      </Row>
      {props.banner}
      {!!session.motion && <Text style={styles.h2}>{session.motion}</Text>}

      <Row>
        {session.format.speeches.map((s, i) => (
          <Chip
            key={s.id}
            label={s.role}
            active={i === session.currentIndex}
            color={s.side === 'gov' ? colors.gov : colors.opp}
            onPress={() => caps.controlTimer && void goto(i)}
          />
        ))}
      </Row>

      <View style={{ backgroundColor: phaseColor[phase], borderRadius: 20, padding: 20, alignItems: 'center', gap: 4 }}>
        <Text style={[styles.h2, { color: template.side === 'gov' ? '#cfe0ff' : '#ffd9cf' }]}>
          {template.role} · {template.name}
          {caps.decidePoi && !caps.rule ? ' · You have the floor' : ''}
        </Text>
        <Text style={{ color: '#fff', fontSize: clockSize, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {formatClock(elapsedSec)}
        </Text>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
          {status === 'paused' ? 'Paused' : status === 'stopped' ? 'Finished' : phaseLabel[phase]} ·{' '}
          {remaining >= 0 ? `${formatClock(remaining)} left` : `${formatClock(-remaining)} over`}
        </Text>
        {recorder.recording && <Text style={{ color: '#fff' }}>● Recording</Text>}
        {clipStatus && (
          <Text style={{ color: clipStatus.ok === false ? '#ffd0d0' : '#fff', fontWeight: '600' }}>{clipStatus.text}</Text>
        )}
        {recorder.error && <Text style={{ color: '#ffd0d0' }}>Recorder: {recorder.error}</Text>}
      </View>

      {caps.controlTimer && (
        <Row style={{ justifyContent: 'center' }}>
          {status === 'idle' && <Btn big title="Start" color={colors.ok} onPress={() => void start()} />}
          {status === 'running' && <Btn big title="Pause" color={colors.warn} onPress={() => dispatch({ type: 'timer', event: 'pause', at: clock() })} />}
          {status === 'paused' && (
            <Btn
              big
              title="Resume"
              color={colors.ok}
              disabled={pending.some((i) => i.kind !== 'POI')}
              onPress={() => dispatch({ type: 'timer', event: 'resume', at: clock() })}
            />
          )}
          {(status === 'running' || status === 'paused') && <Btn big title="Stop" color={colors.danger} onPress={() => void stop()} />}
          {!isLast && <Btn big title="Next →" onPress={() => void goto(session.currentIndex + 1)} />}
        </Row>
      )}
      {(caps.ringBell || props.record) && (
        <Row style={{ justifyContent: 'center' }}>
          {caps.ringBell && <Btn title="🔔 Ring" onPress={() => props.onRing('single')} />}
          {caps.ringBell && <Btn title="🔔🔔" onPress={() => props.onRing('double')} />}
          {props.record && (
            <Chip label={autoRecord ? 'Auto-record: on' : 'Auto-record: off'} active={autoRecord} onPress={() => setAutoRecord((v) => !v)} />
          )}
        </Row>
      )}

      {showInterruptions && (
        <Card>
          <Text style={styles.h2}>Interruptions</Text>
          {(caps.rule || caps.raiseAs) && (
            <Row>
              {KINDS.map((k) => (
                <Btn
                  key={k}
                  big={!caps.rule}
                  title={caps.rule ? k : `${k} as ${caps.raiseAs}`}
                  disabled={!canRaiseKind(k)}
                  color={picking === k ? colors.accent : undefined}
                  onPress={() => (caps.rule ? setPicking(picking === k ? null : k) : raise(k, caps.raiseAs!))}
                />
              ))}
            </Row>
          )}
          {caps.rule && picking && (
            <View style={{ gap: 6 }}>
              <Text style={styles.muted}>{INTERRUPTION_NAMES[picking]} from:</Text>
              <Row>
                {eligibleRoles(picking).map((r) => (
                  <Chip key={r} label={r} onPress={() => raise(picking, r)} />
                ))}
              </Row>
            </View>
          )}

          {livePoi && (
            <Row style={{ backgroundColor: colors.surfaceHi, padding: 10, borderRadius: 10 }}>
              <Text style={styles.text}>
                POI from {livePoi.raisedBy} · {Math.max(0, Math.ceil(POI_MAX_SEC - (elapsedSec - (livePoi.resolvedAtSec ?? 0))))}s
              </Text>
              {(caps.decidePoi || livePoi.raisedBy === caps.raiseAs) && (
                <Btn title="End POI" onPress={() => dispatch({ type: 'endPoi', id: livePoi.id, at: clock() })} />
              )}
            </Row>
          )}

          {pending.map((i) => (
            <View key={i.id} style={{ gap: 6, backgroundColor: colors.surfaceHi, padding: 10, borderRadius: 10 }}>
              <Text style={styles.text}>
                {i.kind} from {i.raisedBy} at {formatClock(i.raisedAtSec)}
                {i.kind === 'POI'
                  ? ` — speaker decides (${Math.max(0, Math.ceil(POI_EXPIRE_SEC - (elapsedSec - i.raisedAtSec)))}s)`
                  : ' — clock paused, chair rules'}
              </Text>
              <Row>
                {i.kind === 'POI' && caps.decidePoi && (
                  <>
                    <Btn big={!caps.rule} title="Accept" color={colors.ok} onPress={() => dispatch({ type: 'decidePoi', id: i.id, accept: true, at: clock() })} />
                    <Btn big={!caps.rule} title="Decline" onPress={() => dispatch({ type: 'decidePoi', id: i.id, accept: false, at: clock() })} />
                  </>
                )}
                {i.kind !== 'POI' && caps.rule && (
                  <>
                    <Btn title="Well taken" color={colors.ok} onPress={() => dispatch({ type: 'rule', id: i.id, ruling: 'well-taken', at: clock() })} />
                    <Btn title="Not well taken" onPress={() => dispatch({ type: 'rule', id: i.id, ruling: 'not-well-taken', at: clock() })} />
                    <Btn title="Under consideration" onPress={() => dispatch({ type: 'rule', id: i.id, ruling: 'under-consideration', at: clock() })} />
                  </>
                )}
                {(caps.rule || i.raisedBy === caps.raiseAs) && (
                  <Btn title="Withdraw" onPress={() => dispatch({ type: 'withdraw', id: i.id, at: clock() })} />
                )}
              </Row>
            </View>
          ))}

          {speech.interruptions
            .filter((i) => i.status !== 'pending')
            .map((i) => (
              <Text key={i.id} style={styles.muted}>
                {formatClock(i.raisedAtSec)} · {i.kind} from {i.raisedBy} · {describeOutcome(i)}
                {speech.clips.some((c) => c.interruptionId === i.id) ? ' · 🎙 audio' : ''}
              </Text>
            ))}
        </Card>
      )}
    </ScrollView>
  );
}

function isLivePoi(i: Interruption) {
  return i.kind === 'POI' && i.status === 'accepted' && i.endedAtSec === undefined;
}

export function describeOutcome(i: Interruption): string {
  if (i.status === 'ruled') return i.ruling!.replace(/-/g, ' ');
  if (i.status === 'accepted' && i.endedAtSec !== undefined && i.resolvedAtSec !== undefined) {
    return `accepted (${Math.round(i.endedAtSec - i.resolvedAtSec)}s)`;
  }
  return i.status;
}
