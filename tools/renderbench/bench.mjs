#!/usr/bin/env node
/**
 * bench.mjs — CONTROLLED A/B of the RENDER RIG, not the asset.
 *
 * The same GLB, the same camera (the graftverify face3q framing that produced
 * review/graft/neckfix-after-face3q-mid.png), rendered under five rigs:
 *
 *   REF  the rig that made the reference render (tools/graftverify.mjs):
 *        no tone mapping, white ambient 1.1 + white key 2.2 + cool rim 0.8.
 *   A    CURRENT — site-deploy/king-demo/index.html's figure rig, verbatim.
 *   B    STUDIO-IBL — PMREM(RoomEnvironment) as scene.environment,
 *        ACESFilmicToneMapping, exposure 1.0, warm key + amber rim.
 *   C    NEUTRAL-IBL — B with THREE.NeutralToneMapping (vendored r185 has it).
 *   D    C + a material-only skin tweak (metalness 0, roughness clamp,
 *        small HSL saturation lift). No post pipeline.
 *
 * Everything is drawn with the VENDORED three in site-deploy/app/vendor, so
 * whatever wins can be lifted into the site as-is.
 *
 * usage: node tools/renderbench/bench.mjs [--size 1024] [--out review/render-ab.png]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const SIZE = Number(flag('size', 1024));
const OUT = path.resolve(ROOT, flag('out', 'review/render-ab.png'));
const TILES = path.resolve(ROOT, flag('tiles', 'review/render-ab-tiles'));
fs.mkdirSync(TILES, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const html = `<!doctype html><html><body style="margin:0">
<script type="importmap">{"imports":{
  "three":"/site-deploy/app/vendor/three.module.js"}}</script>
<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from '/site-deploy/app/vendor/loaders/GLTFLoader.js';
import { RoomEnvironment } from '/tools/renderbench/RoomEnvironment.js';

const SIZE = ${SIZE};
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
const gl = renderer.getContext();

/* ---- one PMREM of RoomEnvironment, shared by every IBL rig ---------------- */
let ENV = null;
const env = () => {
  if (!ENV){
    const pmrem = new THREE.PMREMGenerator(renderer);
    ENV = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  return ENV;
};

/* ---- model prep: the page's own normalisation (1.9 m, feet on the ground) -- */
const HEIGHT = 1.9;
function prepare(model){
  const box = new THREE.Box3().setFromObject(model);
  model.scale.setScalar(HEIGHT / (box.max.y - box.min.y));
  const b = new THREE.Box3().setFromObject(model);
  const c = b.getCenter(new THREE.Vector3());
  model.position.x -= c.x; model.position.z -= c.z; model.position.y -= b.min.y;
  model.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; });
  model.updateMatrixWorld(true);
  return model;
}

/* ---- the face3q camera, exactly as tools/graftverify.mjs computes it ------ */
const skinPos = (mesh, i, v) => {
  v.fromBufferAttribute(mesh.geometry.attributes.position, i);
  if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, v);
  return v.applyMatrix4(mesh.matrixWorld);
};
function headFrame(root, mode){
  const v = new THREE.Vector3();
  if (mode === 'graft'){
    let graft = null;
    root.traverse((o) => { if (o.isSkinnedMesh && /goodface|head/i.test(o.name) && !graft) graft = o; });
    const p = graft.geometry.attributes.position, acc = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < p.count; i += 7){ acc.add(skinPos(graft, i, v)); n++; }
    const hs = new THREE.Box3().setFromObject(graft).getSize(new THREE.Vector3()).y;
    return { target: acc.multiplyScalar(1 / n), span: hs };
  }
  if (mode === 'whole'){                      /* head-only asset: frame all of it */
    const acc = new THREE.Vector3(); let n = 0;
    root.traverse((o) => { if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 7){ acc.add(skinPos(o, i, v)); n++; } });
    const hs = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
    return { target: acc.multiplyScalar(1 / n), span: hs };
  }
  if (mode === 'full'){                       /* the page's own framing: the whole man */
    const b = new THREE.Box3().setFromObject(root);
    return { target: b.getCenter(new THREE.Vector3()),
             span: (b.max.y - b.min.y) * 1.55 / 2.3 };
  }
  /* full figure, no graft mesh: the top slice IS the head (7.4 heads tall) */
  const box = new THREE.Box3().setFromObject(root);
  const hs = (box.max.y - box.min.y) * 0.135;
  const cut = box.max.y - hs;
  const acc = new THREE.Vector3(); let n = 0;
  root.traverse((o) => { if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 3){
      skinPos(o, i, v); if (v.y >= cut){ acc.add(v); n++; }
    } });
  return { target: acc.multiplyScalar(1 / n), span: hs };
}

