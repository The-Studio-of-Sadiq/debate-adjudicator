import { makeId } from './storage';

/** Exposed by apps/desktop/preload.js; absent in a plain browser. */
interface DebateFilesBridge {
  saveClip(fileName: string, base64: string): Promise<string>;
}

const bridge = (globalThis as { debateFiles?: DebateFilesBridge }).debateFiles;

/** Works for blob:, data: and app:// URLs. */
export async function readAsBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Store a clip. In the Windows app it goes to disk (served back over app://);
 * in a plain browser it can only be kept inline as a data: URL.
 */
export async function saveClip(fileName: string, base64: string): Promise<string> {
  if (bridge) return bridge.saveClip(fileName, base64);
  return `data:audio/${extensionOf(fileName)};base64,${base64}`;
}

/**
 * Browser recordings are blob: URLs that die with the page; copy them to
 * disk so the review screen can still play them after a restart.
 */
export async function persistRecording(uri: string): Promise<string> {
  if (!uri.startsWith('blob:') || !bridge) return uri;
  return bridge.saveClip(`${makeId()}.webm`, await readAsBase64(uri));
}

export function extensionOf(uri: string): string {
  return uri.match(/\.([a-z0-9]{1,5})(?:\?|$)/i)?.[1]?.toLowerCase() ?? 'webm';
}
