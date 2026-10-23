import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DebateFormat, Session } from '@debate/core';
import { DEFAULT_SETTINGS, type TranscriptionSettings } from './transcription/types';

/** Exposed by apps/desktop/preload.js: files on disk, written immediately. */
interface StoreBridge {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
const bridge = (globalThis as { debateStore?: StoreBridge }).debateStore;

/**
 * Android: AsyncStorage (SQLite, durable). Windows app: the disk store, falling
 * back to AsyncStorage (localStorage) for data saved before it existed.
 */
const kv = bridge
  ? {
      getItem: async (key: string) => (await bridge.get(key)) ?? AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => bridge.set(key, value),
      removeItem: async (key: string) => {
        await bridge.remove(key);
        await AsyncStorage.removeItem(key);
      },
    }
  : AsyncStorage;

const INDEX_KEY = 'sessions:index';
const sessionKey = (id: string) => `session:${id}`;
const FORMATS_KEY = 'formats:custom';

export interface SessionSummary {
  id: string;
  createdAt: number;
  motion: string;
  formatName: string;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await kv.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function listSessions(): Promise<SessionSummary[]> {
  const list = await readJson<SessionSummary[]>(INDEX_KEY, []);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadSession(id: string): Promise<Session | null> {
  return readJson<Session | null>(sessionKey(id), null);
}

export async function saveSession(s: Session): Promise<void> {
  await kv.setItem(sessionKey(s.id), JSON.stringify(s));
  const list = await readJson<SessionSummary[]>(INDEX_KEY, []);
  const summary: SessionSummary = { id: s.id, createdAt: s.createdAt, motion: s.motion, formatName: s.format.name };
  const next = [summary, ...list.filter((x) => x.id !== s.id)];
  await kv.setItem(INDEX_KEY, JSON.stringify(next));
}

export async function deleteSession(id: string): Promise<void> {
  await kv.removeItem(sessionKey(id));
  const list = await readJson<SessionSummary[]>(INDEX_KEY, []);
  await kv.setItem(INDEX_KEY, JSON.stringify(list.filter((x) => x.id !== id)));
}

/** Custom formats saved from the bell editor, keyed by format id. */
export async function loadCustomFormats(): Promise<Record<string, DebateFormat>> {
  return readJson<Record<string, DebateFormat>>(FORMATS_KEY, {});
}

export async function saveCustomFormat(f: DebateFormat): Promise<void> {
  const all = await loadCustomFormats();
  all[f.id] = f;
  await kv.setItem(FORMATS_KEY, JSON.stringify(all));
}

export async function resetCustomFormat(id: string): Promise<void> {
  const all = await loadCustomFormats();
  delete all[id];
  await kv.setItem(FORMATS_KEY, JSON.stringify(all));
}

const TRANSCRIPTION_KEY = 'settings:transcription';

/** Stored as-is; the API key is kept on this device only. */
export async function loadTranscriptionSettings(): Promise<TranscriptionSettings> {
  const saved = await readJson<Partial<TranscriptionSettings> | null>(TRANSCRIPTION_KEY, null);
  return { ...DEFAULT_SETTINGS, ...saved, cloud: { ...DEFAULT_SETTINGS.cloud, ...saved?.cloud } };
}

export async function saveTranscriptionSettings(s: TranscriptionSettings): Promise<void> {
  await kv.setItem(TRANSCRIPTION_KEY, JSON.stringify(s));
}

export interface Identity {
  deviceId: string;
  name: string;
}

const IDENTITY_KEY = 'device:identity';

/** Stable per-install id, so a device that drops off Wi-Fi is readmitted without re-approval. */
export async function loadIdentity(): Promise<Identity> {
  const saved = await readJson<Identity | null>(IDENTITY_KEY, null);
  if (saved) return saved;
  const fresh = { deviceId: makeId(), name: '' };
  await kv.setItem(IDENTITY_KEY, JSON.stringify(fresh));
  return fresh;
}

export async function saveIdentity(i: Identity): Promise<void> {
  await kv.setItem(IDENTITY_KEY, JSON.stringify(i));
}

export const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
