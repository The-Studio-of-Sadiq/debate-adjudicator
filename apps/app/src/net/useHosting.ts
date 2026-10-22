import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PORT,
  HostController,
  makeJoinCode,
  type BellPattern,
  type Member,
  type MemberRole,
  type Session,
  type SessionAction,
} from '@debate/core';
import { ringBell } from '../hooks';
import { transport } from './transport';
import type { ListeningServer } from './types';

export interface HostingInfo {
  port: number;
  token: string;
  /** Detected LAN addresses plus any the chair added by hand. */
  addresses: string[];
}

/** Runs the LAN host for the chair's current session. */
export function useHosting(session: Session | null, dispatch: (a: SessionAction) => void, hostName: string) {
  const [info, setInfo] = useState<HostingInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hostRef = useRef<HostController | null>(null);
  const serverRef = useRef<ListeningServer | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const stop = useCallback(() => {
    hostRef.current?.close();
    serverRef.current?.close();
    hostRef.current = null;
    serverRef.current = null;
    setInfo(null);
    setMembers([]);
  }, []);

  const start = useCallback(async () => {
    if (hostRef.current || !transport.available) return;
    const token = makeJoinCode();
    const host = new HostController({
      token,
      hostName: hostName || 'Chair',
      getSession: () => sessionRef.current!,
      dispatch,
      onMembers: setMembers,
      onRing: (p) => ringBell(p),
    });
    try {
      const server = await transport.listen(DEFAULT_PORT, (s) => host.attach(s));
      hostRef.current = host;
      serverRef.current = server;
      setInfo({ port: server.port, token, addresses: await transport.localAddresses() });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [dispatch, hostName]);

  // Push every change to joined devices.
  useEffect(() => {
    if (session && hostRef.current) hostRef.current.publish(session);
  }, [session]);

  // A different round means a different room.
  useEffect(() => stop, [session?.id, stop]);

  const ring = useCallback((p: BellPattern) => {
    if (hostRef.current) hostRef.current.ring(p);
    else ringBell(p);
  }, []);

  return {
    info,
    members,
    error,
    active: info !== null,
    start,
    stop,
    ring,
    addAddress: (ip: string) => setInfo((i) => (i && !i.addresses.includes(ip) ? { ...i, addresses: [ip, ...i.addresses] } : i)),
    approve: (id: string, role?: MemberRole, seat?: string) => hostRef.current?.approve(id, role, seat),
    setRole: (id: string, role: MemberRole, seat?: string) => hostRef.current?.setRole(id, role, seat),
    remove: (id: string) => hostRef.current?.remove(id),
  };
}

export type Hosting = ReturnType<typeof useHosting>;
