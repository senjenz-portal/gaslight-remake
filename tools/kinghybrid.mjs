#!/usr/bin/env node
/**
 * kinghybrid.mjs — HYBRID KING, step 2: graft the Tripo head onto the
 * procedural low-poly body.
 *
 * Builds the King figure with app/figures.js (READ-ONLY import — the app lane
 * owns that file), removes the procedural head cage mesh from the head joint,
 * and mounts the head headcut.mjs extracted (king2-head.glb):
 *
 *   · yaw-aligned so the face looks down +Z (the figure's facing axis);
 *   · scaled so its height matches the procedural head span (fig.dims:
 *     H - headY, x --scale-mult so the visible chin-to-crown span matches once
 *     the neck stub is sunk);
 *   · positioned on the neck joint: rim centroid on the joint axis, crown at
 *     stature, rim translated DOWN --drop into the collar and its lowest ring
 *     of vertices pinched in (0.82 -> 1.0 over the bottom 6%) so the open rim
 *     tucks inside the procedural neck column;
 *   · material converted to MeshLambertMaterial({ map, flatShading: true })
 *     and the geometry de-indexed with face normals, so the flat facet look is
 *     baked into the GLB for any loader;
 *   · the procedural domino mask node kept ON TOP, repositioned to the new
 *     face's eye line (--eye-t of head height) and re-scaled to the new head's
 *     width at that line.
 *
 * The whole figure is exported with GLTFExporter to
 * assets/plates/king-v2/king2-hybrid.glb, copied to
 * site-deploy-staging/king-hybrid.glb, and a raw-first manifest (inputs,
 * outputs, parameters, sha256) is written to assets/raw/hybrid/<ts>/.
 * Runs in headless chromium (same pattern as glbpreview.mjs) so GLTFExporter
 * can re-encode the jpeg texture through a real canvas.
 *
 * usage: node tools/kinghybrid.mjs [--yaw rad] [--scale-mult 1.05]
 *          [--drop 0.012] [--eye-t 0.53] [--z-nudge 0] [--seed 0x3c0d5]
 */
import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const PARAMS = {
  /* face azimuth measured off the cut head (nose probe + face render): the
   * baked world-space head looks toward ~+31 deg; rotate it to +Z. Verified
   * dead-on symmetric in review/hybrid/king2-hybrid.shot-front.png. */
  yaw: Number(flag('yaw', -0.541)),
  /* 1.10, not 1.00: at 1.05 the head measured 5.85 spans against the colossus
   * torso and read a step too fine for the diorama's chunky vocabulary; the
   * procedural span the body was authored against also spends mass on a beard
   * this head does not have. */
  scaleMult: Number(flag('scale-mult', 1.10)),
  drop: Number(flag('drop', 0.012)),
  eyeT: Number(flag('eye-t', 0.535)),
  maskScale: Number(flag('mask-scale', 0.72)),
  zNudge: Number(flag('z-nudge', 0)),
  seed: Number(flag('seed', 0x3c0d5)),
  /* multiply tint on the head texture: the Tripo bake is a pale studio pink
   * against a body whose skin ramp is warm tan (0xf0b184 face / 0xa57a56
   * neck); a mild warm multiply meets it half way without flattening the bake */
  tint: String(flag('tint', 'ffe9d4')),
};
const HEAD_GLB = path.join(ROOT, 'assets/plates/king-v2/king2-head.glb');
const OUT_GLB = path.join(ROOT, 'assets/plates/king-v2/king2-hybrid.glb');
const STAGING = path.join(ROOT, 'site-deploy-staging/king-hybrid.glb');

if (!fs.existsSync(HEAD_GLB)) { console.error('run tools/headcut.mjs first'); process.exit(2); }

/* static server rooted at ROOT (node_modules three + app modules + assets) */
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  const ct = file.endsWith('.js') || file.endsWith('.mjs') ? 'text/javascript'
    : file.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': ct });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const html = `<!doctype html><html><body>
