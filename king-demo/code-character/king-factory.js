/* king-factory.js — THE KING, authored in native Three.js code.
 *
 * img2threejs character method (skill 1.5): one reference image → measured spec
 * (king-sculpt-spec.json) → this procedural factory. No GLB is loaded at runtime;
 * every part below is built from primitives and custom BufferGeometry.
 * The GLB baseline (king2-rigged.glb) was used as a MEASUREMENT TARGET only —
 * its topology and materials are never copied (the method's law).
 *
 * Reconstruction data (measured off king2-look.png / king2-unmasked.png and the
 * GLB skeleton landmarks) is kept separate from renderer objects, below.
 */
import * as THREE from 'three';

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
    pupilHalfSpacing: 0.185,   // of head width, per side
    headWidthOverHeight: 0.75, headDepthOverHeight: 0.90,
  },
  palette: {
    skin: 0xefc49b, skinShadow: 0xc99b72, hair: 0x20202a,
    shirt: 0xf0e6cf, vest: 0xe9dcc0, cravat: 0x2a3453,
    coat: 0x3d4a6b, coatDark: 0x2c3552,
    lining: 0xe8722a, liningDeep: 0xc8511f, piping: 0xf08033,
    trousers: 0x252c45, boots: 0x181a22, brass: 0xc9a24b,
    eye: 0x241d18, lips: 0xc98f77,
  },
};

const H = KING_DATA.totalHeight;
const LM = {}; for (const [k, v] of Object.entries(KING_DATA.landmarks)) LM[k] = v * H;
const HEAD_H = H / KING_DATA.headUnits;               // 0.3255
const HEAD_W = HEAD_H * KING_DATA.face.headWidthOverHeight;
const HEAD_D = HEAD_H * KING_DATA.face.headDepthOverHeight;
const CROWN = H;
const faceY = (n) => CROWN - n * HEAD_H;              // normalized face landmark → world y

/* quality tiers — the low tessellation IS the register (flat-shaded facets) */
export const QUALITY_TIERS = {
  low:      { radial: 6,  cap: 2, sphereW: 7,  sphereH: 5, coatRadial: 8,  coatRows: 4 },
  standard: { radial: 9,  cap: 3, sphereW: 10, sphereH: 7, coatRadial: 12, coatRows: 6 },
};

/* ---------------- materials (single accent colours, flat-shaded) ---------------- */

function makeMaterials() {
  const P = KING_DATA.palette;
  const std = (color, rough, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true, ...extra });
  return {
    skin:  std(P.skin, 0.75),
    hair:  std(P.hair, 0.85),
    shirt: std(P.shirt, 0.8),
    vest:  std(P.vest, 0.8),
    cravat: std(P.cravat, 0.85),
    coat:  std(P.coat, 0.9, { side: THREE.DoubleSide }),
    lining: std(P.lining, 0.85, { side: THREE.DoubleSide }),
    piping: std(P.piping, 0.85),
    trousers: std(P.trousers, 0.9),
    boots: std(P.boots, 0.6),
    brass: new THREE.MeshStandardMaterial({ color: P.brass, roughness: 0.4, metalness: 0.8, flatShading: true }),
    eye:   std(P.eye, 0.25),
    eyeWhite: std(0xe8e2d6, 0.35),
    lips:  std(P.lips, 0.7),
    catchlight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
}

/* ---------------- geometry helpers ---------------- */

function capsuleGeo(r0, r1, len, q) {
  // tapered capsule: low-poly lathe of a stadium profile with two radii
  const pts = [];
  const capSeg = q.cap;
  for (let i = 0; i <= capSeg; i++) {
    const a = -Math.PI / 2 + (i / capSeg) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r1, -len / 2 + Math.sin(a) * r1));
  }
  for (let i = 0; i <= capSeg; i++) {
    const a = (i / capSeg) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r0, len / 2 + Math.sin(a) * r0));
  }
  const g = new THREE.LatheGeometry(pts, q.radial);
  return g;
}

