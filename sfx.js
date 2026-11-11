// Tiny synthesized sound effects (no audio files needed, all free).
export class Sfx {
  constructor(ctx) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.out.connect(comp);
    comp.connect(ctx.destination);
  }

  _blip(t, f, dur, vol, type = 'triangle') {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f * 1.2, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.9, t + dur);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2.4;
    bp.Q.value = 1.1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(bp);
    bp.connect(g);
    g.connect(this.out);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  // "hehehe" – returns duration in seconds
  giggle() {
    const t0 = this.ctx.currentTime + 0.02;
    const n = 5 + ((Math.random() * 3) | 0);
    const base = 640 + Math.random() * 120;
    let t = t0;
    for (let i = 0; i < n; i++) {
      const f = base * (1 + 0.1 * Math.sin(i * 1.3)) * (1 - i * 0.03);
      this._blip(t, f, 0.09, 0.2);
      t += 0.135 + Math.random() * 0.02;
    }
    return t - t0;
  }

  // short surprised "oh!"
  oh() {
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.14);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(bp);
    bp.connect(g);
    g.connect(this.out);
    osc.start(t);
    osc.stop(t + 0.35);
    return 0.35;
  }

  // sleepy yawn
  yawn() {
    const c = this.ctx;
    const t = c.currentTime + 0.05;
    const dur = 2.3;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.linearRampToValueAtTime(520, t + 0.8);
    osc.frequency.exponentialRampToValueAtTime(240, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return dur;
  }
}
