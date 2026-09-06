/** A visible practice surface and recent interaction are both required. */
export class PracticeClock {
  private last: number;
  private input: number;
  private wasReady = false;
  constructor(now: number) {
    this.last = now;
    this.input = now;
  }
  touch(now: number) {
    this.input = now;
  }
  reset(now: number) {
    this.last = now;
    this.wasReady = false;
  }
  sample(now: number, active: boolean, visible: boolean): number {
    // Do not credit a suspended/throttled browser's entire missed interval.
    const elapsed = Math.max(0, Math.min(2000, now - this.last));
    const seconds =
      this.wasReady && active && visible
        ? Math.max(0, Math.min(now, this.input + 45000) - (now - elapsed)) / 1000
        : 0;
    this.last = now;
    this.wasReady = active && visible;
    return seconds;
  }
}
