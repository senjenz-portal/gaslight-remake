/**
 * sea3d.js — procedural Three.js FULL-3D SET
 * THE SEA (Beat VI, the escape) as native geometry: the headland cliff with the
 * ammunition boulders at the brow, open water with the moonpath, the escape ship
 * (the twenty-oarer), the rock-impact splash system, the cave-glow at the cliff
 * base, and the low-poly prop moon.
 *
 * Same method as demo3d/full3d/createCaveScene.js (the cave set): built against
 * the reference plate ../../assets/set/sea/sea.jpg through the staged passes
 * blockout -> structural -> form -> material -> lighting, each pass
 * screenshot-reviewed against the plate.
 *
 * THE FLOOR PLAN IS THE LEDGER. Every transform derives from tools/ody/ledger.json
 * (sets.sea, plate px, 12.7 px/m off the ship — the twenty-oarer, 8 rowlocks a
 * side painted, 15 m tip-to-tip, Butler's own hull class) through the shared frame:
 *   X(px)      = (px - 704) / 12.7                     metres, +east
 *   Z(py)      = (py - 470) / (12.7 · sin 30°)         metres, +downstage (ship waterline row ≈ 0)
 *   ZH(py, h)  = ((py - 470)/12.7 + h·cos 30°) / sin 30°   plan depth of a point painted at height h
 *   Y up, water surface = 0 exactly.
 * The 30° is the slab's own edge read: at the 45° azimuth an orthographic ground
 * edge projects at screen slope sin E; the plate's slab edges run ~2:1 → E = 30°.
 * Heights come from the ledger cross-check: cliff base (770,540) → brow (790,192)
 * = 350 px = 27.5 m headland; mast 112 px = 8.8 m.
 *
 * DETERMINISM LAW: every scatter/jitter is mulberry32-seeded; the splash bursts
 * are GPU point systems whose positions are PURE functions of (seed attributes,
 * uTime − uT0); the thrown rocks + their impact times are pure f(simT) (the
 * scheduler recomputes t0 from cycle arithmetic every tick — setSim replays
 * byte-identically). tick(simT) drives uniforms, oar cycle, sway and flicker only.
 *
 * Exports
 *   createSeaScene()            -> { root, tick(simT), splashAt(x,z), caveGlow, moonLight,
 *                                    glowFlick, oars, oarTip(i), SHIP, ROW_PERIOD,
 *                                    parts, triangles, setPixelScale }
 *   createSeaIsoCamera(aspect)  -> OrthographicCamera + .userData.setOrbit(azimuthDeg)
 *   SEA_WORLD                   -> { S, SIN_E, COS_E, X(), Z(), ZH(), FLOORS, OBSTACLES, MARKS, SHIP_PX }
 */
import * as THREE from 'three';

/* ---------------- world frame (the ledger's plan) ---------------- */
const S = 12.7;                            /* px per metre — the ship yardstick */
const ELEV = THREE.MathUtils.degToRad(30); /* the slab's own 2:1 edge slope */
const SIN_E = Math.sin(ELEV), COS_E = Math.cos(ELEV);
const CX = 704, CY = 470;
const X = (px) => (px - CX) / S;
const Z = (py) => (py - CY) / (S * SIN_E);
const ZH = (py, h) => ((py - CY) / S + h * COS_E) / SIN_E;
const M = (px) => px / S;

/* ledger floors (plate px) — the obstacle law audits these */
const FLOORS = {
  deck: { polyline: [[515, 420], [660, 490]], note: 'deck walk line stern->bow' },
  clifftopLedge: {
    polyline: [[790, 195], [870, 215], [955, 238], [1120, 230]],
    note: 'the seaward brow; the ONLY land floor on this set',
    exempt: ['cliffMass'],                 /* the ledge rides the massif's own top */
  },
};
/* obstacle boxes (plate px). cliffMass is the whole headland footprint; the
   clifftop ledge is exempt from it (it IS the massif's floor) but the deck
   line is not. splashImpact boxes are the rock-fall water: no floor may cross. */
const OBSTACLES = {
  cliffMass: [[690, 150], [1270, 600]],
  clifftopBoulders: [[850, 30], [1100, 170]],
  splashImpact1: [[448, 485], [488, 525]],
  splashImpact2: [[435, 520], [475, 560]],
};
const MARKS = {
  'clifftop-giant': [860, 210],
  'stern-ulysses': [518, 426],
};
const SHIP_PX = {
  sternTip: [495, 462], bowTip: [678, 516],
  mastFoot: [578, 462], mastTop: [580, 350], deckCentre: [575, 450],
};
export const SEA_WORLD = { S, ELEV, SIN_E, COS_E, X, Z, ZH, FLOORS, OBSTACLES, MARKS, SHIP_PX };

