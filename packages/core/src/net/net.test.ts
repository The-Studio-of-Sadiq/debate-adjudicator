import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { BP } from '../formats';
import { createSession, currentSpeech, reduceSession, type SessionAction } from '../session';
import { elapsedMs } from '../timer';
import type { BellPattern, Session } from '../types';
import { ClientController } from './client';
import { HostController } from './host';
import { encodeJoin, makeJoinCode, parseJoin, wifiQrPayload } from './join';
import type { MemberRole, SocketLike } from './protocol';

const TOKEN = 'ABC234';
const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

async function waitFor(cond: () => boolean, ms = 2000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function startHost() {
  const clock = { t: 1_000_000 };
  let session: Session = createSession(BP, { id: 's1', now: clock.t });
  const rings: BellPattern[] = [];
  const host: HostController = new HostController({
    token: TOKEN,
    hostName: 'Chair',
    getSession: () => session,
    dispatch: (a) => {
      session = reduceSession(session, a);
      host.publish(session);
    },
    onRing: (p) => rings.push(p),
    now: () => clock.t,
  });
  const server = net.createServer((s) => {
    s.setEncoding('utf8');
    host.attach(s as unknown as SocketLike);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as net.AddressInfo).port;
  cleanups.push(() => {
    host.close();
    server.close();
  });
  const act = (a: SessionAction) => {
    session = reduceSession(session, a);
    host.publish(session);
  };
  return { host, port, clock, rings, act, get session() { return session; } };
}

function join(port: number, opts: { id: string; role: MemberRole; seat?: string; token?: string; now?: () => number }) {
  const rings: BellPattern[] = [];
  const denied: string[] = [];
  let detail = '';
  const client = new ClientController({
    connect: () =>
      new Promise((resolve, reject) => {
        const s = net.createConnection({ port, host: '127.0.0.1' }, () => resolve(s as unknown as SocketLike));
        s.setEncoding('utf8');
        s.once('error', reject);
      }),
    hello: { token: opts.token ?? TOKEN, deviceId: opts.id, name: opts.id, want: { role: opts.role, seat: opts.seat } },
    onRing: (p) => rings.push(p),
    onDenied: (r) => denied.push(r),
    onStatus: (_s, d) => (detail = d ?? detail),
    now: opts.now,
  });
  client.start();
  cleanups.push(() => client.stop());
  return { client, rings, denied, get detail() { return detail; } };
}

describe('join payload', () => {
  it('round-trips QR payloads and parses typed codes', () => {
    const info = { hosts: ['192.168.1.5', '10.0.0.2'], port: 47800, token: 'XYZ789', name: 'Room 3' };
    expect(parseJoin(encodeJoin(info))).toEqual(info);
    expect(parseJoin('192.168.43.1 abc234')).toEqual({ hosts: ['192.168.43.1'], port: 47800, token: 'ABC234' });
    expect(parseJoin('192.168.43.1:5000 ABC234')?.port).toBe(5000);
    expect(parseJoin('hello world')).toBeNull();
    expect(makeJoinCode()).toMatch(/^[A-Z2-9]{6}$/);
    expect(wifiQrPayload('Debate;Hall', 'p:ss')).toBe('WIFI:T:WPA;S:Debate\\;Hall;P:p\\:ss;;');
  });
});

describe('host/client over TCP', () => {
  it('waits for approval, then receives the session', async () => {
    const h = await startHost();
    const { client } = join(h.port, { id: 'dlo', role: 'debater', seat: 'DLO' });
    await waitFor(() => client.status === 'pending');
    expect(h.host.list()).toMatchObject([{ deviceId: 'dlo', status: 'pending', seat: 'DLO' }]);

    h.host.approve('dlo');
    await waitFor(() => client.status === 'joined');
    expect(client.session?.id).toBe('s1');
    expect(client.member).toMatchObject({ role: 'debater', seat: 'DLO', status: 'approved' });
  });

  it('rejects a wrong code', async () => {
    const h = await startHost();
    const j = join(h.port, { id: 'x', role: 'viewer', token: 'WRONG1' });
    await waitFor(() => j.client.status === 'rejected');
    expect(j.detail).toBe('Wrong join code');
  });

  it('syncs the clock so a skewed client shows the host time', async () => {
    const h = await startHost();
    // Host clock runs 5 s ahead of the client's real clock.
    h.clock.t = Date.now() + 5000;
    const tick = setInterval(() => (h.clock.t = Date.now() + 5000), 1);
    cleanups.push(() => clearInterval(tick));
    const { client } = join(h.port, { id: 'v', role: 'viewer' });
    await waitFor(() => client.status === 'pending');
    h.host.approve('v');
    await waitFor(() => client.status === 'joined' && client.clock.synced);
    await new Promise((r) => setTimeout(r, 800));
    expect(Math.abs(client.clock.offset - 5000)).toBeLessThan(50);

    h.act({ type: 'timer', event: 'start', at: h.clock.t });
    await waitFor(() => (client.session ? currentSpeech(client.session).events.length === 1 : false));
    const hostElapsed = elapsedMs(currentSpeech(h.session).events, h.clock.t);
    const clientElapsed = elapsedMs(currentSpeech(client.session!).events, client.hostNow());
    expect(Math.abs(hostElapsed - clientElapsed)).toBeLessThan(50);
  });

  it('enforces roles and re-stamps actions with host time', async () => {
    const h = await startHost();
    const dlo = join(h.port, { id: 'dlo', role: 'debater', seat: 'DLO' });
    const dpm = join(h.port, { id: 'dpm', role: 'debater', seat: 'DPM' });
    const viewer = join(h.port, { id: 'v', role: 'viewer' });
    await waitFor(() => h.host.list().length === 3);
    for (const id of ['dlo', 'dpm', 'v']) h.host.approve(id);
    await waitFor(() => [dlo, dpm, viewer].every((j) => j.client.status === 'joined'));

    h.act({ type: 'timer', event: 'start', at: h.clock.t });
    h.clock.t += 90_000;

    // Viewer cannot touch the timer.
    viewer.client.request({ type: 'timer', event: 'pause', at: 0 });
    await waitFor(() => viewer.denied.length === 1);

    // Same side as the PM: no POI.
    dpm.client.request({ type: 'raise', id: 'p0', kind: 'POI', raisedBy: 'DPM', at: 0 });
    await waitFor(() => dpm.denied.length === 1);

    // Opposition can, and a client can't pretend to be another seat.
    dlo.client.request({ type: 'raise', id: 'p1', kind: 'POI', raisedBy: 'LO', at: 0 });
    await waitFor(() => dlo.denied.length === 1);
    dlo.client.request({ type: 'raise', id: 'p2', kind: 'POI', raisedBy: 'DLO', at: 0 });
    await waitFor(() => currentSpeech(h.session).interruptions.length === 1);
    expect(currentSpeech(h.session).interruptions[0]).toMatchObject({ id: 'p2', raisedBy: 'DLO', raisedAtSec: 90 });

    // Everyone sees it.
    await waitFor(() => currentSpeech(viewer.client.session!).interruptions.length === 1);
  });

  it('auto-readmits an approved device after a dropped connection', async () => {
    const h = await startHost();
    const j = join(h.port, { id: 'tk', role: 'timekeeper' });
    await waitFor(() => j.client.status === 'pending');
    h.host.approve('tk');
    await waitFor(() => j.client.status === 'joined');

    // Simulate a Wi-Fi drop by killing the socket from the client side.
    (j.client as unknown as { socket: SocketLike }).socket.destroy();
    await waitFor(() => j.client.status === 'reconnecting');
    await waitFor(() => j.client.status === 'joined');
    expect(h.host.list()[0]).toMatchObject({ status: 'approved', connected: true });
  });

  it('broadcasts manual bells from the timekeeper', async () => {
    const h = await startHost();
    const tk = join(h.port, { id: 'tk', role: 'timekeeper' });
    const v = join(h.port, { id: 'v', role: 'viewer' });
    await waitFor(() => h.host.list().length === 2);
    h.host.approve('tk');
    h.host.approve('v');
    await waitFor(() => tk.client.status === 'joined' && v.client.status === 'joined');

    tk.client.ring('double');
    await waitFor(() => v.rings.length === 1);
    expect(h.rings).toEqual(['double']);

    v.client.ring('single');
    await waitFor(() => v.denied.length === 1);
  });
});
