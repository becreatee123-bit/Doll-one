import * as THREE from 'three';
import { CONFIG } from './config.js';
import { CHARACTERS } from './index.js';
import { Behavior } from './behavior.js';
import { Sfx } from './sfx.js';
import { VoiceEngine } from './voice.js';

// optional: nicer reflections for the glossy toy look (skipped if it fails to load)
let RoomEnvironment = null;
try {
  ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
} catch (e) {
  console.warn('RoomEnvironment not available, using plain lights', e);
}

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const statusEl = $('status');
const bubble = $('bubble');
const micBtn = $('mic');
const startBtn = $('start');
const startWrap = $('startWrap');
const settingsBtn = $('settingsBtn');
const settingsPanel = $('settings');
const pitchSlider = $('pitch');
const picker = $('picker');

// ------------------------------------------------------------- renderer ----
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
if (RoomEnvironment) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
}

const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xfff1e6, 0xf0b9a0, 0.7));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(3.5, 7, 6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -2;
key.shadow.radius = 4;
key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(0xffc8a8, 1.0);
rim.position.set(-5, 4, -4);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffe0f0, 0.5);
fill.position.set(-4, 2, 5);
scene.add(fill);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.22 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ------------------------------------------------------------ character ----
let rig = null;
let behavior = null;
let sfx = null;
let currentId = null;

function loadCharacter(id) {
  if (rig) {
    scene.remove(rig.group);
    rig.dispose();
  }
  currentId = id;
  rig = CHARACTERS[id](THREE);
  scene.add(rig.group);
  behavior = new Behavior(rig, sfx);
  frameCamera();
  if (picker) {
    [...picker.children].forEach((b) => b.classList.toggle('on', b.dataset.id === id));
  }
}

function frameCamera() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const b = rig ? rig.bounds : { width: 3.6, height: 4.6, centerY: 2.2 };
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const dH = (b.height * 1.28) / (2 * Math.tan(vFov / 2));
  const dW = (b.width * 1.1) / (2 * Math.tan(hFov / 2));
  const d = Math.max(dH, dW);
  camera.position.set(0, b.centerY + 0.15, d);
  camera.lookAt(0, b.centerY - 0.05, 0);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', frameCamera);

// --------------------------------------------------------------- audio ----
let audioCtx = null;
let voice = null;
let busy = false; // doll is "thinking" or talking
let status = '';

function setStatus(text) {
  status = text;
  statusEl.textContent = text;
}

function showBubble(text, ms = 4500) {
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(showBubble._t);
  showBubble._t = setTimeout(() => bubble.classList.remove('show'), ms);
}

function ensureAudio() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AC();
  sfx = new Sfx(audioCtx);
  if (behavior) behavior.sfx = sfx;
  voice = new VoiceEngine(audioCtx, {
    onSpeechStart() {
      if (behavior) behavior.setHearing(true);
      setStatus('👂 Listening…');
    },
    onSpeechEnd(ok) {
      if (behavior) behavior.setHearing(false);
      if (!ok) setStatus('🎤 Say something!');
    },
    async onUtterance(samples, sr) {
      if (busy) return;
      busy = true;
      voice.muted = true;
      setStatus('💭 …');
      await new Promise((r) => setTimeout(r, 280 + Math.random() * 120));
      behavior.setTalking(true);
      setStatus('💬');
      await voice.play(samples, sr);
      behavior.setTalking(false);
      behavior.setLevel(0);
      await new Promise((r) => setTimeout(r, 350));
      voice.muted = false;
      busy = false;
      setStatus(voice.listening ? '🎤 Say something!' : 'Tap the mic 🎤');
    },
  });
  const saved = loadPitch();
  voice.setRate(saved);
  pitchSlider.value = String(saved);
}

function loadPitch() {
  try {
    const v = parseFloat(localStorage.getItem('doll.pitch'));
    if (v >= CONFIG.voice.min && v <= CONFIG.voice.max) return v;
  } catch (e) { /* ignore */ }
  return CONFIG.voice.rate;
}

