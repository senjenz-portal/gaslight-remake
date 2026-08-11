/**
 * gltf.js — how generated art gets into the diorama.
 *
 * The loader is VENDORED (app/vendor/loaders/GLTFLoader.js + its two utils
 * deps), resolved through the importmap's "three/addons/" prefix, and pulled
 * in DYNAMICALLY so a build with no GLBs never pays for it. Nothing here
 * touches the network beyond the app's own origin.
 *
 * ASSETS.md §2 scale law: every GLB is YVO3D-normalised to ~2.0 units on its
 * longest axis and centred at origin — NOT metres. So the caller asks for a
 * REAL-WORLD size (`height` / `depth` in metres) and this module measures the
 * loaded bbox and derives the scale, then `lift`s the model so its feet sit
 * on the slot's y=0. That is self-correcting: a re-generated asset with a
 * different bbox lands in the same place without editing a magic number.
 *
 * `flat: true` is ASSETS.md's style lock — the baked PBR textures are more
 * photoreal than the flat-shaded law, so every material is replaced by a
 * MeshLambertMaterial sampling ONLY the basecolour, flat-shaded. It also
 * drops the normal/metallic-roughness samplers, which is the cheapest real
 * win available on fragment cost.
 *
 *   await swapSlot(world.slots.holmes, '../assets/3d/holmes.glb',
 *                  { height: 1.75, yaw: -0.55, lift: true, flat: true });
 *
 * Focus anchors, click targets and hand props live inside the slot and are
 * preserved by slot.replace(), so camera framing, the hold ring and the mask
 * gate keep working across a swap. Correct a bad pivot with the opts — never
 * by moving the slot, which is the diorama's contract.
 */
import * as THREE from 'three';

let _loaderPromise = null;

export async function getLoader() {
  if (!_loaderPromise) {
    _loaderPromise = import('three/addons/loaders/GLTFLoader.js')
      .then(m => new m.GLTFLoader());
  }
  return _loaderPromise;
}

/** Is the vendored loader reachable at all? (harness gate, loads no assets) */
export async function loaderAvailable() {
  try {
    const m = await import('three/addons/loaders/GLTFLoader.js');
    return typeof m.GLTFLoader === 'function';
  } catch (e) {
    return false;
  }
}

export async function loadGLB(url) {
  const loader = await getLoader();
  return new Promise((res, rej) => loader.load(url, res, undefined, rej));
}

/** Triangles in a subtree — the number the frame-time budget is spent on. */
export function countTris(obj) {
  let n = 0;
  obj.traverse((o) => {
    const g = o.geometry;
    if (!g || !g.attributes || !g.attributes.position) return;
    n += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  });
  return Math.round(n);
}

/** Replace baked PBR with the flat-shaded style law, basecolour only. */
function flatten(obj, tint) {
  obj.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    const map = src && src.map ? src.map : null;
    const mat = new THREE.MeshLambertMaterial({
      map, color: tint !== undefined ? tint : 0xffffff, flatShading: true,
      side: src && src.side !== undefined ? src.side : THREE.FrontSide,
      transparent: !!(src && src.transparent), opacity: src ? src.opacity : 1,
    });
    if (map) map.colorSpace = THREE.SRGBColorSpace;
    // the normal/mr samplers go away with the old material
    if (Array.isArray(o.material)) o.material.forEach(m => m !== src && m.dispose?.());
    if (src) { src.normalMap = null; src.roughnessMap = null; src.dispose?.(); }
    o.material = mat;
    if (o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals();
  });
}

/**
 * Load `url` and put it in `slot`, dropping the placeholder blocks.
 * Returns { gltf, tris, size, scale } so the caller can budget frame time.
 *
 * opts:
 *   height  metres the model should stand (drives scale from the bbox)
 *   depth   metres the model should measure on Z (for the carriage)
 *   scale   explicit scale, wins over height/depth
 *   lift    true -> put the model's lowest point on the slot's y = 0
 *   yaw     radians about Y
 *   y       extra Y offset applied after lift
 *   flat    true -> flat-shaded Lambert, basecolour only (style law)
 *   tint    hex multiplied into the basecolour (e.g. mahogany-darkening)
 */
const smoothstep01 = (t) => {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return k * k * (3 - 2 * k);
};

/**
 * SIT A STANDING FIGURE DOWN — round-2 [R3-1].
 *
 * Every figure GLB in this set is ONE mesh, no skin, no bones, no clips
 * (`nodes: world -> YVO3D.obj -> mesh 0`), so there is no rig to pose. What
 * there IS, is a continuous body along Y, and a chair to put it in. This is a
 * two-joint BEND DEFORMER run once on the position attribute at load:
 *
 *   · the leg below the hip is re-parameterised by arc length `s` measured
 *     DOWN from the hip joint;
 *   · a cumulative bend angle phi(s) ramps 0 -> thighAngle across the hip and
 *     thighAngle -> shinAngle across the knee, each over a smoothstep band,
 *     so the surface never tears the way a rigid two-segment rotation does;
 *   · the axis curve C(s) is the integral of that direction field, and each
 *     vertex rides the moving frame (its X is untouched, its perpendicular
 *     offset is carried by the rotated normal of the axis).
 *
 * Result: thighs forward, shins down, the frock-coat skirt drapes over the
 * lap because it IS the thigh region of the mesh, and the hands — which hang
 * just below the hip — swing onto the knees. A small `lean` reclines the
 * torso about the same hip pivot, blended over the same band.
 *
 * Deterministic (pure function of the mesh + the constants), done once before
 * __ready, and costs nothing per frame. Materials are flat-shaded, and three
 * takes flat-shaded normals from screen-space derivatives, so no normal
 * attribute has to be rebuilt.
 *
 * Returns the measurements the caller needs to seat him: stature, and the
 * height of the hip (i.e. of the chair seat he now needs) above his new feet.
 */
