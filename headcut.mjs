#!/usr/bin/env node
/**
 * headcut.mjs — HYBRID KING, step 1: cut the Tripo mesh's head off at the neck.
 *
 * Loads assets/plates/king-v2/king2-tripo.glb (single mesh, single jpeg-textured
 * material, pygltflib GLB: JSON chunk + BIN chunk), bakes the node transform
 * chain into the positions so Y is world-up at world scale, then:
 *
 *   1. finds the NECK PLANE — the narrowest horizontal cross-section (slab bbox
 *      area, xExtent * zExtent) scanned between 78% and 88% of total height;
 *   2. keeps every triangle whose three vertices all sit ABOVE that plane;
 *   3. drops disconnected fragments (the standing cloak collar behind the neck
 *      pokes above the plane too — union-find keeps only the component that owns
 *      the topmost vertex, i.e. the skull);
 *   4. rebuilds an indexed BufferGeometry-shaped GLB preserving POSITION /
 *      NORMAL / TEXCOORD_0 and the ORIGINAL jpeg texture bytes + material,
 *      written to assets/plates/king-v2/king2-head.glb for kinghybrid.mjs.
 *
 * Reports: tris kept, open-rim vertex count (boundary edges counted on
 * position-welded vertices, so UV seams don't inflate it), bbox.
 *
 * usage: node tools/headcut.mjs [--in GLB] [--out GLB] [--lo 0.83] [--hi 0.87]
 *
 * The default search window is 83-87% of height (inside the task's 78-88%):
 * the Tripo shell fuses the shirt collar and cloak collar to the neck skin, so
 * a plane much below 83% keeps the whole bust connected (measured: a cut at
 * 79.75% kept collar + tie + chest as ONE component). At 83%+ the plane passes
 * under the chin, the collar ring disconnects and the component filter drops
 * it (256 tris on the default run), leaving the head + the small fused collar
 * slivers that tuck inside the procedural collar during assembly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const IN = path.resolve(ROOT, flag('in', 'assets/plates/king-v2/king2-tripo.glb'));
const OUT = path.resolve(ROOT, flag('out', 'assets/plates/king-v2/king2-head.glb'));
const LO = Number(flag('lo', 0.83)), HI = Number(flag('hi', 0.87));

/* ---------------- GLB parse (glTF 2.0 binary, JSON + BIN chunks) -------- */
const buf = fs.readFileSync(IN);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
let bin = null;
{
  let o = 20 + jsonLen;
  while (o < buf.length) {
    const len = buf.readUInt32LE(o), type = buf.readUInt32LE(o + 4);
    if (type === 0x004e4942) { bin = buf.subarray(o + 8, o + 8 + len); break; }
    o += 8 + len;
  }
}
if (!bin) throw new Error('no BIN chunk');

const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array,
             5125: Uint32Array, 5126: Float32Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function acc(i) {
  const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
  const Arr = CT[a.componentType], n = NC[a.type];
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
  if (bv.byteStride && bv.byteStride !== n * Arr.BYTES_PER_ELEMENT)
    throw new Error('interleaved accessor not supported');
  return new Arr(bin.buffer, bin.byteOffset + off, a.count * n);
}

/* the one mesh, and the world matrix of the node that carries it */
const meshNodeIdx = json.nodes.findIndex((n) => n.mesh !== undefined);
const nodeMat = (n) => {
  const m = new THREE.Matrix4();
  if (n.matrix) m.fromArray(n.matrix);
  else {
    const t = n.translation || [0, 0, 0], r = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
    m.compose(new THREE.Vector3(...t), new THREE.Quaternion(...r), new THREE.Vector3(...s));
  }
  return m;
};
let world = nodeMat(json.nodes[meshNodeIdx]);
for (let i = 0; i < json.nodes.length; i++) {
  const n = json.nodes[i];
  if (n.children && n.children.includes(meshNodeIdx)) {
    world = nodeMat(n).multiply(world);          // one-deep chain in this GLB
    break;
  }
}
const normalMat = new THREE.Matrix3().getNormalMatrix(world);

