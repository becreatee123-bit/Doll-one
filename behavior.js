// ---------------------------------------------------------------------------
//  Behavior: drives ANY character rig (see girl.js "RIG API") to make it feel
//  alive: blinking, breathing, eye movement, listening pose, lip-sync while
//  talking, poke / tickle reactions and a sleepy yawn when left alone.
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class Behavior {
  constructor(rig, sfx) {
    this.rig = rig;
    this.sfx = sfx;
    this.t = 0;

    // inputs
    this.pointer = null; // {x,y} in -1..1 or null
    this.listening = false;
    this.hearing = false; // user is speaking right now
    this.talking = false;
    this.level = 0;

    // internal animation state
    this.blinkT = -1;
    this.nextBlink = 2 + Math.random() * 2;
    this.saccade = { x: 0.3, y: 0.05, next: 1.5 };
    this.look = { x: 0.3, y: 0.05 };
    this.mouth = 0;
    this.width = 1;
    this.brow = 0;
    this.blush = 0.2;

    this.sq = 0; // squash spring
    this.sqv = 0;
    this.giggleT = 0;
    this.nextGiggleSound = 0;
    this.surprise = 0;
    this.pokeTimes = [];
    this.idleT = 0;
    this.yawnT = -1;
    this.headShake = 0;
    this.tickling = false;
    this.energy = 0;
  }

  // ---------- inputs from main.js ------------------------------------------
  setPointer(p) { this.pointer = p; }
  setListening(b) { this.listening = b; }
  setHearing(b) { this.hearing = b; if (b) this.idleT = 0; }
  setTalking(b) { this.talking = b; if (b) this.idleT = 0; }
  setLevel(v) { this.level = v; }

  startGiggle(dur = 1.4) {
    this.giggleT = Math.max(this.giggleT, dur);
    this.idleT = 0;
    if (!this.talking && this.t >= this.nextGiggleSound) {
      const d = this.sfx ? this.sfx.giggle() : 1;
      this.nextGiggleSound = this.t + d + 0.1;
    }
  }

  // a tap on the character; part = 'head' | 'face' | 'hair' | 'torso' | 'arm' | 'hand' | 'leg' | 'base'
  poke(part) {
    this.idleT = 0;
    this.yawnT = -1;
    this.sqv += 3.2;
    this.pokeTimes = this.pokeTimes.filter((x) => this.t - x < 1.4);
    this.pokeTimes.push(this.t);
    const rapid = this.pokeTimes.length >= 3;

    if (rapid) {
      this.startGiggle(2.4);
      return;
    }
    if (part === 'head' || part === 'face') {
      this.surprise = 0.55;
      if (!this.talking && this.sfx) this.sfx.oh();
    } else if (part === 'hair') {
      this.headShake = 0.6;
      this.startGiggle(1.1);
    } else {
      this.startGiggle(1.5); // ticklish!
    }
  }

  // continuous tickling (finger dragged over her)
  tickle(active) {
    this.tickling = active;
    if (active) {
      this.idleT = 0;
      this.yawnT = -1;
      if (this.giggleT < 0.4) this.startGiggle(1.2);
    }
  }

  greet() {
    this.startGiggle(1.3);
  }

  // ---------- per-frame ------------------------------------------------------
  update(dt) {
    const r = this.rig;
    this.t += dt;
    const t = this.t;
    this.idleT += dt;

    // squash spring
    this.sqv += (-180 * this.sq - 12 * this.sqv) * dt;
    this.sq += this.sqv * dt;
    this.sq = clamp(this.sq, -0.25, 0.3);

    this.giggleT = Math.max(0, this.giggleT - dt);
    this.surprise = Math.max(0, this.surprise - dt);
    this.headShake = Math.max(0, this.headShake - dt);
    const giggling = this.giggleT > 0;
    if (!giggling && this.tickling === false) this.pokeTimes = this.pokeTimes.filter((x) => t - x < 1.4);

    // ---- yawn when left alone
    if (this.idleT > 24 && this.yawnT < 0 && !this.talking && !this.listening) {
      this.yawnT = 0;
      if (this.sfx) this.sfx.yawn();
    }
    let yawn = 0;
    if (this.yawnT >= 0) {
      this.yawnT += dt;
      const d = 2.5;
      if (this.yawnT > d) {
        this.yawnT = -1;
        this.idleT = 0;
      } else {
        yawn = Math.pow(Math.sin((Math.PI * this.yawnT) / d), 0.7);
      }
    }

    // ---- blink
    let blink = 0;
    if (this.blinkT < 0) {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) {
        this.blinkT = 0;
        this.nextBlink = 2 + Math.random() * 3.2;
        if (Math.random() < 0.15) this.nextBlink = 0.25; // double blink
      }
    } else {
      this.blinkT += dt;
      const d = 0.17;
      if (this.blinkT >= d) this.blinkT = -1;
      else blink = Math.sin((Math.PI * this.blinkT) / d);
    }

    // ---- eyes: follow pointer, else wander
    this.saccade.next -= dt;
    if (this.saccade.next <= 0) {
      this.saccade.x = (Math.random() - 0.5) * 1.2 + 0.15;
      this.saccade.y = (Math.random() - 0.5) * 0.5;
      this.saccade.next = 1.4 + Math.random() * 3;
    }
    let tx = this.saccade.x;
    let ty = this.saccade.y;
    if (this.listening || this.hearing || this.talking) {
      tx = 0; ty = 0.05; // look at the person
    } else if (this.pointer) {
      tx = this.pointer.x;
      ty = this.pointer.y;
    }
    this.look.x = lerp(this.look.x, tx, 1 - Math.exp(-9 * dt));
    this.look.y = lerp(this.look.y, ty, 1 - Math.exp(-9 * dt));

    // ---- mouth / brows / eyes by mood
    let mouthT = 0;
    let widthT = 1;
    let browT = 0;
    let tilt = 0;
    let happy = 0;
    let blinkOut = blink;
    let blushT = 0.2;

    if (this.talking) {
      const lv = clamp(this.level * 1.8, 0, 1);
      mouthT = Math.pow(lv, 0.8);
      widthT = 1.05 - 0.4 * mouthT;
      browT = lv * 0.5;
      blushT = 0.3;
    } else if (giggling) {
      mouthT = 0.3 + 0.35 * Math.abs(Math.sin(t * 17));
      widthT = 1.15;
      browT = 0.2;
      blinkOut = 1;
      happy = 1;
      blushT = 0.6;
    } else if (this.surprise > 0) {
      mouthT = 0.55;
      widthT = 0.65;
      browT = 1;
      blinkOut = 0;
    } else if (yawn > 0) {
      mouthT = 0.95 * yawn;
      widthT = 0.85;
      browT = -0.2;
      blinkOut = Math.max(blink, yawn * 0.9);
    } else if (this.hearing || this.listening) {
      browT = this.hearing ? 0.55 : 0.25;
      widthT = 1.05;
      blushT = 0.28;
    }

    const rate = this.talking || giggling ? 1 - Math.exp(-32 * dt) : 1 - Math.exp(-14 * dt);
    this.mouth = lerp(this.mouth, mouthT, rate);
    this.width = lerp(this.width, widthT, rate);
    this.brow = lerp(this.brow, browT, 1 - Math.exp(-12 * dt));
    this.blush = lerp(this.blush, blushT, 1 - Math.exp(-4 * dt));

    r.setMouth(this.mouth, this.width);
    r.setBlink(clamp(blinkOut, 0, 1), happy);
    r.setLook(clamp(this.look.x, -1, 1), clamp(this.look.y, -1, 1));
    r.setBrows(clamp(this.brow, -0.3, 1), tilt);
    r.setBlush(this.blush);

    // ---- head + body
    const wob = giggling ? Math.sin(t * 38) * 0.05 * Math.min(1, this.giggleT * 2) : 0;
    const talkBob = this.talking ? this.level * 0.035 : 0;
    const nod = this.talking ? Math.sin(t * 9) * 0.03 * this.level : 0;
    const shake = this.headShake > 0 ? Math.sin(t * 30) * 0.12 * (this.headShake / 0.6) : 0;
    const listenTilt = this.hearing ? 0.1 : this.listening ? 0.05 : 0;

    const yaw = this.look.x * 0.22 + Math.sin(t * 0.5) * 0.04 + shake;
    const pitch = -this.look.y * 0.12 + nod - yawn * 0.14 + (this.surprise > 0 ? -0.05 : 0);
    const roll = Math.sin(t * 0.7) * 0.03 + listenTilt + wob * 1.6;
    r.setHead(yaw, pitch, roll);

    const breath = Math.sin(t * 1.7);
    r.setBody({
      bob: talkBob + Math.abs(wob) * 0.2,
      lean: this.listening ? 0.05 : 0,
      squash: this.sq,
      wiggle: wob * 0.6,
      breath,
    });

    this.energy = lerp(this.energy, this.talking ? this.level : giggling ? 0.8 : 0, 1 - Math.exp(-5 * dt));
    r.update(dt, t, this.energy);
  }
}