/* ---- the five rigs -------------------------------------------------------- */
const BG = 0x14161c;                 /* one background for every tile: the figure is the test */

function rigREF(scene){
  renderer.toneMapping = THREE.NoToneMapping;      /* graftverify never set one */
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.8); rim.position.set(-3, 2, -2); scene.add(rim);
}
function rigA(scene){                              /* king-demo/index.html, verbatim */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.fog = new THREE.Fog(0x0a1e3f, 3.5, 17);
  scene.add(new THREE.HemisphereLight(0x33496f, 0x0d1730, 1.0));
  const key = new THREE.DirectionalLight(0xe6ecfa, 2.2); key.position.set(1.3, 2.0, 4.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb45a, 1.45); rim.position.set(-2.2, 2.1, -2.8); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x7d94c6, 0.7); fill.position.set(-1.9, 1.0, 2.0); scene.add(fill);
}
function studio(scene, tone, envI, exp, rimI){
  renderer.toneMapping = tone;
  renderer.toneMappingExposure = exp;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.environment = env();
  scene.environmentIntensity = envI;
  const key = new THREE.DirectionalLight(0xffe6c4, 0.85); key.position.set(2.0, 3.0, 4.0); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb45a, rimI === undefined ? 0.9 : rimI);
  rim.position.set(-2.2, 2.1, -2.8); scene.add(rim);
}
const RIGS = {
  REF: (s) => rigREF(s),
  A:   (s) => rigA(s),
  B:   (s) => studio(s, THREE.ACESFilmicToneMapping, 1.0, 1.0),
  C:   (s) => studio(s, THREE.NeutralToneMapping,    0.7, 1.0),
  D:   (s) => studio(s, THREE.NeutralToneMapping,    0.7, 1.0),
  E:   (s) => {                                   /* the page rig: same, at night */
    studio(s, THREE.NeutralToneMapping, 0.6, 1.0, 1.2);
    s.background = new THREE.Color(0x0d1428);
    s.fog = new THREE.Fog(0x0a1e3f, 3.5, 17);
  },
};

/* ---- D's material-only skin tweak (no post pipeline) ---------------------- */
function skinTweak(root, on){
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])){
      if (!m || !m.isMeshStandardMaterial) continue;
      if (!m.userData.__orig) m.userData.__orig = { metalness:m.metalness, roughness:m.roughness,
        color:m.color.clone(), env:m.envMapIntensity };
      const o0 = m.userData.__orig;
      const isSkin = /skin|face|head/i.test(m.name + ' ' + o.name);
      m.metalness = on ? 0.0 : o0.metalness;      /* cloth is not 40% metal (tripo ships 0.4) */
      m.roughness = on ? Math.min(o0.roughness, isSkin ? 0.62 : 0.9) : o0.roughness;
      m.color.copy(o0.color);
      if (on) m.color.offsetHSL(0, 0.06, 0);        /* the saturation ACES eats back */
      m.envMapIntensity = on ? 1.0 : o0.env;
      m.needsUpdate = true;
    }
  });
}

/* ---- skin statistics straight off the framebuffer ------------------------- */
function stats(ctx2d){
  const d = ctx2d.getImageData(0, 0, SIZE, SIZE).data;
  let n = 0, sl = 0, ss = 0, sh = 0, sr = 0, sg = 0, sb = 0;
  for (let i = 0; i < d.length; i += 4){
    const r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b), l = (mx+mn)/2, dl = mx-mn;
    if (dl < 1e-4) continue;
    const s = dl / (1 - Math.abs(2*l - 1));
    let h = 0;
    if (mx === r) h = 60*(((g-b)/dl)%6); else if (mx === g) h = 60*((b-r)/dl+2); else h = 60*((r-g)/dl+4);
    if (h < 0) h += 360;
    if (h > 8 && h < 48 && s > 0.12 && s < 0.75 && l > 0.18 && l < 0.96 && r > g && g > b){
      n++; sl += l; ss += s; sh += h; sr += r; sg += g; sb += b;   /* skin-ish pixels only */
    }
  }
  if (!n) return { skinPx:0 };
  return { skinPx:n, L:+(100*sl/n).toFixed(1), S:+(100*ss/n).toFixed(1), H:+(sh/n).toFixed(1),
           rgb:[Math.round(255*sr/n), Math.round(255*sg/n), Math.round(255*sb/n)] };
}

