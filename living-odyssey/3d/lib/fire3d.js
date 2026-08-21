/**
 * fire3d.js — the SHARED seeded particle-fire module + low-poly facet toolkit.
 *
 * Extracted verbatim from demo3d/full3d/createCaveScene.js (the cave set, the
 * worked img2threejs example) so every 3D set burns the SAME fire: flames,
 * embers and smoke are GPU point systems whose positions are PURE functions of
 * (per-particle seed attributes, uTime) — no state, no wall clock. tick(simT)
 * writes uniforms only; setSim(t) replays any second byte-identically.
 *
 * Also carries the register's deterministic helpers (mulberry32, position-hash
 * jitter, per-face facet colors, face deletion, flat material, glow sprite) —
 * the Baker Street / cave-set facet law in one place.
 *
 * Exports
 *   mulberry32(seed)                     deterministic RNG stream
 *   hash3(x,y,z,seed)                    quantised position hash (crack-free)
 *   jitterByPos(geo, seed, amp)          shared-position vertex jitter
 *   facetColors(geo, hex, seed, amount)  per-face value jitter -> vertex colors
 *   dropFaces(geo, keep)                 delete triangles by centroid predicate
 *   flatMat(opts)                        flat-shaded MeshStandardMaterial
 *   glowTexture(inner, outer)            radial-gradient sprite canvas
 *   fireSystem({count,seed,radius,height,size,mode[,px]})  flame|ember|smoke Points
 *   flickCurve(t)                        the hearth flicker, pure f(t)
 *   PX_UNIFORM                           shared { value: px-per-metre } (ortho)
 */
import * as THREE from 'three';

/* ---------------- deterministic RNG + facet helpers ---------------- */
export function mulberry32(seed) {
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
export function hash3(x, y, z, seed) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (Math.round(x * 97) & 0xffff), 2654435761);
  h = Math.imul(h ^ (Math.round(y * 97) & 0xffff), 2246822519);
  h = Math.imul(h ^ (Math.round(z * 97) & 0xffff), 3266489917);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export function jitterByPos(geo, seed, amp) {
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
/* per-face value jitter -> painterly facets (vertex colors, flat by construction) */
export function facetColors(geo, baseHex, seed, amount = 0.10) {
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
/* delete triangles by centroid predicate (cutaways/clips — face deletion, never a boolean) */
export function dropFaces(geo, keep) {
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
export const flatMat = (opts = {}) => new THREE.MeshStandardMaterial({
  flatShading: true, metalness: 0, roughness: 0.95, ...opts });

/* radial-gradient sprite canvas (halos, particle discs) */
export function glowTexture(inner = 'rgba(255,220,140,1)', outer = 'rgba(255,150,40,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------- the seeded GPU particle fire ---------------- */
/* position/size/colour are computed IN THE VERTEX SHADER from per-particle seed
   attributes + uTime: pure f(t), deterministic, zero per-frame CPU work.
   `sz` is a WORLD diameter in metres; PX_UNIFORM (px per metre, ortho) converts
   to gl_PointSize — the page drives it on resize. */
export const PX_UNIFORM = { value: 34 };
export function fireSystem({ count, seed, radius, height, size, mode, px = PX_UNIFORM }) {
  const rnd = mulberry32(seed);
  const a0 = new Float32Array(count), r0 = new Float32Array(count),
        ph = new Float32Array(count), sp = new Float32Array(count),
        lf = new Float32Array(count), hm = new Float32Array(count),
        sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    a0[i] = rnd() * Math.PI * 2;
    r0[i] = Math.sqrt(rnd()) * radius;
    ph[i] = rnd() * 10;
    sp[i] = 0.75 + rnd() * 0.6;
    lf[i] = 0.9 + rnd() * 0.7;
    hm[i] = height * (0.7 + rnd() * 0.6);
    sz[i] = size * (0.6 + rnd() * 0.8);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('a0', new THREE.BufferAttribute(a0, 1));
  g.setAttribute('r0', new THREE.BufferAttribute(r0, 1));
  g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('sp', new THREE.BufferAttribute(sp, 1));
  g.setAttribute('lf', new THREE.BufferAttribute(lf, 1));
  g.setAttribute('hm', new THREE.BufferAttribute(hm, 1));
  g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height * 0.6, 0), height * 1.6 + radius);
  const MODE = { flame: 0, ember: 1, smoke: 2 }[mode];
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: glowTexture() }, uPx: px },
    transparent: true, depthWrite: false,
    blending: MODE === 2 ? THREE.NormalBlending : THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uPx;
      attribute float a0, r0, ph, sp, lf, hm, sz;
      varying float vU; varying float vTw;
      void main(){
        float u = mod(uTime * sp + ph, lf) / lf;      /* life fraction, pure f(t) */
        vU = u;
        float ang = a0 + u * (1.8 + sp);              /* swirl */
        float r = r0 * (1.0 - u * ${MODE === 2 ? '0.15' : '0.75'});
        vec3 p = vec3(cos(ang) * r, u * hm, sin(ang) * r * 0.92);
        ${MODE === 1 ? 'p.x += sin(u*9.0+ph)*0.12; p.z += cos(u*7.0+ph)*0.12;' : ''}
        ${MODE === 2 ? 'p.x += u*u*0.9; p.z -= u*0.15;' : ''}
        vTw = sin(uTime * (6.0 + sp * 4.0) + ph * 7.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        /* sz is a WORLD diameter in metres; uPx converts to pixels (ortho: no z term) */
        float s = sz * ${MODE === 0 ? '(1.0 - u * 0.72)' : MODE === 1 ? '(1.0 - u * 0.5)' : '(0.5 + u * 1.7)'};
        gl_PointSize = max(1.0, s * uPx);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      varying float vU; varying float vTw;
      void main(){
        vec4 tex = texture2D(uMap, gl_PointCoord);
        ${MODE === 0 ? `
        vec3 col = mix(vec3(1.0,0.88,0.45), vec3(1.0,0.45,0.12), smoothstep(0.15,0.75,vU));
        col = mix(col, vec3(0.75,0.16,0.05), smoothstep(0.75,1.0,vU));
        float a = tex.a * (1.0 - vU) * 0.9;` : MODE === 1 ? `
        vec3 col = mix(vec3(1.0,0.75,0.3), vec3(1.0,0.4,0.1), vU);
        float a = tex.a * (0.55 + 0.45 * vTw) * (1.0 - vU * vU);` : `
        vec3 col = vec3(0.42,0.44,0.52);
        float a = tex.a * 0.14 * (1.0 - abs(vU * 2.0 - 1.0));`}
        gl_FragColor = vec4(col, a);
        if (gl_FragColor.a < 0.01) discard;
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = true;
  return pts;
}

/* the hearth flicker — pure f(t), shared by every set's fire light */
export const flickCurve = (t) =>
  0.84 + 0.11 * Math.sin(2 * Math.PI * t / 3.1)
       + 0.05 * Math.sin(2 * Math.PI * t / 0.47 + 1.7)
       + 0.04 * Math.sin(2 * Math.PI * t / 1.13 + 0.6);