<script type="importmap">{"imports":{
  "three":"/node_modules/three/build/three.module.js",
  "three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createFigure, BUILDS } from '/app/figures.js';

window.buildHybrid = async (P) => {
  const stats = {};

  /* ---- the body: the King, in house vocabulary -------------------- */
  const fig = createFigure({ seed: P.seed, build: 'king' });
  fig.step(1 / 60, 0);                       // settle the at-ease pose
  const dims = fig.dims;
  const headJ = fig.joints.head;
  const headSpan = dims.H - dims.headY;      // the procedural head span
  stats.dims = { H: dims.H, headY: dims.headY, headSpan };

  /* ---- off with the procedural head cage -------------------------- */
  const oldHead = headJ.children.filter((o) => o.isMesh);
  stats.removed = oldHead.map((o) => o.name);
  for (const o of oldHead) { headJ.remove(o); o.geometry.dispose(); }

  /* ---- on with the Tripo head -------------------------------------- */
  const gltf = await new GLTFLoader().loadAsync('/assets/plates/king-v2/king2-head.glb');
  let src = null;
  gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
  let geo = src.geometry;

  /* cull the fused COSTUME SHARDS at the rim. headcut's component filter drops
   * the collar ring, but the Tripo shell fuses slivers of shirt collar and tie
   * to the neck skin itself and they ride up with the head — two white + navy
   * flags sticking out beside the jaw on the first graft. They are not
   * separable by position (they hug the neck) but they are by PAINT: sample
   * each below-chin triangle's texels and drop the ones that read as linen
   * (near-white) or navy (blue over red) instead of skin. */
  {
    const img = src.material.map.image;
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    const tex = cx.getImageData(0, 0, cv.width, cv.height).data;
    const flipY = src.material.map.flipY === false;   // glTF: v runs down
    const texel = (u, v) => {
      const x = Math.max(0, Math.min(cv.width - 1, Math.round(u * (cv.width - 1))));
      const yv = flipY ? v : 1 - v;
      const y = Math.max(0, Math.min(cv.height - 1, Math.round(yv * (cv.height - 1))));
      const k = (y * cv.width + x) * 4;
      return [tex[k] / 255, tex[k + 1] / 255, tex[k + 2] / 255];
    };
    const pos0 = geo.attributes.position, uv0 = geo.attributes.uv, idx0 = geo.index;
    geo.computeBoundingBox();
    const chinY = geo.boundingBox.min.y +
      (geo.boundingBox.max.y - geo.boundingBox.min.y) * 0.24;
    const keep = [];
    let culled = 0;
    for (let t = 0; t < idx0.count; t += 3) {
      const a = idx0.getX(t), b = idx0.getX(t + 1), c = idx0.getX(t + 2);
      let below = pos0.getY(a) < chinY && pos0.getY(b) < chinY && pos0.getY(c) < chinY;
      let costume = false;
      if (below) {
        let r = 0, g = 0, bl = 0;
        for (const i of [a, b, c]) {
          const [tr, tg, tb] = texel(uv0.getX(i), uv0.getY(i));
          r += tr / 3; g += tg / 3; bl += tb / 3;
        }
        const white = Math.min(r, g, bl) > 0.62;
        const navy = bl > r * 1.03 && (r + g + bl) / 3 < 0.62;
        costume = white || navy;
      }
      if (costume) { culled++; continue; }
      keep.push(a, b, c);
    }
    geo.setIndex(keep);
    stats.cull = { costumeTris: culled };
  }

  // yaw-align the face to +Z
  geo.applyMatrix4(new THREE.Matrix4().makeRotationY(P.yaw));

  // scale to the procedural head span
  geo.computeBoundingBox();
  let bb = geo.boundingBox;
  const scale = (headSpan * P.scaleMult) / (bb.max.y - bb.min.y);
  geo.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));
  geo.computeBoundingBox(); bb = geo.boundingBox;
  const scaledH = bb.max.y - bb.min.y;

  // rim centroid (bottom 5%) -> the joint axis; crown -> stature - drop
  const pos = geo.attributes.position;
  let rx = 0, rz = 0, rn = 0;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > bb.min.y + scaledH * 0.05) continue;
    rx += pos.getX(i); rz += pos.getZ(i); rn++;
  }
  rx /= rn; rz /= rn;
  const crownLocal = headSpan * 1.006 - P.drop;    // the procedural crown line
  const dy = crownLocal - bb.max.y;
  geo.applyMatrix4(new THREE.Matrix4().makeTranslation(-rx, dy, -rz + P.zNudge));
  geo.computeBoundingBox(); bb = geo.boundingBox;

  // tuck the rim: pinch the bottom 10% of vertices toward the rim axis
  // (0.70 -> 1.0 — deep enough that the last fused tie dart at the rim's
  // south-east edge pulls inside the tunic collar)
  const tuckH = scaledH * 0.10;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > bb.min.y + tuckH) continue;
    const t = (y - bb.min.y) / tuckH;
    const k = 0.70 + 0.30 * (t * t * (3 - 2 * t));
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, P.zNudge + (pos.getZ(i) - P.zNudge) * k);
  }
  pos.needsUpdate = true;

  // bake the flat facet look: de-index + face normals
  geo = geo.toNonIndexed();
  geo.computeVertexNormals();
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  bb = geo.boundingBox;

  const map = src.material.map;
  const headMat = new THREE.MeshLambertMaterial({ map, flatShading: true });
  headMat.color.set(parseInt(P.tint, 16));      // warm multiply toward the body ramp
  headMat.name = 'tripoHeadSkin';
  const headMesh = new THREE.Mesh(geo, headMat);
  headMesh.name = 'seg:head';
  headJ.add(headMesh);
  stats.head = {
    tris: geo.attributes.position.count / 3, scale: +scale.toFixed(4),
    scaledH: +scaledH.toFixed(4),
    local: { min: bb.min.toArray().map((v) => +v.toFixed(4)),
             max: bb.max.toArray().map((v) => +v.toFixed(4)) },
  };

  /* ---- the mask, on the new face's eye line ------------------------
   * The mask SCALE is a tuned constant, not a measurement: every geometric
   * width at eye height on this head is hair or ears (two grafts measured
   * 0.133 and 0.148 half-widths and both produced a floating visor twice the
   * face). Measured off the render instead: the eye corners sit at ~0.62 of
   * the hair silhouette's half-span, which against the procedural lobe reach
   * wh(0.055) is a node scale of ~0.72. The z PRESSES the domino against the
   * face: sampled under the lobes' own footprint (|x| in 0.3..0.9 of the
   * scaled reach), so the plate rides the brow instead of the nose tip. */
  const p2 = geo.attributes.position;
  const hH = bb.max.y - bb.min.y;
  const eyeY = bb.min.y + hH * P.eyeT;
  const band = hH * 0.04;
  if (fig.mask) {
    const reach0 = 0.4783 * dims.face.headW;       // lobe tip = wh(0.055)
    const reach = reach0 * P.maskScale;
    let zFace = -Infinity;
    for (let i = 0; i < p2.count; i++) {
      if (Math.abs(p2.getY(i) - eyeY) > band) continue;
      const x = Math.abs(p2.getX(i));
      if (x < reach * 0.3 || x > reach * 0.9) continue;
      const z = p2.getZ(i);
      if (z > zFace) zFace = z;
    }
    fig.mask.node.position.set(0, eyeY, zFace + 0.004);
    fig.mask.node.scale.setScalar(P.maskScale);
    stats.mask = { eyeY: +eyeY.toFixed(4), zFace: +zFace.toFixed(4),
                   reach: +reach.toFixed(4), scale: P.maskScale };
  }

  /* ---- ledger ------------------------------------------------------ */
  let tris = 0, meshes = 0;
  fig.root.traverse((o) => { if (o.isMesh) { meshes++;
    const g = o.geometry;
    tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3; } });
  stats.figure = { tris, meshes };

  /* ---- export ------------------------------------------------------ */
  const glb = await new GLTFExporter().parseAsync(fig.root, { binary: true });
  const bytes = new Uint8Array(glb);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return { b64: btoa(bin), stats };
};
window.readySignal = true;
</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await page.route('**/hybrid.html', (r) => r.fulfill({ contentType: 'text/html', body: html }));
await page.goto(`http://127.0.0.1:${port}/hybrid.html`);
await page.waitForFunction('window.readySignal === true', null, { timeout: 60000 });
const { b64, stats } = await page.evaluate((P) => window.buildHybrid(P), PARAMS);
await browser.close();
server.close();

