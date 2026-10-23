import type { SessionAction } from '../session';
import type { BellPattern, Session } from '../types';
import { ClockSync } from './clock';
import {
  CLIP_CHUNK_CHARS,
  encodeMsg,
  isMsg,
  LineDecoder,
  PROTOCOL_VERSION,
  type ClientMsg,
  type ClipMeta,
  type Hello,
  type HostMsg,
  type Member,
  type SocketLike,
} from './protocol';

export type ClientStatus = 'connecting' | 'pending' | 'joined' | 'reconnecting' | 'rejected' | 'closed';

export interface ClientOptions {
  /** Open a connected socket to the host (adapter tries candidate addresses). */
  connect(): Promise<SocketLike>;
  hello: Omit<Hello, 't' | 'v'>;
  onStatus?(status: ClientStatus, detail?: string): void;
  onState?(session: Session): void;
  onMember?(member: Member): void;
  onRing?(pattern: BellPattern): void;
  onDenied?(reason: string): void;
  now?(): number;
}

const PING_BURST = 5;
const PING_BURST_GAP_MS = 150;
const PING_INTERVAL_MS = 3000;
const RETRY_MS = [500, 1000, 2000, 4000];

/** Runs on every joined device. Holds a read-only copy of the host's session. */
export class ClientController {
  readonly clock = new ClockSync();
  status: ClientStatus = 'connecting';
  member: Member | null = null;
  session: Session | null = null;
  hostName = '';

  /** Clips waiting for the host's ack; resent after every reconnect. */
  private outbox = new Map<
    string,
    { meta: ClipMeta; base64: string; resolve: () => void; reject: (e: Error) => void }
  >();
  private socket: SocketLike | null = null;
  private rev = -1;
  private stopped = false;
  private attempt = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private now: () => number;

  constructor(private opts: ClientOptions) {
    this.now = opts.now ?? Date.now;
  }

  start() {
    this.stopped = false;
    void this.connect();
  }

  /** Host time in epoch ms. Use this, not Date.now(), to draw the timer. */
  hostNow(): number {
    return this.now() + this.clock.offset;
  }

  request(action: SessionAction) {
    this.send({ t: 'act', action });
  }

  ring(pattern: BellPattern) {
    this.send({ t: 'ring', pattern });
  }

  /**
   * Send a recorded clip to the host. Resolves once the host has stored it;
   * survives dropped connections by resending after each reconnect.
   */
  uploadClip(id: string, meta: ClipMeta, base64: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.outbox.set(id, { meta, base64, resolve, reject });
      if (this.status === 'joined') this.sendClip(id);
    });
  }

  /** Clips still waiting for the host. */
  get pendingClips(): number {
    return this.outbox.size;
  }

  private sendClip(id: string) {
    const item = this.outbox.get(id);
    if (!item) return;
    const { base64, meta } = item;
    const count = Math.max(1, Math.ceil(base64.length / CLIP_CHUNK_CHARS));
    for (let seq = 0; seq < count; seq++) {
      this.send({
        t: 'clip',
        id,
        seq,
        last: seq === count - 1,
        data: base64.slice(seq * CLIP_CHUNK_CHARS, (seq + 1) * CLIP_CHUNK_CHARS),
        meta: seq === 0 ? meta : undefined,
      });
    }
  }

  stop() {
    this.stopped = true;
    for (const item of this.outbox.values()) item.reject(new Error('left'));
    this.outbox.clear();
    this.clearTimers();
    this.socket?.destroy();
    this.socket = null;
    this.setStatus('closed');
  }

  private setStatus(s: ClientStatus, detail?: string) {
    this.status = s;
    this.opts.onStatus?.(s, detail);
  }

  private send(msg: ClientMsg) {
    try {
      this.socket?.write(encodeMsg(msg));
    } catch {
      // Reconnect logic handles a dead socket.
    }
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private async connect() {
    if (this.stopped) return;
    let socket: SocketLike;
    try {
      socket = await this.opts.connect();
    } catch (e) {
      this.scheduleRetry('unreachable');
      return;
    }
    if (this.stopped) {
      socket.destroy();
      return;
    }
    this.socket = socket;
    this.attempt = 0;
    const decoder = new LineDecoder();
    socket.on('data', (chunk) => {
      for (const msg of decoder.push(chunk)) if (isMsg<HostMsg>(msg)) this.onMessage(msg);
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.clearTimers();
      if (this.status === 'rejected' || this.stopped) return;
      this.scheduleRetry('connectionLost');
    });

    this.send({ t: 'hello', v: PROTOCOL_VERSION, ...this.opts.hello });
    for (let i = 0; i < PING_BURST; i++) this.later(i * PING_BURST_GAP_MS, () => this.ping());
    const loop = () => {
      this.ping();
      this.later(PING_INTERVAL_MS, loop);
    };
    this.later(PING_BURST * PING_BURST_GAP_MS + PING_INTERVAL_MS, loop);
  }

  private scheduleRetry(detail: string) {
    if (this.stopped) return;
    this.setStatus(this.member ? 'reconnecting' : 'connecting', detail);
    const ms = RETRY_MS[Math.min(this.attempt++, RETRY_MS.length - 1)]!;
    this.later(ms, () => void this.connect());
  }

  private ping() {
    this.send({ t: 'ping', c0: this.now() });
  }

  private onMessage(msg: HostMsg) {
    switch (msg.t) {
      case 'pong':
        this.clock.add(msg.c0, msg.h, this.now());
        break;
      case 'pending':
        this.hostName = msg.hostName;
        this.setStatus('pending');
        break;
      case 'welcome':
        this.hostName = msg.hostName;
        this.member = msg.member;
        this.rev = msg.rev;
        this.session = msg.session;
        this.opts.onMember?.(msg.member);
        this.opts.onState?.(msg.session);
        this.setStatus('joined');
        for (const id of this.outbox.keys()) this.sendClip(id);
        break;
      case 'clipAck':
        this.outbox.get(msg.id)?.resolve();
        this.outbox.delete(msg.id);
        break;
      case 'clipRejected':
        this.outbox.get(msg.id)?.reject(new Error(msg.reason));
        this.outbox.delete(msg.id);
        break;
      case 'state':
        if (msg.rev <= this.rev) break;
        this.rev = msg.rev;
        this.session = msg.session;
        this.opts.onState?.(msg.session);
        break;
      case 'you':
        this.member = msg.member;
        this.opts.onMember?.(msg.member);
        break;
      case 'ring':
        this.opts.onRing?.(msg.pattern);
        break;
      case 'denied':
        this.opts.onDenied?.(msg.reason);
        break;
      case 'rejected':
        this.setStatus('rejected', msg.reason);
        this.stopped = true;
        this.clearTimers();
        this.socket?.destroy();
        break;
    }
  }
}
