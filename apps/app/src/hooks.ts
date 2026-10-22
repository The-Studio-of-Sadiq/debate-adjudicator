import { useEffect, useRef, useState } from 'react';
import { Platform, Vibration } from 'react-native';
import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import { bellsBetween, RINGS, type BellPattern, type ClipRef, type SpeechTemplate } from '@debate/core';

/** Re-renders every `intervalMs` while `active`, returning `clock()` (Date.now by default). */
export function useNow(active: boolean, intervalMs = 100, clock: () => number = Date.now): number {
  const [now, setNow] = useState(clock());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(clock()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, clock]);
  return active ? now : clock();
}

const RING_GAP_MS = 330;
let bellPlayer: AudioPlayer | null = null;

function getBellPlayer(): AudioPlayer {
  bellPlayer ??= createAudioPlayer(require('../assets/bell.wav'));
  return bellPlayer;
}

export function ringBell(pattern: BellPattern, vibrate = true) {
  const player = getBellPlayer();
  const rings = RINGS[pattern];
  for (let i = 0; i < rings; i++) {
    setTimeout(() => {
      void player.seekTo(0);
      player.play();
    }, i * RING_GAP_MS);
  }
  if (vibrate && Platform.OS === 'android') {
    Vibration.vibrate(Array.from({ length: rings * 2 }, (_, i) => (i % 2 ? 180 : i === 0 ? 0 : 150)));
  }
}

/**
 * Rings the scheduled bells as the speech clock crosses them. Tracks the last
 * seen elapsed time so irregular renders never skip or double a bell.
 */
export function useBells(template: SpeechTemplate, elapsedSec: number, enabled: boolean) {
  const last = useRef<{ id: string; sec: number } | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { id: template.id, sec: elapsedSec };
    // New speech, or first render: just remember where we are.
    if (!enabled || !prev || prev.id !== template.id) return;
    const hits = bellsBetween(template.bells, prev.sec, elapsedSec);
    const strongest = hits[hits.length - 1];
    if (strongest) ringBell(strongest.rule.pattern);
  }, [template, elapsedSec, enabled]);
}

/** Records one clip per speech on this device. */
export function useSpeechRecorder(deviceId: string) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' } as typeof RecordingPresets.HIGH_QUALITY);
  const startedAt = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, allowsBackgroundRecording: true });
  }, []);

  async function start(): Promise<boolean> {
    if (startedAt.current !== null) return true;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone permission denied');
        return false;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setRecording(true);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function stop(): Promise<ClipRef | null> {
    const began = startedAt.current;
    if (began === null) return null;
    startedAt.current = null;
    setRecording(false);
    try {
      await recorder.stop();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
    if (!recorder.uri) return null;
    return {
      id: `${began.toString(36)}-${deviceId}`,
      deviceId,
      uri: recorder.uri,
      startedAt: began,
      durationMs: Date.now() - began,
    };
  }

  return { start, stop, recording, error };
}