const prim = json.meshes[0].primitives[0];
const posIn = acc(prim.attributes.POSITION);
const nrmIn = acc(prim.attributes.NORMAL);
const uvIn = acc(prim.attributes.TEXCOORD_0);
const idxIn = acc(prim.indices);
const vCount = posIn.length / 3, triCount = idxIn.length / 3;

/* bake the transform */
const pos = new Float32Array(posIn.length), nrm = new Float32Array(nrmIn.length);
{
  const v = new THREE.Vector3();
  for (let i = 0; i < vCount; i++) {
    v.set(posIn[i * 3], posIn[i * 3 + 1], posIn[i * 3 + 2]).applyMatrix4(world);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    v.set(nrmIn[i * 3], nrmIn[i * 3 + 1], nrmIn[i * 3 + 2]).applyMatrix3(normalMat).normalize();
    nrm[i * 3] = v.x; nrm[i * 3 + 1] = v.y; nrm[i * 3 + 2] = v.z;
  }
}

/* ---------------- the neck plane ----------------------------------------
 * "Narrowest horizontal cross-section" has to mean the NECK TUBE, not the slab
 * bbox: the Tripo king wears a standing cloak collar that rises past his ears,
 * so any whole-slab measure bottoms out at the collar bone, keeps the collar +
 * tie + chest, and the first cut of this tool proved it (cut landed at 0.814,
 * bbox 0.32 x 0.31 — a bust, not a head). So: take the skull axis (xz centroid
 * of the top 8% of the mesh), sort each slab's vertices by radial distance from
 * that axis, and walk outward until the first radial GAP wider than 0.02 * H —
 * everything inside the gap is the neck cluster, the collar is beyond it. The
 * metric is the neck cluster's outer radius; the neck plane is its minimum. */
