/**
 * plate3d.js — THE PLATE IS THE WORLD.
 *
 * Each set's stage is an ordered sandwich built out of the painting itself:
 *
 *     PLATE BACKDROP  (the full-frame painted plate, its pixels untouched)
 *        3D CAST      (rigged characters, lit from the plate at their mark)
 *     OCCLUDER CARDS  (SAM2-cut foreground layers, one per depth band)
 *
 * THE ORTHO REGISTRATION LAW.  Every set's world is the ledger's own affine
 * plan — X(px) = (px-CX)/S, Z(py) = (py-CY)/(S·sin e) — and the book's camera
 * is ORTHOGRAPHIC at elevation e with no azimuth. Under that projection a
 * ground point at plate (px,py) lands at screen (X(px), -(py-CY)/S): one
 * uniform scale S in BOTH axes, and NO parallax with depth. So a vertical card
 * whose world height is compensated by 1/cos(e) re-projects its slice of the
 * plate onto exactly the plate pixels it was cut from — at ANY depth we choose
 * to stand it. That is what makes the sandwich pixel-exact: we get to pick each
 * card's depth purely for OCCLUSION and pay nothing in registration.
 *
 * THE GROUND-ROW LAW (the pews-front law, generalised by SAM2).  Each cut
 * carries the lowest row of its own silhouette. The card stands, vertical, at
 * that row's depth. An actor whose foot row is upstage of it is behind it at
 * every height; downstage, in front of it at every height. The GPU depth test
 * does the rest — no per-actor z-order bookkeeping anywhere.
 */
import * as THREE from 'three';

export const PLATE_W = 1408, PLATE_H = 768;
/* how far upstage of plate row 0 the backdrop stands (metres) */
const BACKDROP_BEHIND = 14;
/* a card stands a hair upstage of its ground row, so an actor standing ON the
   row is downstage of it — the law's tie-break, and it kills z-fighting */
const GROUND_EPS = 0.03;

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/* one material for backdrop and cards alike: two plate states, crossfaded by
   mixK, so a state change is a dissolve between two paintings and nothing else */
const FRAG = `
uniform sampler2D mapA;
uniform sampler2D mapB;
uniform float mixK;
uniform float uOpacity;
uniform float uGain;
uniform vec3 uFlat;
uniform float uFlatK;
varying vec2 vUv;
void main() {
  vec4 a = texture2D(mapA, vUv);
  vec4 b = texture2D(mapB, vUv);
  vec4 c = mix(a, b, mixK);
  /* uFlatK is the GATE's own switch: paint the card a known flat colour while
     keeping its alpha, so the harness can read the alpha straight off two
     renders. Zero in the book; nothing in the story ever sets it. */
  gl_FragColor = vec4(mix(c.rgb * uGain, uFlat, uFlatK), c.a * uOpacity);
  #include <colorspace_fragment>
}`;

function plateMaterial(texA, texB, { transparent }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      mapA: { value: texA }, mapB: { value: texB },
      mixK: { value: 0 }, uOpacity: { value: 1 }, uGain: { value: 1 },
      uFlat: { value: new THREE.Vector3(1, 1, 1) }, uFlatK: { value: 0 },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: !!transparent,
    depthWrite: !transparent,     /* cards test depth but never write it */
    depthTest: true,
    side: THREE.FrontSide,
  });
}

/** the world's cosine of elevation (cave3d exports SIN_E only) */
function cosE(world) {
  return world.COS_E !== undefined ? world.COS_E : Math.cos(world.ELEV);
}

/**
 * A standing card cut from the plate.
 * @param world  the set's frame { S, SIN_E, ELEV, X(), Z() }
 * @param box    [x0,y0,x1,y1] plate px the cut came from
 * @param z      world depth to stand it at (registration holds for any z)
 */
