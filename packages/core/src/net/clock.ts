const MAX_SAMPLES = 10;

/**
 * Estimates how far the host clock is ahead of ours from ping/pong round
 * trips (NTP-style). The sample with the shortest round trip is the most
 * trustworthy, so that one wins.
 */
export class ClockSync {
  private samples: { offset: number; rtt: number }[] = [];

  /** c0: our send time, h: host time on reply, c1: our receive time. */
  add(c0: number, h: number, c1: number) {
    const rtt = c1 - c0;
    if (rtt < 0) return;
    this.samples.push({ offset: h - (c0 + c1) / 2, rtt });
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  private best() {
    let best: { offset: number; rtt: number } | undefined;
    for (const s of this.samples) if (!best || s.rtt < best.rtt) best = s;
    return best;
  }

  /** Milliseconds to add to our clock to get host time. */
  get offset(): number {
    return this.best()?.offset ?? 0;
  }

  get rtt(): number | null {
    return this.best()?.rtt ?? null;
  }

  get synced(): boolean {
    return this.samples.length > 0;
  }

  reset() {
    this.samples = [];
  }
}
