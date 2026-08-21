/**
 * actor3d.js — THE CAST, mounted the demo's way.
 *
 * The photo-rig GLBs are signed-off artifacts and they arrive here with the
 * demo's own build path, not a new one:
 *
 *   POSTURE LAW    the measured local-X corrections from the demo pages —
 *                  rest corrections onto the bind pose, clip corrections
 *                  baked into the walk's quaternion tracks
 *                  (demo3d/full3d/index.html lines 149-171).
 *   SCALE          the actor is fitted in METRES against the scale authority's
 *                  size table, centred on X/Z and set on the floor plane
 *                  (full3d lines 182-189) — the world IS the ledger's scale.
 *   GROUNDING LAW  the clip is swept and the model lifted so the LOWEST
 *                  ANIMATED point meets y=0. Mesh-accurate (skinned vertices,
 *                  not foot bones) — the house law the cast page shipped.
 *   MATERIALS      render3d.dressActorMaterials — the demo's exact treatment:
 *                  matte, transparent for the walk fade, shadow-casting into
 *                  the one caster the set declares.
 *   POSTURE PROBE  head pitch in degrees about the rig's own forward bind,
 *                  so the posture law can be re-measured in situ by the smoke.
 *
 * The RIG TABLE below is carried verbatim from the signed-off cast registry
 * (3d/cast.json + the demo pages' measured corrections). The SIZES, however,
 * are the scale authority's: kinds, not plate pixels. The flock used to be
 * fitted from plate px (a 0.56 m "ewe"); it is now a 1.0 m sheep because
 * world.js says a sheep is 1.0 m.
 */
import * as THREE from 'three';
import { GLTFLoader } from '../../../app/vendor/loaders/GLTFLoader.js';
import { dressActorMaterials } from './render3d.js';
import { SIZE_TABLE } from './world.js';

/* ---- the rig registry: file + measured posture + the kind it is ---- */
export const RIGS = {
  ulysses: {
    file: '../demo3d/ulysses-walk.glb', kind: 'human', heightM: 1.75,
    clipCorr: { Spine02: 4, NeckTwist01: 5, Head: 6 },
    restCorr: { NeckTwist01: -3, Head: -3 },
    fwdBind: [0.166, 0, 0.986],
  },
  crew: {
    file: 'cast/crew-walk.glb', kind: 'human', heightM: 1.70,
    clipCorr: { Spine02: 4, NeckTwist01: 5, Head: 6 },
    restCorr: {},
    fwdBind: [0.097, 0, 0.995],
  },
  polyphemus: {
    file: '../demo3d/polyphemus/polyphemus-walk.glb', kind: 'giant', heightM: 7.0,
    clipCorr: { Spine02: 4, NeckTwist01: 5, Head: 6 },
    restCorr: {},
    fwdBind: [0.03, 0, 1.0],
  },
  'polyphemus-idle': {
    file: '../demo3d/polyphemus/polyphemus-idle.glb', kind: 'giant', heightM: 7.0,
    clipCorr: {}, restCorr: {},            /* the idle breathes level — no bow */
    fwdBind: [0.03, 0, 1.0],
  },
  /* THE SEATED GIANT. Every unit at the ledger's `giant-seat` mark is a SEATED
   * unit — the cave's vault is 5.4 m and he is 7 m, so standing inside is not a
   * pose the room has. The seat is carried verbatim from the signed-off cast
   * build (measured on the rig by tools/ody/_seatpose.mjs): local-X posture on
   * the spine chain, and AIMED limbs (point the bone's own +Y down a world
   * direction) because this Tripo rig's arm frames sit 45° off every world
   * axis. Cross-legged on the floor — hip at 0.10 of stature — and the
   * forearms drawn back over the lap so the hands do not go through the floor. */
  'polyphemus-seat': {
    file: '../demo3d/polyphemus/polyphemus-idle.glb', kind: 'giant', heightM: 7.0,
    clipCorr: {}, restCorr: {}, fwdBind: [0.03, 0, 1.0],
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
  'ram-great': {
    file: 'cast/ram-walk.glb', kind: 'ram-great', heightM: SIZE_TABLE['ram-great'].m,
    clipCorr: {}, restCorr: {}, fwdBind: [0, 0, 1], quadruped: true,
  },
  ewe: {
    file: 'cast/ram-walk.glb', kind: 'sheep', heightM: SIZE_TABLE.sheep.m,
    clipCorr: {}, restCorr: {}, fwdBind: [0, 0, 1], quadruped: true,
  },
};

const qcx = (deg) => new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(deg));

const loader = new GLTFLoader();
const buffers = new Map();
async function bufferFor(url) {
  if (!buffers.has(url)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`actor GLB ${url} -> HTTP ${r.status}`);
    buffers.set(url, await r.arrayBuffer());
  }
  return buffers.get(url);
}