fs.writeFileSync(OUT_GLB, Buffer.from(b64, 'base64'));
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.copyFileSync(OUT_GLB, STAGING);

/* ---- raw-first manifest -------------------------------------------- */
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const entry = (p) => ({ filename: path.relative(ROOT, p), bytes: fs.statSync(p).size, sha256: sha(p) });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const rawDir = path.join(ROOT, 'assets/raw/hybrid', stamp);
fs.mkdirSync(rawDir, { recursive: true });
const renderDir = path.join(ROOT, 'review/hybrid');
const renders = fs.existsSync(renderDir)
  ? fs.readdirSync(renderDir).filter((f) => f.startsWith('king2-hybrid') && f.endsWith('.png'))
      .map((f) => entry(path.join(renderDir, f)))
  : [];
const manifest = {
  lane: 'hybrid-king',
  generator: 'tools/headcut.mjs (neck-plane cut of the Tripo mesh) + ' +
             'tools/kinghybrid.mjs (graft onto app/figures.js King, GLTFExporter in chromium)',
  generatedAt: new Date().toISOString(),
  params: PARAMS,
  inputs: [
    entry(path.join(ROOT, 'assets/plates/king-v2/king2-tripo.glb')),
    entry(HEAD_GLB),
  ],
  outputs: [entry(OUT_GLB), entry(STAGING), ...renders],
  stats,
  errors: errs,
};
fs.writeFileSync(path.join(rawDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ out: path.relative(ROOT, OUT_GLB),
  staging: path.relative(ROOT, STAGING),
  manifest: path.relative(ROOT, path.join(rawDir, 'manifest.json')),
  bytes: fs.statSync(OUT_GLB).size, stats, errors: errs }, null, 2));