export function seatFigure(obj, o = {}) {
  const hipR = o.hip ?? 0.51, kneeR = o.knee ?? 0.275;
  const thigh = (o.thighAngle ?? -78) * Math.PI / 180;
  const shin = (o.shinAngle ?? -7) * Math.PI / 180;
  const lean = (o.lean ?? -7) * Math.PI / 180;
  const face = (o.face ?? 1) >= 0 ? 1 : -1;
  const bandR = o.band ?? 0.055;

  const meshes = [];
  let minY = Infinity, maxY = -Infinity;
  obj.traverse((m) => {
    const p = m.isMesh && m.geometry && m.geometry.attributes.position;
    if (!p) return;
    meshes.push(m);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  });
  if (!meshes.length || !isFinite(minY)) return null;

  const H = maxY - minY;
  const hipY = minY + hipR * H, kneeY = minY + kneeR * H;
  const band = Math.max(1e-4, bandR * H);
  const thighLen = hipY - kneeY;
  const phi = (s) => thigh * smoothstep01(s / band)
    + (shin - thigh) * smoothstep01((s - thighLen) / band);

  // the axis curve, integrated once at 1024 samples and read back by lerp
  const N = 1024, sMax = hipY - minY, ds = sMax / N;
  const cy = new Float64Array(N + 1), cz = new Float64Array(N + 1);
  cy[0] = hipY; cz[0] = 0;
  for (let i = 0; i < N; i++) {
    const a = phi((i + 0.5) * ds);
    cy[i + 1] = cy[i] + ds * -Math.cos(a);      // 'down', rotated about X
    cz[i + 1] = cz[i] + ds * -Math.sin(a);
  }

  for (const m of meshes) {
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vy = p.getY(i), vz = face * p.getZ(i);
      if (vy >= hipY) {
        // torso: reclines about the hip, blended in over the same band so the
        // waist bends instead of shearing
        const k = smoothstep01((vy - hipY) / band);
        const a = lean * k, dy = vy - hipY;
        const ny = hipY + dy * Math.cos(a) - vz * Math.sin(a);
        const nz = dy * Math.sin(a) + vz * Math.cos(a);
        p.setY(i, ny); p.setZ(i, face * nz);
      } else {
        const s = Math.min(sMax, hipY - vy);
        const f = s / ds, i0 = Math.min(N - 1, Math.floor(f)), t = f - i0;
        const ax = cy[i0] + (cy[i0 + 1] - cy[i0]) * t;
        const az = cz[i0] + (cz[i0 + 1] - cz[i0]) * t;
        const a = phi(s);
        // the axis frame's perpendicular: rotate (+z) by the same angle
        const ny = ax + vz * -Math.sin(a);
        const nz = az + vz * Math.cos(a);
        p.setY(i, ny); p.setZ(i, face * nz);
      }
    }
    p.needsUpdate = true;
    m.geometry.computeBoundingBox();
    m.geometry.computeBoundingSphere();
  }
  return { stature: H, hipY, seatAboveFeet: hipY - cy[N], sMax };
}

/**
 * Load `url` and get it diorama-ready (style lock, real-world scale, feet on
 * y=0) WITHOUT putting it anywhere. This is the half of `swapSlot` a caller
 * needs when a slot has to hold two models and flip between them with no
 * network in the middle — see the King's masked/unmasked pair.
 *
 * `pose: 'seated'` runs `seatFigure` AFTER the standing scale is derived (his
 * stature must set the scale, not his seated bbox) and re-lifts him onto the
 * slot floor afterwards; `r.seat` reports how high the chair he needs is.
 */
export async function prepareGLB(url, opts = {}) {
  const { height, depth, yaw = 0, y = 0, lift = false, flat = false, tint } = opts;
  const gltf = await loadGLB(url);
  const obj = gltf.scene || gltf.scenes[0];

  if (flat) flatten(obj, tint);
  else if (tint !== undefined) {
    obj.traverse(o => { if (o.material && o.material.color) o.material.color.setHex(tint); });
  }

  obj.updateWorldMatrix(true, true);
  const bb = new THREE.Box3().setFromObject(obj);
  const size = bb.getSize(new THREE.Vector3());
  let scale = opts.scale;
  if (scale === undefined && height) scale = height / Math.max(1e-6, size.y);
  if (scale === undefined && depth) scale = depth / Math.max(1e-6, size.z);
  if (scale === undefined) scale = 1;

  obj.scale.setScalar(scale);
  obj.rotation.y = yaw;
  let seat = null, floorY = bb.min.y;
  if (opts.pose === 'seated') {
    seat = seatFigure(obj, opts.seat || {});
    obj.updateWorldMatrix(true, true);
    const bb2 = new THREE.Box3();
    obj.traverse((m) => {
      if (m.isMesh && m.geometry) { m.geometry.computeBoundingBox(); bb2.union(m.geometry.boundingBox); }
    });
    if (isFinite(bb2.min.y)) floorY = bb2.min.y;
  }
  obj.position.y = (lift ? -floorY * scale : 0) + y;
  obj.traverse(o => { o.userData.generated = true; });
  return { gltf, obj, tris: countTris(obj), scale,
           seat: seat ? { stature: +(seat.stature * scale).toFixed(4),
                          seatAboveFeet: +(seat.seatAboveFeet * scale).toFixed(4) } : null,
           size: [+size.x.toFixed(3), +size.y.toFixed(3), +size.z.toFixed(3)] };
}

export async function swapSlot(slot, url, opts = {}) {
  const r = await prepareGLB(url, opts);
  slot.replace(r.obj);
  return r;
}
