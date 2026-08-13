#!/usr/bin/env node
/**
 * hybridshot.mjs — judge harness for the HYBRID KING (glbpreview.mjs adapted:
 * same server + page pattern, but the framings the graft is judged on):
 *
 *   <name>.shot-front.png       full body, dead-on +Z (yaw truth)
 *   <name>.shot-threeq.png      full body, three-quarter
 *   <name>.shot-profile.png     full body, side (neck seam / mask strap)
 *   <name>.shot-face.png        head close-up, dead-on (mask sit, eye line)
 *   <name>.shot-facethreeq.png  head close-up, three-quarter (seam read)
 *   <name>.shot-neck.png        collar-level close-up, three-quarter (the rim)
 *
 * usage: node tools/hybridshot.mjs --glb PATH [--out DIR] [--size 1024]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const glb = path.resolve(String(flag('glb', '')));
const out = path.resolve(String(flag('out', path.dirname(glb))));
const size = Number(flag('size', 1024));
if (!glb || !fs.existsSync(glb)) { console.error('need --glb PATH'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url === '/__glb__' ? glb : path.join(ROOT, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'model/gltf-binary' });
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
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.8); rim.position.set(-3, 2, -2); scene.add(rim);
  scene.add(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const shots = {};
  const look = (target, dist, dir) => {
    cam.position.copy(target).addScaledVector(dir.clone().normalize(), dist);
    cam.lookAt(target); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    return canvas.toDataURL('image/png');
  };
  const d = Math.max(s.x, s.y, s.z);
  const head = new THREE.Vector3(c.x, box.max.y - s.y * 0.085, c.z);
  const neck = new THREE.Vector3(c.x, box.max.y - s.y * 0.19, c.z);
  shots.front      = look(c, d * 2.2, new THREE.Vector3(0, 0.12, 1));
  shots.threeq     = look(c, d * 2.2, new THREE.Vector3(0.7, 0.25, 1));
  shots.profile    = look(c, d * 2.2, new THREE.Vector3(1, 0.12, 0.06));
  shots.face       = look(head, s.y * 0.38, new THREE.Vector3(0, 0.06, 1));
  shots.facethreeq = look(head, s.y * 0.38, new THREE.Vector3(0.6, 0.14, 1));
  shots.neck       = look(neck, s.y * 0.34, new THREE.Vector3(0.5, 0.30, 1));
  return shots;
};
window.readySignal = true;
</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: size, height: size } });
page.on('pageerror', (e) => console.error('PAGEERR', String(e.message).slice(0, 300)));
await page.route('**/shot.html', (r) => r.fulfill({ contentType: 'text/html', body: html }));
await page.goto(`http://127.0.0.1:${port}/shot.html`);
await page.waitForFunction('window.readySignal === true', null, { timeout: 60000 });
const shots = await page.evaluate(() => window.renderViews('/__glb__'));
const name = path.basename(glb).replace(/\.glb$/, '');
for (const [view, dataUrl] of Object.entries(shots)) {
  const dest = path.join(out, `${name}.shot-${view}.png`);
  fs.writeFileSync(dest, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(dest);
}
await browser.close();
server.close();