let yMin = Infinity, yMax = -Infinity;
for (let i = 0; i < vCount; i++) { const y = pos[i * 3 + 1];
  if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
const H = yMax - yMin;
let axX = 0, axZ = 0, axN = 0;
for (let i = 0; i < vCount; i++) {
  if (pos[i * 3 + 1] < yMax - 0.08 * H) continue;
  axX += pos[i * 3]; axZ += pos[i * 3 + 2]; axN++;
}
axX /= axN; axZ /= axN;
const STEPS = 80, slabH = H / 160, GAP = 0.02 * H;
let best = { y: 0, r: Infinity, n: 0, beyond: 0 };
for (let s = 0; s <= STEPS; s++) {
  const yc = yMin + H * (LO + (HI - LO) * s / STEPS);
  const radii = [];
  for (let i = 0; i < vCount; i++) {
    const y = pos[i * 3 + 1];
    if (Math.abs(y - yc) > slabH) continue;
    radii.push(Math.hypot(pos[i * 3] - axX, pos[i * 3 + 2] - axZ));
  }
  if (radii.length < 8) continue;
  radii.sort((a, b) => a - b);
  let r = radii[0], k = 1;
  while (k < radii.length && radii[k] - r <= GAP) { r = radii[k]; k++; }
  if (r < best.r) best = { y: yc, r, n: k, beyond: radii.length - k };
}
const yCut = best.y;

/* ---------------- the cut ----------------------------------------------- */
const keptTri = [];
for (let t = 0; t < triCount; t++) {
  const a = idxIn[t * 3], b = idxIn[t * 3 + 1], c = idxIn[t * 3 + 2];
  if (pos[a * 3 + 1] > yCut && pos[b * 3 + 1] > yCut && pos[c * 3 + 1] > yCut) keptTri.push(t);
}

/* connected components over shared POSITION (weld by quantized xyz so UV-seam
 * duplicates stay in one component) — keep the component with the topmost vertex */
const weld = new Map();                     // quantized pos -> weld id
const weldOf = new Int32Array(vCount).fill(-1);
const q = (v) => Math.round(v * 1e5);
for (let i = 0; i < vCount; i++) {
  const k = q(pos[i * 3]) + '|' + q(pos[i * 3 + 1]) + '|' + q(pos[i * 3 + 2]);
  let id = weld.get(k);
  if (id === undefined) { id = weld.size; weld.set(k, id); }
  weldOf[i] = id;
}
const parent = new Int32Array(weld.size);
for (let i = 0; i < parent.length; i++) parent[i] = i;
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
for (const t of keptTri) {
  const a = weldOf[idxIn[t * 3]], b = weldOf[idxIn[t * 3 + 1]], c = weldOf[idxIn[t * 3 + 2]];
  union(a, b); union(b, c);
}
let topV = -1, topY = -Infinity;
for (const t of keptTri) for (let k = 0; k < 3; k++) {
  const i = idxIn[t * 3 + k], y = pos[i * 3 + 1];
  if (y > topY) { topY = y; topV = i; }
}
const headRoot = find(weldOf[topV]);
const headTri = keptTri.filter((t) => find(weldOf[idxIn[t * 3]]) === headRoot);
const droppedFrag = keptTri.length - headTri.length;

/* ---------------- rebuild ------------------------------------------------ */
const remap = new Int32Array(vCount).fill(-1);
const oPos = [], oNrm = [], oUv = [], oIdx = [];
for (const t of headTri) {
  for (let k = 0; k < 3; k++) {
    const i = idxIn[t * 3 + k];
    if (remap[i] < 0) {
      remap[i] = oPos.length / 3;
      oPos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      oNrm.push(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
      oUv.push(uvIn[i * 2], uvIn[i * 2 + 1]);
    }
    oIdx.push(remap[i]);
  }
}
const nV = oPos.length / 3, nT = oIdx.length / 3;

/* open rim: boundary edges on the welded graph (each non-boundary edge is shared
 * by exactly two kept triangles) — count the welded vertices those edges touch */
const edges = new Map();
for (const t of headTri) {
  const w3 = [weldOf[idxIn[t * 3]], weldOf[idxIn[t * 3 + 1]], weldOf[idxIn[t * 3 + 2]]];
  for (let k = 0; k < 3; k++) {
    const a = w3[k], b = w3[(k + 1) % 3];
    const key = a < b ? a + '|' + b : b + '|' + a;
    edges.set(key, (edges.get(key) || 0) + 1);
  }
}
const rimVerts = new Set();
let rimEdges = 0, rimYSum = 0, rimN = 0;
for (const [key, count] of edges) {
  if (count !== 1) continue;
  rimEdges++;
  for (const w2 of key.split('|')) rimVerts.add(Number(w2));
}
/* rim y stats off the ORIGINAL indices that weld to rim ids */
for (let i = 0; i < vCount; i++) {
  if (remap[i] >= 0 && rimVerts.has(weldOf[i])) { rimYSum += pos[i * 3 + 1]; rimN++; }
}

const bb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
for (let i = 0; i < nV; i++) for (let k = 0; k < 3; k++) {
  const v = oPos[i * 3 + k];
  if (v < bb.min[k]) bb.min[k] = v; if (v > bb.max[k]) bb.max[k] = v;
}

/* ---------------- write the head GLB (hand-rolled, texture bytes as-is) -- */
const img = json.images[0];
const ibv = json.bufferViews[img.bufferView];
const imgBytes = bin.subarray(ibv.byteOffset || 0, (ibv.byteOffset || 0) + ibv.byteLength);

const align4 = (n) => (n + 3) & ~3;
const posBytes = Buffer.from(new Float32Array(oPos).buffer);
const nrmBytes = Buffer.from(new Float32Array(oNrm).buffer);
const uvBytes = Buffer.from(new Float32Array(oUv).buffer);
const IdxArr = nV > 65535 ? Uint32Array : Uint16Array;
const idxBytes = Buffer.from(new IdxArr(oIdx).buffer);
const views = [];
const chunks = [];
let off = 0;
const addView = (bytes, target) => {
  const v = { buffer: 0, byteOffset: off, byteLength: bytes.length };
  if (target) v.target = target;
  views.push(v);
  chunks.push(bytes);
  const pad = align4(bytes.length) - bytes.length;
  if (pad) chunks.push(Buffer.alloc(pad));
  off += align4(bytes.length);
  return views.length - 1;
};
const vPos = addView(posBytes, 34962), vNrm = addView(nrmBytes, 34962),
      vUv = addView(uvBytes, 34962), vIdx = addView(idxBytes, 34963),
      vImg = addView(Buffer.from(imgBytes));
const outJson = {
  asset: { generator: 'gaslight-remake tools/headcut.mjs', version: '2.0' },
  scenes: [{ nodes: [0] }], scene: 0,
  nodes: [{ mesh: 0, name: 'tripoHead' }],
  meshes: [{ name: 'tripoHead', primitives: [{
    attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0, mode: 4 }] }],
  materials: [{ name: 'tripoHeadSkin', doubleSided: true,
    pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0,
      roughnessFactor: 0.9, baseColorTexture: { index: 0, texCoord: 0 } } }],
  textures: [{ source: 0, sampler: 0 }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  images: [{ mimeType: img.mimeType, bufferView: vImg, name: img.name }],
  accessors: [
    { bufferView: vPos, componentType: 5126, count: nV, type: 'VEC3', min: bb.min, max: bb.max },
    { bufferView: vNrm, componentType: 5126, count: nV, type: 'VEC3' },
    { bufferView: vUv, componentType: 5126, count: nV, type: 'VEC2' },
    { bufferView: vIdx, componentType: nV > 65535 ? 5125 : 5123, count: nT * 3, type: 'SCALAR' },
  ],
  bufferViews: views,
  buffers: [{ byteLength: off }],
};
const jsonBuf = Buffer.from(JSON.stringify(outJson), 'utf8');
const jsonPad = align4(jsonBuf.length) - jsonBuf.length;
const binBuf = Buffer.concat(chunks);
const total = 12 + 8 + jsonBuf.length + jsonPad + 8 + binBuf.length;
const head = Buffer.alloc(12 + 8);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
head.writeUInt32LE(jsonBuf.length + jsonPad, 12); head.writeUInt32LE(0x4e4f534a, 16);
const binHead = Buffer.alloc(8);
binHead.writeUInt32LE(binBuf.length, 0); binHead.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(OUT, Buffer.concat([head, jsonBuf, Buffer.from(' '.repeat(jsonPad)), binHead, binBuf]));

/* ---------------- report ------------------------------------------------- */
const report = {
  in: path.relative(ROOT, IN), out: path.relative(ROOT, OUT),
  source: { verts: vCount, tris: triCount, height: +H.toFixed(4), yMin: +yMin.toFixed(4), yMax: +yMax.toFixed(4) },
  neckPlane: { y: +yCut.toFixed(4), frac: +((yCut - yMin) / H).toFixed(4),
               neckRadius: +best.r.toFixed(4), neckSlabVerts: best.n,
               vertsBeyondGap: best.beyond,
               skullAxis: [+axX.toFixed(4), +axZ.toFixed(4)] },
  cut: { trisAbovePlane: keptTri.length, trisKept: nT, fragmentTrisDropped: droppedFrag,
         verts: nV, rimVerts: rimVerts.size, rimEdges,
         rimMeanY: rimN ? +(rimYSum / rimN).toFixed(4) : null },
  bbox: { min: bb.min.map((v) => +v.toFixed(4)), max: bb.max.map((v) => +v.toFixed(4)),
          size: bb.max.map((v, k) => +(v - bb.min[k]).toFixed(4)) },
  bytes: fs.statSync(OUT).size,
};
console.log(JSON.stringify(report, null, 2));
