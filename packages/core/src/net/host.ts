import type { SessionAction } from '../session';
import type { BellPattern, Session } from '../types';
import { authorize, mayUploadClip } from './permissions';
import {
  encodeMsg,
  isMsg,
  LineDecoder,
  MAX_CLIP_CHARS,
  PROTOCOL_VERSION,
  type ClipMeta,
  type ClientMsg,
  type HostMsg,
  type Member,
  type MemberRole,
  type SocketLike,
} from './protocol';

export interface HostOptions {
  token: string;
  hostName: string;
  getSession(): Session;
  /** Apply an (already authorized, host-stamped) action to the host's session. */
  dispatch(action: SessionAction): void;
  onMembers?(members: Member[]): void;
  /** A timekeeper asked for a manual bell; ring it locally too. */
  onRing?(pattern: BellPattern): void;
  /**
   * Store an uploaded clip (base64) and return a URI the host can play it
   * from. Without this, uploads are refused.
   */
  saveClip?(fileName: string, base64: string): Promise<string>;
  now?(): number;
}

interface IncomingClip {
  meta: ClipMeta;
  parts: string[];
  chars: number;
  nextSeq: number;
}

/**
 * Runs on the core adjudicator's device. Transport-agnostic: hand it each
 * accepted socket via `attach`, and call `publish` whenever the session changes.
 */
export class HostController {
  private members = new Map<string, Member>();
  private sockets = new Map<string, SocketLike>();
  /** Partially received uploads, keyed by clip id. */
  private uploads = new Map<string, IncomingClip>();
  private rev = 0;
  private now: () => number;

  constructor(private opts: HostOptions) {
    this.now = opts.now ?? Date.now;
  }

  attach(socket: SocketLike) {
    const decoder = new LineDecoder();
    let deviceId: string | null = null;
    socket.on('data', (chunk) => {
      for (const msg of decoder.push(chunk)) {
        if (!isMsg<ClientMsg>(msg)) continue;
        if (msg.t === 'hello') deviceId = this.onHello(socket, msg);
        else this.onMessage(socket, deviceId, msg);
      }
    });
    socket.on('close', () => {
      if (!deviceId || this.sockets.get(deviceId) !== socket) return;
      this.sockets.delete(deviceId);
      const m = this.members.get(deviceId);
      if (m) {
        if (m.status === 'pending') this.members.delete(deviceId);
        else m.connected = false;
      }
      this.emitMembers();
    });
    socket.on('error', () => {});
  }

  private send(socket: SocketLike, msg: HostMsg) {
    try {
      socket.write(encodeMsg(msg));
    } catch {
      // The close handler cleans up.
    }
  }

  /** Send a final message, then close once it has been flushed. */
  private sendAndClose(socket: SocketLike, msg: HostMsg) {
    this.send(socket, msg);
    if (socket.end) socket.end();
    else socket.destroy();
  }

  private sendTo(deviceId: string, msg: HostMsg) {
    const s = this.sockets.get(deviceId);
    if (s) this.send(s, msg);
  }

  private onHello(socket: SocketLike, msg: Extract<ClientMsg, { t: 'hello' }>): string | null {
    if (msg.v !== PROTOCOL_VERSION) {
      this.sendAndClose(socket, { t: 'rejected', reason: 'App version mismatch; update both devices' });
      return null;
    }
    if (msg.token.toUpperCase() !== this.opts.token) {
      this.sendAndClose(socket, { t: 'rejected', reason: 'Wrong join code' });
      return null;
    }
    const id = msg.deviceId;
    const old = this.sockets.get(id);
    if (old && old !== socket) old.destroy();
    this.sockets.set(id, socket);

    const existing = this.members.get(id);
    if (existing?.status === 'approved') {
      // Reconnect after a Wi-Fi blip: no need to approve again.
      existing.connected = true;
      existing.name = msg.name;
      this.sendWelcome(existing);
    } else {
      this.members.set(id, {
        deviceId: id,
        name: msg.name.slice(0, 40) || 'Guest',
        role: msg.want.role,
        seat: msg.want.seat,
        status: 'pending',
        connected: true,
      });
      this.send(socket, { t: 'pending', hostName: this.opts.hostName });
    }
    this.emitMembers();
    return id;
  }

  private onMessage(socket: SocketLike, deviceId: string | null, msg: ClientMsg) {
    if (msg.t === 'ping') {
      this.send(socket, { t: 'pong', c0: msg.c0, h: this.now() });
      return;
    }
    const member = deviceId ? this.members.get(deviceId) : undefined;
    if (!member || member.status !== 'approved') return;

    if (msg.t === 'ring') {
      if (member.role === 'timekeeper') this.ring(msg.pattern);
      else this.send(socket, { t: 'denied', reason: 'Only the timekeeper can ring the bell' });
      return;
    }
    if (msg.t === 'clip') {
      void this.onClipChunk(socket, member, msg);
      return;
    }
    if (msg.t === 'act') {
      const session = this.opts.getSession();
      if (!authorize(member, msg.action, session)) {
        this.send(socket, { t: 'denied', reason: 'Not allowed for your role' });
        return;
      }
      // The host's clock is the only clock: re-stamp every timed action.
      const action = 'at' in msg.action ? { ...msg.action, at: this.now() } : msg.action;
      this.opts.dispatch(action);
    }
  }

