import { useCallback, useRef, useState } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { reduceSession, type ClipRef, type Session, type SessionAction, type Transcript } from '@debate/core';
import { loadSession, loadTranscriptionSettings, saveSession } from '../storage';
import { transcribeClip, type Progress } from './index';

export type JobState = { status: 'queued' } | { status: 'running'; progress?: Progress } | { status: 'error'; error: string };

const KEEP_AWAKE_TAG = 'transcription';

/**
 * Runs transcriptions one at a time (Whisper uses every core it gets) and
 * stores each result on its round, even if the user has moved to another one.
 */
export function useTranscriptionJobs(session: Session | null, dispatch: (a: SessionAction) => void) {
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const queue = useRef<{ sessionId: string; clip: ClipRef }[]>([]);
  const running = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const setJob = (clipId: string, state: JobState | null) =>
    setJobs((all) => {
      const next = { ...all };
      if (state) next[clipId] = state;
      else delete next[clipId];
      return next;
    });

  const pump = useCallback(async () => {
    if (running.current) return;
    const job = queue.current.shift();
    if (!job) {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
      return;
    }
    running.current = true;
    // Long jobs: don't let the phone sleep mid-transcription.
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    setJob(job.clip.id, { status: 'running' });
    try {
      const settings = await loadTranscriptionSettings();
      const { engine, segments } = await transcribeClip(job.clip.uri, settings, (progress) =>
        setJob(job.clip.id, { status: 'running', progress }),
      );
      const transcript: Transcript = { clipId: job.clip.id, engine, createdAt: Date.now(), segments };
      const action: SessionAction = { type: 'setTranscript', transcript };
      if (sessionRef.current?.id === job.sessionId) dispatch(action);
      else {
        const stored = await loadSession(job.sessionId);
        if (stored) await saveSession(reduceSession(stored, action));
      }
      setJob(job.clip.id, null);
    } catch (e) {
      setJob(job.clip.id, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      running.current = false;
      void pump();
    }
  }, [dispatch]);

  const enqueue = useCallback(
    (sessionId: string, clips: ClipRef[]) => {
      for (const clip of clips) {
        if (queue.current.some((j) => j.clip.id === clip.id)) continue;
        queue.current.push({ sessionId, clip });
        setJob(clip.id, { status: 'queued' });
      }
      void pump();
    },
    [pump],
  );

  return { jobs, enqueue };
}

export type TranscriptionJobs = ReturnType<typeof useTranscriptionJobs>;