/* the greatcoat: open lathe sector shell (front opening), per spec latheProfile */
function coatShellGeo(q, inner = false) {
  // profile: [radius, y-offset-from-shoulder] — A-line drape, shoulders → ankles
  const prof = [
    [0.235, 0.045], [0.295, -0.06], [0.295, -0.42],
    [0.325, -0.80], [0.355, -1.14], [0.375, -1.28],
  ];
  const inset = inner ? 0.012 : 0;
  const openHalf = Math.PI * 0.32;             // front opening ~115° total
  const thetaLen = Math.PI * 2 - 2 * openHalf;
  const rows = q.coatRows, cols = q.coatRadial;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const fi = t * (prof.length - 1);
    const i0 = Math.min(Math.floor(fi), prof.length - 2);
    const f = fi - i0;
    const r = (prof[i0][0] * (1 - f) + prof[i0 + 1][0] * f) - inset;
    const y = prof[i0][1] * (1 - f) + prof[i0 + 1][1] * f;
    for (let j = 0; j <= cols; j++) {
      const psi = openHalf + (j / cols) * thetaLen;  // opening centred on +Z
      pos.push(Math.sin(psi) * r * 1.22, y, Math.cos(psi) * r * 0.92);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1;
      if (inner) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* standing collar: open flared cone sector, orange inner face via second shell */
function collarGeo(q, inner = false) {
  const inset = inner ? 0.008 : 0;
  const r0 = 0.115 - inset, r1 = 0.185 - inset, h = 0.16;
  const openHalf = Math.PI * 0.22;
  const thetaLen = Math.PI * 2 - 2 * openHalf;
  const cols = Math.max(6, Math.round(q.coatRadial * 0.75));
  const pos = [], idx = [];
  for (let i = 0; i <= 1; i++) {
    const r = i ? r1 : r0, y = i ? h : 0;
    for (let j = 0; j <= cols; j++) {
      const psi = openHalf + (j / cols) * thetaLen;
      pos.push(Math.sin(psi) * r, y, Math.cos(psi) * r);
    }
  }
  for (let j = 0; j < cols; j++) {
    const a = j, b = j + 1, c = j + cols + 1, d = c + 1;
    if (inner) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* hair: skull cap + swept fringe wedges (stylized clumps, no strands) */
function hairGroup(mats, q) {
  const g = new THREE.Group(); g.name = 'hair';
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(1, q.sphereW, q.sphereH, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.hair);
  cap.name = 'hair-cap';
  cap.scale.set(HEAD_W * 0.55, HEAD_H * 0.46, HEAD_D * 0.55);
  cap.position.set(0, faceY(0.26), -HEAD_D * 0.04);
  g.add(cap);
  // fringe: three swept wedge boxes over the forehead, side part to his right
  const fringe = [
    { x: -HEAD_W * 0.16, y: faceY(0.20), z: HEAD_D * 0.36, w: HEAD_W * 0.40, h: HEAD_H * 0.13, rz: -0.14, ry: 0.10 },
    { x: HEAD_W * 0.19, y: faceY(0.19), z: HEAD_D * 0.33, w: HEAD_W * 0.30, h: HEAD_H * 0.11, rz: 0.18, ry: -0.14 },
    { x: 0, y: faceY(0.12), z: HEAD_D * 0.26, w: HEAD_W * 0.50, h: HEAD_H * 0.12, rz: 0.03, ry: 0 },
  ];
  fringe.forEach((f, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.h, HEAD_D * 0.16), mats.hair);
    m.name = 'hair-fringe-' + i;
    m.position.set(f.x, f.y, f.z);
    m.rotation.z = f.rz; m.rotation.y = f.ry;
    m.userData.explodeWithParent = true;
    g.add(m);
  });
  // temple masses
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(HEAD_W * 0.13, HEAD_H * 0.26, HEAD_D * 0.40), mats.hair);
    m.name = 'hair-temple-' + (s < 0 ? 'r' : 'l');
    m.position.set(s * HEAD_W * 0.46, faceY(0.36), -HEAD_D * 0.10);
    m.rotation.z = s * 0.06;
    m.userData.explodeWithParent = true;
    g.add(m);
  }
  return g;
}

/* ---------------- the factory ---------------- */

