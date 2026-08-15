#!/usr/bin/env node
/**
 * riginspect.mjs — parse a rigged GLB and report skeleton + skinning stats as JSON.
 *
 * Reports: bone names/count/hierarchy, Mixamo-convention check, rest pose sanity,
 * skin weights (max influences, zero-weight verts, weight-sum drift), animation clips.
 *
 * usage: node tools/riginspect.mjs <file.glb>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: riginspect.mjs <file.glb>'); process.exit(2); }
const buf = fs.readFileSync(file);

// --- GLB container ---
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not GLB');
const total = buf.readUInt32LE(8);
let off = 12, json = null, bin = null;
while (off < total) {
  const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
  const chunk = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
  else if (type === 0x004e4942) bin = chunk;
  off += 8 + len;
}

const COMP = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(idx) {
  const acc = json.accessors[idx];
  const bv = json.bufferViews[acc.bufferView];
  const [Arr, sz] = COMP[acc.componentType];
  const n = NCOMP[acc.type];
  const stride = bv.byteStride || sz * n;
  const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const out = new Float64Array(acc.count * n);
  for (let i = 0; i < acc.count; i++) {
    const p = base + i * stride;
    for (let c = 0; c < n; c++) {
      const raw = new Arr(bin.buffer, bin.byteOffset + p + c * sz, 1)[0];
      out[i * n + c] = acc.normalized
        ? (Arr === Uint8Array ? raw / 255 : Arr === Uint16Array ? raw / 65535 : raw)
        : raw;
    }
  }
  return { data: out, count: acc.count, n, componentType: acc.componentType, normalized: !!acc.normalized };
}

const report = { file, generator: json.asset?.generator, meshes: [], skins: [], animations: [], nodes: json.nodes.length };

// --- hierarchy ---
const nodes = json.nodes;
const parent = new Array(nodes.length).fill(-1);
nodes.forEach((nd, i) => (nd.children || []).forEach((c) => (parent[c] = i)));
function chain(i) { const names = []; while (i >= 0) { names.push(nodes[i].name || `#${i}`); i = parent[i]; } return names.reverse(); }

// --- skins ---
const MIXAMO_CORE = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
for (const [si, skin] of (json.skins || []).entries()) {
  const names = skin.joints.map((j) => nodes[j].name || `#${j}`);
  const stripped = names.map((n) => n.replace(/^mixamorig:?/, ''));
  const coreHit = MIXAMO_CORE.filter((b) => stripped.includes(b));
  // depth-first hierarchy print limited to skin joints
  const jointSet = new Set(skin.joints);
  const roots = skin.joints.filter((j) => !jointSet.has(parent[j]));
  const lines = [];
  function walk(i, d) {
    lines.push('  '.repeat(d) + (nodes[i].name || `#${i}`));
    (nodes[i].children || []).filter((c) => jointSet.has(c)).forEach((c) => walk(c, d + 1));
  }
  roots.forEach((r) => walk(r, 0));
  // rest pose: bone translations (local)
  const hipsIdx = skin.joints.find((j) => /Hips$/.test(nodes[j].name || ''));
  report.skins.push({
    index: si,
    jointCount: skin.joints.length,
    mixamoPrefix: names[0]?.startsWith('mixamorig'),
    mixamoCoreMatched: `${coreHit.length}/${MIXAMO_CORE.length}`,
    missingCore: MIXAMO_CORE.filter((b) => !stripped.includes(b)),
    extraJoints: stripped.filter((n) => !MIXAMO_CORE.includes(n) && !/Thumb|Index|Middle|Ring|Pinky/.test(n)),
    fingerJoints: stripped.filter((n) => /Thumb|Index|Middle|Ring|Pinky/.test(n)).length,
    skeletonRootChain: roots.map((r) => chain(r).join(' > ')),
    hierarchy: lines.join('\n'),
    hipsLocalTranslation: hipsIdx != null ? nodes[hipsIdx].translation : null,
  });
}

// --- meshes & weights ---
for (const [ni, nd] of nodes.entries()) {
  if (nd.mesh == null) continue;
  const mesh = json.meshes[nd.mesh];
  for (const [pi, prim] of mesh.primitives.entries()) {
    const entry = { node: nd.name || `#${ni}`, mesh: mesh.name, prim: pi, skinned: nd.skin != null };
    const pos = json.accessors[prim.attributes.POSITION];
    entry.vertexCount = pos.count;
    entry.triangles = prim.indices != null ? json.accessors[prim.indices].count / 3 : pos.count / 3;
    entry.posMin = pos.min; entry.posMax = pos.max;
    const sets = Object.keys(prim.attributes).filter((k) => k.startsWith('WEIGHTS_')).length;
    entry.weightSets = sets;
    if (sets > 0 && nd.skin != null) {
      const w = [], j = [];
      for (let s = 0; s < sets; s++) { w.push(readAccessor(prim.attributes[`WEIGHTS_${s}`])); j.push(readAccessor(prim.attributes[`JOINTS_${s}`])); }
      const jointNames = json.skins[nd.skin].joints.map((x) => nodes[x].name || `#${x}`);
      let zeroW = 0, maxInf = 0, sumMin = Infinity, sumMax = -Infinity, badSum = 0;
      const infHist = {};
      const perBoneW = new Float64Array(jointNames.length);
      for (let v = 0; v < pos.count; v++) {
        let sum = 0, inf = 0;
        for (let s = 0; s < sets; s++) for (let c = 0; c < 4; c++) {
          const wv = w[s].data[v * 4 + c];
          sum += wv;
          if (wv > 1e-4) { inf++; perBoneW[j[s].data[v * 4 + c]] += wv; }
        }
        if (sum < 1e-4) zeroW++;
        else { sumMin = Math.min(sumMin, sum); sumMax = Math.max(sumMax, sum); if (Math.abs(sum - 1) > 0.01) badSum++; }
        maxInf = Math.max(maxInf, inf);
        infHist[inf] = (infHist[inf] || 0) + 1;
      }
      entry.weights = {
        componentType: w[0].componentType, normalized: w[0].normalized,
        zeroWeightVerts: zeroW, maxInfluences: maxInf, influenceHistogram: infHist,
        weightSumRange: [Number(sumMin.toFixed(5)), Number(sumMax.toFixed(5))], vertsWithSumOff1: badSum,
      };
      entry.topBonesByWeight = [...perBoneW.keys()]
        .map((i) => [jointNames[i], Number(perBoneW[i].toFixed(1))])
        .sort((a, b) => b[1] - a[1]).slice(0, 12);
      entry.unweightedBones = jointNames.filter((_, i) => perBoneW[i] < 1e-3);
    }
    report.meshes.push(entry);
  }
}

// --- animations ---
for (const anim of json.animations || []) {
  const targets = new Set(anim.channels.map((c) => nodes[c.target.node]?.name + '.' + c.target.path));
  let dur = 0;
  for (const s of anim.samplers) { const acc = json.accessors[s.input]; dur = Math.max(dur, acc.max?.[0] ?? 0); }
  report.animations.push({ name: anim.name, channels: anim.channels.length, durationSec: Number(dur.toFixed(3)), sampleTargets: [...targets].slice(0, 8) });
}

console.log(JSON.stringify(report, (k, v) => k === 'hierarchy' ? undefined : v, 2));
if (report.skins[0]) { console.error('\n=== SKELETON HIERARCHY ===\n' + report.skins[0].hierarchy); }
