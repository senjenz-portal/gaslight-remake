#!/usr/bin/env node
/**
 * rigverify.mjs — headless three.js validation of a rigged GLB.
 *
 * 1. Loads the GLB with the vendored GLTFLoader (three 0.185.1).
 * 2. If it carries animation clips: plays clip 0 via AnimationMixer, screenshots
 *    at 0/25/50/75% of the clip (full body) + a shoulder closeup mid-clip.
 * 3. Always: resets pose, programmatically rotates LeftArm 45° about Z
 *    (arm raise), screenshots full body + left-shoulder closeup for a
 *    candy-wrapper/collapse read. Same for RightArm as control.
 *
 * usage: node tools/rigverify.mjs --glb PATH --out DIR --prefix rig-experiment [--size 1024]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
let glb = null, out = null, prefix = 'rig-experiment', size = 1024;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--glb') glb = path.resolve(argv[++i]);
  else if (argv[i] === '--out') out = path.resolve(argv[++i]);
  else if (argv[i] === '--prefix') prefix = argv[++i];
  else if (argv[i] === '--size') size = Number(argv[++i]);
}
if (!glb || !out) { console.error('need --glb and --out'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (url === '/__glb__') file = glb;
  else file = path.join(ROOT, url);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const ct = file.endsWith('.js') || file.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream';
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

window.run = async (url) => {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161c);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.8); rim.position.set(-3, 2, -2); scene.add(rim);
  scene.add(gltf.scene);

  const box = new THREE.Box3().setFromObject(gltf.scene);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const d = Math.max(s.x, s.y, s.z);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const shots = {};
  const info = { clips: gltf.animations.map((a) => ({ name: a.name, duration: a.duration, tracks: a.tracks.length })), bones: [] };
  const snap = (name) => { shots[name] = canvas.toDataURL('image/png'); };
  const look = (target, dist, dir) => {
    cam.position.copy(target).addScaledVector(dir.normalize(), dist);
    cam.lookAt(target); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  };
  const front = new THREE.Vector3(0.25, 0.15, 1);
  const full = (name) => { look(c, d * 2.4, front); snap(name); };

  // find bones
  let leftArm = null, rightArm = null, leftForeArm = null;
  gltf.scene.traverse((o) => {
    if (!o.isBone) return;
    info.bones.push(o.name);
    if (/LeftArm$/.test(o.name)) leftArm = o;
    if (/RightArm$/.test(o.name)) rightArm = o;
    if (/LeftForeArm$/.test(o.name)) leftForeArm = o;
  });
  const shoulderTargetOf = (bone) => bone.getWorldPosition(new THREE.Vector3());

  // 1) animation clip playback
  if (gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const clip = gltf.animations[0];
    const action = mixer.clipAction(clip); action.play();
    for (const f of [0, 0.25, 0.5, 0.75]) {
      mixer.setTime(clip.duration * f);
      gltf.scene.updateMatrixWorld(true);
      full('anim-t' + Math.round(f * 100));
    }
    // shoulder closeup mid-stride
    mixer.setTime(clip.duration * 0.35);
    gltf.scene.updateMatrixWorld(true);
    if (leftArm) { look(shoulderTargetOf(leftArm), s.y * 0.5, front); snap('anim-shoulder'); }
    mixer.stopAllAction(); mixer.setTime(0);
    // reset to bind pose for the manual test
    gltf.scene.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
    gltf.scene.updateMatrixWorld(true);
  }

  // 2) rest pose + manual bone pose test
  full('rest');
  const rad = Math.PI / 4;
  if (leftArm) {
    const save = leftArm.rotation.clone();
    // rotate about the axis that raises the arm laterally; try Z then X, pick larger hand displacement
    const hand = leftForeArm || leftArm;
    const before = hand.getWorldPosition(new THREE.Vector3());
    leftArm.rotation.z += rad; gltf.scene.updateMatrixWorld(true);
    const dz = hand.getWorldPosition(new THREE.Vector3()).distanceTo(before);
    leftArm.rotation.copy(save);
    leftArm.rotation.x += rad; gltf.scene.updateMatrixWorld(true);
    const dx = hand.getWorldPosition(new THREE.Vector3()).distanceTo(before);
    leftArm.rotation.copy(save);
    const axis = dz >= dx ? 'z' : 'x';
    leftArm.rotation[axis] += rad;
    gltf.scene.updateMatrixWorld(true);
    info.poseTest = { bone: leftArm.name, axis, radians: rad };
    full('pose-leftarm45');
    look(shoulderTargetOf(leftArm), s.y * 0.45, front); snap('pose-leftarm45-shoulder');
    look(shoulderTargetOf(leftArm), s.y * 0.45, new THREE.Vector3(-1, 0.2, 0.4)); snap('pose-leftarm45-side');
    // twist test: candy-wrapper check — twist forearm 60 deg about its length axis
    if (leftForeArm) {
      leftForeArm.rotation.y += Math.PI / 3;
      gltf.scene.updateMatrixWorld(true);
      look(shoulderTargetOf(leftForeArm), s.y * 0.4, front); snap('pose-forearm-twist');
      leftForeArm.rotation.y -= Math.PI / 3;
    }
    leftArm.rotation.copy(save);
  }
  if (rightArm) {
    rightArm.rotation.z -= rad;
    gltf.scene.updateMatrixWorld(true);
    full('pose-rightarm45');
    rightArm.rotation.z += rad;
  }
  gltf.scene.updateMatrixWorld(true);

  gltf.scene.removeFromParent();
  return { shots, info };
};
window.readySignal = true;
</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: size, height: size } });
page.on('console', (m) => console.error('[page]', m.text()));
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.route('**/verify.html', (r) => r.fulfill({ contentType: 'text/html', body: html }));
await page.goto(`http://127.0.0.1:${port}/verify.html`);
await page.waitForFunction('window.readySignal === true');

const { shots, info } = await page.evaluate((u) => window.run(u), '/__glb__');
for (const [name, dataUrl] of Object.entries(shots)) {
  const dest = path.join(out, `${prefix}-${name}.png`);
  fs.writeFileSync(dest, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(dest);
}
console.log(JSON.stringify(info, null, 2));
await browser.close();
server.close();
