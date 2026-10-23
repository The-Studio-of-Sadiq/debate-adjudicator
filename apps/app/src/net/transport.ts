import type { SocketLike } from '@debate/core';
import { rankAddresses, type Transport } from './types';

/** Exposed by apps/desktop/preload.js. Absent in a plain browser. */
type BridgeEvent =
  | { type: 'connection'; id: number }
  | { type: 'data'; id: number; data: string }
  | { type: 'close'; id: number }
  | { type: 'error'; id: number; message: string };

interface DebateNetBridge {
  listen(port: number): Promise<number>;
  unlisten(): Promise<void>;
  connect(host: string, port: number, timeoutMs: number): Promise<number>;
  write(id: number, data: string): void;
  end(id: number): void;
  destroy(id: number): void;
  addresses(): Promise<string[]>;
  onEvent(cb: (e: BridgeEvent) => void): () => void;
}

const bridge = (globalThis as { debateNet?: DebateNetBridge }).debateNet;

type Handlers = { data: ((d: string) => void)[]; close: (() => void)[]; error: ((e: unknown) => void)[] };

/** A socket living in Electron's main process, driven over IPC. */
class BridgeSocket implements SocketLike {
  handlers: Handlers = { data: [], close: [], error: [] };
  constructor(readonly id: number) {}
  write(data: string) {
    bridge!.write(this.id, data);
  }
  end() {
    bridge!.end(this.id);
  }
  destroy() {
    bridge!.destroy(this.id);
  }
  on(event: 'data' | 'close' | 'error', cb: (arg: never) => void) {
    (this.handlers[event] as unknown[]).push(cb);
    return this;
  }
}

const sockets = new Map<number, BridgeSocket>();
let onIncoming: ((s: SocketLike) => void) | null = null;

bridge?.onEvent((e) => {
  if (e.type === 'connection') {
    const s = new BridgeSocket(e.id);
    sockets.set(e.id, s);
    onIncoming?.(s);
    return;
  }
  const s = sockets.get(e.id);
  if (!s) return;
  if (e.type === 'data') s.handlers.data.forEach((h) => h(e.data));
  else if (e.type === 'error') s.handlers.error.forEach((h) => h(new Error(e.message)));
  else {
    sockets.delete(e.id);
    s.handlers.close.forEach((h) => h());
  }
});

export const transport: Transport = bridge
  ? {
      available: true,

      async listen(port, onSocket) {
        onIncoming = onSocket;
        const actual = await bridge.listen(port);
        return {
          port: actual,
          close: () => {
            onIncoming = null;
            void bridge.unlisten();
          },
        };
      },

      async connect(host, port, timeoutMs) {
        const id = await bridge.connect(host, port, timeoutMs);
        const s = new BridgeSocket(id);
        sockets.set(id, s);
        return s;
      },

      async localAddresses() {
        return rankAddresses(await bridge.addresses());
      },
    }
  : {
      available: false,
      unavailableReason: 'net.browserNoSockets',
      listen: () => Promise.reject(new Error('Not available in a browser')),
      connect: () => Promise.reject(new Error('Not available in a browser')),
      localAddresses: async () => [],
    };
