// ---------------------------------------------------------------------------
//  Girl character (procedural Three.js model)
//
//  An ORIGINAL character design based on the reference picture supplied by the
//  project owner: kneeling pose, long wavy black hair with a middle part, gold
//  hoop earrings, patterned cowl-neck slip dress, red nails, yellow base.
//
//  The model is built from code (no external file), so every part can be
//  animated. To make another girl, copy this file and change the options /
//  shapes, or just call createGirl(THREE, { skin, hair, dress, ... }).
//
//  Every character returns the same "rig" API (see bottom of createGirl) so
//  behavior.js / main.js work with any character unchanged.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

export const GIRL_DEFAULTS = {
  skin: 0xe3a87d,
  skinShade: 0xd09169,
  hair: 0x1a1312,
  lips: 0xe8607c,
  nails: 0xc8242c,
  iris: 0x4a2a1a,
  gold: 0xe3b23c,
  baseColor: 0xf4b400,
  dress: {
    base: '#c9a06a',
    spots: ['#8a4a2a', '#b5703a', '#e6c58b', '#5e3420', '#a2582c'],
  },
};

// ---- pure-JS sphere mesh data (so we can deform / cut it freely) ----------
function sphereData(wSeg, hSeg, thetaLen, fn) {
  const pos = [];
  const idx = [];
  for (let iy = 0; iy <= hSeg; iy++) {
    const th = (iy / hSeg) * thetaLen;
    for (let ix = 0; ix <= wSeg; ix++) {
      const ph = (ix / wSeg) * TAU + Math.PI; // seam at the BACK of the head
      const x = Math.sin(th) * Math.sin(ph);
      const y = Math.cos(th);
      const z = Math.sin(th) * Math.cos(ph);
      const p = fn(x, y, z);
      pos.push(p[0], p[1], p[2]);
    }
  }
  for (let iy = 0; iy < hSeg; iy++) {
    for (let ix = 0; ix < wSeg; ix++) {
      const a = iy * (wSeg + 1) + ix;
      const b = a + wSeg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { pos, idx };
}

function filterTriangles(data, keep) {
  const out = [];
  const p = data.pos;
  for (let i = 0; i < data.idx.length; i += 3) {
    const a = data.idx[i], b = data.idx[i + 1], c = data.idx[i + 2];
    const cx = (p[a * 3] + p[b * 3] + p[c * 3]) / 3;
    const cy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3;
    const cz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3;
    if (keep(cx, cy, cz)) out.push(a, b, c);
  }
  return { pos: data.pos, idx: out };
}

export function createGirl(THREE, options = {}) {
  const o = {
    ...GIRL_DEFAULTS,
    ...options,
    dress: { ...GIRL_DEFAULTS.dress, ...(options.dress || {}) },
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const BASE_TOP = 0.34;

  // ------------------------------------------------------------ helpers ----
  function geoFrom(data) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
    g.setIndex(data.idx);
    g.computeVertexNormals();
    return g;
  }

  function mk(geo, mat, part) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    if (part) m.userData.part = part;
    return m;
  }

  // unit sphere scaled into an ellipsoid
  function ell(rx, ry, rz, mat, part, seg = 20) {
    const m = mk(new THREE.SphereGeometry(1, seg, Math.max(8, seg >> 1)), mat, part);
    m.scale.set(rx, ry, rz);
    return m;
  }

  function pivot(x, y, z) {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    const c = new THREE.Group();
    c.position.set(-x, -y, -z);
    p.add(c);
    return { p, c };
  }

  // rounded limb from a to b
  function limb(a, b, r1, r2, mat, part) {
    const g = new THREE.Group();
    const dir = b.clone().sub(a);
    const len = dir.length();
    const cyl = mk(new THREE.CylinderGeometry(r2, r1, len, 20, 1), mat, part);
    cyl.position.copy(a).addScaledVector(dir, 0.5);
    cyl.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
    g.add(cyl);
    const s1 = ell(r1, r1, r1, mat, part, 16);
    s1.position.copy(a);
    const s2 = ell(r2, r2, r2, mat, part, 16);
    s2.position.copy(b);
    g.add(s1, s2);
    return g;
  }

  // tube along a polyline with radius tapering from r0 to ~0
  function taperedTube(points, r0, r1, radial = 10) {
    const n = points.length;
    const pos = [];
    const idx = [];
    let N = V(0, 0, 1);
    let prevT = null;
    for (let i = 0; i < n; i++) {
      const a = points[Math.max(0, i - 1)];
      const b = points[Math.min(n - 1, i + 1)];
      const T = b.clone().sub(a).normalize();
      if (i === 0) {
        N = Math.abs(T.z) > 0.9 ? V(1, 0, 0) : V(0, 0, 1);
        N = N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
      } else {
        N = N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
      }
      const B = T.clone().cross(N).normalize();
      const t = i / (n - 1);
      let r = r0 + (r1 - r0) * Math.pow(t, 1.4);
      if (i === n - 1) r *= 0.12;
      else if (i === n - 2) r *= 0.6;
      for (let j = 0; j <= radial; j++) {
        const ang = (j / radial) * TAU;
        const cx = Math.cos(ang) * r;
        const cy = Math.sin(ang) * r;
        pos.push(
          points[i].x + N.x * cx + B.x * cy,
          points[i].y + N.y * cx + B.y * cy,
          points[i].z + N.z * cx + B.z * cy
        );
      }
      prevT = T;
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    return geoFrom({ pos, idx });
  }

  // a thin curved tube (lashes, brows, lips)
  function curveTube(pts, radius, mat, part) {
    const curve = new THREE.CatmullRomCurve3(pts);
    return mk(new THREE.TubeGeometry(curve, 24, radius, 8, false), mat, part);
  }

  // ----------------------------------------------------------- textures ----
  function makeDressTexture(pal) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = pal.base;
    g.fillRect(0, 0, 512, 512);
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 230; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const r = 14 + rnd() * 44;
      const col = pal.spots[(rnd() * pal.spots.length) | 0];
      const rot = rnd() * Math.PI;
      const sy = 0.35 + rnd() * 0.5;
      for (const dx of [-512, 0, 512]) {
        for (const dy of [-512, 0, 512]) {
          g.save();
          g.translate(x + dx, y + dy);
          g.rotate(rot);
          g.scale(1, sy);
          const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
          grd.addColorStop(0, col + 'dd');
          grd.addColorStop(1, col + '00');
          g.fillStyle = grd;
          g.beginPath();
          g.arc(0, 0, r, 0, TAU);
          g.fill();
          g.restore();
        }
      }
    }
    g.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      g.strokeStyle = 'rgba(255,236,205,0.13)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 70);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(2, 1.5);
    tex.anisotropy = 4;
    return tex;
  }

  // ---------------------------------------------------------- materials ----
  const mSkin = new THREE.MeshPhysicalMaterial({
    color: o.skin, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.35,
    emissive: 0x5a2a1c, emissiveIntensity: 0.3,
  });
  const mSkinDeep = new THREE.MeshStandardMaterial({ color: o.skinShade, roughness: 0.5 });
  const mHair = new THREE.MeshPhysicalMaterial({
    color: o.hair, roughness: 0.3, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25,
  });
  const mHairCap = mHair.clone();
  mHairCap.side = THREE.DoubleSide;
  const mLip = new THREE.MeshPhysicalMaterial({ color: o.lips, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  const mDark = new THREE.MeshStandardMaterial({ color: 0x1a0e0b, roughness: 0.4 });
  const mMouth = new THREE.MeshStandardMaterial({ color: 0x4a1218, roughness: 0.6 });
  const mTongue = new THREE.MeshStandardMaterial({ color: 0xd9667a, roughness: 0.5 });
  const mWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
  const mIris = new THREE.MeshStandardMaterial({ color: o.iris, roughness: 0.3 });
  const mIris2 = new THREE.MeshStandardMaterial({ color: 0x8a5230, roughness: 0.3 });
  const mIrisGlow = new THREE.MeshStandardMaterial({ color: 0xb8793f, roughness: 0.3 });
  const mBrow = new THREE.MeshStandardMaterial({ color: 0x2a1a15, roughness: 0.5 });
  const mGloss = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  const mShadow = new THREE.MeshBasicMaterial({
    color: 0xe6808a, transparent: true, opacity: 0.28, depthWrite: false,
  });
  const mGold = new THREE.MeshStandardMaterial({ color: o.gold, roughness: 0.22, metalness: 0.9 });
  const mNail = new THREE.MeshPhysicalMaterial({ color: o.nails, roughness: 0.2, clearcoat: 1 });
  const mBase = new THREE.MeshPhysicalMaterial({
    color: o.baseColor, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2,
  });
  const mDress = new THREE.MeshPhysicalMaterial({
    map: makeDressTexture(o.dress), roughness: 0.5, sheen: 1,
    sheenColor: new THREE.Color(0xffd9a0), sheenRoughness: 0.5, side: THREE.DoubleSide,
  });
  const mBlush = new THREE.MeshBasicMaterial({
    color: 0xff7f8e, transparent: true, opacity: 0.3, depthWrite: false,
  });

  // -------------------------------------------------------------- root -----
  const root = new THREE.Group();

  // ---- base: yellow plinth with four corner feet
  const base = new THREE.Group();
  const slab = mk(new THREE.CylinderGeometry(1.62, 1.62, 0.2, 8), mBase, 'base');
  slab.rotation.y = Math.PI / 8;
  slab.position.y = BASE_TOP - 0.1;
  slab.receiveShadow = true;
  base.add(slab);
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * Math.PI) / 2;
    const foot = mk(new THREE.BoxGeometry(0.42, 0.14, 0.42), mBase, 'base');
    foot.position.set(Math.cos(ang) * 1.18, 0.07, Math.sin(ang) * 1.18);
    foot.rotation.y = -ang;
    base.add(foot);
  }
  root.add(base);

  // ---- body pivot (squash / lean happen around the base top)
  const body = pivot(0, BASE_TOP, 0);
  root.add(body.p);
  const B = body.c; // add absolute-coordinate parts here

  // ---- legs (kneeling): thighs forward, knees on the base
  for (const sx of [-1, 1]) {
    B.add(limb(V(sx * 0.36, 0.95, -0.2), V(sx * 0.42, 0.64, 0.95), 0.27, 0.27, mSkin, 'leg'));
  }

  // ---- skirt: open at the front so the knees show
  const skirtProfile = [
    [0.6, 1.52], [0.7, 1.36], [0.88, 1.06], [1.12, 0.78], [1.3, 0.55], [1.36, 0.44],
  ].map((p) => new THREE.Vector2(p[0], p[1] - 0.0));
  const gap = 1.75;
  const skirt = mk(new THREE.LatheGeometry(skirtProfile, 48, gap / 2, TAU - gap), mDress, 'torso');
  skirt.position.set(0, 0, -0.2);
  B.add(skirt);
  // a little front drape over the lap
  const drape = mk(
    new THREE.LatheGeometry(
      [[0.62, 1.4], [0.8, 1.15], [1.0, 0.98], [1.08, 0.9]].map((p) => new THREE.Vector2(p[0], p[1])),
      16, -gap / 2 + 0.25, gap - 0.5
    ),
    mDress, 'torso'
  );
  drape.position.set(0, 0, -0.2);
  B.add(drape);

  // ---- torso (skin) + bodice (dress)
  const torsoPts = [
    [0.54, 0.95], [0.64, 1.1], [0.55, 1.45], [0.47, 1.7], [0.5, 1.95], [0.42, 2.18], [0.2, 2.32],
  ];
  const torsoG = new THREE.Group();
  const torso = mk(
    new THREE.LatheGeometry(torsoPts.map((p) => new THREE.Vector2(p[0], p[1])), 32), mSkin, 'torso'
  );
  torso.rotation.y = Math.PI;
  torsoG.add(torso);
  const bodicePts = torsoPts.filter((p) => p[1] <= 1.96).map((p) => new THREE.Vector2(p[0] + 0.03, p[1]));
  const bodice = mk(new THREE.LatheGeometry(bodicePts, 32), mDress, 'torso');
  bodice.rotation.y = Math.PI;
  torsoG.add(bodice);
  torsoG.scale.set(1, 1, 0.72);
  B.add(torsoG);

  // cowl neckline drape + thin straps
  const cowl = curveTube(
    [V(-0.36, 2.02, 0.28), V(-0.18, 1.9, 0.36), V(0, 1.84, 0.38), V(0.18, 1.9, 0.36), V(0.36, 2.02, 0.28)],
    0.075, mDress, 'torso'
  );
  B.add(cowl);
  for (const sx of [-1, 1]) {
    const strap = curveTube(
      [V(sx * 0.34, 2.0, 0.26), V(sx * 0.36, 2.2, 0.12), V(sx * 0.33, 2.27, -0.1), V(sx * 0.3, 2.0, -0.28)],
      0.035, mDress, 'torso'
    );
    B.add(strap);
  }

  // ---- arms, hands on the knees
  const shoulders = { '-1': V(-0.5, 2.08, 0), '1': V(0.5, 2.08, 0) };
  const elbows = { '-1': V(-0.52, 1.36, 0.36), '1': V(0.7, 1.4, 0.3) };
  const wrists = { '-1': V(0.02, 1.02, 0.8), '1': V(0.4, 1.02, 0.8) };
  for (const sx of [-1, 1]) {
    const k = String(sx);
    B.add(limb(shoulders[k], elbows[k], 0.15, 0.125, mSkin, 'arm'));
    B.add(limb(elbows[k], wrists[k], 0.125, 0.1, mSkin, 'arm'));
    const hand = new THREE.Group();
    hand.position.copy(wrists[k]).add(V(0, -0.03, 0.1));
    hand.rotation.x = 0.35;
    const palm = ell(0.14, 0.07, 0.17, mSkin, 'hand');
    hand.add(palm);
    for (let i = 0; i < 4; i++) {
      const f = ell(0.035, 0.035, 0.09, mSkin, 'hand', 10);
      f.position.set(-0.075 + i * 0.05, 0.0, 0.2);
      hand.add(f);
      const nail = ell(0.027, 0.014, 0.04, mNail, 'hand', 8);
      nail.position.set(-0.075 + i * 0.05, 0.03, 0.26);
      hand.add(nail);
    }
    B.add(hand);
  }

  // ---- neck
  B.add(limb(V(0, 2.2, 0.03), V(0, 2.55, 0.05), 0.17, 0.16, mSkin, 'torso'));

  // =============================================================== HEAD ====
  const HC = V(0, 3.2, 0.05);
  const HR = { x: 0.88, y: 0.92, z: 0.85 };
  const head = pivot(0, 2.45, 0.05);
  B.add(head.p);
  const H = head.c; // absolute coordinates inside here too

  // skull with a soft, rounded chin
  const skullData = sphereData(56, 40, Math.PI, (x, y, z) => {
    let sx = 1;
    let sz = 1;
    if (y < 0) {
      const t = Math.pow(-y, 1.3);
      sx = 1 - 0.2 * t;
      sz = 1 - 0.12 * t;
    }
    return [HC.x + x * HR.x * sx, HC.y + y * HR.y, HC.z + z * HR.z * sz];
  });
  const skull = mk(geoFrom(skullData), mSkin, 'head');
  H.add(skull);

  function faceZ(x, y) {
    const dy = (y - HC.y) / HR.y;
    let sx = 1;
    let sz = 1;
    if (dy < 0) {
      const t = Math.pow(-dy, 1.3);
      sx = 1 - 0.2 * t;
      sz = 1 - 0.12 * t;
    }
    const q = 1 - Math.pow((x - HC.x) / (HR.x * sx), 2) - dy * dy;
    return HC.z + HR.z * sz * Math.sqrt(Math.max(q, 0));
  }
  function faceNormal(x, y, z) {
    return V((x - HC.x) / (HR.x * HR.x), (y - HC.y) / (HR.y * HR.y), (z - HC.z) / (HR.z * HR.z)).normalize();
  }
  const Z = V(0, 0, 1);
  function placeOnFace(obj, x, y, lift = 0.0) {
    const z = faceZ(x, y);
    const n = faceNormal(x, y, z);
    obj.position.set(x, y, z).addScaledVector(n, lift);
    obj.quaternion.setFromUnitVectors(Z, n);
  }

  // ears + gold hoops
  for (const sx of [-1, 1]) {
    const ear = ell(0.07, 0.15, 0.1, mSkinDeep, 'head');
    ear.position.set(sx * 0.87, 3.05, 0.05);
    H.add(ear);
    const hoop = mk(new THREE.TorusGeometry(0.16, 0.022, 10, 36), mGold, 'head');
    hoop.position.set(sx * 0.96, 2.84, 0.1);
    hoop.rotation.y = sx * 0.35;
    H.add(hoop);
  }

  // nose + cheeks
  const nose = ell(0.048, 0.038, 0.045, mSkin, 'head', 14);
  placeOnFace(nose, 0, 2.86, 0.01);
  H.add(nose);

  const blushes = [];
  for (const sx of [-1, 1]) {
    const b = ell(0.2, 0.125, 0.03, mBlush, 'head', 14);
    b.castShadow = false;
    placeOnFace(b, sx * 0.52, 2.8, 0.0);
    H.add(b);
    blushes.push(b);
  }

  // ---- eyes
  const BROW_Y = 0.35;
  const eyeRigs = [];
  function buildEye(sx) {
    const eye = new THREE.Group();
    const open = new THREE.Group();
    eye.add(open);
    open.add(ell(0.23, 0.2, 0.08, mWhite, 'head', 24));
    const iris = new THREE.Group();
    iris.position.y = 0.0;
    const ir = ell(0.165, 0.168, 0.05, mIris, 'head', 24);
    ir.position.set(0, 0.01, 0.05);
    const ir2 = ell(0.125, 0.128, 0.04, mIris2, 'head', 20);
    ir2.position.set(0, 0.0, 0.062);
    const glow = ell(0.1, 0.045, 0.03, mIrisGlow, 'head', 14);
    glow.position.set(0, -0.085, 0.07);
    const pupil = ell(0.08, 0.088, 0.03, mDark, 'head', 16);
    pupil.position.set(0, 0.01, 0.078);
    const hl1 = ell(0.055, 0.062, 0.02, mWhite, 'head', 12);
    hl1.position.set(-0.05, 0.075, 0.112);
    const hl2 = ell(0.028, 0.03, 0.02, mWhite, 'head', 10);
    hl2.position.set(0.06, -0.055, 0.112);
    const hl3 = ell(0.016, 0.016, 0.02, mWhite, 'head', 8);
    hl3.position.set(0.015, 0.0, 0.112);
    iris.add(ir, ir2, glow, pupil, hl1, hl2, hl3);
    open.add(iris);
    // upper lash line, bold and lifted into a little wing at the outer corner
    const lash = curveTube(
      [V(-sx * 0.23, -0.01, 0.07), V(-sx * 0.19, 0.12, 0.08), V(-sx * 0.08, 0.195, 0.085),
       V(sx * 0.06, 0.21, 0.085), V(sx * 0.18, 0.155, 0.08), V(sx * 0.255, 0.09, 0.07),
       V(sx * 0.33, 0.135, 0.06)],
      0.032, mDark, 'head'
    );
    open.add(lash);
    // two small extra lashes at the outer corner
    for (const [dx, dy, ex, ey] of [[0.14, 0.185, 0.2, 0.275], [0.2, 0.15, 0.285, 0.215]]) {
      open.add(curveTube(
        [V(sx * dx, dy, 0.08), V(sx * (dx + ex) / 2, (dy + ey) / 2 + 0.03, 0.08), V(sx * ex, ey, 0.075)],
        0.014, mDark, 'head'
      ));
    }
    // closed-eye arc (shown while blinking)
    const closedPivot = new THREE.Group();
    const closed = curveTube(
      [V(-0.22, 0.02, 0.07), V(-0.1, -0.05, 0.08), V(0.1, -0.05, 0.08), V(0.22, 0.02, 0.07), V(sx * 0.3, 0.08, 0.06)],
      0.03, mDark, 'head'
    );
    closedPivot.add(closed);
    closedPivot.visible = false;
    eye.add(closedPivot);
    // soft pink eyeshadow above the eye
    const shadow = ell(0.22, 0.075, 0.02, mShadow, 'head', 14);
    shadow.castShadow = false;
    shadow.position.set(0, 0.22, 0.03);
    eye.add(shadow);
    // eyebrow: thin, soft arch
    const brow = new THREE.Group();
    const browMesh = curveTube(
      [V(-sx * 0.2, -0.005, 0.0), V(-sx * 0.09, 0.04, 0.0), V(sx * 0.05, 0.07, 0.0),
       V(sx * 0.17, 0.05, 0.0), V(sx * 0.25, -0.005, 0.0)],
      0.014, mBrow, 'head'
    );
    brow.add(browMesh);
    brow.position.set(0, BROW_Y, 0.04);
    eye.add(brow);

    placeOnFace(eye, sx * 0.4, 3.08, 0.015);
    H.add(eye);
    return { eye, open, iris, closedPivot, brow, sx };
  }
  eyeRigs.push(buildEye(-1), buildEye(1));

  // ---- mouth
  const mouth = new THREE.Group();
  const lipZ = (x) => -0.64 * x * x;
  const upperPts = [-0.16, -0.08, 0, 0.08, 0.16].map((x, i) => V(x, [0.03, 0.044, 0.028, 0.044, 0.03][i], lipZ(x)));
  const lowerPts = [-0.16, -0.08, 0, 0.08, 0.16].map((x, i) => V(x, [0.03, -0.028, -0.046, -0.028, 0.03][i], lipZ(x)));
  const upperLip = curveTube(upperPts, 0.03, mLip, 'face');
  const lowerLip = curveTube(lowerPts, 0.037, mLip, 'face');
  // little shine on the lower lip
  const gloss = ell(0.032, 0.009, 0.008, mGloss, 'face', 10);
  gloss.castShadow = false;
  gloss.position.set(-0.04, -0.043, lipZ(-0.04) + 0.034);
  lowerLip.add(gloss);
  const inner = ell(0.15, 0.03, 0.02, mMouth, 'face', 16);
  inner.position.set(0, -0.005, -0.012);
  const teeth = ell(0.1, 0.02, 0.012, mWhite, 'face', 12);
  teeth.position.set(0, 0.0, -0.002);
  const tongue = ell(0.075, 0.03, 0.012, mTongue, 'face', 12);
  tongue.position.set(0, -0.02, -0.004);
  mouth.add(inner, teeth, tongue, upperLip, lowerLip);
  placeOnFace(mouth, 0, 2.63, 0.012);
  H.add(mouth);

  // ---- hair
  const hairLayer = new THREE.Group();
  H.add(hairLayer);

  // cap: big shell around the skull with the face window cut out
  const CAP = { c: V(0, 3.3, -0.08), rx: 1.0, ry: 1.04, rz: 1.03 };
  const hairlineY = (x) => 3.8 - 0.52 * Math.pow(Math.min(1, Math.abs(x) / 0.9), 1.45);
  let capData = sphereData(160, 120, 2.35, (x, y, z) => [
    CAP.c.x + x * CAP.rx, CAP.c.y + y * CAP.ry, CAP.c.z + z * CAP.rz,
  ]);
  capData = filterTriangles(capData, (cx, cy, cz) => {
    if (cz > 0.1 && cy < hairlineY(cx)) return false; // forehead / face window
    if (Math.abs(cx) > 0.78 && cz > -0.3 && cy < 3.45 && cy > 2.7) return false; // ears
    return true;
  });
  const cap = mk(geoFrom(capData), mHairCap, 'hair');
  hairLayer.add(cap);

  function capZ(x, y) {
    const dy = (y - CAP.c.y) / CAP.ry;
    const q = 1 - (x / CAP.rx) * (x / CAP.rx) - dy * dy;
    return CAP.c.z + CAP.rz * Math.sqrt(Math.max(q, 0));
  }

  // smooth rounded hair edge along the hairline (hides any stair-steps), split at the centre part
  for (const sx of [-1, 1]) {
    const edge = [];
    for (let i = 0; i <= 40; i++) {
      const x = sx * (0.035 + (i / 40) * 0.72);
      const y = hairlineY(x) + 0.03;
      edge.push(V(x, y, capZ(x, y) + 0.01));
    }
    hairLayer.add(curveTube(edge, 0.05, mHair, 'hair'));
  }

  function wavy(pts, amp, freq, phase, sx) {
    // resample with a CatmullRom curve, then add a sideways wave that grows toward the tips
    const curve = new THREE.CatmullRomCurve3(pts);
    const n = 70;
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const p = curve.getPoint(t);
      const w = Math.pow(t, 0.9);
      p.x += sx * amp * Math.sin(t * freq + phase) * w;
      p.z += amp * 0.7 * Math.cos(t * freq + phase) * w;
      out.push(p);
    }
    return out;
  }

  // front curtains (one per side) – pivot near the hairline so they can sway
  const curtains = [];
  const STR = 9;
  for (const sx of [-1, 1]) {
    const cp = pivot(sx * 0.4, 3.9, 0.45);
    const grp = cp.c;
    for (let k = 0; k < STR; k++) {
      const f = k / (STR - 1);
      const x0 = sx * (0.1 + 0.04 * f);
      const x1 = sx * (0.52 + 0.12 * f);
      const x2 = sx * (0.96 + 0.1 * f);
      const pts = [
        V(x0, 4.0 - 0.02 * f, capZ(x0, 4.0) + 0.06),
        V(x1, 3.9 - 0.05 * f, capZ(x1, 3.9) + 0.06),
        V(x2, 3.48, Math.max(0.2, capZ(x2, 3.48) + 0.08)),
        V(sx * (1.14 + 0.2 * f), 2.95, 0.3 - 0.04 * f),
        V(sx * (1.18 + 0.22 * f), 2.35, 0.4),
        V(sx * (1.04 + 0.24 * f), 1.75, 0.62),
        V(sx * (0.86 + 0.3 * f), 1.15, 0.8),
      ];
      const line = wavy(pts, 0.07 + 0.03 * f, 13 + 2 * f, k * 0.8, sx);
      const geo = taperedTube(line, 0.15, 0.06, 10);
      grp.add(mk(geo, mHair, 'hair'));
    }
    hairLayer.add(cp.p);
    curtains.push(cp.p);
  }

  // back hair mass
  const backPivot = pivot(0, 3.8, -0.6);
  const BK = 16;
  for (let k = 0; k < BK; k++) {
    const f = k / (BK - 1);
    const xs = (f - 0.5) * 2;
    const pts = [
      V(xs * 0.8, 3.7, -0.9),
      V(xs * 1.0, 2.9, -1.0),
      V(xs * 1.2, 2.1, -0.85),
      V(xs * 1.35, 1.4, -0.7),
      V(xs * 1.4, 0.8, -0.55),
    ];
    const line = wavy(pts, 0.09, 12, k * 0.7, xs >= 0 ? 1 : -1);
    backPivot.c.add(mk(taperedTube(line, 0.2, 0.08, 10), mHair, 'hair'));
  }
  hairLayer.add(backPivot.p);

  // ============================================================ RIG API ====
  const state = { look: [0, 0], blink: 0, happy: 0, mouth: 0, width: 1, brow: 0, tilt: 0 };

  const rig = {
    group: root,
    name: 'girl',
    // Ideal camera framing (units): width / height of the character + centre
    bounds: { width: 3.6, height: 4.6, centerY: 2.2 },

    // 0..1 how open the mouth is, width 0.6..1.2
    setMouth(open, width = 1) {
      state.mouth = open;
      const o1 = Math.max(0, Math.min(1, open));
      upperLip.position.y = o1 * 0.085;
      lowerLip.position.y = -o1 * 0.17;
      inner.scale.set(0.15, 0.03 + o1 * 0.15, 0.02);
      inner.position.y = -0.005 - o1 * 0.045;
      teeth.visible = o1 > 0.18;
      teeth.position.y = 0.0 + o1 * 0.035;
      tongue.visible = o1 > 0.3;
      tongue.position.y = -0.02 - o1 * 0.1;
      mouth.scale.set(width, 1, 1);
    },

    // 0 open .. 1 closed;   happy 0..1 turns the closed eye into a ^ ^ smile
    setBlink(v, happy = 0) {
      state.blink = v;
      state.happy = happy;
      for (const e of eyeRigs) {
        const closed = v > 0.92;
        e.open.visible = !closed;
        e.open.scale.y = Math.max(0.05, 1 - v * 0.96);
        e.closedPivot.visible = closed;
        e.closedPivot.scale.y = happy > 0.5 ? -1.1 : 1;
        e.closedPivot.position.y = happy > 0.5 ? 0.04 : 0;
      }
    },

    // x,y in -1..1 (x = viewer's right, y = up)
    setLook(x, y) {
      state.look = [x, y];
      for (const e of eyeRigs) {
        e.iris.position.set(x * 0.05, y * 0.03, 0);
      }
    },

    // raise 0..1 (eyebrows up), tilt -1..1 (worried ↔ cross)
    setBrows(raise, tilt = 0) {
      state.brow = raise;
      for (const e of eyeRigs) {
        e.brow.position.y = BROW_Y + raise * 0.1;
        e.brow.rotation.z = e.sx * tilt * 0.25;
      }
    },

    setBlush(v) {
      mBlush.opacity = Math.max(0, Math.min(0.75, v * 1.25));
    },

    // pitch (+ = look down), yaw (+ = turn to viewer's right), roll (+ = tilt to viewer's right)
    setHead(yaw, pitch, roll) {
      head.p.rotation.set(pitch, yaw, -roll);
    },

    // bob (y offset), lean (x rot), squash (+ = squashed), wiggle (z rot), breath (0..1)
    setBody({ bob = 0, lean = 0, squash = 0, wiggle = 0, breath = 0 } = {}) {
      body.p.position.y = BASE_TOP + bob;
      body.p.rotation.set(lean, 0, wiggle);
      body.p.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      torsoG.scale.y = 1 + breath * 0.02;
    },

    // gentle hair sway; energy 0..1 (more when talking / giggling)
    update(dt, t, energy = 0) {
      const a = 0.02 + energy * 0.05;
      curtains[0].rotation.z = Math.sin(t * 1.3) * a;
      curtains[1].rotation.z = Math.sin(t * 1.3 + 1.2) * a;
      curtains[0].rotation.x = Math.sin(t * 0.9) * a * 0.6;
      curtains[1].rotation.x = Math.sin(t * 0.9 + 0.7) * a * 0.6;
      backPivot.p.rotation.z = Math.sin(t * 0.8 + 2) * a * 0.5;
    },

    // names used for tap / tickle hit-testing: head, face, hair, torso, arm, hand, leg, base
    parts: ['head', 'face', 'hair', 'torso', 'arm', 'hand', 'leg', 'base'],

    dispose() {
      root.traverse((m) => {
        if (m.geometry) m.geometry.dispose();
      });
    },
  };

  rig.setMouth(0);
  rig.setBlink(0);
  rig.setLook(0.35, 0.05);
  rig.setBrows(0, 0);
  rig.setBlush(0.22);
  rig.setBody({});
  return rig;
}
