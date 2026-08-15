#!/usr/bin/env node
/**
 * graftverify.mjs — headless three.js validation of the LANE A head transplant
 * (tools/blender-headgraft.py), in the rigverify/normalizer-verify pattern.
 *
 * For each GLB it reports and renders:
 *   1. CLIP PLAYS — clip 0 through an AnimationMixer, hips displacement t0->t50
 *      proving the run actually moves the rig.
 *   2. HEAD RIDES THE HEAD BONE — every vertex of the graft mesh whose skin
 *      weight on mixamorig:Head is >= 0.99 is skinned by hand
 *      (SkinnedMesh.applyBoneTransform) at 12 times across the clip and pushed
 *      into the Head bone's LOCAL frame. A rigid ride means those local
 *      coordinates never change: reported as rideDrift_mm (max over verts and
 *      frames). Lag or detach shows up here as millimetres.
 *   3. HEAD ACTUALLY MOVES — crown travel in world space over the clip, so a
 *      zero drift can't be confused with a head that is simply frozen.
 *   4. NO DETACH AT THE SEAM — every graft vertex in the neck band is paired
 *      with its nearest body vertex in bind pose, then the pair is re-measured
 *      at each sampled time. seam.maxOpeningVsBind_mm is what matters: how far
 *      any pair drifts from its bind-pose distance while the run plays. A
 *      transplant that snaps at the collar shows up there in millimetres.
 *   5. renders: full body at 0/25/50/75% of the clip, plus a FACE close-up and
 *      a NECK close-up at rest and mid-run.
 * With --before it also writes a face-close-up side-by-side.
 *
 * usage: node tools/graftverify.mjs --after PATH [--before PATH] --out DIR
 *          [--prefix graft] [--size 1024] [--samples 12]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const AFTER = flag('after', null) && path.resolve(flag('after'));
const BEFORE = flag('before', null) && path.resolve(flag('before'));
const OUT = flag('out', null) && path.resolve(flag('out'));
const PREFIX = flag('prefix', 'graft');
const SIZE = Number(flag('size', 1024));
const SAMPLES = Number(flag('samples', 12));
if (!AFTER || !OUT) { console.error('need --after and --out'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url === '/__after__' ? AFTER : url === '/__before__' ? BEFORE
    : path.join(ROOT, url);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript'
    : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const html = `<!doctype html><html><body style="margin:0">
<script type="importmap">{"imports":{
  "three":"/node_modules/three/build/three.module.js",
  "three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(${SIZE}, ${SIZE}, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const SAMPLES = ${SAMPLES};

window.run = async (url) => {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161c);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.8); rim.position.set(-3, 2, -2); scene.add(rim);
  scene.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);

  const shots = {};
  const info = { url, clips: gltf.animations.map((a) => ({ name: a.name, duration: a.duration, tracks: a.tracks.length })), meshes: [] };
  const snap = (n) => { shots[n] = canvas.toDataURL('image/png'); };
  const cam = new THREE.PerspectiveCamera(35, 1, 0.005, 100);
  const look = (target, dist, dir) => {
    cam.position.copy(target).addScaledVector(dir.clone().normalize(), dist);
    cam.lookAt(target); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  };
  const FRONT = new THREE.Vector3(0.25, 0.12, 1);

  const skinned = [];
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  for (const m of skinned) info.meshes.push({ name: m.name,
    verts: m.geometry.attributes.position.count,
    tris: (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3,
    material: m.material.name, map: m.material.map ? m.material.map.image.width + 'x' + m.material.map.image.height : null });
  const graft = skinned.find((m) => /goodface|head/i.test(m.name)) || null;
  const bodyMesh = skinned.find((m) => m !== graft) || null;
  let headBone = null, hips = null;
  gltf.scene.traverse((o) => {
    if (!o.isBone) return;
    if (/:?Head$/.test(o.name)) headBone = o;
    if (/Hips$/.test(o.name)) hips = o;
  });
  info.headBone = headBone ? headBone.name : null;

  /* ---- who is bound rigidly to the Head bone? ------------------------- */
  const headJoint = (mesh) => {
    if (!mesh || !headBone) return -1;
    return mesh.skeleton.bones.indexOf(headBone);
  };
  const rigidVerts = (mesh, thr = 0.99) => {
    const j = headJoint(mesh); if (j < 0) return [];
    const sk = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
    const out = [];
    for (let i = 0; i < sk.count; i++) {
      let w = 0;
      for (const c of ['x', 'y', 'z', 'w']) if (sk[('get' + c.toUpperCase())](i) === j) w += sw[('get' + c.toUpperCase())](i);
      if (w >= thr) out.push(i);
    }
    return out;
  };
  const skinPos = (mesh, i, v) => {
    v.fromBufferAttribute(mesh.geometry.attributes.position, i);
    mesh.applyBoneTransform(i, v);
    return v.applyMatrix4(mesh.matrixWorld);
  };

  /* ---- seam pairs: each graft NECK-BAND vertex and its nearest body
   * vertex in bind pose (5 mm search over a bucketed grid). Exact-coincidence
   * pairing is not enough on this asset: the rig pipeline left the body a
   * near-triangle-soup (51254 verts for 19622 tris), so the body's copies of
   * the cut boundary are duplicates that only *nearly* coincide. What matters
   * for "no detach" is that these distances do not GROW during the run. */
  const pairs = [], wpairs = [], wbind = [];
  let bindDist = [];
  if (graft && bodyMesh) {
    const CELL = 0.005;
    const grid = new Map();
    const cell = (x, y, z) => Math.floor(x / CELL) + '|' + Math.floor(y / CELL) + '|' + Math.floor(z / CELL);
    const bp = bodyMesh.geometry.attributes.position;
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    for (let i = 0; i < bp.count; i++) {
      v.fromBufferAttribute(bp, i);
      const k = cell(v.x, v.y, v.z);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }
    const gp = graft.geometry.attributes.position;
    const gbox = new THREE.Box3().setFromBufferAttribute(gp);
    const bandTop = gbox.min.y + (gbox.max.y - gbox.min.y) * 0.28;   /* neck band */
    for (let i = 0; i < gp.count; i++) {
      v.fromBufferAttribute(gp, i);
      if (v.y > bandTop) continue;
      let best = -1, bd = CELL;
      const cx = Math.floor(v.x / CELL), cy = Math.floor(v.y / CELL), cz = Math.floor(v.z / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const j of grid.get((cx + dx) + '|' + (cy + dy) + '|' + (cz + dz)) || []) {
          w.fromBufferAttribute(bp, j);
          const d = v.distanceTo(w);
          if (d < bd) { bd = d; best = j; }
        }
      }
      if (best >= 0) {
        pairs.push([i, best]);
        bindDist.push(bd);
        /* does that body vertex carry the SAME skin weights as the graft
         * vertex? Those are the true seam partners — the graft inherited the
         * body's weights there, so the pair has to travel as one piece.
         * Neighbours with different weights (the shirt/cloak collar rides
         * other bones) legitimately move relative to the neck. */
        const wv = (mesh, k) => {
          const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
          const m = new Map();
          for (const c of ['X', 'Y', 'Z', 'W']) {
            const w = sw['get' + c](k);
            if (w > 0) m.set(si['get' + c](k), (m.get(si['get' + c](k)) || 0) + w);
          }
          return m;
        };
        const a = wv(graft, i), c2 = wv(bodyMesh, best);
        let l1 = 0;
        for (const k of new Set([...a.keys(), ...c2.keys()])) l1 += Math.abs((a.get(k) || 0) - (c2.get(k) || 0));
        if (l1 < 0.05) { wpairs.push([i, best]); wbind.push(bd); }
      }
    }
  }

  const rv = graft ? rigidVerts(graft) : [];
  const stride = Math.max(1, Math.floor(rv.length / 400));
  const rideSample = rv.filter((_, k) => k % stride === 0);
  info.rigid = graft ? { headWeight099: rv.length, sampled: rideSample.length,
                         graftVerts: graft.geometry.attributes.position.count } : null;

  /* ---- walk the clip -------------------------------------------------- */
  const clip = gltf.animations[0] || null;
  let mixer = null;
  if (clip) { mixer = new THREE.AnimationMixer(gltf.scene); mixer.clipAction(clip).play(); }
  const setT = (t) => {
    if (mixer) { mixer.setTime(t); }
    gltf.scene.updateMatrixWorld(true);
    for (const m of skinned) m.skeleton.update();
  };

  const local0 = [], v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  let rideDrift = 0, seamGap = 0, seamGap0 = 0, crownTravel = 0, weldDrift = 0;
  const crownIdx = (() => {
    if (!graft) return -1;
    const p = graft.geometry.attributes.position; let bi = -1, by = -Infinity;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > by) { by = p.getY(i); bi = i; }
    return bi;
  })();
  const crownPos = [];
  const inv = new THREE.Matrix4();
  const dur = clip ? clip.duration : 0;
  for (let s = 0; s < SAMPLES; s++) {
    setT(dur * s / (SAMPLES - 1 || 1));
    if (headBone) inv.copy(headBone.matrixWorld).invert();
    if (graft) {
      rideSample.forEach((i, k) => {
        const w = skinPos(graft, i, v3).clone().applyMatrix4(inv);
        if (s === 0) local0[k] = w;
        else rideDrift = Math.max(rideDrift, w.distanceTo(local0[k]));
      });
      if (crownIdx >= 0) crownPos.push(skinPos(graft, crownIdx, v3).clone());
    }
    pairs.forEach(([i, j], k) => {
      const d = skinPos(graft, i, v3).distanceTo(skinPos(bodyMesh, j, v4));
      seamGap = Math.max(seamGap, d);
      seamGap0 = Math.max(seamGap0, Math.abs(d - bindDist[k]));  /* the OPENING */
    });
    wpairs.forEach(([i, j], k) => {
      const d = skinPos(graft, i, v3).distanceTo(skinPos(bodyMesh, j, v4));
      weldDrift = Math.max(weldDrift, Math.abs(d - wbind[k]));
    });
  }
  for (const p of crownPos) for (const q2 of crownPos) crownTravel = Math.max(crownTravel, p.distanceTo(q2));
  if (clip && hips) {
    setT(0); const h0 = hips.getWorldPosition(new THREE.Vector3());
    setT(dur * 0.5); const h1 = hips.getWorldPosition(new THREE.Vector3());
    info.runClip = { duration: dur, hipsDisplacement_t0_t50_mm: +(1000 * h0.distanceTo(h1)).toFixed(2) };
  }
  info.rideDrift_mm = +(1000 * rideDrift).toFixed(3);
  info.seam = {
    pairs: pairs.length,
    bindDistMax_mm: +(1000 * Math.max(0, ...bindDist)).toFixed(3),
    bindDistMean_mm: +(1000 * (bindDist.reduce((a, b) => a + b, 0) / (bindDist.length || 1))).toFixed(3),
    worstDistDuringRun_mm: +(1000 * seamGap).toFixed(3),
    maxOpeningVsBind_mm: +(1000 * seamGap0).toFixed(3),
    weightMatchedPairs: wpairs.length,
    weightMatchedDrift_mm: +(1000 * weldDrift).toFixed(4),
  };
  info.crownTravel_mm = +(1000 * crownTravel).toFixed(2);

  /* ---- renders --------------------------------------------------------- */
  setT(0);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const full = (n) => { look(c, sz.y * 1.55, FRONT); snap(n); };
  const headTarget = () => {
    if (!graft) return headBone.getWorldPosition(new THREE.Vector3());
    const p = graft.geometry.attributes.position, v = new THREE.Vector3();
    const acc = new THREE.Vector3(); let n = 0;
    for (let i = 0; i < p.count; i += 7) { acc.add(skinPos(graft, i, v)); n++; }
    return acc.multiplyScalar(1 / n);
  };
  const headSpan = () => {
    if (!graft) return sz.y * 0.16;
    const b = new THREE.Box3().setFromObject(graft);
    return Math.max(1e-3, b.getSize(new THREE.Vector3()).y);
  };
  const hs = headSpan();
  for (const [n, t] of [['t0', 0], ['t25', 0.25], ['t50', 0.5], ['t75', 0.75]]) {
    setT(dur * t); full('anim-' + n);
  }
  for (const [n, t] of [['rest', 0], ['t25', 0.25], ['mid', 0.5], ['t75', 0.75]]) {
    setT(dur * t);
    const ht = headTarget();
    look(ht, hs * 2.3, FRONT); snap('face-' + n);
    look(ht, hs * 2.3, new THREE.Vector3(1, 0.1, 0.35)); snap('face3q-' + n);
    const neck = ht.clone(); neck.y -= hs * 0.55;
    look(neck, hs * 1.5, FRONT); snap('neck-' + n);
    look(neck, hs * 1.5, new THREE.Vector3(-0.9, 0.05, 0.5)); snap('neckside-' + n);
  }
  gltf.scene.removeFromParent();
  return { shots, info };
};

