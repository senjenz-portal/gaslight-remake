/* king-sdf.js — the implicit-surface runtime for the code-only King.
 *
 * img2threejs implicit track (grimoire/build/implicit_sdf_modeling.md + the character
 * contract's L0 law: "Implicit SDF smooth-union → marching cubes"): the generator samples a
 * signed distance field and polygonizes it IN CODE. Here the field's source is a dense
 * point-cloud sampling of king2-rigged.glb, computed offline
 * (tools/ody/work/kingsdf/build_field.py) and shipped as king-field.bin — quantized
 * distance + palette + part + skin-weight voxels. No mesh file is loaded at runtime:
 * every triangle below is created by marching cubes in this file, in the browser.
 *
 * king-field.bin layout (gzip): u32 headerLen | headerJSON | per-field arrays
 *   int8 dist (signed distance / 4 cells * 127), uint8 pal, uint8 part, uint8 jA, jB, wA.
 */
import * as THREE from 'three';
import { edgeTable, triTable } from './king-mc-tables.js';

let FIELD = null;

export async function loadKingField(url = './king-field.bin') {
  if (FIELD) return FIELD;
  const res = await fetch(url);
  if (!res.ok) throw new Error('king-field.bin HTTP ' + res.status);
  const ds = new DecompressionStream('gzip');
  const buf = await new Response(res.body.pipeThrough(ds)).arrayBuffer();
  const dv = new DataView(buf);
  const hlen = dv.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hlen)));
  const base = 4 + hlen;
  for (const f of header.fields) {
    const n = f.voxels;
    let o = base + f.offset;
    f.dist = new Int8Array(buf, o, n); o += n;
    f.pal  = new Uint8Array(buf, o, n); o += n;
    f.part = new Uint8Array(buf, o, n); o += n;
    f.jA   = new Uint8Array(buf, o, n); o += n;
    f.jB   = new Uint8Array(buf, o, n); o += n;
    f.wA   = new Uint8Array(buf, o, n);
  }
  FIELD = header;
  return header;
}

export function kingFieldOrThrow() {
  if (!FIELD) throw new Error('loadKingField() must resolve before createKingModel()');
  return FIELD;
}

/* ---- marching cubes over one field (edge-deduplicated, indexed output) ----
 * Corner-bit and edge conventions match three.js MarchingCubes.js exactly
 * (see king-mc-tables.js); "inside" is dist < 0. */
