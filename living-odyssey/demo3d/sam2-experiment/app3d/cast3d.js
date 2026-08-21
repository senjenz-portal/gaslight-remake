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
import { GLTFLoader } from '../../../../app/vendor/loaders/GLTFLoader.js';

/* ---- the measured posture corrections (demo pages + cast.json) ---- */
export const RIGS = {
  ulysses: {
    file: '../ulysses-walk.glb', heightM: 1.75,
    clipCorr: { Spine02: 4, NeckTwist01: 5, Head: 6 },
    restCorr: { NeckTwist01: -3, Head: -3 },
    fwdBind: [0.166, 0, 0.986],
  },
  crew: {
    file: '../../3d/cast/crew-walk.glb', heightM: 1.70,
    clipCorr: { Spine02: 4, NeckTwist01: 5, Head: 6 },
    restCorr: {},
    fwdBind: [0.097, 0, 0.995],
  },
  polyphemus: {
    file: '../polyphemus/polyphemus-walk.glb', heightM: 7.0,
    clipCorr: { Spine02: 4, NeckTwist01: 5, Head: 6 },
    restCorr: {},
    fwdBind: [0.03, 0, 1.0],
  },
  'polyphemus-idle': {
    file: '../polyphemus/polyphemus-idle.glb', heightM: 7.0,
    clipCorr: {},                     /* the idle breathes level — no bow */
    restCorr: {},
    fwdBind: [0.03, 0, 1.0],
  },
  /* THE SEATED GIANT (ledger LEDGER.md L.50-51): the cave mouth is 160 px =
   * 3.7 m, and the giant it seats is "~7 m (300 px standing, ~165 px seated)".
   * Every unit at the `giant-seat` mark is a SEATED unit, so the seat is a rig
   * of its own — same bytes as the idle (bufferFor caches the fetch), posed
   * once at build and grounded on the POSED silhouette.
   *
   * The pose is local-X post-multiplication, the house posture idiom, and the
   * axis is measured, not guessed: every spine and leg bone in this Tripo
   * biped carries local X = world (-1,0,0), so +deg tilts a bone BACKWARD
   * (away from the rig's +Z facing) and -deg tilts it forward. Hip flexion is
   * therefore POSITIVE at the thigh and knee flexion NEGATIVE at the calf; the
   * forward hunch is the POSTURE AMENDMENT's "hunch = character" (he is working
   * over the bowls at his knee), and the neck chain gives the head back toward
   * level so his face still plays to the lens.
   *
   * THE LIMBS DO NOT SHARE THAT AXIS, and round 3 assumed they did. Measured on
   * the rig (tools/ody/_seatpose.mjs --axes), L_Upperarm's local X is
   * (-0.70,-0.69,0.16) and L_Forearm's is (-0.65,-0.75,-0.14): the arm frames
   * follow the limb down the A-pose, 45 deg off every world axis, so a local-X
   * turn swings a hanging arm OUT and UP. That is why the shipped seat threw
   * both arms forward like a sleepwalker and measured 6.85 m across.
   *
   * So the arms and the crossed legs are AIMED instead: seatAim points a bone's
   * own +Y at a world direction (the giant faces +Z, his left is +X), which is
   * exact, reads as intent, and cannot be off by an axis. Aim entries apply in
   * order, parent before child, after the local-X pose.
   *
   * THE SEAT IS ON THE FLOOR, CROSS-LEGGED. Round 3's hips-flexed-90 pose is a
   * CHAIR pose, and there is no chair at the mark: this rig's hip sits at 0.382
   * of stature (a human's is ~0.50), so a chair sit left his rump 1.55 m in the
   * air — the "crouching, not sitting" read. Cross-legged puts the hip at
   * 0.72 m = 0.10 of stature, on the floor, knees out at his sides.
   *
   * THE ARMS DECIDE THE SCALE, and that is not obvious: the plate is an ortho
   * view at 25 deg, so a metre of DEPTH draws sin(25)x43 px of screen HEIGHT.
   * His arm is 2.9 m and his seated shoulder is 2.75 m — point it down and the
   * hand goes through the floor (the grounding law then lifts the whole body
   * off its seat, rump 1.9 m up); point it forward and the hand lands 3.7 m
   * downstage, which is 65 plate px of pure silhouette. Drawn IN over his lap
   * they cost nothing and the bottom of the box goes back to his own knees.
   *
   * MEASURED through this very build path (tools/ody/_seatpose.mjs imports
   * buildActor and measures the plate box at the stage's own seat yaw; then
   * confirmed on the stage by tools/ody/_stageprobe.mjs):
   *   standing 292 px (ledger 300) · seated 183 px (ledger ~165, +11.0%,
   *   inside the perspective law's 12%) · hip 0.72 m · width 4.21 m ·
   *   head pitch +15.5 deg — bowed to the bowls, face still to the lens.
   */
  'polyphemus-seat': {
    file: '../polyphemus/polyphemus-idle.glb', heightM: 7.0,
    clipCorr: {}, restCorr: {},
    fwdBind: [0.03, 0, 1.0],
    seatPose: {
      Waist: -22, Spine01: -18, Spine02: -16,     /* the working hunch (56°) */
      NeckTwist01: 16, NeckTwist02: 14, Head: 12, /* …head back to near level */
      L_Foot: -10, R_Foot: -10,
    },
    seatAim: {                       /* world directions for the bone's own +Y */
      L_Thigh: [0.72, 0.20, 0.66], R_Thigh: [-0.72, 0.20, 0.66], /* knees out */
      L_Calf: [-0.80, -0.20, 0.56],                 /* …shins crossing inward, */
      R_Calf: [0.80, -0.16, 0.66],                  /*    the right one in front */
      L_Upperarm: [0.34, -0.72, 0.61],   /* elbows forward and low, and then */
      R_Upperarm: [-0.34, -0.72, 0.61],
      L_Forearm: [0.16, -0.30, -0.94],   /* …the forearms drawn back over the */
      R_Forearm: [-0.16, -0.30, -0.94],  /*    lap: hands in, not reaching */
    },
  },
  ram: {
    file: '../../3d/cast/ram-walk.glb', lengthM: 105 / 43,   /* the authored anomaly */
    clipCorr: {}, restCorr: {}, fwdBind: [0, 0, 1],
  },
  ewe: {
    file: '../../3d/cast/ram-walk.glb', heightM: 24 / 43,    /* the ewes' stock height */
    clipCorr: {}, restCorr: {}, fwdBind: [0, 0, 1],
    tint: [   /* cast.json ram-flock 'ewe-grey' */
      { match: { sMin: 0.30 }, satMul: 0.55, lightMul: 1.00 },
      { match: {}, lightMul: 1.06 },
    ],
  },
  flock: {
    /* Beat V's streaming males: the same photo-rig at a stock-male height
       between the ewes and the authored great ram — fleece kept warm */
    file: '../../3d/cast/ram-walk.glb', heightM: 30 / 43,
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

/* ------------------------------------------------------------------------ *
 * THE IDENTITY LAW, read off the rig's OWN atlas.
 *
 * A character's identity is a small set of hues — Ulysses is bronze skin at
 * ~19 deg and a crimson chiton at ~344 deg; the giant is warm hide at ~31 deg
 * in an olive tunic at ~45 deg. Those numbers are not authored anywhere: they
 * are a property of the baked base-colour texture, so they are MEASURED from
 * it at boot and become the canon the live render is gated against.
 *
 * The statistic is a circular hue histogram over saturated texels, smoothed,
 * with every local maximum kept (a fixed exclusion window merges skin into
 * tunic when they sit 15 deg apart, which is exactly the giant's case) and
 * each peak refined to the circular MEAN of the texels inside it.
 * ------------------------------------------------------------------------ */
const HUE_BINS = 72;                       /* 5 deg — separates hide from olive */
const HUE_SAT_MIN = 0.12, HUE_L_MIN = 0.06, HUE_L_MAX = 0.97;

/** hue peaks of an RGB pixel list -> [{ hue, frac, n, rgb }], strongest first */
export function huePeaks(list, minFrac = 0.03) {
  const bins = new Float64Array(HUE_BINS);
  const keep = [];
  for (const p of list) {
    const [h, s, l] = rgb2hsl(p[0], p[1], p[2]);
    if (s < HUE_SAT_MIN || l < HUE_L_MIN || l > HUE_L_MAX) continue;
    keep.push([h, p]);
    bins[Math.floor(h / (360 / HUE_BINS)) % HUE_BINS] += 1;
  }
  const tot = keep.length;
  if (tot < 24) return { sat: tot, peaks: [] };
  /* circular 3-bin smoothing (15 deg) — enough to kill JPEG speckle, not
     enough to merge two real garments */
  const sm = new Float64Array(HUE_BINS);
  for (let i = 0; i < HUE_BINS; i++)
    sm[i] = bins[(i + HUE_BINS - 1) % HUE_BINS] + bins[i] + bins[(i + 1) % HUE_BINS];
  const out = [];
  for (let i = 0; i < HUE_BINS; i++) {
    const a = sm[(i + HUE_BINS - 1) % HUE_BINS], b = sm[i], c = sm[(i + 1) % HUE_BINS];
    if (!(b > a && b >= c)) continue;                 /* strict local maximum */
    if (b / (3 * tot) < minFrac) continue;
    const ctr = i * (360 / HUE_BINS) + (360 / HUE_BINS) / 2;
    let sx = 0, sy = 0, n = 0, rs = 0, gs = 0, bs = 0;
    for (const [h, p] of keep) {
      if (Math.abs(((h - ctr) % 360 + 540) % 360 - 180) > 12) continue;
      const rad = h * Math.PI / 180;
      sx += Math.cos(rad); sy += Math.sin(rad); n++;
      rs += p[0]; gs += p[1]; bs += p[2];
    }
    if (!n) continue;
    const hue = ((Math.atan2(sy, sx) * 180 / Math.PI) % 360 + 360) % 360;
    out.push({ hue: +hue.toFixed(1), frac: +(n / tot).toFixed(4), n,
               rgb: [Math.round(rs / n), Math.round(gs / n), Math.round(bs / n)] });
  }
  out.sort((a, b) => b.n - a.n);
  return { sat: tot, peaks: out };
}

/** the same statistic taken off a decoded texture image */
function atlasHues(image, size = 192) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0, size, size);
  const d = g.getImageData(0, 0, size, size).data;
  const list = [];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    list.push([d[i], d[i + 1], d[i + 2]]);
  }
  return huePeaks(list, 0.035);
}

