/**
 * sea3d.js — procedural Three.js FULL-3D SET (REBUILD to the cave's bar)
 * THE SEA (Beat VI, the escape) as native geometry: the headland cliff (painterly
 * faceted crags, the glowing recess, the flat brow plateau with the ammunition
 * boulders), open water under the water law (seeded vertex swell, wine-dark base,
 * fresnel-style brightening toward the moon line, the moonpath as a coherent
 * emissive band with animated sparkle, shore foam, the ship's wake), the
 * twenty-oarer with real hull/oar craft, the rock-impact splash system, the
 * cave-glow at the cliff base, and the low-poly prop moon.
 *
 * Rebuilt with the img2threejs staged pipeline (~/.claude/skills/img2threejs)
 * from the reference plate ../../assets/set/sea/sea.jpg through the gated passes
 * spec -> blockout -> structure -> form -> material -> lighting; every pass
 * rendered through the real page and judged against the plate. The pass log with
 * per-pass renders + verdicts: 3d/sea/passes/passlog.md.
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
 * DETERMINISM LAW: every scatter/jitter is mulberry32-seeded; the water swell is
 * displaced IN THE VERTEX SHADER as a pure function of (world position, uTime);
 * the splash bursts are GPU point systems whose positions are PURE functions of
 * (seed attributes, uTime − uT0); the thrown rocks + their impact times are pure
 * f(simT) (the scheduler recomputes t0 from cycle arithmetic every tick — setSim
 * replays byte-identically). tick(simT) drives uniforms, oar cycle, sway, flicker.
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
/* crack-free jitter: offset is a hash of the QUANTISED vertex position, so shared
   positions (even across duplicated non-indexed verts) move together — no holes */
function hash3(x, y, z, seed) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (Math.round(x * 97) & 0xffff), 2654435761);
  h = Math.imul(h ^ (Math.round(y * 97) & 0xffff), 2246822519);
  h = Math.imul(h ^ (Math.round(z * 97) & 0xffff), 3266489917);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function jitterByPos(geo, seed, amp, ampY = amp) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i,
      x + (hash3(x, y, z, seed) - 0.5) * 2 * amp,
      y + (hash3(x, y, z, seed + 1) - 0.5) * 2 * ampY,
      z + (hash3(x, y, z, seed + 2) - 0.5) * 2 * amp);
  }
  p.needsUpdate = true;
  return geo;
}
/* per-face value jitter -> painterly facets (vertex colors, flat by construction) */
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
/* delete triangles by centroid predicate (face deletion, never a boolean) */
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
/* warm-paint faces near a point (the cave-glow spill baked onto the rock).
   fadeY makes the wash die with height like the plate's climbing amber;
   chimney (optional [x, z, halfWidth]) confines the high wash to the recess. */
function warmPaint(geo, point, radius, warmHex, seed, { fadeY = 0, chimney = null, gain = 1 } = {}) {
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
    let w = (1 - d / radius) * (0.55 + hash3(a.x, a.y, a.z, seed) * 0.35) * gain;
    if (fadeY > 0) w *= THREE.MathUtils.clamp(1 - Math.max(0, a.y - point.y) / fadeY, 0, 1);
    if (chimney && a.y > point.y + 2.5) {
      const [cxx, czz, hw] = chimney;
      const off = Math.hypot(a.x - cxx, (a.z - czz) * 0.6);
      w *= THREE.MathUtils.clamp(1 - (off - hw) / hw, 0, 1);
    }
    w = Math.min(w, 0.96);
    if (w <= 0) continue;
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

/* ================================================================ */
/* THE CRAG BUILDER — ridged painterly-faceted rock, not a blob.    */
/* A radial column grid: per-ring angular jitter + multi-lobe       */
/* radius + vertical terracing give big near-vertical facets with   */
/* real creases; the top closes as a flat plateau fan.              */
/* ================================================================ */
function cragGeo({ seed, radial = 12, tiers = 6, height = 20, rx = 6, rz = 6,
                   lobes = [], notch = null, taper = 0.86, flare = 1.22, terrace = 0.24,
                   plateau = true, plateauDrop = 0.14, jit = 0.55, aJit = 0.42,
                   base = -2.5 }) {
  const rnd = mulberry32(seed);
  /* per-tier ring: angular offsets + terraced radius multipliers */
  const ringOff = [], tierMul = [];
  for (let t = 0; t <= tiers; t++) {
    ringOff.push((rnd() - 0.5) * aJit * (Math.PI * 2 / radial));
    tierMul.push(1 + (rnd() - 0.5) * terrace);
  }
  const angJit = [];
  for (let t = 0; t <= tiers; t++) {
    const row = [];
    for (let j = 0; j < radial; j++) row.push((rnd() - 0.5) * aJit * (Math.PI * 2 / radial));
    angJit.push(row);
  }
  const lobeAt = (a, u) => {
    let m = 1;
    for (const [n, amp, ph] of lobes) m += amp * Math.sin(n * a + ph);
    if (notch) {                            /* the glowing recess: a carved chimney */
      const [na, nw, nd] = notch;
      let d = a - na;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      m -= nd * Math.exp(-(d * d) / (2 * nw * nw)) * (1 - Math.abs(u - 0.35) * 1.2);
    }
    return m;
  };
  const ring = [];                          /* ring[t][j] = Vector3 */
  for (let t = 0; t <= tiers; t++) {
    const u = t / tiers;
    const y = base + (height - base) * Math.pow(u, 1.12);
    /* near-vertical superellipse profile: slight base flare, gentle taper up */
    const prof = (flare + (taper - flare) * Math.pow(u, 0.62)) * tierMul[t];
    const row = [];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2 + ringOff[t] + angJit[t][j];
      const m = prof * lobeAt(a, u);
      row.push(new THREE.Vector3(Math.cos(a) * rx * m, y, Math.sin(a) * rz * m));
    }
    ring.push(row);
  }
  const tri = [];
  const quad = (a, b, c, d) => {            /* wound so the wall normals face OUTWARD */
    tri.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    tri.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z);
  };
  for (let t = 0; t < tiers; t++) {
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      quad(ring[t][j], ring[t][j2], ring[t + 1][j2], ring[t + 1][j]);
    }
  }
  if (plateau) {                            /* flat top fan, dropped just under the rim */
    const top = ring[tiers];
    const c = new THREE.Vector3(0, height - plateauDrop, 0);
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      tri.push(c.x, c.y, c.z, top[j2].x, top[j2].y, top[j2].z, top[j].x, top[j].y, top[j].z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri), 3));
  jitterByPos(g, seed + 5, jit, jit * 0.55);
  return g;
}
/* the plate is itself a LIT render — bake its light logic into the facets:
   per-face grade between a shadow hex and a lit hex by facet-normal · moon dir,
   plus seeded painterly jitter. The live rig then shades on top. */