function standingCard(world, box, z, mat) {
  const [x0, y0, x1, y1] = box;
  const S = world.S, SIN = world.SIN_E, COS = cosE(world);
  const W = (x1 - x0) / S;
  const H = (y1 - y0) / (S * COS);          /* 1/cos(e) — the foreshortening */
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  /* bottom edge must project onto plate row y1: y_b·cos e - z·sin e = -Z(y1)·sin e */
  const yb = SIN * (z - world.Z(y1)) / COS;
  mesh.position.set(world.X((x0 + x1) / 2), yb + H / 2, z);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

/* ------------------------------------------------------------------ blobs */
let BLOB_TEX = null;
function blobTexture() {
  if (BLOB_TEX) return BLOB_TEX;
  const N = 64;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grad.addColorStop(0.00, 'rgba(0,0,0,0.92)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.78, 'rgba(0,0,0,0.16)');
  grad.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, N, N);
  BLOB_TEX = new THREE.CanvasTexture(c);
  BLOB_TEX.colorSpace = THREE.SRGBColorSpace;
  return BLOB_TEX;
}

/**
 * A soft contact shadow laid flat on the plate under an actor. The plate is a
 * painted render with its own shadows; ours only has to seat the character on
 * the floor, so it is a squashed blob, dark and cheap, never a shadow map.
 */
export function makeContactShadow(radiusM) {
  const mat = new THREE.MeshBasicMaterial({
    map: blobTexture(), transparent: true, opacity: 0.42,
    depthWrite: false, depthTest: true, color: 0x000000,
    blending: THREE.NormalBlending, toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * radiusM, 2 * radiusM * 0.62), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = -1;
  m.name = 'contact-shadow';
  return m;
}

/* ------------------------------------------------------------------ set */
export class PlateSet {
  constructor(name, world, entry, textures) {
    this.name = name;
    this.world = world;
    this.entry = entry;
    this.tex = textures;
    this.group = new THREE.Group();
    this.group.name = 'plate-' + name;
    this.states = Object.keys(entry.plate);
    this.stateA = this.states[0];
    this.stateB = this.states[0];
    this.mixK = 0;
    this.mats = [];
    this.layers = {};
    this.patches = {};

    /* --- the backdrop: the whole painting, standing behind everything --- */
    const zBack = world.Z(0) - BACKDROP_BEHIND;
    const bm = plateMaterial(this.tex.plate[this.stateA], this.tex.plate[this.stateA],
                             { transparent: false });
    this.backdrop = standingCard(world, [0, 0, PLATE_W, PLATE_H], zBack, bm);
    this.backdrop.name = 'plate-backdrop';
    this.backdrop.renderOrder = -100;
    this.group.add(this.backdrop);
    this.mats.push({ mat: bm, kind: 'plate' });

    /* --- the occluder cards, one per depth band --- */
    for (const L of entry.layers) {
      const t = this.tex.layers[L.id];
      const first = L.states ? L.states[0] : Object.keys(t)[0];
      const m = plateMaterial(t[first], t[first], { transparent: true });
      const z = world.Z(L.ground) - GROUND_EPS;
      const mesh = standingCard(world, L.box, z, m);
      mesh.name = 'occluder-' + L.id;
      mesh.renderOrder = 10 + L.band;
      this.group.add(mesh);
      this.layers[L.id] = { mesh, mat: m, tex: t, band: L.band, ground: L.ground,
                            box: L.box, z, states: Object.keys(t) };
      this.mats.push({ mat: m, kind: 'layer', id: L.id });
    }

    /* --- derived hole patches: a moving prop's painted bed, faded in only
           when the prop actually leaves (never written into the plate) --- */
    for (const P of entry.patches || []) {
      const t = this.tex.patches[P.id];
      const m = plateMaterial(t, t, { transparent: true });
      m.uniforms.uOpacity.value = 0;
      const mesh = standingCard(world, P.box, world.Z(P.ground) - GROUND_EPS * 2, m);
      mesh.name = 'patch-' + P.id;
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.patches[P.id] = { mesh, mat: m };
    }

    this.setState(this.stateA, 1);
  }

  /** crossfade the whole sandwich to a plate state (k<1 = mid-dissolve) */
  setState(name, k = 1) {
    if (!this.tex.plate[name]) return this.stateB;
    if (name !== this.stateB) {
      this.stateA = this.stateB;
      this.stateB = name;
    }
    this.mixK = Math.max(0, Math.min(1, k));
    const A = this.stateA, B = this.stateB;
    this.backdrop.material.uniforms.mapA.value = this.tex.plate[A];
    this.backdrop.material.uniforms.mapB.value = this.tex.plate[B];
    this.backdrop.material.uniforms.mixK.value = this.mixK;
    for (const id of Object.keys(this.layers)) {
      const L = this.layers[id];
      const hasA = !!L.tex[A], hasB = !!L.tex[B];
      /* a layer the state does not carry (the shut boulder at dawn) leaves the
         sandwich entirely — it must stop occluding, not just stop showing */
      L.mat.uniforms.mapA.value = L.tex[hasA ? A : B];
      L.mat.uniforms.mapB.value = L.tex[hasB ? B : A];
      L.mat.uniforms.mixK.value = hasA && hasB ? this.mixK : (hasB ? 1 : 0);
      const op = (hasA ? 1 - this.mixK : 0) + (hasB ? this.mixK : 0);
      L.mat.uniforms.uOpacity.value = op;
      L.mesh.visible = op > 0.004;
    }
    return this.stateB;
  }

  /** fade a derived hole patch in/out (0..1) */
  setPatch(id, k) {
    const P = this.patches[id];
    if (!P) return;
    P.mat.uniforms.uOpacity.value = Math.max(0, Math.min(1, k));
    P.mesh.visible = P.mat.uniforms.uOpacity.value > 0.004;
  }

  /** global exposure on the painted layers (the blinding flare, the dim) */
  setGain(g) {
    for (const m of this.mats) m.mat.uniforms.uGain.value = g;
  }

  /** the depth an actor standing on plate row py occupies */
  depthOf(py) { return this.world.Z(py); }

  /** ordered census for the harness */
  census() {
    return Object.keys(this.layers).map((id) => {
      const L = this.layers[id];
      return { id, band: L.band, ground: L.ground, box: L.box,
               z: +L.z.toFixed(4), states: L.states };
    }).sort((a, b) => a.band - b.band);
  }
}

/* ------------------------------------------------------------------ load */
const _texCache = new Map();
function loadTex(loader, url) {
  if (_texCache.has(url)) return _texCache.get(url);
  const p = new Promise((res, rej) => {
    loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = 4;
      t.needsUpdate = true;
      res(t);
    }, undefined, rej);
  });
  _texCache.set(url, p);
  return p;
}