/* ---------------- deterministic RNG + facet helpers (house kit) ---------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z, seed) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (Math.round(x * 97) & 0xffff), 2654435761);
  h = Math.imul(h ^ (Math.round(y * 97) & 0xffff), 2246822519);
  h = Math.imul(h ^ (Math.round(z * 97) & 0xffff), 3266489917);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function jitterByPos(geo, seed, amp) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i,
      x + (hash3(x, y, z, seed) - 0.5) * 2 * amp,
      y + (hash3(x, y, z, seed + 1) - 0.5) * 2 * amp,
      z + (hash3(x, y, z, seed + 2) - 0.5) * 2 * amp);
  }
  p.needsUpdate = true;
  return geo;
}
function facetColors(geo, baseHex, seed, amount = 0.10) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const base = new THREE.Color(baseHex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const rnd = mulberry32(seed);
  for (let f = 0; f < n / 3; f++) {
    const v = 1 + (rnd() - 0.5) * 2 * amount;
    for (let k = 0; k < 3; k++) {
      col[(f * 3 + k) * 3 + 0] = base.r * v;
      col[(f * 3 + k) * 3 + 1] = base.g * v;
      col[(f * 3 + k) * 3 + 2] = base.b * v;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function dropFaces(geo, keep) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const kept = [];
  const c = new THREE.Vector3();
  for (let f = 0; f < p.count / 3; f++) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++)
      c.add(new THREE.Vector3(p.getX(f * 3 + k), p.getY(f * 3 + k), p.getZ(f * 3 + k)));
    c.multiplyScalar(1 / 3);
    if (keep(c)) kept.push(f);
  }
  const out = new Float32Array(kept.length * 9);
  kept.forEach((f, i) => {
    for (let k = 0; k < 3; k++) {
      out[(i * 3 + k) * 3 + 0] = p.getX(f * 3 + k);
      out[(i * 3 + k) * 3 + 1] = p.getY(f * 3 + k);
      out[(i * 3 + k) * 3 + 2] = p.getZ(f * 3 + k);
    }
  });
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.BufferAttribute(out, 3));
  return ng;
}
/* warm-paint faces near a point (the cave-glow spill on the rock) */
function warmPaint(geo, point, radius, warmHex, seed) {
  const pos = geo.attributes.position, col = geo.attributes.color;
  const warm = new THREE.Color(warmHex);
  const a = new THREE.Vector3();
  for (let f = 0; f < pos.count / 3; f++) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) {
      cx += pos.getX(f * 3 + k); cy += pos.getY(f * 3 + k); cz += pos.getZ(f * 3 + k);
    }
    a.set(cx / 3, cy / 3, cz / 3);
    const d = a.distanceTo(point);
    if (d > radius) continue;
    const w = (1 - d / radius) * (0.55 + hash3(a.x, a.y, a.z, seed) * 0.35);
    for (let k = 0; k < 3; k++) {
      const i = f * 3 + k;
      col.setXYZ(i,
        col.getX(i) + (warm.r - col.getX(i)) * w,
        col.getY(i) + (warm.g - col.getY(i)) * w,
        col.getZ(i) + (warm.b - col.getZ(i)) * w);
    }
  }
  col.needsUpdate = true;
  return geo;
}
const flatMat = (opts = {}) => new THREE.MeshStandardMaterial({
  flatShading: true, metalness: 0, roughness: 0.95, ...opts });

