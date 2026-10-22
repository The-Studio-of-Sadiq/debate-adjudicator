import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ClientController, type ClientStatus, type JoinInfo, type MemberRole } from '@debate/core';
import { ringBell } from '../hooks';
import type { Identity } from '../storage';
import { transport } from './transport';

const CONNECT_TIMEOUT_MS = 2500;

export interface JoinRequest {
  info: JoinInfo;
  identity: Identity;
  want: { role: MemberRole; seat?: string };
}

/** Joins a host and keeps a live, read-only copy of its session. */
export function useClient(req: JoinRequest | null) {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [status, setStatus] = useState<{ status: ClientStatus; detail?: string }>({ status: 'connecting' });
  const [denied, setDenied] = useState<string | null>(null);
  const ref = useRef<ClientController | null>(null);

  useEffect(() => {
    if (!req) return;
    const client = new ClientController({
      // Try each address from the QR until one answers.
      connect: async () => {
        let last: unknown = new Error('No host address');
        for (const host of req.info.hosts) {
          try {
            return await transport.connect(host, req.info.port, CONNECT_TIMEOUT_MS);
          } catch (e) {
            last = e;
          }
        }
        throw last;
      },
      hello: { token: req.info.token, deviceId: req.identity.deviceId, name: req.identity.name, want: req.want },
      onStatus: (s, detail) => setStatus({ status: s, detail }),
      onState: rerender,
      onMember: rerender,
      onRing: (p) => ringBell(p),
      onDenied: (r) => {
        setDenied(r);
        setTimeout(() => setDenied(null), 3000);
      },
    });
    ref.current = client;
    client.start();
    // Clock-sync samples arrive without a state change; refresh the sync readout.
    const tick = setInterval(rerender, 2000);
    return () => {
      clearInterval(tick);
      client.stop();
      ref.current = null;
    };
  }, [req]);

  // Stable so the timer's interval doesn't restart every render.
  const hostNow = useCallback(() => ref.current?.hostNow() ?? Date.now(), []);

  return { client: ref.current, ...status, denied, hostNow };
}