  private async onClipChunk(socket: SocketLike, member: Member, msg: Extract<ClientMsg, { t: 'clip' }>) {
    const reject = (reason: string) => {
      this.uploads.delete(msg.id);
      this.send(socket, { t: 'clipRejected', id: msg.id, reason });
    };

    if (msg.seq === 0) {
      const meta = msg.meta;
      // The id and extension become a file name on the host, so keep them plain.
      if (!meta || !/^[\w-]{1,80}$/.test(msg.id) || !/^[a-z0-9]{1,5}$/.test(meta.ext)) return reject('Bad clip metadata');
      const session = this.opts.getSession();
      // Already stored (a retry after a reconnect): just confirm.
      if (session.speeches[meta.speechIndex]?.clips.some((c) => c.id === msg.id)) {
        this.uploads.delete(msg.id);
        this.send(socket, { t: 'clipAck', id: msg.id });
        return;
      }
      if (!this.opts.saveClip) return reject('This device cannot store clips');
      if (!mayUploadClip(member, session, meta.speechIndex, meta.interruptionId)) return reject('Not your interruption');
      this.uploads.set(msg.id, { meta, parts: [], chars: 0, nextSeq: 0 });
    }

    const up = this.uploads.get(msg.id);
    if (!up) return; // Remainder of an upload we already answered.
    if (msg.seq !== up.nextSeq) return reject('Clip chunks out of order');
    up.parts.push(msg.data);
    up.chars += msg.data.length;
    up.nextSeq++;
    if (up.chars > MAX_CLIP_CHARS) return reject('Clip too large');
    if (!msg.last) return;

    this.uploads.delete(msg.id);
    let uri: string;
    try {
      uri = await this.opts.saveClip!(`${msg.id}.${up.meta.ext}`, up.parts.join(''));
    } catch (e) {
      return reject(`Could not save clip: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.opts.dispatch({
      type: 'addClip',
      speechIndex: up.meta.speechIndex,
      clip: {
        id: msg.id,
        deviceId: member.deviceId,
        uri,
        startedAt: up.meta.startedAt,
        durationMs: up.meta.durationMs,
        interruptionId: up.meta.interruptionId,
      },
    });
    this.send(socket, { t: 'clipAck', id: msg.id });
  }

  private sendWelcome(m: Member) {
    this.sendTo(m.deviceId, { t: 'welcome', hostName: this.opts.hostName, member: { ...m }, session: this.opts.getSession(), rev: this.rev });
  }

  private emitMembers() {
    this.opts.onMembers?.(this.list());
  }

  list(): Member[] {
    return [...this.members.values()].map((m) => ({ ...m }));
  }

  approve(deviceId: string, role?: MemberRole, seat?: string) {
    const m = this.members.get(deviceId);
    if (!m) return;
    m.status = 'approved';
    if (role) m.role = role;
    m.seat = (role ?? m.role) === 'debater' ? (seat ?? m.seat) : undefined;
    this.sendWelcome(m);
    this.emitMembers();
  }

  setRole(deviceId: string, role: MemberRole, seat?: string) {
    const m = this.members.get(deviceId);
    if (!m) return;
    m.role = role;
    m.seat = role === 'debater' ? seat : undefined;
    if (m.status === 'approved') this.sendTo(deviceId, { t: 'you', member: { ...m } });
    this.emitMembers();
  }

  /** Reject a pending request or remove an approved member. */
  remove(deviceId: string, reason = 'Removed by the chair') {
    const socket = this.sockets.get(deviceId);
    if (socket) this.sendAndClose(socket, { t: 'rejected', reason });
    this.sockets.delete(deviceId);
    this.members.delete(deviceId);
    this.emitMembers();
  }

  /** Push the latest session to every approved, connected device. */
  publish(session: Session) {
    this.rev++;
    for (const m of this.members.values()) {
      if (m.status === 'approved' && m.connected) this.sendTo(m.deviceId, { t: 'state', session, rev: this.rev });
    }
  }

  ring(pattern: BellPattern) {
    this.opts.onRing?.(pattern);
    for (const m of this.members.values()) {
      if (m.status === 'approved' && m.connected) this.sendTo(m.deviceId, { t: 'ring', pattern });
    }
  }

  close() {
    for (const s of this.sockets.values()) s.destroy();
    this.sockets.clear();
    this.members.clear();
    this.uploads.clear();
  }
}