/**
 * Build a set's plate sandwich from the cut registry.
 * @param name     'cave' | 'shore' | 'sea'
 * @param world    the set module's exported frame
 * @param registry the parsed 3d/layers.json
 * @param base     path prefix for the registry's relative files
 */
export async function loadPlateSet(name, world, registry, base = './') {
  const entry = registry.sets[name];
  if (!entry) throw new Error('plate3d: no layer registry for ' + name);
  const loader = new THREE.TextureLoader();
  const jobs = [];
  const tex = { plate: {}, layers: {}, patches: {} };
  for (const [st, meta] of Object.entries(entry.plate)) {
    jobs.push(loadTex(loader, base + meta.file).then((t) => { tex.plate[st] = t; }));
  }
  for (const L of entry.layers) {
    tex.layers[L.id] = {};
    for (const [st, file] of Object.entries(L.files)) {
      jobs.push(loadTex(loader, base + file).then((t) => { tex.layers[L.id][st] = t; }));
    }
  }
  for (const P of entry.patches || []) {
    jobs.push(loadTex(loader, base + P.file).then((t) => { tex.patches[P.id] = t; }));
  }
  await Promise.all(jobs);
  return new PlateSet(name, world, entry, tex);
}

/* ------------------------------------------------------------ plate light */
/**
 * THE REGRADE LAW ON 3D LIGHTING. platelight.json holds the plate's own ring
 * colour on a coarse grid per state; this samples it bilinearly at a plate
 * point so a character's key light is the light the painter put there.
 */
export function samplePlateLight(table, setName, state, px, py) {
  const s = table.sets[setName];
  const st = s && (s.states[state] || s.states[Object.keys(s.states)[0]]);
  if (!st) return { rgb: [128, 128, 128], lum: 128 };
  const g = table.gridPx;
  const fx = Math.min(st.gridW - 1.001, Math.max(0, px / g - 0.5));
  const fy = Math.min(st.gridH - 1.001, Math.max(0, py / g - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const x1 = Math.min(st.gridW - 1, x0 + 1), y1 = Math.min(st.gridH - 1, y0 + 1);
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = st.grid[y0][x0][c] * (1 - tx) + st.grid[y0][x1][c] * tx;
    const b = st.grid[y1][x0][c] * (1 - tx) + st.grid[y1][x1][c] * tx;
    out[c] = a * (1 - ty) + b * ty;
  }
  return { rgb: out, lum: 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2] };
}