const cache = {};
window.load = async (url) => {
  if (!cache[url]) cache[url] = await new GLTFLoader().loadAsync(url);
  return true;
};
window.materials = async (url) => {
  const g = cache[url]; const out = [];
  g.scene.traverse((o) => { if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material]))
      out.push({ mesh:o.name, mat:m.name, type:m.type, metalness:m.metalness,
                 roughness:m.roughness, color:'#'+m.color.getHexString(),
                 map: m.map ? (m.map.image.width+'x'+m.map.image.height) : null,
                 mapCS: m.map ? m.map.colorSpace : null,
                 emissive: m.emissive ? '#'+m.emissive.getHexString() : null }); });
  return out;
};
window.shoot = async (url, rigName, mode, opts) => {
  opts = opts || {};
  const src = cache[url];
  const root = src.scene.clone(true);
  /* clone(true) shares skeletons badly for skinned meshes — re-bind by hand */
  const bones = new Map(); root.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const sk = o.skeleton;
    o.bind(new THREE.Skeleton(sk.bones.map((b) => bones.get(b.name) || b), sk.boneInverses),
           o.bindMatrix.clone());
  });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.add(root);
  prepare(root);

  let dur = 0, mixer = null;
  if (src.animations.length && mode === 'graft'){
    mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(src.animations[0]).play();
    dur = src.animations[0].duration;
    mixer.setTime(dur * 0.5);                     /* the reference render's frame: 'mid' */
  }
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });

  (RIGS[rigName] || RIGS.REF)(scene);
  if (opts.envI !== undefined) scene.environmentIntensity = opts.envI;
  if (opts.exposure !== undefined) renderer.toneMappingExposure = opts.exposure;
  skinTweak(root, rigName === 'D' || rigName === 'E');

  const { target, span } = headFrame(root, mode);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.005, 100);
  const dir = new THREE.Vector3().fromArray(opts.dir || [1, 0.1, 0.35]).normalize();
  cam.position.copy(target).addScaledVector(dir, span * 2.3);
  cam.lookAt(target); cam.updateProjectionMatrix();
  renderer.render(scene, cam);

  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
  const cx = cv.getContext('2d', { willReadFrequently:true });
  cx.drawImage(canvas, 0, 0);
  return { png: canvas.toDataURL('image/png'), stats: stats(cx),
           target: target.toArray().map((x) => +x.toFixed(4)), span:+span.toFixed(4) };
};
window.statsOf = async (url) => {                 /* stats of a saved reference PNG */
  const img = await new Promise((res, rej) => { const i = new Image();
    i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
  const cx = cv.getContext('2d', { willReadFrequently:true });
  cx.drawImage(img, 0, 0, SIZE, SIZE);
  return stats(cx);
};
window.diff = async (urlA, dataB) => {            /* mean |Δ| between saved ref and replica */
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const [a, b] = await Promise.all([load(urlA), load(dataB)]);
  const mk = (im) => { const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    const cx = cv.getContext('2d', { willReadFrequently:true }); cx.drawImage(im, 0, 0, SIZE, SIZE);
    return cx.getImageData(0, 0, SIZE, SIZE).data; };
  const da = mk(a), db = mk(b);
  let s = 0; for (let i = 0; i < da.length; i += 4)
    s += Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2]);
  return +(s / (da.length / 4 * 3)).toFixed(2);
};

