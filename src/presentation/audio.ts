type Sound = "click" | "step" | "alarm" | "fire" | "warp";

export class ShipAudio {
  private context: AudioContext | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private nextNote = 0;
  private note = 0;
  private paused = false;
  private musicLevel = 0.22;
  private effectsLevel = 0.45;

  constructor(private readonly report: (message: string) => void) {}

  start(): void {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.music = this.context.createGain();
        this.effects = this.context.createGain();
        this.music.connect(this.context.destination);
        this.effects.connect(this.context.destination);
        this.setVolumes(this.musicLevel, this.effectsLevel);
      }
      void this.context.resume().catch((error: unknown) => {
        this.report(`Audio could not start: ${String(error)}. The game is still playable.`);
      });
    } catch (error) {
      this.report(`Audio is unavailable: ${String(error)}. The game is still playable.`);
    }
  }

  setVolumes(music: number, effects: number): void {
    this.musicLevel = music;
    this.effectsLevel = effects;
    if (this.music) this.music.gain.value = music;
    if (this.effects) this.effects.gain.value = effects;
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!this.context) return;
    const operation = paused ? this.context.suspend() : this.context.resume();
    void operation.catch((error: unknown) => this.report(`Audio state could not change: ${String(error)}`));
  }

  tick(): void {
    const context = this.context;
    if (!context || !this.music || context.state !== "running" || this.paused) return;
    if (context.currentTime < this.nextNote) return;
    const melody = [130.81, 196, 261.63, 164.81, 146.83, 220, 293.66, 196];
    const frequency = melody[this.note % melody.length] ?? 130.81;
    this.tone(frequency, frequency, 0.9, "triangle", this.music, 0.08);
    if (this.note % 4 === 0) this.tone(frequency / 2, frequency / 2, 2.7, "sine", this.music, 0.09);
    this.note += 1;
    this.nextNote = context.currentTime + 0.8;
  }

  play(sound: Sound): void {
    if (!this.context || !this.effects || this.context.state !== "running" || this.paused) return;
    const sounds: Record<Sound, [number, number, number, OscillatorType, number]> = {
      click: [660, 880, 0.055, "sine", 0.10],
      step: [85, 45, 0.045, "triangle", 0.035],
      alarm: [370, 330, 0.28, "triangle", 0.10],
      fire: [880, 95, 0.28, "sawtooth", 0.07],
      warp: [110, 880, 1.1, "triangle", 0.08],
    };
    const [from, to, duration, wave, volume] = sounds[sound];
    this.tone(from, to, duration, wave, this.effects, volume);
  }

  private tone(from: number, to: number, duration: number, wave: OscillatorType, output: GainNode, volume: number): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const now = context.currentTime;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
}