/** circular hue distance in degrees */
export const hueDist = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

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

  /* ---- THE MATERIALS GATE, at boot and HARD ------------------------------
     A rig whose base-colour texture did not decode renders as flat paint under
     any light, and no identity law can be measured on it. That is a build
     failure, not a warning: it throws, the stage never mounts, and the smoke
     reports the boot error instead of shipping a pink giant. The assert is on
     the DECODED IMAGE's dimensions — the only fact that proves the bytes made
     it to the GPU — plus the colour space, because an sRGB atlas sampled as
     linear is the other way this goes wrong silently. */
  if (!mats.length) throw new Error(`cast3d[materials]: ${rigName} has no standard material`);
  const texDims = [];
  for (const m of mats) {
    const img = m.map && m.map.image;
    const w = img && (img.width || img.naturalWidth || 0);
    const h = img && (img.height || img.naturalHeight || 0);
    if (!m.map) throw new Error(
      `cast3d[materials]: ${rigName}/${m.name || 'mat'} has NO baseColor texture`);
    if (!(w >= 8 && h >= 8)) throw new Error(
      `cast3d[materials]: ${rigName}/${m.name || 'mat'} baseColor texture undecoded (${w}x${h})`);
    if (m.map.colorSpace !== THREE.SRGBColorSpace) throw new Error(
      `cast3d[materials]: ${rigName}/${m.name || 'mat'} baseColor colorSpace=`
      + `${m.map.colorSpace} (want ${THREE.SRGBColorSpace})`);
    texDims.push([w, h]);
  }
  /* the canon this rig's live render is gated against (identity law) */
  const canon = atlasHues(mats[0].map.image);

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

    /* THE SEATED POSE. Applied once, on top of clip frame 0, then the mixer is
     * discarded: a standing actor on this stage is already frozen at frame 0
     * (stage3d's step calls mixer.setTime(0) for every 'stand'), so a static
     * seat costs no motion and cannot be overwritten. Ground on the POSED
     * silhouette — hips drop and shins fold, so the sole the build measured
     * standing is not the sole he sits on. */
    if (rig.seatPose || rig.seatAim) {
      for (const [name, deg] of Object.entries(rig.seatPose || {}))
        if (bones[name]) bones[name].quaternion.multiply(qcx(deg));
      /* AIM (parent before child — Object key order is the hierarchy order):
         swing the bone so its own +Y points down a world direction. Exact,
         and immune to the arm frames' 45-degree local axes. */
      const wq = new THREE.Quaternion(), pq = new THREE.Quaternion();
      const cur = new THREE.Vector3(), tgt = new THREE.Vector3();
      const del = new THREE.Quaternion();
      const aimBone = (b, dir) => {
        group.updateMatrixWorld(true);
        b.getWorldQuaternion(wq);
        cur.set(0, 1, 0).applyQuaternion(wq).normalize();
        tgt.copy(dir).normalize();
        del.setFromUnitVectors(cur, tgt);
        b.parent.getWorldQuaternion(pq).invert();
        b.quaternion.copy(pq).multiply(del).multiply(wq);
      };
      for (const [name, dir] of Object.entries(rig.seatAim || {})) {
        if (bones[name]) aimBone(bones[name], new THREE.Vector3(...dir));
      }
      model.position.y -= minSkinY() - group.position.y;
      mixer = null;
    }
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

  /* THE POSED FOOTPRINT. Box3.setFromObject on a SkinnedMesh reports the BIND
     bounds — the skin transform lives on the GPU — so a seated giant measured
     that way hands back a standing A-pose box (4.24 x 1.53 m) and his contact
     shadow comes out a third of his real depth. Sweep the skinned vertices in
     the pose the stage will mount and hand the stage the truth. */
  const skinBox = new THREE.Box3();
  {
    const p = new THREE.Vector3();
    group.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const n = o.geometry.attributes.position.count;
      const stride = Math.max(1, Math.floor(n / 900));
      for (let i = 0; i < n; i += stride) {
        o.getVertexPosition(i, p);
        skinBox.expandByPoint(p.applyMatrix4(o.matrixWorld));
      }
    });
  }
  const skinSize = skinBox.getSize(new THREE.Vector3());

  return { id, rig: rigName, group, model, mixer, clip,
           clipDur: clip ? clip.duration : 0, mats,
           skinSize: [+skinSize.x.toFixed(3), +skinSize.y.toFixed(3),
                      +skinSize.z.toFixed(3)],
           heightM: rig.heightM || null, lengthM: rig.lengthM || null, pitchDeg,
           /* the boot evidence the [materials] gate reads back */
           identity: { tex: texDims, canon: canon.peaks.slice(0, 4), satPx: canon.sat } };
}