// ------------------------------------------------------------------ UI ----
pitchSlider.min = CONFIG.voice.min;
pitchSlider.max = CONFIG.voice.max;
pitchSlider.step = 0.02;
pitchSlider.value = CONFIG.voice.rate;
pitchSlider.addEventListener('input', () => {
  const v = parseFloat(pitchSlider.value);
  if (voice) voice.setRate(v);
  try { localStorage.setItem('doll.pitch', String(v)); } catch (e) { /* ignore */ }
});
settingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('show'));

micBtn.addEventListener('click', async () => {
  ensureAudio();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  if (voice.listening) {
    voice.stop();
    behavior.setListening(false);
    micBtn.classList.remove('on');
    setStatus('Tap the mic 🎤');
    return;
  }
  try {
    await voice.start();
    behavior.setListening(true);
    micBtn.classList.add('on');
    setStatus('🎤 Say something!');
  } catch (e) {
    console.warn(e);
    showBubble('I can\'t reach the microphone. Please allow mic access in your browser and try again.', 6000);
    setStatus('Mic blocked');
  }
});

if (picker && CONFIG.characters.length > 1) {
  CONFIG.characters.forEach((id, i) => {
    const b = document.createElement('button');
    b.textContent = String(i + 1);
    b.dataset.id = id;
    b.addEventListener('click', () => loadCharacter(id));
    picker.appendChild(b);
  });
  picker.classList.add('show');
}

startBtn.addEventListener('click', () => {
  ensureAudio();
  audioCtx.resume();
  startWrap.classList.add('hide');
  setTimeout(() => startWrap.remove(), 600);
  const name = (CONFIG.herName || '').trim();
  const msg = CONFIG.greeting.replace('{name}', name).replace(/\s+!/g, '!').replace('Hi !', 'Hi!');
  showBubble(msg, 5500);
  behavior.greet();
  setStatus('Tap the mic 🎤');
});

// --------------------------------------------------- pointer interaction ---
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null; // {x,y,t,onDoll,part,moved}
let yawTarget = 0;
let yaw = 0;

function pick(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(rig.group, true);
  for (const h of hits) {
    let o = h.object;
    while (o) {
      if (o.userData && o.userData.part) return o.userData.part;
      o = o.parent;
    }
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (!rig || !behavior) return;
  canvas.setPointerCapture(e.pointerId);
  const part = pick(e.clientX, e.clientY);
  down = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, t: performance.now(), part, onDoll: !!part && part !== 'base', moved: 0, tickleDist: 0 };
});

canvas.addEventListener('pointermove', (e) => {
  if (!rig || !behavior) return;
  const r = canvas.getBoundingClientRect();
  behavior.setPointer({
    x: Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)),
    y: Math.max(-1, Math.min(1, -((e.clientY - r.top) / r.height) * 2 + 1)),
  });
  if (!down) return;
  const dx = e.clientX - down.lastX;
  const dy = e.clientY - down.lastY;
  down.lastX = e.clientX;
  down.lastY = e.clientY;
  const dist = Math.hypot(dx, dy);
  down.moved += dist;
  if (down.onDoll) {
    const overDoll = pick(e.clientX, e.clientY);
    if (overDoll && overDoll !== 'base') {
      down.tickleDist += dist;
      if (down.tickleDist > 90) behavior.tickle(true);
    }
  } else {
    yawTarget = Math.max(-0.8, Math.min(0.8, yawTarget + dx * 0.008));
  }
});

function endPointer() {
  if (!down) return;
  const quick = performance.now() - down.t < 320 && down.moved < 12;
  if (quick && down.onDoll) behavior.poke(down.part);
  behavior.tickle(false);
  if (!down.onDoll) setTimeout(() => { yawTarget = 0; }, 900);
  down = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { if (!down && behavior) behavior.setPointer(null); });

// ------------------------------------------------------------ main loop ----
loadCharacter(CONFIG.startCharacter);
frameCamera();

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (voice && behavior && behavior.talking) behavior.setLevel(voice.getLevel());
  if (behavior) behavior.update(dt);
  yaw += (yawTarget - yaw) * (1 - Math.exp(-6 * dt));
  if (rig) rig.group.rotation.y = yaw;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.__dollReady = true;
document.getElementById('loading')?.remove();
