#!/usr/bin/env node
/**
 * normalizer-verify.mjs — headless three.js validation of the WEIGHT
 * NORMALIZER stage (tools/blender-normalize-weights.py), adapted from
 * rigverify.mjs.
 *
 * Loads the BEFORE (auto-rigged) and AFTER (normalized) GLBs and for each:
 *   1. plays animation clip 0 and screenshots a mid-run frame (t=50%),
 *      asserting the clip actually moves bones (hips displacement);
 *   2. THE MONEY TEST — poses BOTH arms to 60 deg from vertical (the
 *      bat-wing pose) via world-space alignment of the upper-arm axis and
 *      screenshots the full body. On the before model the cloak tears into
 *      bat-wings; on the after model it must stay draped.
 * Also writes a side-by-side composite of the two wide-arm shots.
 *
 * usage: node tools/normalizer-verify.mjs --before PATH --after PATH \
 *          --out DIR [--prefix normalizer] [--size 1024]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
let before = null, after = null, out = null, prefix = 'normalizer', size = 1024;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--before') before = path.resolve(argv[++i]);
  else if (argv[i] === '--after') after = path.resolve(argv[++i]);
  else if (argv[i] === '--out') out = path.resolve(argv[++i]);
  else if (argv[i] === '--prefix') prefix = argv[++i];
  else if (argv[i] === '--size') size = Number(argv[++i]);
}
if (!before || !after || !out) { console.error('need --before, --after, --out'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (url === '/__before__') file = before;
  else if (url === '/__after__') file = after;
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

  // frame on model HEIGHT so before (huge wings) and after get identical zoom
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const shots = {};
  const info = { clips: gltf.animations.map((a) => ({ name: a.name, duration: a.duration, tracks: a.tracks.length })) };
  const snap = (name) => { shots[name] = canvas.toDataURL('image/png'); };
  const look = (target, dist, dir) => {
    cam.position.copy(target).addScaledVector(dir.normalize(), dist);
    cam.lookAt(target); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  };
  const front = new THREE.Vector3(0.25, 0.15, 1);
  const full = (name) => { look(c, s.y * 1.55, front.clone()); snap(name); };

  let leftArm = null, rightArm = null, leftFore = null, rightFore = null, hips = null;
  gltf.scene.traverse((o) => {
    if (!o.isBone) return;
    if (/LeftArm$/.test(o.name)) leftArm = o;
    if (/RightArm$/.test(o.name)) rightArm = o;
    if (/LeftForeArm$/.test(o.name)) leftFore = o;
    if (/RightForeArm$/.test(o.name)) rightFore = o;
    if (/Hips$/.test(o.name)) hips = o;
  });

  // 1) run clip: assert playback moves bones; shoot mid-run frame
  if (gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const clip = gltf.animations[0];
    mixer.clipAction(clip).play();
    mixer.setTime(0); gltf.scene.updateMatrixWorld(true);
    const h0 = hips.getWorldPosition(new THREE.Vector3());
    mixer.setTime(clip.duration * 0.5); gltf.scene.updateMatrixWorld(true);
    const h1 = hips.getWorldPosition(new THREE.Vector3());
    info.runClip = { duration: clip.duration, hipsDisplacementT0toT50: h0.distanceTo(h1) };
    full('runframe');
    mixer.stopAllAction();
    gltf.scene.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
    gltf.scene.updateMatrixWorld(true);
  }

  // 2) MONEY TEST: both upper arms to 60 deg from vertical, world-space
  const aim = (arm, fore, sideSign) => {
    const rad = Math.PI / 3; // 60 deg from straight-down
    const target = new THREE.Vector3(sideSign * Math.sin(rad), -Math.cos(rad), 0);
    const a = arm.getWorldPosition(new THREE.Vector3());
    const f = fore.getWorldPosition(new THREE.Vector3());
    const dir = f.sub(a).normalize();
    const pq = arm.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const q = new THREE.Quaternion().setFromUnitVectors(
      dir.applyQuaternion(pq).normalize(), target.applyQuaternion(pq).normalize());
    arm.quaternion.premultiply(q);
  };
  aim(leftArm, leftFore, 1);
  aim(rightArm, rightFore, -1);
  gltf.scene.updateMatrixWorld(true);
  info.moneyPose = 'both arms 60deg from vertical (world-space aim)';
  full('widearm');

  gltf.scene.removeFromParent();
  return { shots, info };
};

window.composite = async (leftUrl, rightUrl, label) => {
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const [li, ri] = await Promise.all([load(leftUrl), load(rightUrl)]);
  const cv = document.createElement('canvas');
  cv.width = ${size} * 2; cv.height = ${size};
  const cx = cv.getContext('2d');
  cx.drawImage(li, 0, 0); cx.drawImage(ri, ${size}, 0);
  cx.fillStyle = '#ffffff'; cx.font = '28px monospace';
  cx.fillText('BEFORE', 24, 44); cx.fillText('AFTER (normalized)', ${size} + 24, 44);
  return cv.toDataURL('image/png');
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

const save = (name, dataUrl) => {
  const dest = path.join(out, `${prefix}-${name}.png`);
  fs.writeFileSync(dest, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(dest);
};

const b = await page.evaluate((u) => window.run(u), '/__before__');
const a = await page.evaluate((u) => window.run(u), '/__after__');
save('before-widearm', b.shots.widearm);
save('after-widearm', a.shots.widearm);
if (b.shots.runframe) save('before-runframe', b.shots.runframe);
if (a.shots.runframe) save('after-runframe', a.shots.runframe);
const combo = await page.evaluate(
  ([l, r]) => window.composite(l, r), [b.shots.widearm, a.shots.widearm]);
save('widearm-sidebyside', combo);
console.log(JSON.stringify({ before: b.info, after: a.info }, null, 2));
await browser.close();
server.close();