export function marchField(fld) {
  const [nx, ny, nz] = fld.dims;
  const yd = nx, zd = nx * ny;
  const d = fld.dist;
  const [ox, oy, oz] = fld.origin;
  const cell = fld.cell;

  const positions = [];
  const vVox = [];                    // nearest voxel per vertex (for attribute lookup)
  const edgeMap = new Map();          // edge key -> vertex index
  const indices = [];

  // edge -> [cornerA offset, cornerB offset, axis] where axis 0=x 1=y 2=z
  const EDGE = [
    [0, 1, 0], [1, 1 + yd, 1], [yd, 1 + yd, 0], [0, yd, 1],
    [zd, 1 + zd, 0], [1 + zd, 1 + yd + zd, 1], [yd + zd, 1 + yd + zd, 0], [zd, yd + zd, 1],
    [0, zd, 2], [1, 1 + zd, 2], [1 + yd, 1 + yd + zd, 2], [yd, yd + zd, 2],
  ];

  const vlist = new Int32Array(12);
  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      let q = y * yd + z * zd;
      for (let x = 0; x < nx - 1; x++, q++) {
        const f0 = d[q], f1 = d[q + 1], f2 = d[q + yd], f3 = d[q + 1 + yd],
              f4 = d[q + zd], f5 = d[q + 1 + zd], f6 = d[q + yd + zd], f7 = d[q + 1 + yd + zd];
        let cube = 0;
        if (f0 < 0) cube |= 1;
        if (f1 < 0) cube |= 2;
        if (f2 < 0) cube |= 8;
        if (f3 < 0) cube |= 4;
        if (f4 < 0) cube |= 16;
        if (f5 < 0) cube |= 32;
        if (f6 < 0) cube |= 128;
        if (f7 < 0) cube |= 64;
        const bits = edgeTable[cube];
        if (bits === 0) continue;
        for (let e = 0; e < 12; e++) {
          if (!(bits & (1 << e))) continue;
          const [oa, ob, axis] = EDGE[e];
          const qa = q + oa, qb = q + ob;
          const key = qa * 3 + axis;
          let vi = edgeMap.get(key);
          if (vi === undefined) {
            const fa = d[qa], fb = d[qb];
            const t = fa / (fa - fb || 1e-9);
            // voxel coords of qa
            const az = (qa / zd) | 0, ay = ((qa - az * zd) / yd) | 0, ax = qa - az * zd - ay * yd;
            let px = ox + (ax + 0.5) * cell, py = oy + (ay + 0.5) * cell, pz = oz + (az + 0.5) * cell;
            if (axis === 0) px += t * cell; else if (axis === 1) py += t * cell; else pz += t * cell;
            vi = positions.length / 3;
            positions.push(px, py, pz);
            // attributes always from the OUTSIDE voxel: its nearest sample is the sheet the
            // surface actually faces (the inside voxel may be nearer a hidden inner sheet)
            vVox.push(fa >= 0 ? qa : qb);
            edgeMap.set(key, vi);
          }
          vlist[e] = vi;
        }
        let ti = cube << 4;
        while (triTable[ti] !== -1) {
          indices.push(vlist[triTable[ti]], vlist[triTable[ti + 1]], vlist[triTable[ti + 2]]);
          ti += 3;
        }
      }
    }
  }

  // winding: the SDF gradient points outward; make face normals agree with it,
  // decided once per field from a vote instead of a guessed convention.
  let agree = 0, tested = 0;
  const P = positions;
  for (let i = 0; i < indices.length && tested < 400; i += Math.max(3, (indices.length / 1200 | 0) * 3)) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const abx = P[b] - P[a], aby = P[b + 1] - P[a + 1], abz = P[b + 2] - P[a + 2];
    const acx = P[c] - P[a], acy = P[c + 1] - P[a + 1], acz = P[c + 2] - P[a + 2];
    const nxv = aby * acz - abz * acy, nyv = abz * acx - abx * acz, nzv = abx * acy - aby * acx;
    const q = vVox[indices[i]];
    const az = (q / zd) | 0, ay = ((q - az * zd) / yd) | 0, ax = q - az * zd - ay * yd;
    if (ax < 1 || ay < 1 || az < 1 || ax >= nx - 1 || ay >= ny - 1 || az >= nz - 1) continue;
    const gx = d[q + 1] - d[q - 1], gy = d[q + yd] - d[q - yd], gz = d[q + zd] - d[q - zd];
    const dot = nxv * gx + nyv * gy + nzv * gz;
    if (dot !== 0) { agree += dot > 0 ? 1 : -1; tested++; }
  }
  if (agree < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = tmp;
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices), vVox };
}