export function createKingModel(quality = 'standard') {
  const q = QUALITY_TIERS[quality] || QUALITY_TIERS.standard;
  const mats = makeMaterials();
  const root = new THREE.Group();
  root.name = 'the-king';

  /* ---- skeleton (real THREE.Bone hierarchy, spec rig) ---- */
  const bone = (name, x, y, z, parent) => {
    const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z);
    if (parent) parent.add(b);
    return b;
  };
  const hips = bone('hips', 0, LM.hips, 0, null);
  const spine = bone('spine', 0, 0.10, 0.005, hips);
  const chest = bone('chest', 0, 0.22, 0.005, spine);          // y ≈ 1.267
  const neckB = bone('neck', 0, LM.neck - (LM.hips + 0.32), -0.01, chest);
  const headB = bone('head', 0, LM.headJoint - LM.neck, 0.01, neckB);
  const bones = { hips, spine, chest, neck: neckB, head: headB };
  const chestWorldY = LM.hips + 0.32;
  for (const s of ['l', 'r']) {
    const sx = s === 'l' ? 1 : -1;
    const sh = bone('shoulder-' + s, sx * LM.shoulderHalfSpanX, LM.shoulder - chestWorldY, 0, chest);
    const el = bone('elbow-' + s, sx * 0.012, -(LM.shoulder - 1.13 * H / 1.8), 0, sh);   // elbow y≈1.13
    const wr = bone('wrist-' + s, sx * 0.008, -0.23, 0.01, el);
    const hipJ = bone('hip-' + s, sx * LM.hipHalfSpanX, 0, 0, hips);
    const kn = bone('knee-' + s, sx * 0.004, -(LM.hips - LM.knee), 0.005, hipJ);
    const an = bone('ankle-' + s, 0, -(LM.knee - LM.ankle), -0.005, kn);
    Object.assign(bones, { ['shoulder-' + s]: sh, ['elbow-' + s]: el, ['wrist-' + s]: wr,
      ['hip-' + s]: hipJ, ['knee-' + s]: kn, ['ankle-' + s]: an });
  }
  // coat sway chain (cross-joint shell L4 gets its own small-envelope bones)
  const coatRoot = bone('coat-root', 0, LM.shoulder - chestWorldY + 0.02, -0.02, chest);
  const coatMid = bone('coat-mid', 0, -0.55, -0.02, coatRoot);
  const coatHem = bone('coat-hem', 0, -0.45, -0.01, coatMid);
  Object.assign(bones, { 'coat-root': coatRoot, 'coat-mid': coatMid, 'coat-hem': coatHem });
  root.add(hips);

  /* ---- parts: named meshes riding their bones ---- */
  const partList = [];
  const part = (mesh, boneOwner, layer) => {
    mesh.castShadow = true;
    boneOwner.add(mesh);
    partList.push({ mesh, bone: boneOwner.name, layer });
    return mesh;
  };
  const named = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; return m; };

  /* head cluster (L0 + L2/L3 isolates) */
  const headG = new THREE.Group(); headG.name = 'head-group';
  headB.add(headG);
  headG.position.set(0, 0, 0);
  const headLocalY = (n) => faceY(n) - LM.headJoint;   // face landmark → head-bone local
  const skullRy = HEAD_H * 0.52, skullRx = HEAD_W * 0.5, skullRz = HEAD_D * 0.5;
  const skullCy = headLocalY(0.48);
  const skull = named(new THREE.SphereGeometry(1, q.sphereW, q.sphereH), mats.skin, 'head');
  skull.scale.set(skullRx, skullRy, skullRz);
  skull.position.y = skullCy;
  headG.add(skull); partList.push({ mesh: skull, bone: 'head', layer: 'L0' });
  // z of the skull surface at a given local y (feature seating)
  const surfZ = (y) => { const dy = (y - skullCy) / skullRy; return skullRz * Math.sqrt(Math.max(0.02, 1 - dy * dy)); };
  const jaw = named(capsuleGeo(HEAD_W * 0.26, HEAD_W * 0.20, HEAD_H * 0.08, q), mats.skin, 'jaw');
  jaw.position.set(0, headLocalY(0.82), HEAD_D * 0.10);
  jaw.scale.z = 0.8;
  headG.add(jaw); partList.push({ mesh: jaw, bone: 'head', layer: 'L0' });
  const neckM = named(new THREE.CylinderGeometry(0.048, 0.055, 0.16, q.radial), mats.skin, 'neck');
  neckM.position.y = 0.02;
  neckB.add(neckM); partList.push({ mesh: neckM, bone: 'neck', layer: 'L0' });

  const hair = hairGroup(mats, q);
  hair.position.y = -LM.headJoint; // group is authored in world-y face coords
  headB.add(hair); partList.push({ mesh: hair, bone: 'head', layer: 'L1' });

  for (const s of [-1, 1]) {
    const brow = named(new THREE.BoxGeometry(HEAD_W * 0.24, HEAD_H * 0.035, 0.012), mats.hair, 'brow-' + (s < 0 ? 'r' : 'l'));
    brow.position.set(s * HEAD_W * KING_DATA.face.pupilHalfSpacing, headLocalY(0.44), surfZ(headLocalY(0.44)) + 0.004);
    brow.rotation.z = s * -0.06;
    headG.add(brow); partList.push({ mesh: brow, bone: 'head', layer: 'L5' });
    const eye = named(new THREE.SphereGeometry(HEAD_W * 0.062, q.sphereW, q.sphereH), mats.eyeWhite, 'eye-' + (s < 0 ? 'r' : 'l'));
    eye.position.set(s * HEAD_W * KING_DATA.face.pupilHalfSpacing, headLocalY(0.56), surfZ(headLocalY(0.56)) * 0.96);
    eye.scale.z = 0.55; eye.scale.y = 0.72;
    headG.add(eye); partList.push({ mesh: eye, bone: 'head', layer: 'L2' });
    const iris = named(new THREE.SphereGeometry(HEAD_W * 0.034, q.sphereW, q.sphereH), mats.eye, 'iris-' + (s < 0 ? 'r' : 'l'));
    iris.position.set(0, 0, HEAD_W * 0.05); iris.scale.z = 0.5;
    iris.userData.explodeWithParent = true;
    eye.add(iris);
    const cl = named(new THREE.SphereGeometry(HEAD_W * 0.010, 5, 4), mats.catchlight, 'catchlight-' + (s < 0 ? 'r' : 'l'));
    cl.position.set(-HEAD_W * 0.012, HEAD_W * 0.012, HEAD_W * 0.078);
    cl.userData.explodeWithParent = true;
    eye.add(cl);
    const ear = named(new THREE.SphereGeometry(HEAD_W * 0.09, 6, 5), mats.skin, 'ear-' + (s < 0 ? 'r' : 'l'));
    ear.position.set(s * HEAD_W * 0.52, headLocalY(0.62), -HEAD_D * 0.02);
    ear.scale.set(0.45, 1, 0.7);
    headG.add(ear); partList.push({ mesh: ear, bone: 'head', layer: 'L1' });
  }
  const nose = named(new THREE.ConeGeometry(HEAD_W * 0.055, HEAD_H * 0.16, 4), mats.skin, 'nose');
  nose.rotation.x = Math.PI / 2 + 0.35;
  nose.position.set(0, headLocalY(0.70), surfZ(headLocalY(0.70)) + 0.012);
  headG.add(nose); partList.push({ mesh: nose, bone: 'head', layer: 'L0' });
  const mouth = named(new THREE.BoxGeometry(HEAD_W * 0.26, HEAD_H * 0.028, 0.012), mats.lips, 'mouth');
  mouth.position.set(0, headLocalY(0.89), surfZ(headLocalY(0.89)) + 0.010);
  headG.add(mouth); partList.push({ mesh: mouth, bone: 'head', layer: 'L2' });

  /* torso: shirt core, vest shell, cravat, buttons (chest bone) */
  const chest0 = named(capsuleGeo(0.13, 0.12, 0.12, q), mats.shirt, 'chest');
  chest0.position.y = -0.02; chest0.scale.z = 0.72;
  part(chest0, chest, 'L0');
  const vest = named(capsuleGeo(0.14, 0.13, 0.12, q), mats.vest, 'vest');
  vest.position.y = -0.045; vest.scale.z = 0.74;
  part(vest, chest, 'L4');
  const abdomen = named(capsuleGeo(0.115, 0.12, 0.10, q), mats.vest, 'abdomen');
  abdomen.position.y = 0.02; abdomen.scale.z = 0.78;
  part(abdomen, spine, 'L0');
  const pelvis = named(capsuleGeo(0.125, 0.13, 0.06, q), mats.trousers, 'pelvis');
  pelvis.position.y = -0.01; pelvis.scale.z = 0.8;
  part(pelvis, hips, 'L0');
  const cravat = named(new THREE.SphereGeometry(0.055, q.sphereW, q.sphereH), mats.cravat, 'cravat');
  cravat.position.set(0, -0.088, 0.07); cravat.scale.set(1.15, 1.02, 0.65);
  part(cravat, neckB, 'L3');
  // double-breasted brass buttons, 2 columns × 3 rows (instanced grid per spec)
  const btnGeo = new THREE.SphereGeometry(0.011, 6, 4);
  const buttons = new THREE.InstancedMesh(btnGeo, mats.brass, 6);
  buttons.name = 'vest-buttons';
  const m4 = new THREE.Matrix4();
  let bi = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    m4.setPosition((c ? 0.048 : -0.048), 0.02 - r * 0.07, 0.118 - r * 0.006);
    buttons.setMatrixAt(bi++, m4);
  }
  part(buttons, chest, 'L3');

  /* collar (open cone sectors) — navy outer, orange inner */
  const collar = named(collarGeo(q, false), mats.coat, 'collar');
  collar.position.set(0, -0.05, -0.012);
  part(collar, neckB, 'L4');
  const collarLining = named(collarGeo(q, true), mats.lining, 'collar-lining');
  collarLining.userData.explodeWithParent = true;
  collar.add(collarLining);  // rides its shell (assembly gate)
  partList.push({ mesh: collarLining, bone: 'neck', layer: 'L4' });

  /* the greatcoat — skinned to the coat sway chain */
  const coatOuterGeo = coatShellGeo(q, false);
  const coatInnerGeo = coatShellGeo(q, true);
  const bindCoat = (geo) => {
    const posA = geo.getAttribute('position');
    const n = posA.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    // spatial W(p): blend along shell y (0 → -1.28) over coat-root/mid/hem
    for (let i = 0; i < n; i++) {
      const y = posA.getY(i);
      const t = Math.min(Math.max(-y / 1.28, 0), 1); // 0 shoulders → 1 hem
      let w0, w1, w2;
      if (t < 0.45) { const f = t / 0.45; w0 = 1 - f; w1 = f; w2 = 0; }
      else { const f = (t - 0.45) / 0.55; w0 = 0; w1 = 1 - f; w2 = f; }
      si.set([0, 1, 2, 0], i * 4); sw.set([w0, w1, w2, 0], i * 4);
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  };
  bindCoat(coatOuterGeo); bindCoat(coatInnerGeo);
  root.updateMatrixWorld(true);               // rest-pose world matrices before binding
  const coatSkeleton = new THREE.Skeleton([coatRoot, coatMid, coatHem]);
  const coatOuter = new THREE.SkinnedMesh(coatOuterGeo, mats.coat);
  coatOuter.name = 'coat-back';
  const coatInner = new THREE.SkinnedMesh(coatInnerGeo, mats.lining);
  coatInner.name = 'coat-lining-inner';
  coatInner.userData.explodeWithParent = true;
  for (const cm of [coatOuter, coatInner]) {
    cm.castShadow = true;
    coatRoot.add(cm);
    cm.updateMatrixWorld(true);
    cm.bind(coatSkeleton);                    // bindMatrix = mesh matrixWorld (rest pose)
  }
  partList.push({ mesh: coatOuter, bone: 'coat-root', layer: 'L4' });
  partList.push({ mesh: coatInner, bone: 'coat-root', layer: 'L4' });
  /* piping strips riding the coat front edges */
  {
    const openHalf = Math.PI * 0.32;
    const topR = 0.245, hemR = 0.375, topY = 0.045, hemY = -1.28;
    const ex = Math.sin(openHalf) * 1.22, ez = Math.cos(openHalf) * 0.92;
    for (const s of [-1, 1]) {
      const x0 = s * topR * ex, z0 = topR * ez, x1 = s * hemR * ex, z1 = hemR * ez;
      const len = Math.hypot(x1 - x0, hemY - topY, z1 - z0);
      const strip = named(new THREE.BoxGeometry(0.018, len, 0.018), mats.piping, 'piping-' + (s < 0 ? 'r' : 'l'));
      strip.position.set((x0 + x1) / 2, (topY + hemY) / 2, (z0 + z1) / 2 + 0.004);
      strip.rotation.z = s * Math.atan2(Math.abs(x1 - x0), topY - hemY);
      strip.rotation.x = -Math.atan2(z1 - z0, topY - hemY) * 0.5;
      strip.userData.explodeWithParent = true;
      part(strip, coatRoot, 'L3');
    }
  }

  /* arms: shirt sleeves (arms outside the coat sleeves — cape-style), skin hands */
  for (const s of ['l', 'r']) {
    const sx = s === 'l' ? 1 : -1;
    const upper = named(capsuleGeo(0.048, 0.042, 0.20, q), mats.shirt, 'upper-arm-' + s);
    upper.position.y = -0.12;
    part(upper, bones['shoulder-' + s], 'L0');
    const fore = named(capsuleGeo(0.040, 0.034, 0.18, q), mats.shirt, 'forearm-' + s);
    fore.position.y = -0.115;
    part(fore, bones['elbow-' + s], 'L0');
    const cuff = named(new THREE.CylinderGeometry(0.043, 0.045, 0.05, q.radial), mats.shirt, 'cuff-' + s);
    cuff.position.y = -0.005;
    part(cuff, bones['wrist-' + s], 'L3');
    const hand = named(new THREE.BoxGeometry(0.052, 0.09, 0.028), mats.skin, 'hand-' + s);
    hand.position.y = -0.075;
    part(hand, bones['wrist-' + s], 'L3');
    const thumb = named(capsuleGeo(0.011, 0.009, 0.035, q), mats.skin, 'thumb-' + s);
    thumb.position.set(sx * 0.032, 0.02, 0.012); thumb.rotation.z = sx * 0.5;
    thumb.userData.explodeWithParent = true;
    hand.add(thumb);  // rides the hand
  }

  /* legs: trousers, knee-high boots */
  for (const s of ['l', 'r']) {
    const thigh = named(capsuleGeo(0.062, 0.052, 0.34, q), mats.trousers, 'thigh-' + s);
    thigh.position.y = -0.20;
    part(thigh, bones['hip-' + s], 'L0');
    const shin = named(capsuleGeo(0.048, 0.038, 0.28, q), mats.trousers, 'shin-' + s);
    shin.position.y = -0.17;
    part(shin, bones['knee-' + s], 'L0');
    const shaft = named(new THREE.CylinderGeometry(0.055, 0.062, 0.30, q.radial), mats.boots, 'boot-shaft-' + s);
    shaft.position.y = -0.235;
    part(shaft, bones['knee-' + s], 'L4');
    const foot = named(new THREE.BoxGeometry(0.085, 0.058, 0.19), mats.boots, 'boot-foot-' + s);
    foot.position.set(0, -0.089, 0.035);
    part(foot, bones['ankle-' + s], 'L3');
  }

  /* ---- sculptRuntime contract ---- */
  const colliders = [
    { bone: 'hips', type: 'capsule', radius: 0.16, height: 0.3 },
    { bone: 'chest', type: 'capsule', radius: 0.17, height: 0.34 },
    { bone: 'head', type: 'sphere', radius: 0.17 },
    { bone: 'knee-l', type: 'capsule', radius: 0.07, height: 0.4 },
    { bone: 'knee-r', type: 'capsule', radius: 0.07, height: 0.4 },
  ];
  root.userData.sculptRuntime = {
    version: '1.5',
    spec: 'king-sculpt-spec.json',
    bones: Object.keys(bones),
    sockets: { hatCrown: 'head', handL: 'wrist-l', handR: 'wrist-r', capeAnchor: 'coat-root' },
    colliders,
    animations: ['idle', 'walk'],
  };

  return { root, bones, partList, quality };
}

/* ---------------- procedural animation (sim-time, deterministic) ---------------- */

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

  /* walk: 1.9 Hz cycle, legs opposite phase, arm counterswing, coat trail */
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
