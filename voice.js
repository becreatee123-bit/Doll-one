// ---------------------------------------------------------------------------
//  Voice engine: listens through the microphone, detects when the person
//  starts / stops talking, then plays the recording back in a "kid voice"
//  (faster playback = higher pitch, like Talking Tom). 100% in the browser,
//  nothing is uploaded anywhere.
// ---------------------------------------------------------------------------
export class VoiceEngine {
  constructor(ctx, handlers = {}) {
    this.ctx = ctx;
    this.h = handlers; // onSpeechStart, onSpeechEnd, onUtterance(samples, sampleRate)
    this.rate = 1.42;

    this.stream = null;
    this.source = null;
    this.proc = null;
    this.listening = false;
    this.muted = false; // true while the doll is talking (so she doesn't hear herself)

    // output chain with analyser (used for lip-sync)
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this._buf = new Float32Array(this.analyser.fftSize);
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 3000;
    shelf.gain.value = 3;
    const comp = ctx.createDynamicsCompressor();
    this.outGain = ctx.createGain();
    this.outGain.gain.value = 1;
    this.input = shelf;
    shelf.connect(comp);
    comp.connect(this.analyser);
    this.analyser.connect(this.outGain);
    this.outGain.connect(ctx.destination);

    // VAD state
    this._reset();
  }

  _reset() {
    this.preRoll = [];
    this.preRollLen = 0;
    this.rec = [];
    this.recLen = 0;
    this.speaking = false;
    this.loudRun = 0;
    this.silentFor = 0;
    this.voicedFor = 0;
    this.noise = 0.006;
    this.startedAt = 0;
  }

  setRate(r) {
    this.rate = r;
  }

  async start() {
    if (this.listening) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('no-mic-api');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.proc = this.ctx.createScriptProcessor(2048, 1, 1);
    this.proc.onaudioprocess = (e) => this._onAudio(e);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.source.connect(this.proc);
    this.proc.connect(mute);
    mute.connect(this.ctx.destination);
    this._mute = mute;
    this._reset();
    this.listening = true;
    return true;
  }

  stop() {
    this.listening = false;
    try {
      if (this.proc) this.proc.disconnect();
      if (this.source) this.source.disconnect();
      if (this._mute) this._mute.disconnect();
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      /* ignore */
    }
    this.proc = this.source = this.stream = null;
    this._reset();
  }

  _onAudio(e) {
    if (!this.listening) return;
    const input = e.inputBuffer.getChannelData(0);
    const chunk = new Float32Array(input); // copy
    const n = chunk.length;
    const sr = this.ctx.sampleRate;
    const dur = n / sr;

    if (this.muted) {
      // keep things clean while the doll talks
      this.preRoll = [];
      this.preRollLen = 0;
      this.speaking = false;
      this.rec = [];
      this.recLen = 0;
      this.loudRun = 0;
      return;
    }

    let sum = 0;
    for (let i = 0; i < n; i++) sum += chunk[i] * chunk[i];
    const rms = Math.sqrt(sum / n);
    const thresh = Math.max(0.018, this.noise * 3.5);

    if (!this.speaking) {
      // track the room's noise floor
      this.noise = this.noise * 0.95 + Math.min(rms, 0.05) * 0.05;
      this.preRoll.push(chunk);
      this.preRollLen += n;
      while (this.preRollLen > sr * 0.35 && this.preRoll.length > 1) {
        this.preRollLen -= this.preRoll.shift().length;
      }
      this.loudRun = rms > thresh ? this.loudRun + 1 : 0;
      if (this.loudRun >= 2) {
        this.speaking = true;
        this.rec = this.preRoll.slice();
        this.recLen = this.preRollLen;
        this.preRoll = [];
        this.preRollLen = 0;
        this.silentFor = 0;
        this.voicedFor = (2 * n) / sr;
        this.startedAt = performance.now();
        if (this.h.onSpeechStart) this.h.onSpeechStart();
      }
    } else {
      this.rec.push(chunk);
      this.recLen += n;
      if (rms < thresh * 0.7) this.silentFor += dur;
      else {
        this.silentFor = 0;
        this.voicedFor += dur;
      }
      const tooLong = this.recLen > sr * 14;
      if (this.silentFor > 0.85 || tooLong) this._finish();
    }
  }

  _finish() {
    const sr = this.ctx.sampleRate;
    this.speaking = false;
    this.loudRun = 0;
    // concat
    const all = new Float32Array(this.recLen);
    let o = 0;
    for (const c of this.rec) {
      all.set(c, o);
      o += c.length;
    }
    this.rec = [];
    this.recLen = 0;
    // trim most of the trailing silence (keep 0.15s)
    const keepTail = Math.floor(sr * 0.15);
    const silentSamples = Math.floor(this.silentFor * sr);
    const end = Math.max(Math.floor(sr * 0.3), all.length - Math.max(0, silentSamples - keepTail));
    const samples = all.subarray(0, Math.min(all.length, end));
    const ok = this.voicedFor >= 0.35;
    if (this.h.onSpeechEnd) this.h.onSpeechEnd(ok);
    if (ok && this.h.onUtterance) {
      this.h.onUtterance(samples, sr);
    }
  }

  // Plays samples in the kid voice. Resolves when finished.
  play(samples, sr) {
    const ctx = this.ctx;
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const a = Math.abs(samples[i]);
      if (a > peak) peak = a;
    }
    const gain = peak > 0 ? Math.min(5, 0.85 / peak) : 1;
    const buf = ctx.createBuffer(1, samples.length, sr);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < samples.length; i++) ch[i] = samples[i] * gain;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = this.rate;
    src.connect(this.input);
    return new Promise((resolve) => {
      src.onended = () => resolve();
      src.start();
    });
  }

  // 0..1 loudness of whatever is currently playing (for lip-sync)
  getLevel() {
    this.analyser.getFloatTimeDomainData(this._buf);
    let s = 0;
    for (let i = 0; i < this._buf.length; i++) s += this._buf[i] * this._buf[i];
    return Math.min(1, Math.sqrt(s / this._buf.length) * 4.5);
  }
}
