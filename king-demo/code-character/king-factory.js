/* king-factory.js — THE KING, authored in native Three.js code. v2: the DENSE track.
 *
 * img2threejs character method, implicit-surface route (the track the method's own character
 * contract prescribes for L0 core volumes: "Implicit SDF smooth-union → marching cubes",
 * grimoire/character/structure_decomposition.md). v1 of this page built the King as ~45
 * primitive shells on the assembly track at the low tier (3,624 tris) — a wrongly imposed
 * "low-poly register". v2 replaces the geometry track: king2-rigged.glb was dense-sampled
 * OFFLINE into a 1.4M-point cloud (tools/ody/work/kingsdf/build_field.py), turned into a
 * signed-distance + palette + part + skin-weight field (king-field.bin), and the smooth
 * organic surface is reconstructed HERE, in code, by marching cubes (king-sdf.js) at the
 * medium tier (~50-80k tris standard, low-tier grid as the second LOD). No GLB, no mesh
 * file is loaded at runtime — the field is data, every triangle is made in the browser.
 *
 * The skeleton, proportion law, walk/idle animator, explode/parts/pick contracts are the
 * shipped v1 harness, unchanged where they were right.
 */
import * as THREE from 'three';
import { loadKingField, kingFieldOrThrow, buildKingParts, makeExplodable } from './king-sdf.js';

export { loadKingField };

/* ---------------- measured reconstruction data (from the sculpt spec) ---------------- */

export const KING_DATA = {
  totalHeight: 1.80,           // world units
  headUnits: 5.53,             // measured off king2-look.png (713px / 129px)
  // normalized landmark heights measured from king2-rigged.glb skeleton (the 8% law)
  landmarks: {
    ankle: 0.066, knee: 0.278, hips: 0.526,
    shoulder: 0.774, neck: 0.813, headJoint: 0.865, crown: 1.0,
    shoulderHalfSpanX: 0.1174, hipHalfSpanX: 0.0523,
  },
  face: { // normalized to head bbox, crown=0 → chin=1 (bust-head-grid.png read)
    hairline: 0.27, browLine: 0.44, eyeLine: 0.56,
    noseBase: 0.79, mouthLine: 0.89,
    pupilHalfSpacing: 0.185,
    headWidthOverHeight: 0.75, headDepthOverHeight: 0.90,
  },
  palette: { // king2-look.png sampled accents (v1); v2 carries the full 28-colour quantized
    skin: 0xefc49b, skinShadow: 0xc99b72, hair: 0x20202a,        // palette in king-field.bin
    shirt: 0xf0e6cf, vest: 0xe9dcc0, cravat: 0x2a3453,
    coat: 0x3d4a6b, coatDark: 0x2c3552,
    lining: 0xe8722a, liningDeep: 0xc8511f, piping: 0xf08033,
    trousers: 0x252c45, boots: 0x181a22, brass: 0xc9a24b,
  },
};

const H = KING_DATA.totalHeight;
const LM = {}; for (const [k, v] of Object.entries(KING_DATA.landmarks)) LM[k] = v * H;

/* skinIndex order — MUST match build_field.py's OUR list (baked into king-field.bin header.joints) */
const SKIN_BONES = ['hips','spine','chest','neck','head',
  'shoulder-l','elbow-l','wrist-l','hip-l','knee-l','ankle-l',
  'shoulder-r','elbow-r','wrist-r','hip-r','knee-r','ankle-r',
  'coat-root','coat-mid','coat-hem'];

/* quality tiers — the field marched at runtime: standard = body+head grids (medium tier),
 * low = one coarse grid (the method's low tier as second LOD) */
export const QUALITY_TIERS = { standard: ['body', 'head'], low: ['low'] };

/* ---------------- materials: realistic register, palette via vertex colours ---------------- */

function materialFor(name) {
  const std = (rough, extra = {}) => new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: rough, metalness: 0.0, ...extra });
  switch (name) {
    case 'head': case 'hand-l': case 'hand-r': return std(0.62);
    case 'hair': return std(0.78);
    case 'coat': case 'coat-lining': return std(0.88);
    case 'vest': return std(0.78);
    case 'cravat': return std(0.82);
    case 'sleeve-l': case 'sleeve-r': return std(0.8);
    case 'trousers': return std(0.9);
    case 'boot-l': case 'boot-r': return std(0.45);
    case 'buttons': return std(0.38, { metalness: 0.85 });
    default: return std(0.8);
  }
}

/* ---------------- the factory ---------------- */

