import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import {
  canRaise,
  currentSpeech,
  currentTemplate,
  elapsedMs,
  formatClock,
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
  type Ruling,
  type Session,
  type SessionAction,
} from '@debate/core';
import { useBells, useNow, useSpeechRecorder } from '../hooks';
import { errorText, formatName, outcomeText, roleName, rtlMark, useT } from '../i18n';
import { makeId } from '../storage';
import { FONTS, useTheme } from '../theme';
import { Btn, Card, Chip, Row } from '../ui';

const KINDS: InterruptionKind[] = ['POI', 'POO', 'POP'];
const RULINGS: Ruling[] = ['well-taken', 'not-well-taken', 'under-consideration'];

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
  const { colors, styles, phase: phaseTheme } = useTheme();
  useKeepAwake();
  const t = useT();
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
  const [noteText, setNoteText] = useState('');
  const recorder = useSpeechRecorder(props.deviceId, clock);

  // Every device rings its own scheduled bells from the shared, synced clock.
  useBells(template, elapsedSec, status === 'running');

  // A debater's device records them while their POI has the floor, or while
  // their POO/POP is being heard, then sends the clip to the chair.
  const myLive = props.mySeat ? liveInterruptionFor(session, props.mySeat) : null;
  const liveKey = myLive ? `${myLive.speechIndex}:${myLive.interruption.id}` : null;
  const recordingFor = useRef<{ speechIndex: number; id: string; kind: InterruptionKind } | null>(null);
  const [clipStatus, setClipStatus] = useState<{ text: string; alert?: boolean } | null>(null);
  const deliverClip = props.onInterruptionClip;
  useEffect(() => {
    if (!deliverClip) return;
    const current = recordingFor.current;
    if (myLive && !current) {
      const kind = myLive.interruption.kind;
      recordingFor.current = { speechIndex: myLive.speechIndex, id: myLive.interruption.id, kind };
      setClipStatus({ text: t('interruptions.recordingYours', { kind }) });
      void recorder.start();
    } else if (!myLive && current) {
      recordingFor.current = null;
      const kind = current.kind;
      void (async () => {
        const clip = await recorder.stop();
        if (!clip) {
          setClipStatus({ text: t('interruptions.notRecorded', { kind }), alert: true });
          return;
        }
        setClipStatus({ text: t('interruptions.sending', { kind }) });
        try {
          await deliverClip(clip, { speechIndex: current.speechIndex, interruptionId: current.id });
          setClipStatus({ text: t('interruptions.sent', { kind }) });
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          setClipStatus({ text: t('interruptions.sendFailed', { kind, reason: t(`net.${reason}`, { defaultValue: reason }) }), alert: true });
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

  function addNote() {
    if (!noteText.trim()) return;
    dispatch({ type: 'addNote', note: { id: makeId(), speechIndex: session.currentIndex, atSec: Math.floor(elapsedSec), text: noteText } });
    setNoteText('');
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
  const speechNotes = (session.notes ?? []).filter((n) => n.speechIndex === session.currentIndex).sort((a, b) => a.atSec - b.atSec);
  // Overtime flashes between its colour and the inverse once a second.
  const flashOff = phase === 'overtime' && status === 'running' && Math.floor(elapsedSec) % 2 === 1;
  const cardBg = flashOff ? phaseTheme.overtime.text : phaseTheme[phase].bg;
  const cardText = flashOff ? phaseTheme.overtime.bg : phaseTheme[phase].text;
  const speaker = session.speakers?.[template.role];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Btn
          title={props.exitLabel ?? t('timer.rounds')}
          onPress={async () => {
            await finishRecording(session.currentIndex);
            props.onExit();
          }}
        />
        <Text style={styles.muted}>
          {formatName(t, session.format)} · {t('timer.speechOf', { n: session.currentIndex + 1, total: session.speeches.length })}
        </Text>
      </Row>
      {props.banner}
      {!!session.motion && <Text style={styles.title}>{session.motion}</Text>}

      <Row>
        {session.format.speeches.map((s, i) => (
          <Chip
            key={s.id}
            label={s.role}
            active={i === session.currentIndex}
            dim={s.side === 'opp'}
            onPress={() => caps.controlTimer && void goto(i)}
          />
        ))}
      </Row>

      <View
        style={{ backgroundColor: cardBg, borderRadius: 20, padding: 20, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border }}
      >
        <Text style={[styles.h2, { color: cardText }]}>
          {rtlMark()}
          {template.role} · {roleName(t, template)}
          {speaker ? ` · ${speaker}` : ''}
          {caps.decidePoi && !caps.rule ? ` · ${t('timer.youHaveFloor')}` : ''}
        </Text>
        <Text style={[styles.clock, { color: cardText, fontSize: clockSize, lineHeight: clockSize * 1.1 }]}>
          {formatClock(elapsedSec)}
        </Text>
        <Text style={{ color: cardText, fontSize: 18, fontFamily: FONTS.semibold }}>
          {status === 'paused' ? t('timer.paused') : status === 'stopped' ? t('timer.finished') : t(`phases.${phase}`)} ·{' '}
          {remaining >= 0 ? t('timer.timeLeft', { time: formatClock(remaining) }) : t('timer.timeOver', { time: formatClock(-remaining) })}
        </Text>
        {recorder.recording && <Text style={{ color: cardText }}>{t('timer.recording')}</Text>}
        {clipStatus && <Text style={{ color: cardText, fontFamily: clipStatus.alert ? FONTS.bold : FONTS.semibold }}>{clipStatus.text}</Text>}
        {recorder.error && <Text style={{ color: cardText, fontFamily: FONTS.bold }}>{t('timer.recorderError', { error: errorText(t, recorder.error) })}</Text>}
      </View>

      {caps.controlTimer && (
        <Row style={{ justifyContent: 'center' }}>
          {status === 'idle' && <Btn big variant="primary" title={t('timer.start')} onPress={() => void start()} />}
          {status === 'running' && (
            <Btn big variant="primary" title={t('timer.pause')} onPress={() => dispatch({ type: 'timer', event: 'pause', at: clock() })} />
          )}
          {status === 'paused' && (
            <Btn
              big
              variant="primary"
              title={t('timer.resume')}
              disabled={pending.some((i) => i.kind !== 'POI')}
              onPress={() => dispatch({ type: 'timer', event: 'resume', at: clock() })}
            />
          )}
          {(status === 'running' || status === 'paused') && <Btn big variant="outline" title={t('timer.stop')} onPress={() => void stop()} />}
          {!isLast && <Btn big title={t('timer.next')} onPress={() => void goto(session.currentIndex + 1)} />}
        </Row>
      )}
      {(caps.ringBell || props.record) && (
        <Row style={{ justifyContent: 'center' }}>
          {caps.ringBell && <Btn title={t('timer.ring')} onPress={() => props.onRing('single')} />}
          {caps.ringBell && <Btn title={t('timer.ringDouble')} onPress={() => props.onRing('double')} />}
          {props.record && (
            <Chip
              label={t(autoRecord ? 'timer.autoRecordOn' : 'timer.autoRecordOff')}
              active={autoRecord}
              onPress={() => setAutoRecord((v) => !v)}
            />
          )}
        </Row>
      )}

      {showInterruptions && (
        <Card>
          <Text style={styles.h2}>{t('interruptions.title')}</Text>
          {(caps.rule || caps.raiseAs) && (
            <Row>
              {KINDS.map((k) => (
                <Btn
                  key={k}
                  big={!caps.rule}
                  title={caps.rule ? k : t('interruptions.raiseAs', { kind: k, seat: caps.raiseAs })}
                  disabled={!canRaiseKind(k)}
                  variant={picking === k ? 'primary' : 'default'}
                  onPress={() => (caps.rule ? setPicking(picking === k ? null : k) : raise(k, caps.raiseAs!))}
                />
              ))}
            </Row>
          )}
          {caps.rule && picking && (
            <View style={{ gap: 6 }}>
              <Text style={styles.muted}>{t('interruptions.pickRaiser', { name: t(`interruptions.names.${picking}`) })}</Text>
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
                {t('interruptions.livePoi', {
                  seat: livePoi.raisedBy,
                  seconds: Math.max(0, Math.ceil(POI_MAX_SEC - (elapsedSec - (livePoi.resolvedAtSec ?? 0)))),
                })}
              </Text>
              {(caps.decidePoi || livePoi.raisedBy === caps.raiseAs) && (
                <Btn title={t('interruptions.endPoi')} onPress={() => dispatch({ type: 'endPoi', id: livePoi.id, at: clock() })} />
              )}
            </Row>
          )}

          {pending.map((i) => (
            <View key={i.id} style={{ gap: 6, backgroundColor: colors.surfaceHi, padding: 10, borderRadius: 10 }}>
              <Text style={styles.text}>
                {i.kind === 'POI'
                  ? t('interruptions.pendingPoi', {
                      kind: i.kind,
                      seat: i.raisedBy,
                      time: formatClock(i.raisedAtSec),
                      seconds: Math.max(0, Math.ceil(POI_EXPIRE_SEC - (elapsedSec - i.raisedAtSec))),
                    })
                  : t('interruptions.pendingChair', { kind: i.kind, seat: i.raisedBy, time: formatClock(i.raisedAtSec) })}
              </Text>
              <Row>
                {i.kind === 'POI' && caps.decidePoi && (
                  <>
                    <Btn
                      big={!caps.rule}
                      variant="primary"
                      title={t('interruptions.accept')}
                      onPress={() => dispatch({ type: 'decidePoi', id: i.id, accept: true, at: clock() })}
                    />
                    <Btn
                      big={!caps.rule}
                      title={t('interruptions.decline')}
                      onPress={() => dispatch({ type: 'decidePoi', id: i.id, accept: false, at: clock() })}
                    />
                  </>
                )}
                {i.kind !== 'POI' &&
                  caps.rule &&
                  RULINGS.map((ruling, n) => (
                    <Btn
                      key={ruling}
                      variant={n === 0 ? 'primary' : 'default'}
                      title={t(`interruptions.rulings.${ruling}`)}
                      onPress={() => dispatch({ type: 'rule', id: i.id, ruling, at: clock() })}
                    />
                  ))}
                {(caps.rule || i.raisedBy === caps.raiseAs) && (
                  <Btn variant="outline" title={t('interruptions.withdraw')} onPress={() => dispatch({ type: 'withdraw', id: i.id, at: clock() })} />
                )}
              </Row>
            </View>
          ))}

          {speech.interruptions
            .filter((i) => i.status !== 'pending')
            .map((i) => (
              <Text key={i.id} style={styles.muted}>
                {t('interruptions.logLine', { time: formatClock(i.raisedAtSec), kind: i.kind, seat: i.raisedBy, outcome: outcomeText(t, i) })}
                {speech.clips.some((c) => c.interruptionId === i.id) ? ` · ${t('interruptions.hasAudio')}` : ''}
              </Text>
            ))}
        </Card>
      )}

      {caps.rule && (
        <Card>
          <Text style={styles.h2}>{t('notes.title')}</Text>
          <Row>
            <TextInput
              style={[styles.input, { flex: 1, minWidth: 200 }]}
              placeholder={t('notes.placeholder', { time: formatClock(elapsedSec) })}
              placeholderTextColor={colors.muted}
              value={noteText}
              onChangeText={setNoteText}
              onSubmitEditing={addNote}
              blurOnSubmit={false}
              returnKeyType="done"
            />
            <Btn title={t('notes.add')} variant="primary" disabled={!noteText.trim()} onPress={addNote} />
          </Row>
          {speechNotes.length === 0 && <Text style={styles.muted}>{t('notes.empty')}</Text>}
          {speechNotes.map((n) => (
            <Row key={n.id} style={{ justifyContent: 'space-between' }}>
              <Text style={[styles.text, { flex: 1 }]}>
                <Text style={styles.muted}>{formatClock(n.atSec)} </Text>
                {n.text}
              </Text>
              <Btn title="✕" variant="outline" onPress={() => dispatch({ type: 'deleteNote', id: n.id })} />
            </Row>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function isLivePoi(i: Interruption) {
  return i.kind === 'POI' && i.status === 'accepted' && i.endedAtSec === undefined;
}