window.composite = async (urls, labels, cols) => {
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const imgs = await Promise.all(urls.map(load));
  const cv = document.createElement('canvas');
  cv.width = ${SIZE} * cols; cv.height = ${SIZE} * Math.ceil(imgs.length / cols);
  const cx = cv.getContext('2d');
  imgs.forEach((im, k) => {
    const x = (k % cols) * ${SIZE}, y = Math.floor(k / cols) * ${SIZE};
    cx.drawImage(im, x, y);
    cx.fillStyle = '#fff'; cx.font = '30px monospace';
    cx.fillText(labels[k], x + 22, y + 46);
  });
  return cv.toDataURL('image/png');
};
window.readySignal = true;
</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await page.route('**/verify.html', (r) => r.fulfill({ contentType: 'text/html', body: html }));
await page.goto(`http://127.0.0.1:${port}/verify.html`);
await page.waitForFunction('window.readySignal === true');

const save = (name, dataUrl) => {
  const dest = path.join(OUT, `${PREFIX}-${name}.png`);
  fs.writeFileSync(dest, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return dest;
};
const written = [];
const a = await page.evaluate((u) => window.run(u), '/__after__');
for (const [n, d] of Object.entries(a.shots)) written.push(save('after-' + n, d));
let b = null;
if (BEFORE) {
  b = await page.evaluate((u) => window.run(u), '/__before__');
  for (const n of ['face-mid', 'neck-mid', 'anim-t50']) if (b.shots[n]) written.push(save('before-' + n, b.shots[n]));
  const combo = await page.evaluate(([u, l, c]) => window.composite(u, l, c),
    [[b.shots['face-mid'], a.shots['face-mid'], b.shots['anim-t50'], a.shots['anim-t50']],
     ['BEFORE rigged-fixed (degraded face)', 'AFTER rigged-goodface', 'BEFORE mid-run', 'AFTER mid-run'], 2]);
  written.push(save('face-sidebyside', combo));
}
await browser.close();
server.close();
console.log(JSON.stringify({ renders: written, after: a.info, before: b ? b.info : null,
                             pageErrors: errs.slice(0, 5) }, null, 2));
