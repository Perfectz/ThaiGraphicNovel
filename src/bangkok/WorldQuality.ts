export type WorldQualityLevel = 'high' | 'low';

/** Visible frame windows distinguish sustained rendering cost from loading and tab changes. */
export class WorldQuality {
  level: WorldQualityLevel = 'high';
  private elapsed = 0;
  private grace = 4000;
  private frames: number[] = [];
  private windowMs = 0;
  private slow = 0;
  private fast = 0;
  private upgradedAt = -Infinity;
  percentileMs = 0;

  pause() {
    this.clearWindow();
    this.slow = this.fast = 0;
    this.grace = Math.max(this.grace, 2000);
  }
  sample(frameMs: number, assetsSettled: boolean, allowChange = true): WorldQualityLevel {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return this.level;
    if (!assetsSettled || frameMs > 1000) {
      this.pause();
      return this.level;
    }
    this.elapsed += frameMs;
    if (this.grace > 0) {
      this.grace = Math.max(0, this.grace - frameMs);
      return this.level;
    }
    this.frames.push(frameMs);
    this.windowMs += frameMs;
    if (this.windowMs < 2000 || this.frames.length < 12) return this.level;
    const ordered = [...this.frames].sort((a, b) => a - b);
    this.percentileMs = ordered[Math.floor((ordered.length - 1) * 0.75)];
    this.slow = this.percentileMs > 42 ? this.slow + 1 : 0;
    this.fast = this.percentileMs < 22 ? this.fast + 1 : 0;
    this.clearWindow();
    if (!allowChange) return this.level;
    if (this.level === 'high' && this.slow >= 3) {
      this.level = 'low';
      // A failed quality restoration gets a longer quiet period before another attempt.
      this.grace = this.elapsed - this.upgradedAt < 30000 ? 60000 : 6000;
      this.slow = this.fast = 0;
    } else if (this.level === 'low' && this.fast >= 6) {
      this.level = 'high';
      this.upgradedAt = this.elapsed;
      this.grace = 6000;
      this.slow = this.fast = 0;
    }
    return this.level;
  }
  private clearWindow() {
    this.frames = [];
    this.windowMs = 0;
  }
}