export function createKingModel(quality = 'standard') {
  const header = kingFieldOrThrow();
  const fieldNames = QUALITY_TIERS[quality] || QUALITY_TIERS.standard;
  const root = new THREE.Group();
  root.name = 'the-king';

  /* ---- skeleton (real THREE.Bone hierarchy, spec rig — unchanged v1 harness) ---- */
  const bone = (name, x, y, z, parent) => {
    const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z);
    if (parent) parent.add(b);
    return b;
  };
  const hips = bone('hips', 0, LM.hips, 0, null);
  const spine = bone('spine', 0, 0.10, 0.005, hips);
  const chest = bone('chest', 0, 0.22, 0.005, spine);
  const neckB = bone('neck', 0, LM.neck - (LM.hips + 0.32), -0.01, chest);
  const headB = bone('head', 0, LM.headJoint - LM.neck, 0.01, neckB);
  const bones = { hips, spine, chest, neck: neckB, head: headB };
  const chestWorldY = LM.hips + 0.32;
  for (const s of ['l', 'r']) {
    const sx = s === 'l' ? 1 : -1;
    const sh = bone('shoulder-' + s, sx * LM.shoulderHalfSpanX, LM.shoulder - chestWorldY, 0, chest);
    const el = bone('elbow-' + s, sx * 0.012, -(LM.shoulder - 1.13 * H / 1.8), 0, sh);
    const wr = bone('wrist-' + s, sx * 0.008, -0.23, 0.01, el);
    const hipJ = bone('hip-' + s, sx * LM.hipHalfSpanX, 0, 0, hips);
    const kn = bone('knee-' + s, sx * 0.004, -(LM.hips - LM.knee), 0.005, hipJ);
    const an = bone('ankle-' + s, 0, -(LM.knee - LM.ankle), -0.005, kn);
    Object.assign(bones, { ['shoulder-' + s]: sh, ['elbow-' + s]: el, ['wrist-' + s]: wr,
      ['hip-' + s]: hipJ, ['knee-' + s]: kn, ['ankle-' + s]: an });
  }
  // coat sway chain (cross-joint shell L4 keeps its own small-envelope bones)
  const coatRoot = bone('coat-root', 0, LM.shoulder - chestWorldY + 0.02, -0.02, chest);
  const coatMid = bone('coat-mid', 0, -0.55, -0.02, coatRoot);
  const coatHem = bone('coat-hem', 0, -0.45, -0.01, coatMid);
  Object.assign(bones, { 'coat-root': coatRoot, 'coat-mid': coatMid, 'coat-hem': coatHem });
  root.add(hips);
  root.updateMatrixWorld(true);

  const skeleton = new THREE.Skeleton(SKIN_BONES.map((n) => bones[n]));

  /* ---- the implicit surface, marched in code, split into named parts ---- */
  const geoms = buildKingParts(header, fieldNames, { shoulderY: LM.shoulder });
  const partList = [];
  for (const g of geoms) {
    const mat = materialFor(g.name);
    const explodeU = makeExplodable(mat);
    const mesh = new THREE.SkinnedMesh(g.geometry, mat);
    mesh.name = g.name;
    mesh.castShadow = true;
    mesh.frustumCulled = false;      // skinned + explodable: bounds move
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    const depthU = makeExplodable(depth);
    mesh.customDepthMaterial = depth;
    root.add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton, mesh.matrixWorld.clone());
    const setOffset = (v) => { explodeU.value.copy(v); depthU.value.copy(v); };
    partList.push({ mesh, bone: g.bone, layer: g.layer, name: g.name,
                    centroid: g.centroid, tris: g.tris, setOffset });
  }

  /* (the GLB's T-pose bind is corrected OFFLINE by re-posing the point cloud — the field ships
   * arms-at-sides, so the runtime rest needs no correction and the welded surface never tears) */

  /* ---- sculptRuntime contract (v1, unchanged) ---- */
  const colliders = [
    { bone: 'hips', type: 'capsule', radius: 0.16, height: 0.3 },
    { bone: 'chest', type: 'capsule', radius: 0.17, height: 0.34 },
    { bone: 'head', type: 'sphere', radius: 0.17 },
    { bone: 'knee-l', type: 'capsule', radius: 0.07, height: 0.4 },
    { bone: 'knee-r', type: 'capsule', radius: 0.07, height: 0.4 },
  ];
  root.userData.sculptRuntime = {
    version: '2.0-implicit',
    spec: 'king-sculpt-spec.json',
    field: 'king-field.bin',
    bones: Object.keys(bones),
    sockets: { hatCrown: 'head', handL: 'wrist-l', handR: 'wrist-r', capeAnchor: 'coat-root' },
    colliders,
    animations: ['idle', 'walk'],
  };

  return { root, bones, skeleton, partList, quality };
}

