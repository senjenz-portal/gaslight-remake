/* cravatcheck.mjs — confirm the exported band is skinned 60/40 Neck/Head and
 * that it actually follows BOTH bones through the clip. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = '/Users/samz/Documents/gaslight-remake';
const GLB = path.resolve(process.argv[2]);
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url === '/__glb__' ? GLB : path.join(ROOT, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const html = `<!doctype html><html><body>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
window.go = async (url) => {
  const g = await new GLTFLoader().loadAsync(url);
  g.scene.updateMatrixWorld(true);
  const skinned = []; g.scene.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  const band = skinned.find((m) => /cravat/i.test(m.name));
  const out = { meshes: skinned.map((m) => m.name), band: band ? band.name : null };
  if (!band) return out;
  const bones = band.skeleton.bones.map((b) => b.name);
  const si = band.geometry.attributes.skinIndex, sw = band.geometry.attributes.skinWeight;
  const tally = new Map();
  for (let i = 0; i < si.count; i++) for (const c of ['X','Y','Z','W']) {
    const w = sw['get'+c](i); if (w <= 0) continue;
    const n = bones[si['get'+c](i)] || ('#'+si['get'+c](i));
    if (!tally.has(n)) tally.set(n, { verts: 0, min: 9, max: -9 });
    const t = tally.get(n); t.verts++; t.min = Math.min(t.min, w); t.max = Math.max(t.max, w);
  }
  out.verts = si.count; out.tris = band.geometry.index.count / 3;
  out.weights = [...tally].map(([n, t]) => ({ bone: n, verts: t.verts,
    w: [ +t.min.toFixed(4), +t.max.toFixed(4) ] }));
  out.material = band.material.name;
  /* flat-shaded == every triangle's three vertex normals equal its geometric
   * face normal (per-face normals, split corners), for every triangle. */
  { const ix = band.geometry.index, po = band.geometry.attributes.position,
          no = band.geometry.attributes.normal;
    const a = new THREE.Vector3(), b2 = new THREE.Vector3(), c = new THREE.Vector3(),
          fn = new THREE.Vector3(), vn = new THREE.Vector3();
    let worst = 0;
    for (let f = 0; f < ix.count; f += 3) {
      const i0 = ix.getX(f), i1 = ix.getX(f + 1), i2 = ix.getX(f + 2);
      a.fromBufferAttribute(po, i0); b2.fromBufferAttribute(po, i1); c.fromBufferAttribute(po, i2);
      fn.copy(c).sub(b2).cross(a.clone().sub(b2)).normalize();
      for (const i of [i0, i1, i2]) {
        vn.fromBufferAttribute(no, i);
        worst = Math.max(worst, 1 - Math.abs(vn.dot(fn)));
      }
    }
    out.flatShaded = worst < 1e-3;
    out.flatShadeMaxDeviation = +worst.toFixed(6); }

  /* does it follow BOTH bones?  pose Neck, then Head, and measure. */
  let neck = null, head = null;
  g.scene.traverse((o) => { if (o.isBone && /:?Neck$/.test(o.name)) neck = o;
                            if (o.isBone && /:?Head$/.test(o.name)) head = o; });
  const p = band.geometry.attributes.position, v = new THREE.Vector3();
  const sample = (n) => { const a = []; for (let i = 0; i < p.count; i += 7) {
    v.fromBufferAttribute(p, i); band.applyBoneTransform(i, v);
    a.push(v.clone().applyMatrix4(band.matrixWorld)); } return a; };
  const upd = () => { g.scene.updateMatrixWorld(true); for (const m of skinned) m.skeleton.update(); };
  upd(); const base = sample();
  const maxMove = (a, b) => 1000 * Math.max(...a.map((q, k) => q.distanceTo(b[k])));
  head.rotation.x += 0.5; upd(); out.movesWithHead_mm = +maxMove(base, sample()).toFixed(2);
  head.rotation.x -= 0.5; upd();
  neck.rotation.x += 0.5; upd(); out.movesWithNeck_mm = +maxMove(base, sample()).toFixed(2);
  neck.rotation.x -= 0.5; upd();

  /* through the clip: does the band tear away from the graft's neck skin? */
  const graft = skinned.find((m) => /goodface|head/i.test(m.name));
  const clip = g.animations[0];
  const mx = new THREE.AnimationMixer(g.scene); mx.clipAction(clip).play();
  const gp = graft.geometry.attributes.position, w2 = new THREE.Vector3();
  const near = [];
  { mx.setTime(0); upd();
    const bs = sample();
    for (let i = 0; i < gp.count; i += 3) {
      w2.fromBufferAttribute(gp, i); graft.applyBoneTransform(i, w2);
      const q = w2.clone().applyMatrix4(graft.matrixWorld);
      let bd = 1e9, bk = -1;
      bs.forEach((b, k) => { const d = q.distanceTo(b); if (d < bd) { bd = d; bk = k; } });
      if (bd < 0.03) near.push({ i, k: bk, d0: bd });
    } }
  let worst = 0;
  for (let s = 0; s < 12; s++) {
    mx.setTime(clip.duration * s / 11); upd();
    const bs = sample();
    for (const n of near) {
      w2.fromBufferAttribute(gp, n.i); graft.applyBoneTransform(n.i, w2);
      worst = Math.max(worst, Math.abs(w2.applyMatrix4(graft.matrixWorld).distanceTo(bs[n.k]) - n.d0));
    }
  }
  out.bandVsNeckSkin = { pairs: near.length, maxOpeningVsBind_mm: +(1000 * worst).toFixed(3) };
  return out;
};
window.ready = true;
</script></body></html>`;
const b = await chromium.launch({ headless: true });
const pg = await b.newPage();
const errs = [];
pg.on('pageerror', (e) => errs.push(String(e.message).slice(0, 300)));
await pg.route('**/x.html', (r) => r.fulfill({ contentType: 'text/html', body: html }));
await pg.goto(`http://127.0.0.1:${port}/x.html`);
await pg.waitForFunction('window.ready === true');
const r = await pg.evaluate(() => window.go('/__glb__'));
await b.close(); server.close();
console.log(JSON.stringify({ glb: GLB, ...r, pageErrors: errs }, null, 2));
