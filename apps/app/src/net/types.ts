import type { SocketLike } from '@debate/core';

export interface ListeningServer {
  port: number;
  close(): void;
}

/** Platform networking. `transport.native.ts` = Android TCP, `transport.ts` = Electron bridge. */
export interface Transport {
  /** False in a plain browser, where raw sockets aren't possible. */
  available: boolean;
  /** i18n key explaining why it's unavailable. */
  unavailableReason?: string;
  /** Listen on all interfaces; falls back to a free port if `port` is taken. */
  listen(port: number, onSocket: (s: SocketLike) => void): Promise<ListeningServer>;
  connect(host: string, port: number, timeoutMs: number): Promise<SocketLike>;
  /** This device's LAN IPv4 addresses, best first. */
  localAddresses(): Promise<string[]>;
}

/** Private ranges first, so the QR puts the likely-right address first. */
export function rankAddresses(ips: string[]): string[] {
  const score = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return [...new Set(ips)].filter((ip) => ip && ip !== '0.0.0.0' && !ip.startsWith('127.') && !ip.startsWith('169.254.')).sort((a, b) => score(a) - score(b));
}
