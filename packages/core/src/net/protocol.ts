import type { BellPattern, Session } from '../types';
import type { SessionAction } from '../session';

export const PROTOCOL_VERSION = 1;
export const DEFAULT_PORT = 47800;

/**
 * chair: the core adjudicator; runs the host and does everything.
 * timekeeper: controls the clock and bells.
 * debater: sits in a seat (PM, LO, …); can raise POI/POO/POP and answer POIs while speaking.
 * wing / viewer: see the timer and hear bells.
 */
export type MemberRole = 'timekeeper' | 'debater' | 'wing' | 'viewer';

export interface Member {
  deviceId: string;
  name: string;
  role: MemberRole;
  /** Speech role code for debaters, e.g. "DLO". */
  seat?: string;
  status: 'pending' | 'approved';
  connected: boolean;
}

export interface Hello {
  t: 'hello';
  v: number;
  token: string;
  deviceId: string;
  name: string;
  want: { role: MemberRole; seat?: string };
}

export type ClientMsg =
  | Hello
  | { t: 'ping'; c0: number }
  | { t: 'act'; action: SessionAction }
  | { t: 'ring'; pattern: BellPattern };

export type HostMsg =
  | { t: 'pending'; hostName: string }
  | { t: 'welcome'; hostName: string; member: Member; session: Session; rev: number }
  | { t: 'state'; session: Session; rev: number }
  | { t: 'you'; member: Member }
  | { t: 'pong'; c0: number; h: number }
  | { t: 'ring'; pattern: BellPattern }
  | { t: 'denied'; reason: string }
  | { t: 'rejected'; reason: string };

/**
 * The minimal socket surface both Node's `net.Socket` and
 * react-native-tcp-socket provide. Adapters must deliver `data` as strings
 * (call `setEncoding('utf8')`).
 */
export interface SocketLike {
  write(data: string): void;
  /** Close after flushing pending writes. */
  end?(): void;
  destroy(): void;
  on(event: 'data', cb: (chunk: string) => void): unknown;
  on(event: 'close', cb: () => void): unknown;
  on(event: 'error', cb: (err: unknown) => void): unknown;
}

/** Messages are newline-delimited JSON. */
export const encodeMsg = (m: HostMsg | ClientMsg) => JSON.stringify(m) + '\n';

const MAX_BUFFER = 4 * 1024 * 1024;

export class LineDecoder {
  private buf = '';

  push(chunk: string): unknown[] {
    this.buf += chunk;
    if (this.buf.length > MAX_BUFFER) {
      this.buf = '';
      return [];
    }
    const lines = this.buf.split('\n');
    this.buf = lines.pop()!;
    const out: unknown[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        // Ignore a garbled line rather than dropping the connection.
      }
    }
    return out;
  }
}

export function isMsg<T extends { t: string }>(m: unknown): m is T {
  return typeof m === 'object' && m !== null && typeof (m as { t?: unknown }).t === 'string';
}
