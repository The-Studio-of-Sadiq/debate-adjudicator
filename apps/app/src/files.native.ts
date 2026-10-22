import { Directory, File, Paths } from 'expo-file-system';

const clipsDir = () => {
  const dir = new Directory(Paths.document, 'clips');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
};

export async function readAsBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}

/** Store an uploaded clip on this device; returns a playable file:// URI. */
export async function saveClip(fileName: string, base64: string): Promise<string> {
  const file = new File(clipsDir(), fileName);
  file.create({ overwrite: true });
  await file.write(base64, { encoding: 'base64' });
  return file.uri;
}

/** Recordings already go to the document directory on Android, so they persist as is. */
export async function persistRecording(uri: string): Promise<string> {
  return uri;
}

export function extensionOf(uri: string): string {
  return uri.match(/\.([a-z0-9]{1,5})(?:\?|$)/i)?.[1]?.toLowerCase() ?? 'm4a';
}