/* ---- build per-part indexed geometries with colors, normals, skin weights ---- */
export function buildKingParts(header, fieldNames, {
  shoulderY, coatChain = [17, 18, 19], coatParts = ['coat', 'coat-lining'],
} = {}) {
  const partsOut = new Map();     // part name -> { indices: [] , layer, bone }
  const geoms = [];

  for (const fname of fieldNames) {
    const fld = header.fields.find(f => f.name === fname);
    const keep = new Set(fld.keepParts);
    const { positions, indices, vVox } = marchField(fld);
    const nVerts = positions.length / 3;

    // vertex attributes from the nearest voxel
    const colors = new Float32Array(nVerts * 3);
    const partOf = new Uint8Array(nVerts);
    const skinIndex = new Uint16Array(nVerts * 4);
    const skinWeight = new Float32Array(nVerts * 4);
    const pal = header.palette;
    const coatSet = new Set(coatParts.map(n => header.parts.findIndex(p => p.name === n)));
    const srgb = new THREE.Color();
    for (let v = 0; v < nVerts; v++) {
      const q = vVox[v];
      const pi = fld.part[q];
      partOf[v] = pi;
      const pc = pal[fld.pal[q]];
      srgb.setRGB(pc[0] / 255, pc[1] / 255, pc[2] / 255, THREE.SRGBColorSpace);
      colors[v * 3] = srgb.r; colors[v * 3 + 1] = srgb.g; colors[v * 3 + 2] = srgb.b;
      if (coatSet.has(pi) && positions[v * 3 + 1] < shoulderY + 0.05) {
        // the coat is a cross-joint shell (L4): it rides its own sway chain by drape height,
        // exactly the shipped v1 bindCoat law, so walk/idle coat trail behaviour is preserved
        const t = Math.min(Math.max((shoulderY + 0.045 - positions[v * 3 + 1]) / 1.325, 0), 1);
        let w0, w1, w2;
        if (t < 0.45) { const f = t / 0.45; w0 = 1 - f; w1 = f; w2 = 0; }
        else { const f = (t - 0.45) / 0.55; w0 = 0; w1 = 1 - f; w2 = f; }
        skinIndex.set([coatChain[0], coatChain[1], coatChain[2], 0], v * 4);
        skinWeight.set([w0, w1, w2, 0], v * 4);
      } else {
        const wA = fld.wA[q] / 255;
        skinIndex.set([fld.jA[q], fld.jB[q], 0, 0], v * 4);
        skinWeight.set([wA, 1 - wA, 0, 0], v * 4);
      }
    }

    // smooth normals on the WELDED geometry (before the part split, so part seams shade continuously)
    const whole = new THREE.BufferGeometry();
    whole.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    whole.setIndex(new THREE.BufferAttribute(indices, 1));
    whole.computeVertexNormals();
    const normals = whole.getAttribute('normal');

    // split triangles by part (vote of the 3 corners), keep only this field's parts
    const byPart = new Map();
    for (let i = 0; i < indices.length; i += 3) {
      const pa = partOf[indices[i]], pb = partOf[indices[i + 1]], pc2 = partOf[indices[i + 2]];
      const pi = (pb === pc2) ? pb : pa;
      if (!keep.has(pi)) continue;
      let arr = byPart.get(pi);
      if (!arr) { arr = []; byPart.set(pi, arr); }
      arr.push(indices[i], indices[i + 1], indices[i + 2]);
    }

    const posAttr = new THREE.BufferAttribute(positions, 3);
    const colAttr = new THREE.BufferAttribute(colors, 3);
    const siAttr = new THREE.BufferAttribute(skinIndex, 4);
    const swAttr = new THREE.BufferAttribute(skinWeight, 4);
    for (const [pi, tri] of byPart) {
      const meta = header.parts[pi];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', posAttr);
      g.setAttribute('normal', normals);
      g.setAttribute('color', colAttr);
      g.setAttribute('skinIndex', siAttr);
      g.setAttribute('skinWeight', swAttr);
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(tri), 1));
      // part centroid for the explode layout
      const cen = new THREE.Vector3();
      const seen = new Set();
      for (const vi of tri) {
        if (seen.has(vi)) continue;
        seen.add(vi);
        cen.x += positions[vi * 3]; cen.y += positions[vi * 3 + 1]; cen.z += positions[vi * 3 + 2];
      }
      cen.multiplyScalar(1 / Math.max(1, seen.size));
      geoms.push({ name: meta.name, layer: meta.layer, bone: meta.bone, geometry: g,
                   centroid: cen, tris: tri.length / 3, field: fname });
    }
  }
  return geoms;
}

/* ---- explode support: a world-space offset applied AFTER skinning ----
 * A SkinnedMesh ignores its own transform, so parts separate through a per-material
 * uniform patched into project_vertex (and into the shadow depth material). */
export function makeExplodable(mat) {
  const u = { value: new THREE.Vector3() };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uExplode = u;
    shader.vertexShader = 'uniform vec3 uExplode;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 kx_world = modelMatrix * vec4( transformed, 1.0 );
kx_world.xyz += uExplode;
vec4 mvPosition = viewMatrix * kx_world;
gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'king-explode';
  return u;
}
