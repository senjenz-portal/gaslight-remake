/**
 * cast3d.js — the STORY stage's actor factory: the photo-rig GLBs placed in
 * the SETS' OWN METRIC WORLDS (shore 11.3 px/m, cave 43 px/m, sea 12.7 px/m
 * — each world's X/Z already divides the ledger's px by its own scale, so an
 * actor built at his real height in metres IS the ledger's honest pixel
 * height on every set; the shore's dual-scale mainland ruling is the one
 * exception and is applied as a local scale factor by the stage).
 *
 * THE POSTURE LAW travels with the registry (3d/cast.json + the demo pages'
 * measured corrections, tools/rigpitch.py): corrective rest rotations on the
 * bind pose, per-key local-X counter-rotations baked into the walk clip's
 * quaternion tracks (slerp is right-invariant, so post-multiplication is
 * exact). Standing pitch ±5°, walk head-pitch ≤12° — the numbers the demo
 * gates measured are reproduced here because the same corrections are
 * applied to the same bytes.
 *
 * DETERMINISM: nothing here reads a clock. The mixer is driven by the stage
 * with absolute story time; the tint pass is a pure function of the texture
 * bytes and the recipe (cast.json's ewe-grey / slate-elder ops).
 */
import * as THREE from 'three';
import { GLTFLoader } from '../../../app/vendor/loaders/GLTFLoader.js';

/* ---- the measured posture corrections (demo pages + cast.json) ---- */
export const RIGS = {
  ulysses: {
    file: '../demo3d/ulysses-walk.glb', heightM: 1.75,
    clipCorr: { Spine02: 4, NeckTwist01: 5, Head: 6 },
    restCorr: { NeckTwist01: -3, Head: -3 },
    fwdBind: [0.166, 0, 0.986],
  },
  crew: {
    file: 'cast/crew-walk.glb', heightM: 1.70,
    clipCorr: { Spine02: 4, NeckTwist01: 5, Head: 6 },
    restCorr: {},
    fwdBind: [0.097, 0, 0.995],
  },
  polyphemus: {
    file: '../demo3d/polyphemus/polyphemus-walk.glb', heightM: 7.0,
    clipCorr: { Spine02: 4, NeckTwist01: 5, Head: 6 },
    restCorr: {},
    fwdBind: [0.03, 0, 1.0],
  },
  'polyphemus-idle': {
    file: '../demo3d/polyphemus/polyphemus-idle.glb', heightM: 7.0,
    clipCorr: {},                     /* the idle breathes level — no bow */
    restCorr: {},
    fwdBind: [0.03, 0, 1.0],
  },
  ram: {
    file: 'cast/ram-walk.glb', lengthM: 105 / 43,   /* the authored anomaly */
    clipCorr: {}, restCorr: {}, fwdBind: [0, 0, 1],
  },
  ewe: {
    file: 'cast/ram-walk.glb', heightM: 24 / 43,    /* the ewes' stock height */
    clipCorr: {}, restCorr: {}, fwdBind: [0, 0, 1],
    tint: [   /* cast.json ram-flock 'ewe-grey' */
      { match: { sMin: 0.30 }, satMul: 0.55, lightMul: 1.00 },
      { match: {}, lightMul: 1.06 },
    ],
  },
  flock: {
    /* Beat V's streaming males: the same photo-rig at a stock-male height
       between the ewes and the authored great ram — fleece kept warm */
    file: 'cast/ram-walk.glb', heightM: 30 / 43,
    clipCorr: {}, restCorr: {}, fwdBind: [0, 0, 1],
  },
};

/* ---- the tint engine (cast.json recipes are DATA, not second builds) ---- */
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}
function matchWin([h, s, l], m) {
  if (m.hMin !== undefined && h < m.hMin) return false;
  if (m.hMax !== undefined && h > m.hMax) return false;
  if (m.sMin !== undefined && s < m.sMin) return false;
  if (m.sMax !== undefined && s > m.sMax) return false;
  if (m.lMin !== undefined && l < m.lMin) return false;
  if (m.lMax !== undefined && l > m.lMax) return false;
  return true;
}
function tintedTexture(srcTex, ops) {
  const img = srcTex.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const hsl = rgb2hsl(p[i], p[i + 1], p[i + 2]);
    for (const op of ops) {
      if (!matchWin(hsl, op.match || {})) continue;
      const h2 = op.hueTo !== undefined ? op.hueTo : hsl[0];
      const s2 = Math.min(1, hsl[1] * (op.satMul !== undefined ? op.satMul : 1));
      const l2 = Math.min(1, hsl[2] * (op.lightMul !== undefined ? op.lightMul : 1));
      const [r, gg, b] = hsl2rgb(h2, s2, l2);
      p[i] = r; p[i + 1] = gg; p[i + 2] = b;
      break;
    }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = srcTex.flipY;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = srcTex.wrapS; t.wrapT = srcTex.wrapT;
  return t;
}