function glowTexture(inner = 'rgba(255,220,140,1)', outer = 'rgba(255,150,40,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PX_UNIFORM = { value: 12 };          /* canvas px per world metre (ortho) — page-driven */

/* ---------------- the seeded splash burst (GPU, pure f(uTime - uT0)) ---------------- */
function splashPoints({ count, seed, srMin, srMax, suMin, suMax, szMin, szMax, lfMin, lfMax, tint }) {
  const rnd = mulberry32(seed);
  const a0 = new Float32Array(count), sr = new Float32Array(count),
        su = new Float32Array(count), sz = new Float32Array(count),
        lf = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    a0[i] = rnd() * Math.PI * 2;
    sr[i] = srMin + rnd() * (srMax - srMin);
    su[i] = suMin + rnd() * (suMax - suMin);
    sz[i] = szMin + rnd() * (szMax - szMin);
    lf[i] = lfMin + rnd() * (lfMax - lfMin);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('a0', new THREE.BufferAttribute(a0, 1));
  g.setAttribute('sr', new THREE.BufferAttribute(sr, 1));
  g.setAttribute('su', new THREE.BufferAttribute(su, 1));
  g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('lf', new THREE.BufferAttribute(lf, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 8);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uT0: { value: -1e9 },
      uMap: { value: glowTexture('rgba(255,255,255,1)', 'rgba(220,235,255,0)') },
      uPx: PX_UNIFORM, uTint: { value: new THREE.Color(tint) },
    },
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: `
      uniform float uTime, uT0, uPx;
      attribute float a0, sr, su, sz, lf;
      varying float vU;
      void main(){
        float tau = uTime - uT0;
        float alive = step(0.0, tau) * (1.0 - step(lf, tau));
        vU = clamp(tau / lf, 0.0, 1.0);
        vec3 p = vec3(cos(a0) * sr * tau, su * tau - 4.9 * tau * tau, sin(a0) * sr * tau * 0.92);
        vec4 mv = modelViewMatrix * vec4(p * alive, 1.0);
        gl_PointSize = max(0.0, sz * (1.0 - vU * 0.45) * uPx * alive);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uTint;
      varying float vU;
      void main(){
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(mix(vec3(1.0), uTint, vU * 0.7), tex.a * (1.0 - vU) * 0.9);
        if (gl_FragColor.a < 0.01) discard;
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;               /* burst origin moves with the group */
  return pts;
}

/* twinkling glints (moonpath) — static seeded positions, alpha = f(uTime) */
function glintPoints({ count, seed, box, size }) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3), ph = new Float32Array(count),
        sp = new Float32Array(count), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = box[0] + rnd() * (box[3] - box[0]);
    pos[i * 3 + 1] = 0.06;
    pos[i * 3 + 2] = box[2] + rnd() * (box[5] - box[2]);
    ph[i] = rnd() * 10;
    sp[i] = 0.5 + rnd() * 1.4;
    sz[i] = size * (0.5 + rnd());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('sp', new THREE.BufferAttribute(sp, 1));
  g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)') }, uPx: PX_UNIFORM },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime, uPx;
      attribute float ph, sp, sz;
      varying float vA;
      void main(){
        float w = 0.5 + 0.5 * sin(uTime * sp + ph);
        vA = 0.15 + 0.85 * w * w * w;
        gl_PointSize = max(1.0, sz * uPx);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      varying float vA;
      void main(){
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(0.92, 0.96, 1.0, tex.a * vA * 0.8);
        if (gl_FragColor.a < 0.01) discard;
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

/* ---------------- the factory ---------------- */
export function createSeaScene() {
  const root = new THREE.Group();
  root.name = 'the-sea-diorama';
  const parts = {};
  const track = (name, obj) => { obj.name = name; parts[name] = obj; root.add(obj); return obj; };
  const tickers = [];

  /* ===== MACRO: sky dome + stars ===== */
  {
    const g = new THREE.SphereGeometry(120, 24, 16);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const top = new THREE.Color('#131e3c'), hor = new THREE.Color('#0b1428');
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp(pos.getY(i) / 120 * 0.5 + 0.5, 0, 1);
      const c = hor.clone().lerp(top, t);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, depthWrite: false }));
    sky.renderOrder = -10;
    track('sky', sky);

    const rnd = mulberry32(93001);
    const N = 240, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const az = rnd() * Math.PI * 2, el = Math.asin(0.06 + rnd() * 0.9);
      sp[i * 3] = 110 * Math.cos(el) * Math.sin(az);
      sp[i * 3 + 1] = 110 * Math.sin(el);
      sp[i * 3 + 2] = 110 * Math.cos(el) * Math.cos(az);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: '#e8eeff', size: 0.7, sizeAttenuation: true,
      map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      transparent: true, depthWrite: false }));
    track('star-points', stars);
  }

  /* ===== MACRO: the water slab (top, skirt, under-rock) ===== */
  const SLAB = { cx: 2, cz: 1, rx: 40, rz: 24 };
  {
    const g = new THREE.RingGeometry(0.02, 1, 46, 5);
    g.rotateX(-Math.PI / 2);
    const geo = facetColors(g, '#1e3260', 93011, 0.22);
    geo.scale(SLAB.rx, 1, SLAB.rz);
    const sea = new THREE.Mesh(geo, flatMat({ vertexColors: true, roughness: 0.85 }));
    sea.position.set(SLAB.cx, 0, SLAB.cz);
    sea.receiveShadow = true;
    track('sea-slab', sea);

    const sk = new THREE.CylinderGeometry(1, 0.965, 1, 46, 1, true);
    const skGeo = facetColors(sk, '#243a6e', 93012, 0.16);
    skGeo.scale(SLAB.rx, 1.15, SLAB.rz);
    const skirt = new THREE.Mesh(skGeo, flatMat({ vertexColors: true, side: THREE.DoubleSide }));
    skirt.position.set(SLAB.cx, -0.58, SLAB.cz);
    track('sea-skirt', skirt);

    const ug = new THREE.IcosahedronGeometry(1, 2);
    const p = ug.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y >= 0) { y *= 0.04; }
      else { const d = -y; x *= (1 - 0.58 * d); z *= (1 - 0.58 * d); y *= 1.05; }
      p.setXYZ(i, x * (SLAB.rx - 2), y * 13, z * (SLAB.rz - 1.5));
    }
    jitterByPos(ug, 93013, 0.6);
    const under = new THREE.Mesh(facetColors(ug, '#2a3560', 93013, 0.16), flatMat({ vertexColors: true }));
    under.position.set(SLAB.cx, -1.0, SLAB.cz);
    track('island-under', under);
  }

  /* ===== MACRO: the moonpath — shard facets + twinkling glints ===== */
  {
    const g = new THREE.PlaneGeometry(7.0, 26, 7, 26);
    g.rotateX(-Math.PI / 2);
    jitterByPos(g, 93021, 0.42);
    /* flatten the jitter back onto the water */
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, 0.03);
    /* the shard fan: dense under the moon, scattered toward the ship */
    let geo = dropFaces(g, (c) => hash3(c.x, c.z, 7, 93022) > 0.36 + 0.3 * (c.z / 26 + 0.5));
    geo = facetColors(geo, '#7fa0cc', 93023, 0.34);
    /* boost a seeded quarter of the shards to moon-white */
    const col = geo.attributes.color, pos = geo.attributes.position;
    for (let f = 0; f < pos.count / 3; f++) {
      if (hash3(pos.getX(f * 3), pos.getZ(f * 3), 3, 93024) < 0.26) {
        for (let k = 0; k < 3; k++) col.setXYZ(f * 3 + k, 0.93, 0.96, 1.0);
      }
    }
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });
    const path = new THREE.Mesh(geo, mat);
    path.position.set(-17.2, 0, -7);       /* moon X −18.1 down to the ship's stern water */
    path.rotation.y = 0.08;
    track('moonpath', path);
    tickers.push((t) => { mat.opacity = 0.74 + 0.08 * Math.sin(2 * Math.PI * t / 7.3); });

    const glints = glintPoints({ count: 64, seed: 93025,
      box: [-19.8, 0, -19, -15, 0, 3.5], size: 0.34 });
    track('moonpath-glints', glints);
    tickers.push((t) => { glints.material.uniforms.uTime.value = t; });
  }

  /* ===== MACRO: the moon — low-poly prop ball + halo (plate: 7.5 m disc) ===== */
  const MOON_POS = new THREE.Vector3(X(474), 14, -11.8); /* projects to plate (474,242) at the book azimuth */
  {
    const grp = new THREE.Group();
    const mg = jitterByPos(new THREE.IcosahedronGeometry(3.8, 1), 93031, 0.16);
    const moon = new THREE.Mesh(facetColors(mg, '#c9d3e4', 93031, 0.14),
      new THREE.MeshBasicMaterial({ vertexColors: true }));
    grp.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(215,230,255,0.5)', 'rgba(150,180,255,0)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(14);
    grp.add(halo);
    grp.position.copy(MOON_POS);
    track('moon', grp);
    tickers.push((t) => { halo.material.opacity = 0.5 + 0.08 * Math.sin(2 * Math.PI * t / 9.1); });
  }

  /* ===== MESO: the headland — massif, crag, base apron, cave mouth ===== */
  const CLIFF_TOP = 27.5;                  /* the ledger cross-check: 350 px = 27.5 m */
  const GLOW_POS = new THREE.Vector3(X(818) - 4.1, 2.4, ZH(457, 3.5) + 1.2); /* just outside the mouth */
  {
    const chunk = (seed, hex, { detail = 2, flatTop = 0.55, flatBot = -0.15, sx, sy, sz, px, py, pz, amount = 0.13, jit = 0.5 }) => {
      const g = new THREE.IcosahedronGeometry(1, detail);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (y > flatTop) y = flatTop + (y - flatTop) * 0.10;
        if (y < flatBot) y = flatBot + (y - flatBot) * 0.15;
        p.setXYZ(i, x, y, z);
      }
      g.scale(sx, sy, sz);
      g.translate(px, py, pz);             /* bake position — warm paint works in set space */
      jitterByPos(g, seed, jit);
      return facetColors(g, hex, seed, amount);
    };
    /* the massif: plan x 3..36, z −8..13; plateau flattened at 27.5 */
    const massifGeo = chunk(93041, '#7e8390', {
      detail: 3, flatTop: 0.55, flatBot: -0.15, amount: 0.17,
      sx: 16.3, sy: 32.8, sz: 10.8, px: 19.5, py: 8, pz: 2.5, jit: 0.62 });
    warmPaint(massifGeo, GLOW_POS, 9.5, '#b07a44', 93042);
    const massif = new THREE.Mesh(massifGeo, flatMat({ vertexColors: true }));
    massif.castShadow = massif.receiveShadow = true;
    track('headland-massif', massif);
    /* the crag column left of the massif (the ledger's cragSpill catches the glow) */
    const cragGeo = chunk(93043, '#8a8d99', {
      flatTop: 0.5, sx: 4.2, sy: 14.5, sz: 4.6, px: 7.2, py: 5.5, pz: 6.0, jit: 0.42 });
    warmPaint(cragGeo, GLOW_POS, 7.5, '#c08a4c', 93044);
    const crag = new THREE.Mesh(cragGeo, flatMat({ vertexColors: true }));
    crag.castShadow = crag.receiveShadow = true;
    track('crag', crag);
    /* the base apron descending into the water — hosts the cave mouth */
    const apronGeo = chunk(93045, '#7c808c', {
      flatTop: 0.45, sx: 5.4, sy: 6.5, sz: 5.6, px: 8.6, py: 0.5, pz: 5.0, jit: 0.4 });
    warmPaint(apronGeo, GLOW_POS, 6.5, '#c9924e', 93046);
    const apron = new THREE.Mesh(apronGeo, flatMat({ vertexColors: true }));
    apron.castShadow = apron.receiveShadow = true;
    track('base-apron', apron);

    /* the cave mouth: a dark opening + the glow (ledger caveMouthGlow 818,457) */
    const mouthGrp = new THREE.Group();
    const mg = jitterByPos(new THREE.IcosahedronGeometry(1, 1), 93047, 0.12);
    const mouth = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ color: '#100c0a' }));
    mouth.scale.set(1.5, 1.9, 1.3);
    mouth.position.set(GLOW_POS.x + 0.9, 1.9, GLOW_POS.z + 0.3);
    mouthGrp.add(mouth);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,190,100,0.7)', 'rgba(255,140,40,0)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(6.5);
    halo.position.copy(GLOW_POS);
    mouthGrp.add(halo);
    track('cave-mouth', mouthGrp);
    tickers.push((t, f) => { halo.material.opacity = 0.42 + 0.3 * (f - 0.86); });

    /* brow boulders — the ammunition (ledger box 850..1100 × 30..170 at height) */
    const rnd = mulberry32(93051);
    const bG = jitterByPos(new THREE.IcosahedronGeometry(1, 1), 93051, 0.14);
    bG.computeVertexNormals();
    const N = 12;
    const im = new THREE.InstancedMesh(bG, flatMat({ color: '#ffffff' }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    let placed = 0, guard = 0;
    while (placed < N && guard++ < 300) {
      const big = placed < 8;
      const x = big ? 13 + rnd() * 18 : 9 + rnd() * 11;
      const z = big ? -5.5 + rnd() * 7 : 3 + rnd() * 5;
      /* stay on the flattened plateau ellipse */
      if (Math.hypot((x - 19.5) / 12.8, (z - 2.5) / 8.4) > 0.88) continue;
      const s = big ? 2.0 + rnd() * 2.3 : 0.8 + rnd() * 0.8;
      e.set(rnd() * 0.5, rnd() * Math.PI, rnd() * 0.5);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, CLIFF_TOP - 0.4 + s * 0.55, z), q,
        new THREE.Vector3(s, s * (0.8 + rnd() * 0.35), s * (0.85 + rnd() * 0.3)));
      im.setMatrixAt(placed, m4);
      im.setColorAt(placed, col.set('#a8adb8').multiplyScalar(0.82 + rnd() * 0.32));
      placed++;
    }
    im.count = placed;
    im.castShadow = true;
    track('brow-boulders', im);

    /* green tufts on the ledges (the plate's succulents) */
    const tufts = new THREE.Group();
    [[7.0, 13.4, 5.6, 1.2, 93061], [8.4, 13.1, 4.6, 0.8, 93062],
     [5.6, 8.6, 5.2, 0.9, 93063], [10.8, 3.9, 6.8, 1.1, 93064],
     [6.2, 3.4, 7.4, 0.7, 93065], [11.6, 27.6, 7.6, 1.0, 93066],
     [8.9, 27.5, 6.4, 0.7, 93067], [4.9, 5.9, 6.6, 0.6, 93068]]
      .forEach(([x, y, z, s, seed]) => {
        const tg = jitterByPos(new THREE.IcosahedronGeometry(0.5, 1), seed, 0.16);
        tg.scale(1, 0.62, 1);
        const t = new THREE.Mesh(facetColors(tg, seed % 2 ? '#5f7a4a' : '#6e8c55', seed, 0.16),
          flatMat({ vertexColors: true }));
        t.scale.setScalar(s);
        t.position.set(x, y, z);
        tufts.add(t);
      });
    track('brow-tufts', tufts);

    /* wave-cut rocks at the waterline */
    const base = new THREE.Group();
    [[3.6, 0.25, 9.6, 1.1, 93071], [5.2, 0.2, 11.6, 0.8, 93072],
     [12.4, 0.35, 13.2, 1.4, 93073], [16.8, 0.3, 12.4, 1.0, 93074]]
      .forEach(([x, y, z, s, seed]) => {
        const rg = jitterByPos(new THREE.IcosahedronGeometry(1, 1), seed, 0.14);
        const r = new THREE.Mesh(facetColors(rg, '#5a5f6e', seed, 0.15), flatMat({ vertexColors: true }));
        r.scale.set(s, s * 0.7, s * 0.85);
        r.position.set(x, y, z);
        r.castShadow = true;
        base.add(r);
      });
    track('base-rocks', base);
  }

  /* ===== the cave-glow — the warm practical at the cliff base ===== */
  const caveGlow = new THREE.PointLight('#ffb347', 95, 0, 2);
  caveGlow.position.copy(GLOW_POS);
  root.add(caveGlow);
  const glowFlick = (t) =>
    0.86 + 0.10 * Math.sin(2 * Math.PI * t / 2.7)
         + 0.04 * Math.sin(2 * Math.PI * t / 0.53 + 0.9);
  tickers.push((t, f) => { caveGlow.intensity = 60 * f; });

  /* ===== MESO: THE SHIP — the twenty-oarer, 15 m tip-to-tip (the yardstick) ===== */
  const SHIP_LEN = 15.0, MAST_H = 8.8, DECK_Y = 0.58, ROW_PERIOD = 2.8;
  const sternW = new THREE.Vector3(X(495), 0, Z(462));
  const bowW = new THREE.Vector3(X(678), 0, Z(516));
  const shipMid = sternW.clone().add(bowW).multiplyScalar(0.5);
  const heading = Math.atan2(bowW.x - sternW.x, bowW.z - sternW.z);
  const shipGroup = new THREE.Group();
  shipGroup.position.set(shipMid.x, 0, shipMid.z);
  shipGroup.rotation.y = heading;
  const sway = new THREE.Group();
  sway.name = 'ship-sway';
  shipGroup.add(sway);
  const oars = [];
  {
    const HL = SHIP_LEN / 2;               /* half length — local z, bow +z */
    /* hull: pole-to-pole sphere shell, top dropped along a rising sheer */
    let hg = new THREE.SphereGeometry(1, 16, 10);
    hg.rotateX(Math.PI / 2);
    hg = dropFaces(hg, (c) => c.y < 0.55 + 0.5 * Math.pow(Math.abs(c.z), 2.4));
    hg.scale(1.55, 1.25, HL);
    jitterByPos(hg, 93081, 0.06);
    const hull = new THREE.Mesh(facetColors(hg, '#7a5236', 93081, 0.14),
      flatMat({ vertexColors: true, side: THREE.DoubleSide }));
    hull.position.y = 0.3;
    hull.castShadow = true;
    hull.name = 'hull';
    sway.add(hull);
    /* deck: elongated hexagon at gangway height */
    const shape = new THREE.Shape();
    const outline = [[0, -7.0], [0.9, -4.6], [1.26, -1.5], [1.26, 1.5], [0.9, 4.5], [0, 6.8]];
    shape.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i][0], outline[i][1]);
    for (let i = outline.length - 2; i >= 0; i--) shape.lineTo(-outline[i][0], outline[i][1]);
    shape.closePath();
    const dg = new THREE.ShapeGeometry(shape, 4);
    dg.rotateX(-Math.PI / 2);              /* shape y -> -z: stern was -7.0, now +7.0 -> flip */
    dg.scale(1, 1, -1);
    const deck = new THREE.Mesh(facetColors(dg, '#a07a4e', 93082, 0.1),
      flatMat({ vertexColors: true, side: THREE.DoubleSide }));
    deck.position.y = DECK_Y;
    deck.name = 'deck';
    sway.add(deck);
    /* stern + bow posts (the plate's curls) */
    const post = (r, tube, y, z, arc) => {
      const t = new THREE.Mesh(
        facetColors(new THREE.TorusGeometry(r, tube, 6, 10, arc), '#4a3020', 93083 + Math.round(z), 0.12),
        flatMat({ vertexColors: true }));
      t.rotation.y = Math.PI / 2;
      t.position.set(0, y, z);
      t.castShadow = true;
      sway.add(t);
      return t;
    };
    post(0.62, 0.11, 1.5, -HL + 0.4, Math.PI * 1.25);   /* sternpost curl */
    post(0.45, 0.09, 1.35, HL - 0.35, Math.PI * 0.9);   /* bow post */
    /* rower thwarts — side benches, centre gangway clear */
    const benchG = new THREE.BoxGeometry(0.62, 0.07, 0.3);
    const benchM = flatMat({ color: '#6e4a2a' });
    const OAR_Z = [-3.8, -2.55, -1.3, -0.05, 1.2, 2.45];
    for (const z of OAR_Z) for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(benchG, benchM);
      b.position.set(sx * 0.78, 0.78, z);
      sway.add(b);
    }
    /* mast (8.8 m — the ledger's 112 px) + masthead */
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, MAST_H, 7),
      flatMat({ color: '#4a3226' }));
    mast.position.set(0, DECK_Y + MAST_H / 2, 0.3);
    mast.castShadow = true;
    mast.name = 'mast';
    sway.add(mast);
    const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), flatMat({ color: '#3a281e' }));
    knob.position.set(0, DECK_Y + MAST_H + 0.1, 0.3);
    sway.add(knob);
    /* the raked yard + furled sail */
    const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6.6, 6),
      flatMat({ color: '#5a3d28' }));
    spar.rotation.x = Math.PI / 2 - 0.5;   /* along z, raked up toward the bow */
    spar.position.set(0, DECK_Y + MAST_H * 0.66, 0.3);
    spar.castShadow = true;
    sway.add(spar);
    const sailG = jitterByPos(new THREE.CylinderGeometry(0.13, 0.24, 5.6, 7), 93085, 0.05);
    const sail = new THREE.Mesh(facetColors(sailG, '#cdb289', 93085, 0.1),
      flatMat({ vertexColors: true }));
    sail.rotation.x = Math.PI / 2 - 0.5;
    sail.position.set(0, DECK_Y + MAST_H * 0.66 - 0.22, 0.3);
    sail.castShadow = true;
    sway.add(sail);
    /* rigging lines (zero triangles) */
    const rig = new THREE.BufferGeometry();
    const mh = new THREE.Vector3(0, DECK_Y + MAST_H, 0.3);
    const sparHi = new THREE.Vector3(0, DECK_Y + MAST_H * 0.66 + Math.cos(0.5) * 3.3, 0.3 + Math.sin(0.5) * 3.3);
    const sparLo = new THREE.Vector3(0, DECK_Y + MAST_H * 0.66 - Math.cos(0.5) * 3.3, 0.3 - Math.sin(0.5) * 3.3);
    const L = [];
    const seg = (a, b) => L.push(a.x, a.y, a.z, b.x, b.y, b.z);
    seg(mh, new THREE.Vector3(0, 1.45, -HL + 0.5));
    seg(mh, new THREE.Vector3(0, 1.3, HL - 0.5));
    seg(sparHi, new THREE.Vector3(0.9, DECK_Y, 4.2));
    seg(sparLo, new THREE.Vector3(-0.9, DECK_Y, -3.6));
    rig.setAttribute('position', new THREE.BufferAttribute(new Float32Array(L), 3));
    sway.add(new THREE.LineSegments(rig,
      new THREE.LineBasicMaterial({ color: '#b9a67e', transparent: true, opacity: 0.55 })));
    /* THE OARS — 6 + 6 (the painted 8 rowlocks read = a twenty-oarer class;
       six survivors row the escape, menbeg's crew) */
    const gw = (z) => 1.55 * Math.sqrt(Math.max(0.05, 1 - (z / HL) * (z / HL))) * 0.94;
    const shaftG = new THREE.CylinderGeometry(0.035, 0.045, 4.2, 6);
    shaftG.rotateZ(Math.PI / 2);
    shaftG.translate(1.2, 0, 0);           /* pivot at the rowlock: shaft −0.9..3.3 */
    const bladeG = new THREE.BoxGeometry(0.78, 0.05, 0.24);
    bladeG.translate(3.0, 0, 0);
    const oarM = flatMat({ color: '#7a5c36' });
    const rnd = mulberry32(93086);
    for (const sx of [1, -1]) {
      for (const z of OAR_Z) {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(shaftG, oarM);
        const blade = new THREE.Mesh(bladeG, oarM);
        shaft.castShadow = blade.castShadow = true;
        g.add(shaft, blade);
        g.position.set(sx * gw(z), 1.02, z);
        g.userData.baseY = sx === 1 ? 0 : Math.PI;
        g.userData.sweepSign = sx;         /* keep port + starboard in fore-aft sync */
        g.userData.stagger = (rnd() - 0.5) * 0.1;
        sway.add(g);
        oars.push(g);
      }
    }
    track('ship', shipGroup);
  }
  /* the row cycle + the sway — pure f(simT) */
  tickers.push((t) => {
    const ph = 2 * Math.PI * t / ROW_PERIOD;
    for (const oar of oars) {
      const p = ph + oar.userData.stagger;
      const dip = -0.36 - 0.17 * Math.cos(p);
      const swp = 0.30 * Math.sin(p) * oar.userData.sweepSign;
      oar.rotation.set(0, oar.userData.baseY + swp, dip);
    }
    sway.position.y = 0.06 * Math.sin(2 * Math.PI * t / 5.3);
    sway.rotation.z = 0.014 * Math.sin(2 * Math.PI * t / 6.1 + 0.8);
    sway.rotation.x = 0.009 * Math.sin(2 * Math.PI * t / 7.9);
  });
  const _tip = new THREE.Vector3();
  const oarTip = (i) => {
    oars[i].updateWorldMatrix(true, false);
    return _tip.set(3.6, 0, 0).applyMatrix4(oars[i].matrixWorld).clone();
  };

  /* ===== MESO: the splash pool + the thrown rocks ===== */
  const splashUnits = [];
  {
    const pool = new THREE.Group();
    for (let u = 0; u < 4; u++) {
      const grp = new THREE.Group();
      const drops = splashPoints({ count: 90, seed: 93091 + u * 7,
        srMin: 0.6, srMax: 2.6, suMin: 2.6, suMax: 5.4,
        szMin: 0.07, szMax: 0.17, lfMin: 0.55, lfMax: 1.05, tint: '#9db8d8' });
      const plume = splashPoints({ count: 30, seed: 93092 + u * 7,
        srMin: 0.1, srMax: 0.55, suMin: 4.4, suMax: 7.2,
        szMin: 0.2, szMax: 0.42, lfMin: 0.5, lfMax: 0.85, tint: '#cfe0f5' });
      const ringG = new THREE.RingGeometry(0.55, 1, 18);
      ringG.rotateX(-Math.PI / 2);
      const ringM = new THREE.MeshBasicMaterial({ color: '#dfe9f5', transparent: true, opacity: 0 });
      const ring = new THREE.Mesh(ringG, ringM);
      ring.position.y = 0.04;
      grp.add(drops, plume, ring);
      grp.visible = false;
      pool.add(grp);
      splashUnits.push({ grp, mats: [drops.material, plume.material], ring, t0: -1e9 });
    }
    track('splash-pool', pool);
  }
  let lastSim = 0, freeSlot = 0;
  const setUnit = (u, x, z, t0) => {
    u.grp.position.set(x, 0, z);
    u.t0 = t0;
    for (const m of u.mats) m.uniforms.uT0.value = t0;
  };
  /* the reusable burst — world metres; smoke + set-pieces call this directly */
  const splashAt = (x, z) => {
    const u = splashUnits[2 + (freeSlot++ % 2)];
    setUnit(u, x, z, lastSim);
    return u;
  };
  /* the rock scheduler: two impacts on the ledger's splash points, pure f(simT) */
  const ROCKS = [
    { launch: new THREE.Vector3(X(880) + 0.6, CLIFF_TOP + 1.4, ZH(196, CLIFF_TOP + 1.4)),
      target: new THREE.Vector3(X(468), 0, Z(505)), period: 9, offset: 1.5, flight: 1.7, unit: 0 },
    { launch: new THREE.Vector3(X(900) + 1.2, CLIFF_TOP + 1.4, ZH(200, CLIFF_TOP + 1.4)),
      target: new THREE.Vector3(X(455), 0, Z(540)), period: 9, offset: 6.0, flight: 1.7, unit: 1 },
  ];
  const thrown = new THREE.Group();
  const rockMeshes = ROCKS.map((r, i) => {
    const rg = jitterByPos(new THREE.IcosahedronGeometry(0.9, 1), 93101 + i, 0.14);
    const m = new THREE.Mesh(facetColors(rg, '#8d92a0', 93101 + i, 0.14), flatMat({ vertexColors: true }));
    m.castShadow = true;
    m.visible = false;
    thrown.add(m);
    return m;
  });
  track('thrown-rocks', thrown);
  tickers.push((t) => {
    for (let i = 0; i < ROCKS.length; i++) {
      const r = ROCKS[i], m = rockMeshes[i];
      const local = ((t - r.offset) % r.period + r.period) % r.period;
      /* the impact this cycle refers to: pure cycle arithmetic — replayable */
      const t0 = local >= r.flight ? t - (local - r.flight) : t - (local + r.period - r.flight);
      setUnit(splashUnits[r.unit], r.target.x, r.target.z, t0);
      if (local < r.flight) {
        const u = local / r.flight;
        m.visible = true;
        m.position.lerpVectors(r.launch, r.target, u);
        m.position.y = r.launch.y * (1 - u) + 4 * 7.5 * u * (1 - u);
        m.rotation.set(u * 5.2, u * 3.1, u * 4.4);
      } else m.visible = false;
    }
    /* splash uniforms + foam rings */
    for (const u of splashUnits) {
      for (const mt of u.mats) mt.uniforms.uTime.value = t;
      const tau = t - u.t0;
      const on = tau >= 0 && tau < 1.4;
      u.grp.visible = u.t0 > -1e8 && tau > -0.01 && tau < 1.6;
      const k = Math.min(Math.max(tau / 1.4, 0), 1);
      u.ring.scale.setScalar(on ? 0.6 + 2.8 * Math.pow(k, 0.7) : 0.001);
      u.ring.material.opacity = on ? 0.7 * (1 - k) : 0;
    }
  });

  /* ===== the night rig — the moon is THE one shadow caster ===== */
  const moonLight = new THREE.DirectionalLight('#bcd2ff', 2.3);
  moonLight.position.set(-32, 34, 10);     /* from the moon's quarter, slightly front — the plate's lit faces */
  moonLight.target.position.set(8, 0, 2);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 120;
  moonLight.shadow.camera.left = -42; moonLight.shadow.camera.right = 42;
  moonLight.shadow.camera.top = 42; moonLight.shadow.camera.bottom = -42;
  moonLight.shadow.bias = -0.003;
  root.add(moonLight, moonLight.target);
  {
    const hemi = new THREE.HemisphereLight('#42558a', '#1a2340', 1.45);
    root.add(hemi);
    parts['night-rig'] = hemi;
  }

  /* ---- budget: count triangles once, from the built graph ---- */
  let triangles = 0;
  root.traverse((o) => {
    if (!o.isMesh && !o.isPoints) return;
    const g = o.geometry;
    if (!g || !g.attributes.position) return;
    const n = g.index ? g.index.count : g.attributes.position.count;
    const t = o.isPoints ? 0 : Math.floor(n / 3) * (o.isInstancedMesh ? o.count : 1);
    triangles += t;
  });

  const tick = (simT) => {
    lastSim = simT;
    const f = glowFlick(simT);
    for (const fn of tickers) fn(simT, f);
  };
  tick(0);

  const SHIP = {
    group: shipGroup, sway, deckY: DECK_Y, lengthM: SHIP_LEN, mastM: MAST_H,
    headingRad: heading, worldMid: shipMid,
    deckPathLocal: [[-0.4, DECK_Y, -5.0], [-0.4, DECK_Y, 4.6]],  /* the port gangway, clear of mast + thwarts */
  };
  root.userData.sculptRuntime = {
    nodes: Object.keys(parts).length,
    triangles,
    sockets: {
      'root:deck-mount': [shipMid.x, DECK_Y, shipMid.z],
      'root:brow-giant': [X(860), CLIFF_TOP, ZH(210, CLIFF_TOP)],
      'root:cave-glow': [GLOW_POS.x, GLOW_POS.y, GLOW_POS.z],
    },
    colliders: OBSTACLES,
  };
  const setPixelScale = (pxPerMetre) => { PX_UNIFORM.value = pxPerMetre; };
  return { root, tick, splashAt, caveGlow, moonLight, glowFlick, oars, oarTip,
           SHIP, ROW_PERIOD, CLIFF_TOP, GLOW_POS, MOON_POS, ROCKS, splashUnits,
           parts, triangles, setPixelScale };
}

/* ---------------- the book's isometric camera + orbit ---------------- */
export function createSeaIsoCamera(aspect = 1408 / 768) {
  const HALF_W = 55.4;                     /* 1408 px at 12.7 px/m — the plate's own width */
  const cam = new THREE.OrthographicCamera(-HALF_W, HALF_W, HALF_W / aspect, -HALF_W / aspect, 0.1, 400);
  const target = new THREE.Vector3(0, 7.8, 0);
  const R = 190;
  const setOrbit = (azimuthDeg) => {
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    cam.position.set(
      target.x + R * Math.sin(az) * Math.cos(ELEV),
      target.y + R * Math.sin(ELEV),
      target.z + R * Math.cos(az) * Math.cos(ELEV));
    cam.lookAt(target);
  };
  setOrbit(0);
  cam.userData.setOrbit = setOrbit;
  cam.userData.target = target;
  return cam;
}