/* ---- contact sheet -------------------------------------------------------- */
window.sheet = async (cells, cols, cell, pad, head) => {
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const imgs = await Promise.all(cells.map((c) => c.png ? load(c.png) : null));
  const rows = Math.ceil(cells.length / cols);
  const cv = document.createElement('canvas');
  cv.width = cols * cell; cv.height = head + rows * (cell + pad);
  const cx = cv.getContext('2d');
  cx.fillStyle = '#0a0e14'; cx.fillRect(0, 0, cv.width, cv.height);
  cx.fillStyle = '#f2e9d4'; cx.font = 'bold 30px monospace';
  cx.fillText('RENDER-RIG A/B — same GLBs, same face3q camera, five rigs, vendored three r185', 22, 42);
  cx.fillStyle = '#c9b98f'; cx.font = '20px monospace';
  cx.fillText('REF = tools/graftverify.mjs rig (the render that "reads well")  ·  A = king-demo viewer today  ·  B/C/D = candidates', 22, 74);
  imgs.forEach((im, k) => {
    const x = (k % cols) * cell, y = head + Math.floor(k / cols) * (cell + pad);
    if (im) cx.drawImage(im, x + 2, y + pad, cell - 4, cell - 4);
    else { cx.fillStyle = '#14161c'; cx.fillRect(x + 2, y + pad, cell - 4, cell - 4); }
    cx.strokeStyle = cells[k].hi ? '#d8b45a' : '#2a2417';
    cx.lineWidth = cells[k].hi ? 4 : 1;
    cx.strokeRect(x + 2, y + pad, cell - 4, cell - 4);
    cx.fillStyle = cells[k].hi ? '#f0c862' : '#d8cfae';
    cx.font = 'bold 19px monospace'; cx.fillText(cells[k].t1 || '', x + 10, y + pad - 24);
    cx.fillStyle = '#8f9dbd'; cx.font = '16px monospace';
    cx.fillText(cells[k].t2 || '', x + 10, y + pad - 6);
  });
  return cv.toDataURL('image/png');
};
window.readySignal = true;
</script></body></html>`;

const browser = await chromium.launch({ headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await page.route('**/bench.html', (r) => r.fulfill({ contentType: 'text/html', body: html }));
await page.goto(`http://127.0.0.1:${port}/bench.html`);
await page.waitForFunction('window.readySignal === true');

const MODELS = [
  { key:'rigged', label:'rigged-goodface-v2 (page model)', mode:'graft',
    url:'/assets/plates/king-v2/king2-rigged-goodface-v2.glb',
    ref:'/review/graft/neckfix-after-face3q-mid.png' },
  { key:'tripo', label:'tripo static (page model)', mode:'figure',
    url:'/assets/plates/king-v2/king2-tripo.glb', ref:null },
  { key:'head', label:'from-scratch head (laneb)', mode:'whole',
    url:'/assets/plates/king-v2/king2-head-blender.glb', ref:null },
];
const RIGLIST = [
  { id:'REF', t1:'REF  reference rig', t2:'NoToneMapping · amb 1.1 + key 2.2' },
  { id:'A',   t1:'A  CURRENT (king-demo)', t2:'ACES · exp 0.9 · cool hemi · NO env' },
  { id:'B',   t1:'B  STUDIO-IBL', t2:'RoomEnv PMREM 1.0 · ACES · exp 1.0' },
  { id:'C',   t1:'C  NEUTRAL-IBL  << WINNER', t2:'RoomEnv PMREM 0.7 · Neutral · exp 1.0' },
  { id:'D',   t1:'D  C + material hygiene', t2:'metalness 0 · skin roughness 0.62' },
  { id:'E',   t1:'E  D on the night page', t2:'env 0.6 · amber rim 1.2 · night bg + fog' },
];

const report = { models:[], envSweep:[], pageErrors:errs };
const cells = [];
const CELL = 512, PAD = 52, HEAD = 96, COLS = 7;