const qcx = (deg) => new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(deg));

const loader = new GLTFLoader();
const buffers = {};
async function bufferFor(url) {
  if (!buffers[url]) buffers[url] = await (await fetch(url)).arrayBuffer();
  return buffers[url];
}

/**
 * Build one actor instance. Returns:
 *   { id, group, model, mixer, clip, clipDur, mats, heightM, pitchDeg() }
 * The group's origin is the actor's ANIMATED SOLE (the grounding law: the
 * clip is swept for its lowest skinned vertex and the model lifted so the
 * lowest animated point meets y=0 — the King demo's law, mesh-accurate).
 */
export async function buildActor(rigName, id) {
  const rig = RIGS[rigName];
  const buf = await bufferFor(rig.file);
  const gltf = await new Promise((res, rej) => loader.parse(buf.slice(0), '', res, rej));
  const model = gltf.scene;
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });

  /* posture law: rest first, then the clip's own tracks */
  for (const [name, deg] of Object.entries(rig.restCorr || {}))
    if (bones[name]) bones[name].quaternion.multiply(qcx(deg));
  const clip = gltf.animations[0] || null;
  if (clip) {
    for (const track of clip.tracks) {
      const m = track.name.match(/(?:^|[/.])([A-Za-z0-9_]+)\.quaternion$/);
      if (!m || !((rig.clipCorr || {})[m[1]])) continue;
      const c = qcx(rig.clipCorr[m[1]]), q = new THREE.Quaternion();
      for (let i = 0; i < track.values.length; i += 4)
        q.fromArray(track.values, i).multiply(c).toArray(track.values, i);
    }
  }

  /* honest metric scale (height or length in METRES — the worlds divide by
     the ledger's own px/m, so this IS the ledger's pixel law per set) */
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = rig.heightM !== undefined
    ? rig.heightM / size.y
    : rig.lengthM / Math.max(size.x, size.z);
  model.scale.setScalar(s);
  const b = new THREE.Box3().setFromObject(model);
  const center = b.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= b.min.y;
  model.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; });

  /* material hygiene + tint + fade registry */
  const mats = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || !m.isMeshStandardMaterial) continue;
      if (rig.tint && m.map) m.map = tintedTexture(m.map, rig.tint);
      m.metalness = 0;
      m.roughness = Math.min(m.roughness, 0.9);
      m.transparent = true;
      m.needsUpdate = true;
      mats.push(m);
    }
  });

  const group = new THREE.Group();
  group.name = 'actor-' + id;
  group.add(model);
  group.visible = false;

  /* grounding law, mesh-accurate: sweep the skinned vertices through the clip */
  let mixer = null;
  if (clip) {
    const skins = [];
    model.traverse((o) => { if (o.isSkinnedMesh) skins.push(o); });
    mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clip).play();
    const v = new THREE.Vector3();
    const minSkinY = () => {
      group.updateMatrixWorld(true);
      let min = Infinity;
      for (const sm of skins) {
        const n = sm.geometry.attributes.position.count;
        const stride = Math.max(1, Math.floor(n / 600));
        for (let i = 0; i < n; i += stride) {
          sm.getVertexPosition(i, v);
          v.applyMatrix4(sm.matrixWorld);
          if (v.y < min) min = v.y;
        }
      }
      return min;
    };
    let minY = Infinity;
    for (let i = 0; i <= 16; i++) {
      mixer.setTime((i / 16) * clip.duration);
      minY = Math.min(minY, minSkinY());
    }
    mixer.setTime(0);
    model.position.y -= minY - group.position.y;
  }

  /* posture instrument (the smoke gate can read it) */
  const fwd = new THREE.Vector3(...(rig.fwdBind || [0, 0, 1])).normalize();
  const headBone = bones.Head || bones.tripoHead_2 || null;
  const _q = new THREE.Quaternion(), _qm = new THREE.Quaternion(), _v = new THREE.Vector3();
  const pitchDeg = () => {
    if (!headBone) return null;
    group.updateMatrixWorld(true);
    headBone.getWorldQuaternion(_q);
    model.getWorldQuaternion(_qm).invert();
    _q.premultiply(_qm);
    _v.set(0, 1, 0).applyQuaternion(_q);
    return +THREE.MathUtils.radToDeg(Math.atan2(_v.dot(fwd), _v.y)).toFixed(2);
  };

  return { id, rig: rigName, group, model, mixer, clip,
           clipDur: clip ? clip.duration : 0, mats,
           heightM: rig.heightM || null, lengthM: rig.lengthM || null, pitchDeg };
}
