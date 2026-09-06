import { renderBattleCue, type BattleCue } from './battleCues.ts';

export class BattleAudio {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private buffers = new Map<BattleCue, AudioBuffer>();
  private sources = new Set<AudioBufferSourceNode>();
  private allowed = true;
  private disposed = false;
  private createContext: () => AudioContext;
  constructor(createContext: () => AudioContext = () => new AudioContext()) {
    this.createContext = createContext;
  }
  /** Only invoked from a user gesture. A blocked browser never queues a delayed surprise cue. */
  unlock() {
    if (this.disposed || !this.allowed) return;
    try {
      if (!this.context) {
        this.context = this.createContext();
        this.output = this.context.createGain();
        this.output.gain.value = 0.55;
        this.output.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      /* Visual battle feedback remains available when Web Audio is unavailable. */
    }
  }
  setAllowed(allowed: boolean) {
    this.allowed = allowed;
    if (!allowed) this.stop();
  }
  play(cue: BattleCue): boolean {
    const context = this.context;
    if (this.disposed || !this.allowed || !context || context.state !== 'running' || !this.output)
      return false;
    // Events are deliberately short; overlapping events should not accumulate loud tails.
    this.stop();
    let buffer = this.buffers.get(cue);
    if (!buffer) {
      const data = renderBattleCue(cue);
      buffer = context.createBuffer(1, data.length, 22050);
      buffer.copyToChannel(data, 0);
      this.buffers.set(cue, buffer);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      this.sources.delete(source);
    };
    source.start();
    return true;
  }
  private stop() {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
      source.disconnect();
    }
    this.sources.clear();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.buffers.clear();
    this.output?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
  }
}