/* ---------------- procedural animation (sim-time, deterministic — v1, unchanged) ---------------- */

export function createKingAnimator(king) {
  const { bones } = king;
  const rest = new Map();
  for (const [name, b] of Object.entries(bones)) rest.set(name, b.rotation.clone());
  const rootRestY = bones.hips.position.y;

  function reset() {
    for (const [name, b] of Object.entries(bones)) b.rotation.copy(rest.get(name));
    bones.hips.position.y = rootRestY;
  }

  /* idle: breath, sway, head drift — the "alive" register */
  function poseIdle(t, w) {
    const breath = Math.sin(t * 1.9) * 0.5 + 0.5;
    bones.chest.rotation.x += (-0.015 - breath * 0.022) * w;
    bones.neck.rotation.x += (0.01 + breath * 0.012) * w;
    bones.spine.rotation.z += Math.sin(t * 0.43) * 0.015 * w;
    bones.hips.position.y += Math.sin(t * 1.9) * 0.004 * w;
    bones.head.rotation.y += (Math.sin(t * 0.31) * 0.10 + 0.16) * w;  // his slight right turn, per reference
    bones.head.rotation.x += Math.sin(t * 0.53) * 0.02 * w;
    bones['shoulder-l'].rotation.z += (0.03 + Math.sin(t * 1.9) * 0.012) * w;
    bones['shoulder-r'].rotation.z += (-0.03 - Math.sin(t * 1.9) * 0.012) * w;
    bones['elbow-l'].rotation.x += -0.06 * w;
    bones['elbow-r'].rotation.x += -0.06 * w;
    bones['coat-mid'].rotation.x += Math.sin(t * 0.9) * 0.008 * w;
    bones['coat-hem'].rotation.x += Math.sin(t * 0.9 + 0.8) * 0.012 * w;
  }

  /* walk: legs opposite phase, arm counterswing, coat trail a beat behind */
  function poseWalk(t, w) {
    const f = t * Math.PI * 2 * 0.95;   // stride frequency
    const L = Math.sin(f), R = Math.sin(f + Math.PI);
    const lift = (p) => Math.max(0, Math.sin(p + Math.PI / 2));
    bones['hip-l'].rotation.x += L * 0.50 * w;
    bones['hip-r'].rotation.x += R * 0.50 * w;
    bones['knee-l'].rotation.x += -Math.max(0, -L) * 0.9 * w - lift(f) * 0.12 * w;
    bones['knee-r'].rotation.x += -Math.max(0, -R) * 0.9 * w - lift(f + Math.PI) * 0.12 * w;
    bones['ankle-l'].rotation.x += (Math.max(0, L) * 0.35 - 0.1) * w;
    bones['ankle-r'].rotation.x += (Math.max(0, R) * 0.35 - 0.1) * w;
    bones['shoulder-l'].rotation.x += R * 0.28 * w;
    bones['shoulder-r'].rotation.x += L * 0.28 * w;
    bones['elbow-l'].rotation.x += (-0.15 + Math.max(0, R) * -0.25) * w;
    bones['elbow-r'].rotation.x += (-0.15 + Math.max(0, L) * -0.25) * w;
    bones.hips.position.y += (Math.abs(Math.cos(f)) * -0.022 + 0.011) * w;
    bones.hips.rotation.y += Math.sin(f) * 0.06 * w;
    bones.spine.rotation.y += Math.sin(f + Math.PI) * 0.05 * w;
    bones.chest.rotation.x += -0.04 * w;
    bones.head.rotation.x += 0.03 * w;
    bones.head.rotation.y += 0.05 * w;
    // the coat answers the stride, a beat behind
    bones['coat-root'].rotation.x += (0.05 + Math.sin(f * 2 - 0.6) * 0.015) * w;
    bones['coat-mid'].rotation.x += (0.06 + Math.sin(f * 2 - 1.2) * 0.03) * w;
    bones['coat-hem'].rotation.x += (0.08 + Math.sin(f * 2 - 1.8) * 0.05) * w;
    bones['coat-mid'].rotation.z += Math.sin(f - 0.5) * 0.02 * w;
  }

  return {
    /** simTime seconds; blend: 0 = idle, 1 = walk */
    apply(simTime, walkWeight) {
      reset();
      const wWalk = Math.min(Math.max(walkWeight, 0), 1);
      if (wWalk < 1) poseIdle(simTime, 1 - wWalk);
      if (wWalk > 0) poseWalk(simTime, wWalk);
    },
  };
}