function gradeFacets(geo, litHex, darkHex, seed, { litDir = [-0.55, 0.68, 0.42],
                     amount = 0.10, gamma = 1.15, eastDark = 0 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const lit = new THREE.Color(litHex), dark = new THREE.Color(darkHex);
  const L = new THREE.Vector3(...litDir).normalize();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(),
        nv = new THREE.Vector3();
  const rnd = mulberry32(seed);
  for (let f = 0; f < n / 3; f++) {
    a.fromBufferAttribute(pos, f * 3); b.fromBufferAttribute(pos, f * 3 + 1);
    c.fromBufferAttribute(pos, f * 3 + 2);
    nv.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
    let k = Math.pow(THREE.MathUtils.clamp(nv.dot(L) * 0.5 + 0.5, 0, 1), gamma);
    /* the plate's own read: faces turned east (away from the moon) drop hard */
    if (eastDark > 0 && nv.x > 0.15) k *= 1 - eastDark * (nv.x - 0.15) / 0.85;
    const v = 1 + (rnd() - 0.5) * 2 * amount;
    const cc = dark.clone().lerp(lit, k).multiplyScalar(v);
    for (let kk = 0; kk < 3; kk++) {
      col[(f * 3 + kk) * 3] = cc.r; col[(f * 3 + kk) * 3 + 1] = cc.g; col[(f * 3 + kk) * 3 + 2] = cc.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/* the succulent rosette — flat pointed lobes in two whorls, pale tips */
function succulent(seed, s = 1) {
  const grp = new THREE.Group();
  const rnd = mulberry32(seed);
  const mk = (len, wid, lift, ang, hex) => {
    const g = new THREE.ConeGeometry(wid, len, 4, 1);
    g.translate(0, len / 2, 0);
    g.rotateX(Math.PI / 2 - lift);          /* lay the spike outward, tip raised */
    g.rotateY(ang);
    g.scale(1, 0.42, 1);                    /* flatten to a leaf */
    jitterByPos(g, seed + Math.round(ang * 37), 0.03);
    const geo = facetColors(g, hex, seed + Math.round(ang * 53), 0.14);
    /* pale tips */
    const pos = geo.attributes.position, col = geo.attributes.color;
    const tip = new THREE.Color('#a8bd8a');
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getZ(i));
      if (d > len * 0.72) col.setXYZ(i,
        col.getX(i) + (tip.r - col.getX(i)) * 0.55,
        col.getY(i) + (tip.g - col.getY(i)) * 0.55,
        col.getZ(i) + (tip.b - col.getZ(i)) * 0.55);
    }
    return new THREE.Mesh(geo, flatMat({ vertexColors: true }));
  };
  const n1 = 7;
  for (let i = 0; i < n1; i++) {
    const ang = (i / n1) * Math.PI * 2 + rnd() * 0.4;
    grp.add(mk(0.9 + rnd() * 0.35, 0.16, 0.32 + rnd() * 0.15, ang, '#5f7a52'));
  }
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.5 + rnd() * 0.4;
    const m = mk(0.55 + rnd() * 0.2, 0.13, 0.65 + rnd() * 0.2, ang, '#8aa06c');
    m.position.y = 0.08;
    grp.add(m);
  }
  grp.scale.setScalar(s);
  return grp;
}

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
function glintPoints({ count, seed, pts: seedPts, size }) {
  const pos = new Float32Array(count * 3), ph = new Float32Array(count),
        sp = new Float32Array(count), sz = new Float32Array(count);
  const rnd = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const [x, z] = seedPts(rnd, i);
    pos[i * 3] = x;
    pos[i * 3 + 1] = 0.14;
    pos[i * 3 + 2] = z;
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

/* ================================================================ */
/* THE WATER LAW — one subdivided world-space plane. Swell is       */
/* displaced in the vertex shader (pure f(position, uTime); shared  */
/* positions displace together — crack-free by construction). Flat  */
/* facet normals come from derivatives (FLAT_SHADED), so the swell  */
/* relights per-face every frame like the plate's hand-lit facets.  */
/* Per-face attributes drive the register: aBand (moonpath), aSpark */
/* (twinkle phase), aFoam (shore foam), aGlow (cave-glow pool).     */
/* ================================================================ */
const SLAB = { cx: -1.2, cz: -2.4, side: 52.4, rotY: THREE.MathUtils.degToRad(35), skirt: 2.3 };
function slabCorner(k) {                    /* k = 0..3 -> E,S,W,N plan corners */
  const a = THREE.MathUtils.degToRad(10 + k * 90);
  const d = SLAB.side * Math.SQRT1_2;
  return [SLAB.cx + d * Math.cos(a), SLAB.cz + d * Math.sin(a)];
}
function buildWater({ seed, moonPlanX, glowPos, shoreline, wakeStern, wakeHeading }) {
  const SEG = 28;
  const g0 = new THREE.PlaneGeometry(SLAB.side, SLAB.side, SEG, SEG);
  g0.rotateX(-Math.PI / 2);
  g0.rotateY(SLAB.rotY);
  g0.translate(SLAB.cx, 0, SLAB.cz);
  /* irregular triangulation: plan jitter only (y stays 0 for the law) */
  const g = g0.toNonIndexed();
  {
    const p = g.attributes.position;
    const cell = SLAB.side / SEG;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const j = 0.42 * cell;
      p.setX(i, x + (hash3(x, 0, z, seed) - 0.5) * 2 * j);
      p.setZ(i, z + (hash3(x, 0, z, seed + 1) - 0.5) * 2 * j);
    }
  }
  const pos = g.attributes.position;
  const nFaces = pos.count / 3;
  const col = new Float32Array(pos.count * 3);
  const band = new Float32Array(pos.count);
  const spark = new Float32Array(pos.count);
  const foam = new Float32Array(pos.count);
  const glow = new Float32Array(pos.count);
  const deep = new THREE.Color('#131c3a'), wine = new THREE.Color('#1e3060');
  const rnd = mulberry32(seed + 7);
  const c = new THREE.Vector3();
  for (let f = 0; f < nFaces; f++) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++)
      c.add(new THREE.Vector3(pos.getX(f * 3 + k), pos.getY(f * 3 + k), pos.getZ(f * 3 + k)));
    c.multiplyScalar(1 / 3);
    /* wine-dark base, brightening gently toward the moon line (west) */
    const towardMoon = THREE.MathUtils.clamp(1 - Math.abs(c.x - moonPlanX) / 30, 0, 1);
    const tone = 0.88 + (rnd() - 0.5) * 2 * 0.20 + towardMoon * 0.14;
    const base = deep.clone().lerp(wine, THREE.MathUtils.clamp(towardMoon * 1.2, 0, 1));
    /* THE MOONPATH BAND: coherent, widest under the moon (upstage), scattering
       downstage past the stern — shards arrive in 2.6 m PATCHES (quantised hash),
       so whole facets flip together like the plate's hand-cut shards */
    const drift = Math.sin(c.z * 0.21 + 1.3) * 1.7;
    const dx = Math.abs(c.x - (moonPlanX + drift));
    const t = THREE.MathUtils.clamp((c.z + 30) / 62, 0, 1);   /* 0 at moon end, 1 downstage */
    const halfW = 7.5 - 5.2 * t;
    const density = 1.0 - 0.85 * t;
    let b = 0;
    if (dx < halfW) {
      const edge = 1 - dx / halfW;
      const patch = hash3(Math.round(c.x / 2.6), 0, Math.round(c.z / 2.6), seed + 11);
      const wobble = 0.8 + 0.5 * hash3(0, 2, Math.round(c.z / 3.1), seed + 17);
      if (patch < density * (0.4 + 0.6 * edge) * wobble) {
        b = (0.5 + 0.5 * edge) * (0.6 + 0.4 * hash3(c.x, 1, c.z, seed + 12));
        /* blown-white core near the moon end */
        if (t < 0.34 && dx < halfW * 0.6) b = Math.min(1.35, b * 1.9);
      }
    } else if (dx < halfW * 2.3 &&
               hash3(Math.round(c.x / 2.2), 1, Math.round(c.z / 2.2), seed + 15) < 0.06) {
      b = 0.35 * (0.5 + 0.5 * hash3(c.x, 4, c.z, seed + 16));   /* stray outboard shards */
    }
    /* the tail thins out before the slab's south corner */
    if (c.z > 12) b *= Math.max(0, 1 - (c.z - 12) / 14);
    /* shore foam: pale band hugging the cliff waterline segments */
    let fm = 0;
    for (const [sx, sz, r] of shoreline) {
      const d = Math.hypot(c.x - sx, c.z - sz);
      if (d < r * 0.72) fm = Math.max(fm, (1 - d / (r * 0.72)));
    }
    fm = fm > 0.25 ? fm * 0.6 * (0.5 + 0.5 * hash3(c.x, 2, c.z, seed + 13)) : 0;
    /* the cave-glow pool on the water in front of the mouth */
    const dg = Math.hypot((c.x - glowPos.x) * 1.15, c.z - glowPos.z - 2.6);
    let gl = dg < 6.2 ? Math.pow(1 - dg / 6.2, 1.5) : 0;
    if (gl > 0 && hash3(c.x, 3, c.z, seed + 14) < 0.4) gl *= 0.25;  /* streaky, not a disc */
    /* the wake: two pale diverging lines astern + churn at the hull */
    let wk = 0;
    {
      const wx = c.x - wakeStern.x, wz = c.z - wakeStern.z;
      const along = -(wx * Math.sin(wakeHeading) + wz * Math.cos(wakeHeading)); /* astern > 0 */
      const across = wx * Math.cos(wakeHeading) - wz * Math.sin(wakeHeading);
      if (along > 0 && along < 13) {
        const arm = Math.abs(Math.abs(across) - (0.55 + along * 0.34));
        if (arm < 0.85) wk = (1 - arm / 0.85) * (1 - along / 13) * 1.25;
        if (Math.abs(across) < 0.9 && along < 4.5) wk = Math.max(wk, (1 - along / 4.5) * 0.8);
      }
    }
    fm = Math.max(fm, wk);
    const sp = rnd() * 10;
    for (let k = 0; k < 3; k++) {
      const i = f * 3 + k;
      col[i * 3] = base.r * tone; col[i * 3 + 1] = base.g * tone; col[i * 3 + 2] = base.b * tone;
      band[i] = b; spark[i] = sp; foam[i] = fm; glow[i] = gl;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aBand', new THREE.BufferAttribute(band, 1));
  g.setAttribute('aSpark', new THREE.BufferAttribute(spark, 1));
  g.setAttribute('aFoam', new THREE.BufferAttribute(foam, 1));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  g.computeVertexNormals();

  const uniforms = { uTime: { value: 0 }, uFlick: { value: 1 } };
  const mat = new THREE.MeshStandardMaterial({
    flatShading: true, vertexColors: true, metalness: 0.0, roughness: 0.62 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uFlick = uniforms.uFlick;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        attribute float aBand, aSpark, aFoam, aGlow;
        varying float vBand, vSpark, vFoam, vGlow;
        float swellY(vec2 p, float t){
          /* the seeded swell — three slow directional trains, pure f(p, t) */
          float y = 0.0;
          y += 0.16 * sin(dot(p, vec2(0.62, 0.30)) + t * 0.55);
          y += 0.11 * sin(dot(p, vec2(-0.34, 0.74)) + t * 0.42 + 2.1);
          y += 0.06 * sin(dot(p, vec2(1.21, -0.88)) + t * 0.83 + 4.4);
          return y;
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += swellY(position.xz, uTime);
        vBand = aBand; vSpark = aSpark; vFoam = aFoam; vGlow = aGlow;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uFlick;
        varying float vBand, vSpark, vFoam, vGlow;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          /* the moonpath: coherent emissive band + per-facet animated sparkle */
          float tw = 0.62 + 0.38 * sin(uTime * (0.7 + fract(vSpark) * 1.7) + vSpark * 6.2832);
          vec3 moonCol = vec3(0.82, 0.88, 1.0);
          totalEmissiveRadiance += moonCol * vBand * tw * 0.85;
          /* fresnel-style grazing brightening, biased toward the moon side */
          vec3 V = normalize(vViewPosition);
          float fres = pow(1.0 - abs(dot(normal, V)), 2.0);
          float moonSide = clamp(0.5 - normal.x * 1.6, 0.0, 1.0);
          totalEmissiveRadiance += moonCol * fres * moonSide * (0.05 + vBand * 0.35);
          /* shore foam + wake: pale, softly pulsing */
          float fp = 0.8 + 0.2 * sin(uTime * 1.3 + vSpark * 6.2832);
          totalEmissiveRadiance += vec3(0.62, 0.70, 0.82) * vFoam * fp * 0.34;
          /* the cave-glow pool, flickering with the practical */
          totalEmissiveRadiance += vec3(1.0, 0.62, 0.22) * vGlow * uFlick * 0.85;
          /* the painted floor: the plate's water is never true black */
          totalEmissiveRadiance += diffuseColor.rgb * 0.26;
        }`);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  return { mesh, uniforms };
}

/* ---------------- the factory ---------------- */
export function createSeaScene() {
  const root = new THREE.Group();
  root.name = 'the-sea-diorama';
  const parts = {};
  const track = (name, obj) => { obj.name = name; parts[name] = obj; root.add(obj); return obj; };
  const tickers = [];

  /* ===== MACRO: sky dome + faint stars ===== */
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
    const N = 170, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const az = rnd() * Math.PI * 2, el = Math.asin(0.06 + rnd() * 0.9);
      sp[i * 3] = 110 * Math.cos(el) * Math.sin(az);
      sp[i * 3 + 1] = 110 * Math.sin(el);
      sp[i * 3 + 2] = 110 * Math.cos(el) * Math.cos(az);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: '#cdd8f2', size: 0.55, sizeAttenuation: true,
      map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      transparent: true, opacity: 0.75, depthWrite: false }));
    track('star-points', stars);
  }

  /* ===== the cave-glow anchor (the water + cliff both read it) ===== */
  const CLIFF_TOP = 27.5;                  /* the ledger cross-check: 350 px = 27.5 m */
  const GLOW_POS = new THREE.Vector3(X(818) - 4.1, 2.4, ZH(457, 3.5) + 1.2);
  const MOON_PLAN_X = X(474);              /* the moonpath aims down this line */

  /* ===== MESO: THE SHIP anchors (water wake needs them before the build) ===== */
  const SHIP_LEN = 15.0, MAST_H = 8.8, DECK_Y = 0.58, ROW_PERIOD = 2.8;
  const sternW = new THREE.Vector3(X(495), 0, Z(462));
  const bowW = new THREE.Vector3(X(678), 0, Z(516));
  const shipMid = sternW.clone().add(bowW).multiplyScalar(0.5);
  const heading = Math.atan2(bowW.x - sternW.x, bowW.z - sternW.z);

  /* ===== MACRO: the water — the law's one plane + skirt + under-rock ===== */
  let waterUniforms;
  {
    const shoreline = [
      /* [plan x, plan z, foam radius] hugging the headland base + waterline rocks */
      [3.4, 8.6, 2.2], [5.4, 10.4, 2.4], [8.2, 12.6, 2.6], [11.6, 14.4, 2.6],
      [15.2, 15.8, 2.8], [19.4, 15.2, 2.4], [23.0, 13.4, 2.2], [27.2, 11.0, 2.2],
      [31.0, 8.0, 2.0], [2.6, 5.4, 1.8], [1.8, 1.6, 1.6],
    ];
    const water = buildWater({
      seed: 93011, moonPlanX: MOON_PLAN_X, glowPos: GLOW_POS,
      shoreline, wakeStern: sternW, wakeHeading: heading });
    waterUniforms = water.uniforms;
    track('sea-slab', water.mesh);
    tickers.push((t, f) => {
      waterUniforms.uTime.value = t;
      waterUniforms.uFlick.value = f;
    });

    /* the skirt: four vertical slab sides off the exact corners */
    {
      const cs = [slabCorner(0), slabCorner(1), slabCorner(2), slabCorner(3)];
      const tri = [];
      for (let e = 0; e < 4; e++) {
        const [ax, az] = cs[e], [bx, bz] = cs[(e + 1) % 4];
        const N = 12;
        for (let i = 0; i < N; i++) {
          const t0 = i / N, t1 = (i + 1) / N;
          const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0;
          const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
          tri.push(x0, 0, z0, x0, -SLAB.skirt, z0, x1, -SLAB.skirt, z1);
          tri.push(x0, 0, z0, x1, -SLAB.skirt, z1, x1, 0, z1);
        }
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri), 3));
      jitterByPos(sg, 93012, 0.3, 0.12);
      const skirt = new THREE.Mesh(facetColors(sg, '#20335f', 93012, 0.18),
        flatMat({ vertexColors: true, side: THREE.DoubleSide }));
      track('sea-skirt', skirt);
    }

    /* the under-rock: inverted faceted mass, rotated with the slab */
    {
      const ug = new THREE.IcosahedronGeometry(1, 2);
      const p = ug.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (y >= 0) { y *= 0.03; }
        else { const d = -y; x *= (1 - 0.55 * d); z *= (1 - 0.55 * d); y *= 1.05; }
        p.setXYZ(i, x * (SLAB.side * 0.56), y * 12, z * (SLAB.side * 0.5));
      }
      ug.rotateY(SLAB.rotY);
      ug.translate(SLAB.cx - 3.5, -SLAB.skirt + 0.3, SLAB.cz + 3.5);
      jitterByPos(ug, 93013, 0.85);
      const under = new THREE.Mesh(facetColors(ug, '#182242', 93013, 0.26), flatMat({ vertexColors: true }));
      track('island-under', under);
    }
  }

  /* ===== MACRO: the moonpath twinkle glints ride the band ===== */
  {
    const glints = glintPoints({ count: 46, seed: 93025, size: 0.3,
      pts: (rnd, i) => {
        const z = -26 + rnd() * 52;
        const t = THREE.MathUtils.clamp((z + 30) / 62, 0, 1);
        const halfW = (6.2 - 3.4 * t) * 0.8;
        const drift = Math.sin(z * 0.21 + 1.3) * 1.7;
        return [MOON_PLAN_X + drift + (rnd() * 2 - 1) * halfW, z];
      } });
    track('moonpath-glints', glints);
    tickers.push((t) => { glints.material.uniforms.uTime.value = t; });
  }

  /* ===== MACRO: the moon — low-poly prop ball + halo (plate: 7.5 m disc) ===== */
  const MOON_POS = new THREE.Vector3(X(474), 14, -11.8); /* projects to plate (474,242) */
  {
    const grp = new THREE.Group();
    const mg = jitterByPos(new THREE.IcosahedronGeometry(3.8, 2), 93031, 0.14);
    /* facet grade: lit toward the up-left, shaded lower-right (the plate's read) */
    const geo = facetColors(mg, '#c3cbd9', 93031, 0.10);
    {
      const pos = geo.attributes.position, col = geo.attributes.color;
      const lit = new THREE.Color('#dde1e8'), dark = new THREE.Color('#76829c');
      const L = new THREE.Vector3(-0.55, 0.72, 0.42).normalize();
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(),
            n = new THREE.Vector3();
      for (let f = 0; f < pos.count / 3; f++) {
        a.fromBufferAttribute(pos, f * 3); b.fromBufferAttribute(pos, f * 3 + 1);
        c.fromBufferAttribute(pos, f * 3 + 2);
        n.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
        const k = THREE.MathUtils.clamp(n.dot(L) * 0.5 + 0.5, 0, 1);
        const v = 0.8 + hash3(a.x, a.y, a.z, 93032) * 0.28;
        const cc = dark.clone().lerp(lit, k).multiplyScalar(v);
        for (let kk = 0; kk < 3; kk++) col.setXYZ(f * 3 + kk, cc.r, cc.g, cc.b);
      }
    }
    const moon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    grp.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(215,230,255,0.38)', 'rgba(150,180,255,0)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(10.5);
    grp.add(halo);
    grp.position.copy(MOON_POS);
    track('moon', grp);
    tickers.push((t) => { halo.material.opacity = 0.38 + 0.07 * Math.sin(2 * Math.PI * t / 9.1); });
  }

  /* ===== MESO: THE HEADLAND — massif, buttress, apron, mouth, brow ===== */
  {
    /* the main massif: near-vertical column facets, flat brow plateau at 27.5,
       the glowing recess carved toward the mouth (plan azimuth ~196°) */
    const massifGeo = cragGeo({ seed: 93041, radial: 13, tiers: 6,
      height: CLIFF_TOP, rx: 13.5, rz: 8.2,
      lobes: [[2, 0.13, 0.7], [3, 0.1, 2.4], [5, 0.07, 4.9]],
      notch: [Math.PI * 1.09, 0.3, 0.3],
      taper: 0.9, flare: 1.16, terrace: 0.18, jit: 0.7 });
    massifGeo.translate(20.2, 0, 3.2);
    const massifCol = gradeFacets(massifGeo, '#8f8789', '#31344a', 93042,
      { amount: 0.12, eastDark: 0.8 });
    warmPaint(massifCol, GLOW_POS, 13, '#c07c42', 93043, { fadeY: 12, gain: 1.8 });
    /* the climbing recess wash — the plate's amber chimney above the mouth */
    warmPaint(massifCol, new THREE.Vector3(9.0, 12, 7.5), 10.5, '#b06f38', 93143,
      { gain: 2.0 });
    const massif = new THREE.Mesh(massifCol, flatMat({ vertexColors: true }));
    massif.castShadow = massif.receiveShadow = true;
    track('headland-massif', massif);

    /* the buttress: the tall pale column left of the recess */
    const buttGeo = cragGeo({ seed: 93044, radial: 9, tiers: 5,
      height: 19.0, rx: 3.6, rz: 3.9,
      lobes: [[2, 0.18, 1.6], [4, 0.1, 0.4]],
      taper: 0.82, flare: 1.28, terrace: 0.24, jit: 0.5 });
    buttGeo.translate(2.8, 0, 0.4);
    const buttCol = gradeFacets(buttGeo, '#a29da2', '#454150', 93045, { amount: 0.12 });
    warmPaint(buttCol, GLOW_POS, 9.5, '#c08347', 93046, { fadeY: 15, gain: 1.7 });
    const butt = new THREE.Mesh(buttCol, flatMat({ vertexColors: true }));
    butt.castShadow = butt.receiveShadow = true;
    track('crag-buttress', butt);

    /* the apron: the low mass hosting the cave mouth */
    const apronGeo = cragGeo({ seed: 93047, radial: 9, tiers: 4,
      height: 7.2, rx: 4.6, rz: 3.8,
      lobes: [[3, 0.18, 0.9]],
      taper: 0.8, flare: 1.32, terrace: 0.22, jit: 0.45 });
    apronGeo.translate(8.8, 0, 6.2);
    const apronCol = gradeFacets(apronGeo, '#8b878f', '#3b3e52', 93048, { amount: 0.12, eastDark: 0.5 });
    warmPaint(apronCol, GLOW_POS, 8.5, '#c9863f', 93049, { gain: 1.4 });
    const apron = new THREE.Mesh(apronCol, flatMat({ vertexColors: true }));
    apron.castShadow = apron.receiveShadow = true;
    track('base-apron', apron);

    /* the stepped rocks falling from the mouth to the water — they catch the amber */
    {
      const steps = new THREE.Group();
      [[5.9, 1.7, 6.7, 1.5, 0.55], [6.9, 1.05, 8.1, 1.35, 0.5], [5.4, 0.55, 8.9, 1.15, 0.42],
       [7.6, 0.35, 9.9, 1.05, 0.36], [6.2, 0.14, 10.8, 0.9, 0.3], [4.3, 0.28, 7.8, 0.9, 0.34]]
        .forEach(([x, y, z, s, h], i) => {
          const g = jitterByPos(new THREE.BoxGeometry(s * 1.5, h, s * 1.2, 2, 1, 2), 93110 + i, 0.09);
          const geo = gradeFacets(g, '#a5a1a8', '#3e4152', 93110 + i, { amount: 0.12 });
          warmPaint(geo, GLOW_POS, 7.0, '#e09a4d', 93120 + i);
          const m = new THREE.Mesh(geo, flatMat({ vertexColors: true }));
          m.position.set(x, y, z);
          m.rotation.y = (i * 0.7) % 1.2;
          m.castShadow = m.receiveShadow = true;
          steps.add(m);
        });
      track('mouth-steps', steps);
    }

    /* the cave mouth: an arch of warm-lit stones around a GLOWING doorway,
       two spark motes drifting above it (pure f(simT)) */
    const mouthGrp = new THREE.Group();
    {
      const rnd = mulberry32(93050);
      const AR = 1.35;
      for (let i = 0; i <= 5; i++) {
        const a = Math.PI * (i / 5);
        const g = jitterByPos(new THREE.IcosahedronGeometry(0.55, 1), 93050 + i, 0.12);
        const geo = gradeFacets(g, '#b9a08a', '#4c4150', 93060 + i, { amount: 0.14 });
        warmPaint(geo, new THREE.Vector3(0, 0.7, 0.8), 2.6, '#e8a34f', 93070 + i);
        const rock = new THREE.Mesh(geo, flatMat({ vertexColors: true }));
        rock.position.set(Math.cos(a) * AR, Math.sin(a) * AR * 0.95 + 0.25, (rnd() - 0.5) * 0.4);
        rock.scale.set(0.8 + rnd() * 0.35, 0.7 + rnd() * 0.4, 0.7);
        rock.castShadow = true;
        mouthGrp.add(rock);
      }
      /* the glowing doorway: emissive amber inner face inside a dark socket */
      const sock = new THREE.Mesh(jitterByPos(new THREE.IcosahedronGeometry(1, 1), 93055, 0.1),
        new THREE.MeshBasicMaterial({ color: '#140e08' }));
      sock.scale.set(1.15, 1.3, 0.9);
      sock.position.set(0.2, 0.9, -0.55);
      mouthGrp.add(sock);
      const doorG = new THREE.PlaneGeometry(1.5, 1.9);
      const doorM = new THREE.MeshBasicMaterial({ color: '#ffb968' });
      const door = new THREE.Mesh(doorG, doorM);
      door.position.set(0.1, 0.95, 0.42);
      door.rotation.x = -0.1;
      mouthGrp.add(door);
      tickers.push((t, f) => { doorM.color.setRGB(1 * f, 0.62 * f, 0.3 * f * f); });
      /* spark motes */
      const motes = [];
      for (let k = 0; k < 2; k++) {
        const mote = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture('rgba(255,220,150,1)', 'rgba(255,160,50,0)'),
          blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        mote.scale.setScalar(0.5 + k * 0.2);
        mouthGrp.add(mote);
        motes.push(mote);
      }
      tickers.push((t) => {
        motes[0].position.set(0.3 + 0.2 * Math.sin(t * 0.7), 2.5 + 0.4 * Math.sin(t * 0.53 + 1.2), 0.3);
        motes[1].position.set(-0.2 + 0.25 * Math.sin(t * 0.61 + 2.1), 3.1 + 0.5 * Math.sin(t * 0.44), 0.2);
        motes[0].material.opacity = 0.55 + 0.3 * Math.sin(t * 1.7);
        motes[1].material.opacity = 0.5 + 0.3 * Math.sin(t * 1.3 + 0.8);
      });
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,190,100,0.7)', 'rgba(255,140,40,0)'),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      halo.scale.setScalar(6.5);
      halo.position.set(0, 0.6, 0.4);
      mouthGrp.add(halo);
      tickers.push((t, f) => { halo.material.opacity = 0.34 + 0.3 * (f - 0.86); });
      mouthGrp.position.set(GLOW_POS.x, 0.15, GLOW_POS.z + 0.4);
      mouthGrp.rotation.y = -0.5;           /* the doorway faces the open water, as painted */
    }
    track('cave-mouth', mouthGrp);

    /* succulent rosettes on real ledge shelves (the plate's five clusters) */
    {
      const green = new THREE.Group();
      const shelf = (x, y, z, s, seed) => {
        const g = jitterByPos(new THREE.BoxGeometry(s * 2.0, s * 0.6, s * 1.7, 2, 1, 2), seed, 0.07);
        const m = new THREE.Mesh(gradeFacets(g, '#8a8794', '#3a3d4c', seed, { amount: 0.12 }),
          flatMat({ vertexColors: true }));
        /* the ledge is a POCKET: sunk into the face so only the lip protrudes */
        m.position.set(x + s * 0.25, y, z - s * 0.55);
        m.rotation.y = 0.45;
        m.castShadow = true;
        green.add(m);
        return m;
      };
      /* [anchor px, painted h] -> shelf + rosette pair, plate's five clusters */
      const put = (x, y, z, s, seed, shelfToo = true) => {
        if (shelfToo) shelf(x, y - 0.22 * s, z, s, seed);
        const r = succulent(seed + 1, s);
        r.position.set(x, y, z);
        green.add(r);
        const r2 = succulent(seed + 7, s * 0.62);   /* the plate clusters in pairs */
        r2.position.set(x + s * 0.9, y + 0.04, z + s * 0.35);
        green.add(r2);
      };
      put(2.8, 18.9, 0.6, 1.7, 93131);      /* buttress top (757,208) */
      put(15.6, 16.7, 10.6, 1.9, 93132);    /* mid-face high (905,290) */
      put(18.1, 14.3, 11.4, 1.4, 93133);    /* mid-face low (940,320) */
      put(13.2, 11.1, 12.2, 1.5, 93134);    /* low shelf (875,412) */
      put(12.5, 27.42, 1.2, 1.1, 93135, false); /* the brow tuft (810,120) */
      track('ledge-succulents', green);
    }

    /* brow boulders — the ammunition: big pile clustered top-rear, small stones front */
    const rnd = mulberry32(93051);
    const bG = jitterByPos(new THREE.IcosahedronGeometry(1, 1), 93051, 0.14);
    bG.computeVertexNormals();
    const N = 15;
    const im = new THREE.InstancedMesh(bG, flatMat({ color: '#ffffff' }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
          col = new THREE.Color();
    let placed = 0, guard = 0;
    while (placed < N && guard++ < 300) {
      const big = placed < 5;
      const x = big ? 12 + rnd() * 13 : 8.5 + rnd() * 22;
      const z = big ? -2.5 + rnd() * 5.5 : 3.5 + rnd() * 4.5;
      if (Math.hypot((x - 20.2) / 11.2, (z - 3.2) / 6.8) > 0.9) continue;
      const s = big ? 2.6 + rnd() * 2.1 : 0.55 + rnd() * 0.6;
      e.set(rnd() * 0.5, rnd() * Math.PI, rnd() * 0.5);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, CLIFF_TOP - 0.4 + s * 0.55, z), q,
        new THREE.Vector3(s, s * (0.8 + rnd() * 0.35), s * (0.85 + rnd() * 0.3)));
      im.setMatrixAt(placed, m4);
      im.setColorAt(placed, col.set('#a8abb6').multiplyScalar(0.82 + rnd() * 0.32));
      placed++;
    }
    im.count = placed;
    im.castShadow = true;
    track('brow-boulders', im);

    /* wave-cut rocks at the waterline */
    const base = new THREE.Group();
    [[3.6, 0.25, 9.6, 1.1, 93071], [5.2, 0.2, 11.6, 0.8, 93072],
     [12.4, 0.35, 14.2, 1.4, 93073], [17.8, 0.3, 14.8, 1.0, 93074],
     [34.6, 0.3, 2.4, 1.3, 93075]]
      .forEach(([x, y, z, s, seed]) => {
        const rg = jitterByPos(new THREE.IcosahedronGeometry(1, 1), seed, 0.14);
        const geo = gradeFacets(rg, '#8f929f', '#3a3d4d', seed, { amount: 0.14 });
        warmPaint(geo, new THREE.Vector3(GLOW_POS.x - x, GLOW_POS.y, GLOW_POS.z - z), 6, '#c9863f', seed + 3);
        const r = new THREE.Mesh(geo, flatMat({ vertexColors: true }));
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
  tickers.push((t, f) => { caveGlow.intensity = 95 * f; });

  /* ===== MESO: THE SHIP — the twenty-oarer, 15 m tip-to-tip (the yardstick) ===== */
  const shipGroup = new THREE.Group();
  shipGroup.position.set(shipMid.x, 0, shipMid.z);
  shipGroup.rotation.y = heading;
  const sway = new THREE.Group();
  sway.name = 'ship-sway';
  shipGroup.add(sway);
  const oars = [];
  const HL = SHIP_LEN / 2;                 /* half length — local z, bow +z */
  /* station curves — the hull's own law (loft, not a scaled sphere) */
  const sheerG = (z) => {
    const q = Math.abs(z) / HL;
    const sternK = Math.pow(Math.max(0, -z) / HL, 2.6);
    const bowK = Math.pow(Math.max(0, z) / HL, 3.2);
    return 0.98 + 0.42 * bowK + 1.05 * sternK;
  };
  const halfBeam = (z) => {
    const q = Math.abs(z) / HL;
    return 1.35 * Math.pow(Math.max(1e-4, 1 - Math.pow(q, 2.6)), 0.62) + 0.02;
  };
  const keelY = (z) => {
    const q = Math.abs(z) / HL;
    return -0.55 * Math.pow(Math.max(1e-4, 1 - Math.pow(q, 1.9)), 0.8) + 0.1 * q;
  };
  {
    const loft = (beamK, gDrop, floorY) => {
      const ST = 13, RP = 9;
      const rings = [];
      for (let i = 0; i < ST; i++) {
        const z = -HL + (i / (ST - 1)) * 2 * HL;
        const w = halfBeam(z) * beamK, gy = sheerG(z) - gDrop, ky = Math.max(keelY(z), floorY);
        const row = [];
        for (let j = 0; j < RP; j++) {
          const sgn = (j / (RP - 1)) * 2 - 1;      /* -1 port .. +1 starboard */
          const xx = w * Math.sin(sgn * Math.PI / 2);
          const yy = ky + (gy - ky) * Math.pow(Math.abs(sgn), 1.6);
          row.push(new THREE.Vector3(xx, yy, z));
        }
        rings.push(row);
      }
      const tri = [];
      const quad = (a, b, c, d) => {
        tri.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        tri.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
      };
      for (let i = 0; i < ST - 1; i++)
        for (let j = 0; j < RP - 1; j++)
          quad(rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri), 3));
      return g;
    };
    /* outer strakes — dark walnut */
    const hullG = loft(1.0, 0, -10);
    jitterByPos(hullG, 93081, 0.035);
    const hull = new THREE.Mesh(gradeFacets(hullG, '#b8875a', '#553f2e', 93081,
      { amount: 0.14, gamma: 1.0 }),
      flatMat({ vertexColors: true, side: THREE.DoubleSide,
                emissive: '#170f09', emissiveIntensity: 1 }));
    hull.castShadow = true;
    hull.name = 'hull';
    sway.add(hull);
    /* inner planking — light tan, down to the floorboards */
    const innerG = loft(0.9, 0.05, 0.34);
    jitterByPos(innerG, 93082, 0.03);
    const inner = new THREE.Mesh(facetColors(innerG, '#b5936a', 93082, 0.12),
      flatMat({ vertexColors: true, side: THREE.DoubleSide,
                emissive: '#453218', emissiveIntensity: 1 }));
    inner.name = 'hull-inner';
    sway.add(inner);
    /* gunwale cap rail */
    {
      const tri = [];
      const Nst = 24;
      for (const side of [-1, 1]) {
        for (let i = 0; i < Nst; i++) {
          const z0 = -HL + (i / Nst) * 2 * HL, z1 = -HL + ((i + 1) / Nst) * 2 * HL;
          const w0i = halfBeam(z0) * 0.86, w0o = halfBeam(z0) * 1.06;
          const w1i = halfBeam(z1) * 0.86, w1o = halfBeam(z1) * 1.06;
          const y0 = sheerG(z0) + 0.03, y1 = sheerG(z1) + 0.03;
          const a = new THREE.Vector3(side * w0i, y0, z0), b = new THREE.Vector3(side * w0o, y0, z0),
                c = new THREE.Vector3(side * w1o, y1, z1), d = new THREE.Vector3(side * w1i, y1, z1);
          tri.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
          tri.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
        }
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri), 3));
      const rail = new THREE.Mesh(facetColors(rg, '#3f2c1e', 93083, 0.12),
        flatMat({ vertexColors: true, side: THREE.DoubleSide }));
      sway.add(rail);
    }
    /* deck floorboards: elongated hexagon at gangway height */
    const shape = new THREE.Shape();
    const outline = [[0, -6.9], [0.75, -4.6], [1.06, -1.5], [1.06, 1.5], [0.75, 4.5], [0, 6.7]];
    shape.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i][0], outline[i][1]);
    for (let i = outline.length - 2; i >= 0; i--) shape.lineTo(-outline[i][0], outline[i][1]);
    shape.closePath();
    const dg = new THREE.ShapeGeometry(shape, 4);
    dg.rotateX(-Math.PI / 2);
    dg.scale(1, 1, -1);
    const deck = new THREE.Mesh(facetColors(dg, '#96794f', 93084, 0.1),
      flatMat({ vertexColors: true, side: THREE.DoubleSide,
                emissive: '#2a1f12', emissiveIntensity: 1 }));
    deck.position.y = DECK_Y;
    deck.name = 'deck';
    sway.add(deck);
    /* stern + bow posts (the plate's curls) + the pale bow ram */
    const post = (r, tube, y, z, arc, seed) => {
      const t = new THREE.Mesh(
        facetColors(new THREE.TorusGeometry(r, tube, 6, 10, arc), '#3a2a20', seed, 0.12),
        flatMat({ vertexColors: true }));
      t.rotation.y = Math.PI / 2;
      t.position.set(0, y, z);
      t.castShadow = true;
      sway.add(t);
      return t;
    };
    post(0.66, 0.11, 1.95, -HL + 0.35, Math.PI * 1.3, 93085);   /* sternpost curl */
    post(0.42, 0.09, 1.35, HL - 0.3, Math.PI * 0.85, 93086);    /* bow post */
    const ramG = jitterByPos(new THREE.BoxGeometry(0.34, 0.3, 1.1), 93087, 0.04);
    const ram = new THREE.Mesh(facetColors(ramG, '#c9ccd4', 93087, 0.1),
      flatMat({ vertexColors: true }));
    ram.position.set(0, 0.12, HL - 0.15);
    sway.add(ram);
    /* rower thwarts — 8 stations, side benches, centre gangway clear */
    const OAR_Z = [-4.9, -3.7, -2.5, -1.3, 1.1, 2.3, 3.5, 4.7];
    const benchG = new THREE.BoxGeometry(0.62, 0.07, 0.3);
    const benchM = flatMat({ color: '#6e4a2a' });
    for (const z of OAR_Z) for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(benchG, benchM);
      b.position.set(sx * 0.8, 0.78, z);
      sway.add(b);
    }
    /* mast (8.8 m — the ledger's 112 px) + masthead */
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, MAST_H, 7),
      flatMat({ color: '#4a3226' }));
    mast.position.set(0, DECK_Y + MAST_H / 2, 0.1);
    mast.castShadow = true;
    mast.name = 'mast';
    sway.add(mast);
    const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), flatMat({ color: '#3a281e' }));
    knob.position.set(0, DECK_Y + MAST_H + 0.1, 0.1);
    sway.add(knob);
    /* the yard, high on the mast, raked up toward the bow + the furled sail lobes */
    const YARD_Y = DECK_Y + MAST_H * 0.86, RAKE = 0.24;
    const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 7.0, 6),
      flatMat({ color: '#5a3d28' }));
    spar.rotation.x = Math.PI / 2 - RAKE;
    spar.position.set(0, YARD_Y, 0.1);
    spar.castShadow = true;
    sway.add(spar);
    for (const side of [-1, 1]) {
      const sailG = jitterByPos(new THREE.CylinderGeometry(0.3, 0.52, 2.9, 7, 2), 93088 + side, 0.1);
      sailG.scale(0.72, 1, 1);              /* flatten toward the yard plane */
      const sail = new THREE.Mesh(facetColors(sailG, '#b89a72', 93088 + side, 0.14),
        flatMat({ vertexColors: true }));
      sail.rotation.x = Math.PI / 2 - RAKE;
      const zOff = side * 1.75;
      sail.position.set(0, YARD_Y - 0.52 + Math.sin(RAKE) * zOff, 0.1 + Math.cos(RAKE) * zOff);
      sail.castShadow = true;
      sway.add(sail);
    }
    /* rigging lines (zero triangles): stays + yard lifts + braces */
    const rig = new THREE.BufferGeometry();
    const mh = new THREE.Vector3(0, DECK_Y + MAST_H, 0.1);
    const yardEnd = (s) => new THREE.Vector3(0, YARD_Y + Math.sin(RAKE) * s * 3.5, 0.1 + Math.cos(RAKE) * s * 3.5);
    const L = [];
    const seg = (a, b) => L.push(a.x, a.y, a.z, b.x, b.y, b.z);
    seg(mh, new THREE.Vector3(0, 1.9, -HL + 0.4));
    seg(mh, new THREE.Vector3(0, 1.35, HL - 0.4));
    seg(mh, yardEnd(1));
    seg(mh, yardEnd(-1));
    seg(yardEnd(1), new THREE.Vector3(0.95, DECK_Y + 0.4, 4.4));
    seg(yardEnd(-1), new THREE.Vector3(-0.95, DECK_Y + 0.4, -4.0));
    rig.setAttribute('position', new THREE.BufferAttribute(new Float32Array(L), 3));
    sway.add(new THREE.LineSegments(rig,
      new THREE.LineBasicMaterial({ color: '#b9a67e', transparent: true, opacity: 0.55 })));
    /* THE OARS — 8 + 8, the plate's own rowlock count */
    const shaftG = new THREE.CylinderGeometry(0.045, 0.055, 4.2, 6);
    shaftG.rotateZ(Math.PI / 2);
    shaftG.translate(1.2, 0, 0);           /* pivot at the rowlock: shaft −0.9..3.3 */
    const bladeG = new THREE.BoxGeometry(0.9, 0.06, 0.3);
    bladeG.translate(3.1, 0, 0);
    const oarM = flatMat({ color: '#84643c', emissive: '#1d1508', emissiveIntensity: 1 });
    const bladeM = flatMat({ color: '#c2a166', emissive: '#241b0d', emissiveIntensity: 1 });
    const rnd = mulberry32(93089);
    for (const sx of [1, -1]) {
      for (const z of OAR_Z) {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(shaftG, oarM);
        const blade = new THREE.Mesh(bladeG, bladeM);
        shaft.castShadow = blade.castShadow = true;
        g.add(shaft, blade);
        g.position.set(sx * halfBeam(z) * 0.98, sheerG(z) - 0.02, z);
        g.userData.baseY = sx === 1 ? 0 : Math.PI;
        g.userData.sweepSign = sx;         /* keep port + starboard in fore-aft sync */
        g.userData.stagger = (rnd() - 0.5) * 0.1;
        sway.add(g);
        oars.push(g);
      }
    }
    /* thole pins at every rowlock */
    const pinG = new THREE.CylinderGeometry(0.03, 0.035, 0.22, 5);
    const pinIM = new THREE.InstancedMesh(pinG, flatMat({ color: '#3f2c1e' }), OAR_Z.length * 2);
    const pm = new THREE.Matrix4();
    let pi = 0;
    for (const sx of [-1, 1]) for (const z of OAR_Z) {
      pm.makeTranslation(sx * halfBeam(z) * 0.98, sheerG(z) + 0.12, z + 0.12);
      pinIM.setMatrixAt(pi++, pm);
    }
    sway.add(pinIM);
    /* the steering oar on the stern quarter */
    {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.6, 6),
        flatMat({ color: '#5a3d28' }));
      shaft.position.y = -1.3;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.07),
        flatMat({ color: '#8a6b47' }));
      blade.position.y = -2.9;
      g.add(shaft, blade);
      g.position.set(-1.0, sheerG(-6.4) + 0.15, -6.4);
      g.rotation.z = -0.5;
      g.rotation.x = 0.18;
      sway.add(g);
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
  const moonLight = new THREE.DirectionalLight('#c8d6f2', 1.4);
  /* the plate paints the front-left column faces PALE: the key light stands
     up-left-FRONT of the headland (the painter's moon, not the prop's azimuth) */
  moonLight.position.set(-30, 36, 34);
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
    const hemi = new THREE.HemisphereLight('#3c4a78', '#20294a', 0.95);
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
    deckPathLocal: [[-0.4, DECK_Y, -5.0], [-0.4, DECK_Y, 4.6]],  /* the port gangway */
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
