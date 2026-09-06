export type MusicAudio = {
  src: string;
  currentTime: number;
  volume: number;
  loop: boolean;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
};
type Deck = {
  url: string;
  audio: MusicAudio;
  gain: number;
  ready: boolean;
  pending: boolean;
  failed: boolean;
  token: number;
};
export class MusicPlayer {
  private current?: Deck;
  private outgoing?: Deck;
  private desired: string | null = null;
  private enabled = true;
  private suspended = false;
  private unlocked = false;
  private disposed = false;
  private volume = 0;
  private settled = 0;
  private positions = new Map<string, number>();
  private createAudio: () => MusicAudio;
  constructor(createAudio: () => MusicAudio) { this.createAudio = createAudio; }
  configure(url: string | null, enabled: boolean, volume: number, suspended: boolean) {
    if (this.disposed) return;
    if (url !== this.desired) {
      this.desired = url;
      this.settled = 0;
    }
    this.enabled = enabled;
    this.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
    this.suspended = suspended;
    this.sync();
  }
  unlock() {
    this.unlocked = true;
    for (const deck of this.decks()) deck.failed = false;
    this.sync();
  }
  private decks() {
    return [this.current, this.outgoing].filter((d): d is Deck => !!d);
  }
  private blocked() {
    return !this.unlocked || !this.enabled || this.suspended || !this.desired || this.volume === 0;
  }
  private sync() {
    if (this.disposed) return;
    if (this.blocked()) {
      for (const d of this.decks()) {
        d.audio.volume = 0;
        d.audio.pause();
        d.ready = false;
        d.token++;
        d.pending = false;
      }
      return;
    }
    if (!this.current) this.changeTrack();
    for (const d of this.decks()) {
      d.audio.volume = d.gain * this.volume;
      this.play(d);
    }
  }
  private play(d: Deck) {
    if (d.ready || d.pending || d.failed) return;
    d.pending = true;
    const token = ++d.token;
    void d.audio
      .play()
      .then(() => {
        if (this.disposed || !this.decks().includes(d) || this.blocked()) {
          d.audio.pause();
          return;
        }
        if (token !== d.token) return;
        d.ready = true;
        d.pending = false;
      })
      .catch(() => {
        if (token !== d.token) return;
        d.failed = true;
        d.pending = false;
        d.ready = false;
        d.audio.pause();
      });
  }
  private release(d: Deck) {
    if (Number.isFinite(d.audio.currentTime)) {
      this.positions.delete(d.url);
      this.positions.set(d.url, d.audio.currentTime);
      if (this.positions.size > 12) this.positions.delete(this.positions.keys().next().value!);
    }
    d.token++;
    d.audio.volume = 0;
    d.audio.pause();
    d.audio.removeAttribute('src');
    d.audio.load();
  }
  private changeTrack() {
    if (!this.desired || this.current?.url === this.desired) return;
    if (this.current && !this.current.ready && this.outgoing) this.release(this.current);
    else {
      if (this.outgoing) this.release(this.outgoing);
      this.outgoing = this.current;
    }
    const audio = this.createAudio();
    audio.src = this.desired;
    audio.loop = true;
    audio.volume = 0;
    audio.currentTime = this.positions.get(this.desired) ?? 0;
    this.current = {
      url: this.desired,
      audio,
      gain: 0,
      ready: false,
      pending: false,
      failed: false,
      token: 0,
    };
    this.play(this.current);
  }
  tick(seconds: number) {
    if (this.disposed || this.blocked()) return;
    const dt = Math.max(0, Math.min(0.1, seconds));
    this.settled += dt;
    if (this.settled >= 0.65 && this.current?.url !== this.desired) this.changeTrack();
    this.sync();
    if (!this.current?.ready) return;
    this.current.gain = Math.min(1, this.current.gain + dt / 1.2);
    if (this.outgoing) {
      this.outgoing.gain = Math.max(0, this.outgoing.gain - dt / 1.2);
      if (this.outgoing.gain === 0) {
        this.release(this.outgoing);
        this.outgoing = undefined;
      }
    }
    for (const d of this.decks()) d.audio.volume = d.gain * this.volume;
  }
  dispose() {
    this.disposed = true;
    for (const d of this.decks()) this.release(d);
    this.current = this.outgoing = undefined;
  }
}
