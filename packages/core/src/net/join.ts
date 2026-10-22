import { DEFAULT_PORT } from './protocol';

export interface JoinInfo {
  /** Candidate host addresses; the client tries each in turn. */
  hosts: string[];
  port: number;
  token: string;
  name?: string;
}

// No 0/O, 1/I/L so codes read cleanly off a screen.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeJoinCode(random: () => number = Math.random, length = 6): string {
  let s = '';
  for (let i = 0; i < length; i++) s += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return s;
}

export function encodeJoin(j: JoinInfo): string {
  const parts = [`h=${j.hosts.join(',')}`, `p=${j.port}`, `k=${j.token}`];
  if (j.name) parts.push(`n=${encodeURIComponent(j.name)}`);
  return `debate://join?${parts.join('&')}`;
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

/**
 * Accepts the QR payload (`debate://join?...`) or a typed code such as
 * `192.168.1.5 ABC234` / `192.168.1.5:47800 ABC234`.
 * (URL/URLSearchParams are incomplete in React Native, so this parses by hand.)
 */
export function parseJoin(text: string): JoinInfo | null {
  const s = text.trim();
  if (s.startsWith('debate://join?')) {
    const params: Record<string, string> = {};
    for (const pair of s.slice('debate://join?'.length).split('&')) {
      const eq = pair.indexOf('=');
      if (eq > 0) params[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
    }
    const hosts = (params.h ?? '').split(',').filter((h) => IPV4.test(h) || h === 'localhost');
    const port = Number(params.p ?? DEFAULT_PORT);
    if (!hosts.length || !params.k || !Number.isInteger(port)) return null;
    return { hosts, port, token: params.k.toUpperCase(), name: params.n };
  }
  const m = s.match(/^([\w.]+)(?::(\d+))?\s+([A-Za-z0-9]{4,8})$/);
  if (!m || !(IPV4.test(m[1]!) || m[1] === 'localhost')) return null;
  return { hosts: [m[1]!], port: m[2] ? Number(m[2]) : DEFAULT_PORT, token: m[3]!.toUpperCase() };
}

/** Standard Wi-Fi QR payload, understood by Android and iOS camera apps. */
export function wifiQrPayload(ssid: string, password: string): string {
  const esc = (v: string) => v.replace(/([\\;,:"])/g, '\\$1');
  return password ? `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};;` : `WIFI:T:nopass;S:${esc(ssid)};;`;
}
