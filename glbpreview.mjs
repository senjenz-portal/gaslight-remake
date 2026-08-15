#!/usr/bin/env node
/**
 * glbpreview.mjs — standalone GLB render harness (no app dependency).
 *
 * Renders a GLB at two framings for by-eye judging of generated meshes:
 *   <name>.render-full.png  — full-body three-quarter view
 *   <name>.render-face.png  — close-up on the top of the bbox (head zoom)
 *   <name>.render-flat.png  — full view, flat-shaded clone (facet read)
 *
 * usage: node tools/glbpreview.mjs --glb PATH [--glb PATH ...] [--out DIR] [--size 1024]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const glbs = [];
let out = null, size = 1024;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--glb') glbs.push(path.resolve(argv[++i]));
  else if (argv[i] === '--out') out = path.resolve(argv[++i]);
  else if (argv[i] === '--size') size = Number(argv[++i]);
}
if (!glbs.length) { console.error('need --glb PATH'); process.exit(2); }
out = out || path.dirname(glbs[0]);
fs.mkdirSync(out, { recursive: true });

// tiny static server rooted at ROOT so the page can import three from node_modules
// and fetch GLBs (exposed under /__glb__/<i>).
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file;
  const m = url.match(/^\/__glb__\/(\d+)$/);
  if (m) file = glbs[Number(m[1])];
  else file = path.join(ROOT, url);
  if (!file || !file.startsWith('/') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  const ct = file.endsWith('.js') || file.endsWith('.mjs') ? 'text/javascript'
    : file.endsWith('.glb') || m ? 'model/gltf-binary' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': ct });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const html = `<!doctype html><html><body style="margin:0">
<script type="importmap">{"imports":{
  "three":"/node_modules/three/build/three.module.js",
  "three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<canvas id="c" width="${size}" height="${size}"></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(${size}, ${size}, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
window.renderViews = async (url) => {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161c);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.8); rim.position.set(-3, 2, -2); scene.add(rim);
  scene.add(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const shots = {};
  const snap = () => canvas.toDataURL('image/png');
  const look = (target, dist, dir) => {
    cam.position.copy(target).addScaledVector(dir.normalize(), dist);
    cam.lookAt(target); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  };
  const d = Math.max(s.x, s.y, s.z);
  look(c, d * 2.2, new THREE.Vector3(0.7, 0.25, 1));           shots.full = snap();
  const head = new THREE.Vector3(c.x, box.max.y - s.y * 0.09, c.z);
  look(head, s.y * 0.42, new THREE.Vector3(0.55, 0.12, 1));    shots.face = snap();
  gltf.scene.traverse((o) => { if (o.isMesh) {
    o.material = new THREE.MeshStandardMaterial({ color: 0xb9bec9, flatShading: true }); } });
  look(c, d * 2.2, new THREE.Vector3(0.7, 0.25, 1));           shots.flat = snap();
  gltf.scene.removeFromParent();
  return shots;
};
window.readySignal = true;
</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: size, height: size } });
await page.route('**/preview.html', (r) => r.fulfill({ contentType: 'text/html', body: html }));
await page.goto(`http://127.0.0.1:${port}/preview.html`);
await page.waitForFunction('window.readySignal === true');

for (let i = 0; i < glbs.length; i++) {
  const name = path.basename(glbs[i]).replace(/\.glb$/, '');
  const shots = await page.evaluate((u) => window.renderViews(u), `/__glb__/${i}`);
  for (const [view, dataUrl] of Object.entries(shots)) {
    const dest = path.join(out, `${name}.render-${view}.png`);
    fs.writeFileSync(dest, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(dest);
  }
}
await browser.close();
server.close();