/**
 * Build one actor. Returns
 *   { id, rig, kind, group, model, mixer, clip, clipDur, mats, heightM,
 *     pitchDeg(), setFade(k) }
 * The group's origin is the animated SOLE at y = 0, centred on X/Z.
 */
export async function buildActor(rigName, id = rigName) {
  const rig = RIGS[rigName];
  if (!rig) throw new Error(`unknown rig "${rigName}"`);
  const buf = await bufferFor(rig.file);
  const gltf = await new Promise((res, rej) => loader.parse(buf.slice(0), '', res, rej));
  const model = gltf.scene;
  const clip = gltf.animations[0] || null;

  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });

  /* ---- POSTURE LAW: the rest pose first, then the clip's own tracks ---- */
  for (const [name, deg] of Object.entries(rig.restCorr || {}))
    if (bones[name]) bones[name].quaternion.multiply(qcx(deg));
  if (clip) {
    for (const track of clip.tracks) {
      const m = track.name.match(/(?:^|[/.])([A-Za-z0-9_]+)\.quaternion$/);
      if (!m || !(rig.clipCorr || {})[m[1]]) continue;
      const c = qcx(rig.clipCorr[m[1]]), q = new THREE.Quaternion();
      for (let i = 0; i < track.values.length; i += 4)
        q.fromArray(track.values, i).multiply(c).toArray(track.values, i);
    }
  }

  const group = new THREE.Group();
  group.name = id;
  group.add(model);

  /* ---- SCALE + SEAT: metres off the size table, centred, sole to y=0 ---- */
  const H = rig.heightM;
  const box0 = new THREE.Box3().setFromObject(model);
  model.scale.setScalar(H / (box0.max.y - box0.min.y));
  const b = new THREE.Box3().setFromObject(model);
  const centre = b.getCenter(new THREE.Vector3());
  model.position.x -= centre.x;
  model.position.z -= centre.z;
  model.position.y -= b.min.y;

  /* ---- MATERIALS: the demo's treatment, verbatim ---- */
  const mats = dressActorMaterials(model);

  /* ---- GROUNDING LAW: sweep the clip, lift onto the lowest animated point ---- */
  const skins = [];
  model.traverse((o) => { if (o.isSkinnedMesh) skins.push(o); });
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

  let mixer = null;
  if (clip) {
    mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clip).play();
    let minY = Infinity;
    for (let i = 0; i <= 16; i++) {
      mixer.setTime((i / 16) * clip.duration);
      minY = Math.min(minY, minSkinY());
    }
    mixer.setTime(0);
    model.position.y -= minY - group.position.y;
  }

  /* ---- THE SEAT: posed once on top of frame 0, then the mixer is dropped.
     Ground on the POSED silhouette — the hips drop and the shins fold, so the
     sole he stood on is not the sole he sits on. ---- */
  if (rig.seatPose || rig.seatAim) {
    for (const [name, deg] of Object.entries(rig.seatPose || {}))
      if (bones[name]) bones[name].quaternion.multiply(qcx(deg));
    const wq = new THREE.Quaternion(), pq = new THREE.Quaternion();
    const curV = new THREE.Vector3(), tgt = new THREE.Vector3(), del = new THREE.Quaternion();
    const aimBone = (b, dir) => {            /* swing the bone's own +Y onto dir */
      group.updateMatrixWorld(true);
      b.getWorldQuaternion(wq);
      curV.set(0, 1, 0).applyQuaternion(wq).normalize();
      tgt.copy(dir).normalize();
      del.setFromUnitVectors(curV, tgt);
      b.parent.getWorldQuaternion(pq).invert();
      b.quaternion.copy(pq).multiply(del).multiply(wq);
    };
    for (const [name, dir] of Object.entries(rig.seatAim || {}))
      if (bones[name]) aimBone(bones[name], new THREE.Vector3(...dir));
    model.position.y -= minSkinY() - group.position.y;
    mixer = null;                            /* a seat does not walk */
  }

  /* ---- POSTURE PROBE: head pitch about the rig's own forward bind ---- */
  const FWD = new THREE.Vector3(...(rig.fwdBind || [0, 0, 1])).normalize();
  const head = bones.Head || bones.head || null;
  const _q = new THREE.Quaternion(), _qm = new THREE.Quaternion(), _v = new THREE.Vector3();
  const pitchDeg = () => {
    if (!head) return null;
    group.updateMatrixWorld(true);
    head.getWorldQuaternion(_q);
    model.getWorldQuaternion(_qm).invert();
    _q.premultiply(_qm);
    _v.set(0, 1, 0).applyQuaternion(_q);
    return +THREE.MathUtils.radToDeg(Math.atan2(_v.dot(FWD), _v.y)).toFixed(2);
  };

  const setFade = (k) => { for (const m of mats) m.opacity = k; };
  setFade(1);

  return {
    id, rig: rigName, kind: rig.kind, group, model, mixer, clip,
    clipDur: clip ? clip.duration : 0, mats, heightM: H, pitchDeg, setFade,
  };
}
