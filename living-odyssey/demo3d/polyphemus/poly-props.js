/* poly-props.js — the giant's three props in PURE CODE ($0, no generation):
 *   the GREAT BOWL   (prop-bowl.png    — faceted ivy-wood kylix, two ring handles)
 *   the STAKE        (prop-stake.png / prop-stake-glowing.png — green olive beam,
 *                     sharpened tip, material STATE: cold charred / ember-glowing)
 *   the WINESKIN     (prop-wineskin.png — dark leather bag, four leg-stubs,
 *                     wooden stopper, rope wraps)
 * All faceted (flatShading) to match the prop art's low-poly register.
 * DETERMINISTIC: every jitter comes from a seeded mulberry32 — no Math.random.
 */
import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial(
  { color, flatShading: true, metalness: 0, roughness: 0.85, ...opts });

/* ---- the GREAT BOWL — wide faceted kylix, cream wood, ring handles ---- */
export function createGreatBowl() {
  const g = new THREE.Group();
  const R = 0.5;                                     // unit: bowl radius 0.5 -> ~1u wide
  const profile = [
    [0.02, 0.00], [0.30, 0.02], [0.42, 0.10], [0.50, 0.26],
    [0.485, 0.34], [0.44, 0.345],                    // rim, slight inward lip
    [0.415, 0.26], [0.34, 0.13], [0.10, 0.085], [0.02, 0.08],
  ].map(([x, y]) => new THREE.Vector2(x * (R / 0.5), y * (R / 0.5)));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), mat(0xd9c69c));
  g.add(body);
  for (const side of [-1, 1]) {                      // the two ring handles
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.115 * (R / 0.5), 0.035 * (R / 0.5), 6, 10),
      mat(0x8a5a30));
    ring.position.set(side * 0.56 * (R / 0.5), 0.27 * (R / 0.5), 0);
    ring.rotation.y = Math.PI / 2;
    ring.rotation.x = side * 0.35;
    g.add(ring);
  }
  g.userData.kind = 'greatBowl';
  return g;                                          // ~1.15u wide, 0.35u tall
}

/* ---- the STAKE — tapered olive beam, knots, sharpened tip; glow state ---- */
export function createStake() {
  const g = new THREE.Group();
  const rnd = mulberry32(90210);
  const L = 1.0, r0 = 0.055, r1 = 0.038;             // unit length 1, butt->neck taper
  const shaft = new THREE.CylinderGeometry(r1, r0, L * 0.8, 9, 4);
  const pos = shaft.attributes.position;             // seeded bark irregularity
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (Math.abs(Math.abs(y) - L * 0.4) < 1e-6) continue;   // keep end rings round
    const k = 1 + (rnd() - 0.5) * 0.16;
    pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k);
  }
  shaft.computeVertexNormals();
  const wood = mat(0x8f9066);                        // green olive wood
  const body = new THREE.Mesh(shaft, wood);
  body.rotation.z = Math.PI / 2;                     // lie along +x, tip to +x
  body.position.x = -L * 0.1;
  g.add(body);
  for (let i = 0; i < 3; i++) {                      // knots on the beam
    const knot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.028, 0), mat(0x6f7050));
    const a = rnd() * Math.PI * 2;
    knot.position.set(-L * 0.42 + rnd() * L * 0.55,
      Math.cos(a) * r0 * 0.95, Math.sin(a) * r0 * 0.95);
    g.add(knot);
  }
  /* the sharpened tip — its MATERIAL is the state: cold charred / ember glow */
  const tipMat = mat(0x4a3b2c, { emissive: 0x000000, emissiveIntensity: 0 });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(r1 * 1.05, L * 0.24, 9, 2), tipMat);
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = L * 0.42;
  g.add(tip);
  const emberLight = new THREE.PointLight(0xff7a18, 0, 3.2, 2);
  emberLight.position.copy(tip.position);
  g.add(emberLight);
  let glowing = false;
  g.userData.kind = 'stake';
  g.userData.setGlow = (on) => {
    glowing = !!on;
    tipMat.color.set(on ? 0xff8c2a : 0x4a3b2c);
    tipMat.emissive.set(on ? 0xff5a00 : 0x000000);
    tipMat.emissiveIntensity = on ? 1.0 : 0;
    tipMat.needsUpdate = true;
  };
  g.userData.isGlowing = () => glowing;
  g.userData.pulse = (t) => {                        // sim-time ember breathing
    if (!glowing) { emberLight.intensity = 0; return; }
    const p = 0.75 + 0.25 * Math.sin(t * 5.1) * Math.sin(t * 1.7);
    tipMat.emissiveIntensity = p;
    emberLight.intensity = 6 * p;
  };
  return g;                                          // 1u long along x, tip +x
}

/* ---- the WINESKIN — plump leather bag, leg-stubs, stopper, rope wraps ---- */
export function createWineskin() {
  const g = new THREE.Group();
  const rnd = mulberry32(1727);
  const bag = new THREE.SphereGeometry(0.34, 10, 8);
  const p = bag.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {                // seeded slouch: fatter low
    v.fromBufferAttribute(p, i);
    const sag = 1 + 0.28 * Math.max(0, -v.y / 0.34);
    p.setXYZ(i, v.x * 1.35 * sag * (1 + (rnd() - 0.5) * 0.08),
      v.y * 0.72, v.z * sag * (1 + (rnd() - 0.5) * 0.08));
  }
  bag.computeVertexNormals();
  const leather = mat(0x4c3826, { roughness: 0.7 });
  g.add(new THREE.Mesh(bag, leather));
  for (const [sx, sz] of [[-0.30, 0.16], [-0.30, -0.16], [0.26, 0.18], [0.26, -0.18]]) {
    const stub = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 6), mat(0x3b2b1d));
    stub.position.set(sx, -0.10, sz);
    stub.rotation.x = sz > 0 ? 0.9 : -0.9;
    stub.rotation.z = sx > 0 ? -0.7 : 0.7;
    g.add(stub);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.16, 8), leather);
  neck.rotation.z = 1.25;
  neck.position.set(-0.46, -0.02, 0);
  g.add(neck);
  const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.11, 7), mat(0xc9a166));
  stopper.rotation.z = 1.25;
  stopper.position.set(-0.56, 0.012, 0);
  g.add(stopper);
  const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.018, 5, 10), mat(0xb89d72));
  wrap.position.set(-0.47, -0.022, 0);
  wrap.rotation.y = Math.PI / 2; wrap.rotation.x = 0.32;
  g.add(wrap);
  g.userData.kind = 'wineskin';
  return g;                                          // ~1.0u long along x
}

export function propTriangles(group) {
  let tris = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const idx = o.geometry.index;
    tris += (idx ? idx.count : o.geometry.attributes.position.count) / 3;
  });
  return Math.round(tris);
}