for (const m of MODELS) {
  await page.evaluate((u) => window.load(u), m.url);
  const mats = await page.evaluate((u) => window.materials(u), m.url);
  const row = { model:m.key, label:m.label, url:m.url, materials:mats, rigs:{} };

  /* col 0 — the saved reference PNG, where one exists */
  if (m.ref) {
    const rs = await page.evaluate((u) => window.statsOf(u), m.ref);
    row.savedRef = { file:m.ref, stats:rs };
    cells.push({ png:m.ref, t1:'SAVED REF (on disk)', t2:m.label + ' · skin L' + rs.L + ' S' + rs.S });
  } else {
    cells.push({ png:null, t1:'(no saved ref)', t2:m.label });
  }

  for (const r of RIGLIST) {
    const shot = await page.evaluate(([u, id, mode]) => window.shoot(u, id, mode),
      [m.url, r.id, m.mode]);
    const file = path.join(TILES, `${m.key}-${r.id}.png`);
    fs.writeFileSync(file, Buffer.from(shot.png.split(',')[1], 'base64'));
    row.rigs[r.id] = { file, stats:shot.stats, target:shot.target, span:shot.span };
    if (r.id === 'REF' && m.ref) {
      row.refReplicaDiff = await page.evaluate(([a, b]) => window.diff(a, b), [m.ref, shot.png]);
    }
    cells.push({ png:shot.png, hi:r.id === 'REF',
      t1:r.t1, t2:`skin L${shot.stats.L} S${shot.stats.S} H${shot.stats.H} · ${m.key}` });
  }
  report.models.push(row);
}

/* ---- environmentIntensity / exposure sweep, on the page's own hero model --- */
const sweep = [];
for (const [envI, exp, tone] of [[0.4,1.0,'C'],[0.7,1.0,'C'],[1.0,1.0,'C'],[1.4,1.0,'C'],
                                 [1.0,0.9,'C'],[1.0,1.15,'C'],[1.0,1.0,'B'],[1.4,1.0,'B']]) {
  const shot = await page.evaluate(([u, id, mode, o]) => window.shoot(u, id, mode, o),
    [MODELS[0].url, tone, 'graft', { envI, exposure:exp }]);
  sweep.push({ png:shot.png, t1:`${tone === 'C' ? 'Neutral' : 'ACES'} envI ${envI} exp ${exp}`,
    t2:`skin L${shot.stats.L} S${shot.stats.S} H${shot.stats.H}` });
  report.envSweep.push({ tone, envI, exposure:exp, stats:shot.stats });
}
const sweepPng = await page.evaluate(([c, cols, cell, pad, head]) => window.sheet(c, cols, cell, pad, head),
  [sweep, 4, CELL, PAD, HEAD]);
const sweepOut = OUT.replace(/\.png$/, '-envsweep.png');
fs.writeFileSync(sweepOut, Buffer.from(sweepPng.split(',')[1], 'base64'));

/* ---- does the winner still hold at the PAGE's framing (the whole man)? ----- */
const fullCells = [];
report.fullBody = [];
for (const m of MODELS.slice(0, 2)) {
  for (const r of ['REF', 'A', 'C', 'D', 'E']) {
    const shot = await page.evaluate(([u, id, mode, o]) => window.shoot(u, id, mode, o),
      [m.url, r, 'full', { dir:[0.25, 0.12, 1] }]);
    fs.writeFileSync(path.join(TILES, `${m.key}-full-${r}.png`),
      Buffer.from(shot.png.split(',')[1], 'base64'));
    report.fullBody.push({ model:m.key, rig:r, stats:shot.stats });
    fullCells.push({ png:shot.png, hi:r === 'D',
      t1:`${r}  ${m.key} · full figure`, t2:`skin L${shot.stats.L} S${shot.stats.S} H${shot.stats.H}` });
  }
}
const fullPng = await page.evaluate(([c, cols, cell, pad, head]) => window.sheet(c, cols, cell, pad, head),
  [fullCells, 5, CELL, PAD, HEAD]);
const fullOut = OUT.replace(/\.png$/, '-fullbody.png');
fs.writeFileSync(fullOut, Buffer.from(fullPng.split(',')[1], 'base64'));
report.fullBodySheet = fullOut;

const sheetPng = await page.evaluate(([c, cols, cell, pad, head]) => window.sheet(c, cols, cell, pad, head),
  [cells, COLS, CELL, PAD, HEAD]);
fs.writeFileSync(OUT, Buffer.from(sheetPng.split(',')[1], 'base64'));

await browser.close();
server.close();
report.sheet = OUT; report.envSweepSheet = sweepOut;
fs.writeFileSync(path.join(TILES, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2).slice(0, 12000));
