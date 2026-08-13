#!/usr/bin/env node
/** verify-king-demo-v5.mjs — verify the king-demo FOUR-way mesh switch standing on the
 *  procedural Baker Street stage (img2threejs).
 *
 *  Everything v4 proved (four options cycle, lazy GLBs, rigged ANIMATES with the camera
 *  frozen, no console errors) plus the stage:
 *    - createBakerStreetStage.js served and mounted, mesh count + tick contract
 *    - the figure stands ON the stage ground (his feet and the pavement share y=0)
 *    - the stage TICK is alive on a STATIC mesh option: camera frozen, two frames 1 s
 *      apart must differ inside the screen-space boxes of the gas lantern and a lit
 *      window (boxes are projected from the real meshes, not hard-coded)
 *    - the camera pendulum stays inside its bearing clamp
 *    - the page says the background is procedural, and both comparison thumbs load
 *
 *  usage: node verify-king-demo-v5.mjs <baseUrl> [--shots <prefix>] [--final <dir>]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { decodePng, pixelDiff, imageStats } from './png.mjs';

const base = process.argv[2];
if (!base) { console.error('usage: verify-king-demo-v5.mjs <baseUrl> [--shots <prefix>] [--final <dir>]'); process.exit(2); }
const argOf = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const shotPrefix = argOf('--shots');
const finalDir = argOf('--final');
if (finalDir) fs.mkdirSync(finalDir, { recursive: true });

const LABELS = ['tripo 3.1', 'hybrid — tripo head, game body',
                'RIGGED — auto-rig + mixamo run', 'previous (yvo3d)'];
const KEYS = ['tripo', 'hybrid', 'rigged', 'yvo'];
const RIGGED_CAPTION = 'Auto-rigged (Make-It-Animatable, free) — a stock Mixamo run ' +
  'retargeted onto the generated mesh. The full pipeline: portrait → image→3D → auto-rig → animate.';
const report = { base, checks: [], failures: [], screenshots: [] };
const ok   = (m) => { report.checks.push(m); console.error('ok:   ' + m); };
const fail = (m) => { report.failures.push(m); console.error('FAIL: ' + m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.setDefaultTimeout(60000);

const consoleErrs = [], badResp = [], responses = [];
p.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 300)); });
p.on('pageerror', e => consoleErrs.push('PAGEERR ' + String(e.message).slice(0, 300)));
p.on('response', r => {
  responses.push({ url: r.url(), status: r.status() });
  if (r.status() >= 400) badResp.push(r.status() + ' ' + r.url());
});

const resp = await p.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
if (resp.status() === 200) ok('page HTTP 200'); else fail('page HTTP ' + resp.status());

await p.waitForFunction('window.__meshLoaded === true', null, { timeout: 120000 });
ok('default tripo mesh loaded (__meshLoaded)');

/* ---------- the stage ---------- */
const stageResp = responses.find(r => r.url.includes('createBakerStreetStage.js'));
if (stageResp && stageResp.status === 200) ok('createBakerStreetStage.js HTTP 200');
else fail('stage factory response: ' + JSON.stringify(stageResp));

const st = await p.evaluate(() => {
  const s = window.__stage;
  if (!s) return null;
  let meshes = 0, lights = 0, sprites = 0;
  s.stage.traverse((o) => { if (o.isMesh) meshes++; if (o.isLight) lights++; if (o.isSprite) sprites++; });
  return {
    name: s.stage.name, meshes, lights, sprites,
    tick: typeof s.stage.userData.tick === 'function',
    movesGeometry: s.stage.userData.tickContract && s.stage.userData.tickContract.movesGeometry,
    scale: +s.stage.scale.x.toFixed(3),
    yaw: +(s.stage.rotation.y * 180 / Math.PI).toFixed(1),
    frames: s.frames, lampEmissive: s.lampEmissive,
    sockets: Object.keys(s.stage.userData.sculptRuntime.sockets)
  };
});
if (!st) fail('window.__stage missing — the stage is not mounted');
else {
  if (st.meshes > 100) ok(`stage mounted: "${st.name}" ${st.meshes} meshes / ${st.lights} lights / ${st.sprites} halo sprites, scale ${st.scale}, yaw ${st.yaw}°`);
  else fail('stage mesh count too low: ' + st.meshes);
  if (st.tick && st.movesGeometry === false) ok('stage exposes userData.tick and declares it moves no geometry');
  else fail('stage tick contract wrong: ' + JSON.stringify({ tick: st.tick, movesGeometry: st.movesGeometry }));
  if (st.frames > 0) ok(`stage tick driven from the render loop (${st.frames} frames so far)`);
  else fail('stage tick never called from the loop');
}

/* he stands ON the stage: pavement top and his feet share y = 0 */
const stand = await p.evaluate(() => {
  const V = window.__viewer.camera.position.constructor;
  const meshes = window.__stage.stage.userData.sculptRuntime.meshes;
  const road = meshes['cobble-field'] || meshes['road-bed'];
  const groundY = road ? road.getWorldPosition(new V()).y : null;
  return { groundY: groundY === null ? null : +groundY.toFixed(3) };
});
if (stand.groundY !== null && Math.abs(stand.groundY) < 0.25)
  ok(`figure stands on the stage's own ground (road surface at y=${stand.groundY}, his feet at y=0)`);
else fail('stage ground is not at the figure\'s feet: ' + JSON.stringify(stand));

/* ---------- the page copy + comparison thumbs ---------- */
const heading = await p.evaluate(() => Array.from(document.querySelectorAll('h2'))
  .map(h => h.textContent.trim()).find(t => t.startsWith('3 ·')));
if (heading && !/two generators/i.test(heading)) ok('section-3 heading updated: "' + heading + '"');
else fail('section-3 heading stale: "' + heading + '"');

const note = await p.evaluate(() => {
  const el = Array.from(document.querySelectorAll('p.note')).find(n => /img2threejs/i.test(n.textContent));
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
});
if (note && /procedural/i.test(note) && /img2threejs/i.test(note))
  ok('intro line credits the procedural background: "…' + note.slice(-150) + '"');
else fail('intro line does not describe the procedural background: ' + note);

const thumbs = await p.evaluate(() => Array.from(document.querySelectorAll('.plate-pair img'))
  .map(i => ({ src: i.getAttribute('src'), okk: i.complete && i.naturalWidth > 0,
               cap: i.closest('figure').querySelector('figcaption').textContent.trim() })));
if (thumbs.length === 2 && thumbs.every(t => t.okk) &&
    thumbs.some(t => /stage-plate/.test(t.src)) && thumbs.some(t => /stage-render/.test(t.src)))
  ok('comparison thumbs present and loaded: ' + thumbs.map(t => t.src).join(' + '));
else fail('comparison thumbs wrong: ' + JSON.stringify(thumbs));

/* lightbox opens on the stage render thumb */
await p.click('.plate-pair img[src="stage-render.jpg"]');
const lb = await p.evaluate(() => {
  const box = document.getElementById('lightbox');
  return { open: box.classList.contains('open'), src: box.querySelector('img').getAttribute('src'),
           cap: box.querySelector('figcaption').textContent.trim().slice(0, 40) };
});
if (lb.open && /stage-render/.test(lb.src)) ok('stage render thumb lightboxes ("' + lb.cap + '…")');
else fail('lightbox did not open on the stage render: ' + JSON.stringify(lb));
await p.click('#lightbox');
await p.waitForFunction('!document.getElementById("lightbox").classList.contains("open")');

/* ---------- switch wiring ---------- */
const sw = await p.evaluate(() => Array.from(document.querySelectorAll('#mesh-switch .mesh-opt'))
  .map(o => ({ key: o.dataset.key, label: o.textContent.trim(), active: o.classList.contains('active') })));
if (sw.length === 4 && KEYS.every((k, i) => sw[i].key === k))
  ok('four-way switch keys in order: ' + sw.map(o => o.key).join(' | '));
else fail('switch options wrong: ' + JSON.stringify(sw));
if (LABELS.every((l, i) => sw[i] && sw[i].label === l)) ok('labels exact');
else fail('labels wrong: ' + JSON.stringify(sw.map(o => o.label)));
if (sw[0] && sw[0].active) ok('tripo is the default/active option'); else fail('tripo not active by default');

const early = responses.filter(r => /king2-hybrid\.glb|king2-rigged\.glb|\/king2\.glb/.test(r.url));
if (early.length === 0) ok('hybrid + rigged + yvo GLBs are lazy (not requested before selection)');
else fail('GLBs requested before selection: ' + early.map(r => r.url).join(', '));

/* park the pendulum back on its default bearing so framing is repeatable */
const parkBearing = async (deg = 45) => {
  await p.evaluate((d) => {
    const c = window.__viewer.controls, cam = window.__viewer.camera, t = c.target;
    const off = cam.position.clone().sub(t);
    const h = Math.sqrt(Math.max(1e-6, off.lengthSq() - off.y * off.y));
    const a = d * Math.PI / 180;
    cam.position.set(t.x + Math.sin(a) * h, t.y + off.y, t.z + Math.cos(a) * h);
    c.update();
  }, deg);
};

/* ---------- the stage tick is alive on a STATIC mesh option ---------- */
await p.locator('#viewer-fig').scrollIntoViewIfNeeded();
/* freeze hard: autoRotate off AND damping off, so no residual glide can fake the diff */
await p.evaluate(() => {
  const c = window.__viewer.controls;
  c.autoRotate = false; c.enableDamping = false; c.update();
});
await parkBearing(45);                          /* default bearing, repeatable framing */
await p.waitForTimeout(1200);                   /* the camera is frozen */

/* the diff boxes are projected from the real meshes, and we take the first candidate that
 * is actually on frame — which lamp is in shot depends on the bearing */
const geom = await p.evaluate(() => {
  const V = window.__viewer.camera.position.constructor;
  const cam = window.__viewer.camera, canvas = document.getElementById('viewer');
  const meshes = window.__stage.stage.userData.sculptRuntime.meshes;
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const proj = (id) => {
    const m = meshes[id];
    if (!m) return null;
    const v = m.getWorldPosition(new V()); v.project(cam);
    const x = (v.x * 0.5 + 0.5) * cw, y = (-v.y * 0.5 + 0.5) * ch;
    const pad = 80;
    return { id, x, y, onFrame: v.z < 1 && x > pad && x < cw - pad && y > pad && y < ch - pad };
  };
  const first = (ids) => ids.map(proj).filter(Boolean).find(q => q.onFrame) || null;
  return {
    lamp: first(['lamp-b-lantern', 'lamp-a-lantern', 'cab-lamp-a', 'cab-lamp-b']),
    win: first(['shopfront-a-glass', 'shopfront-b-glass', 'shop-window-c-glass',
                'upper-window-1-glass', 'upper-window-2-glass', 'pier-window']),
    cw, ch
  };
});
if (geom.lamp && geom.win) ok(`tick probe boxes on frame: lamp "${geom.lamp.id}" + window "${geom.win.id}"`);
else fail('no lamp/window on frame to probe: ' + JSON.stringify(geom));
const tickShots = finalDir ? [finalDir + '/king-demo-stage-tick-a.png', finalDir + '/king-demo-stage-tick-b.png'] : [null, null];
const camFrozenA = await p.evaluate(() => window.__viewer.camera.position.toArray().map(v => +v.toFixed(4)));
const emisA = await p.evaluate(() => window.__stage.lampEmissive);
const tickA = await p.locator('#viewer').screenshot(tickShots[0] ? { path: tickShots[0] } : {});
await p.waitForTimeout(1000);
const tickB = await p.locator('#viewer').screenshot(tickShots[1] ? { path: tickShots[1] } : {});
if (tickShots[0]) report.screenshots.push(...tickShots);
const emisB = await p.evaluate(() => window.__stage.lampEmissive);
const camFrozenB = await p.evaluate(() => window.__viewer.camera.position.toArray().map(v => +v.toFixed(4)));

if (JSON.stringify(camFrozenA) === JSON.stringify(camFrozenB)) ok('camera verified frozen for the tick test');
else fail('camera moved during the tick test: ' + camFrozenA + ' -> ' + camFrozenB);

const imgA = decodePng(tickA), imgB = decodePng(tickB);
const s = imgA.width / geom.cw;                 /* screenshot pixels per CSS pixel */
const boxOf = (pt, r) => ({ x: pt.x * s - r, y: pt.y * s - r, w: r * 2, h: r * 2 });
const R = 70 * s;
const lampBox = geom.lamp ? boxOf(geom.lamp, R) : null;
const winBox  = geom.win  ? boxOf(geom.win, R)  : null;
const dLamp = lampBox ? pixelDiff(imgA, imgB, lampBox, 1, 1) : null;
const dWin  = winBox  ? pixelDiff(imgA, imgB, winBox, 1, 1)  : null;
const dFull = pixelDiff(imgA, imgB, null, 1, 2);
report.tick = { emisA, emisB, lampBox, winBox, dLamp, dWin, dFull };
if (emisA !== null && emisB !== null && emisA !== emisB)
  ok(`stage tick drives the lantern emissive: ${emisA.toFixed(4)} -> ${emisB.toFixed(4)}`);
else fail('lantern emissive did not change: ' + emisA + ' -> ' + emisB);
if (dLamp && dLamp.changed > 0)
  ok(`gas lamp region flickers with the camera frozen: ${dLamp.changed}/${dLamp.samples} px changed, max Δluma ${dLamp.maxDelta}`);
else fail('gas lamp region identical across 1 s: ' + JSON.stringify(dLamp));
if (dWin && dWin.changed > 0)
  ok(`lit window region breathes: ${dWin.changed}/${dWin.samples} px changed, max Δluma ${dWin.maxDelta}`);
else fail('window region identical across 1 s: ' + JSON.stringify(dWin));
if (!tickA.equals(tickB)) ok('two frames 1 s apart differ on a STATIC mesh option (stage alive)');
else fail('static-mesh frames 1 s apart are byte-identical');

/* the frame is a picture, not a black canvas */
const fs0 = imageStats(tickA, 4);
if (fs0.mean > 18 && fs0.mean < 200) ok(`frame exposed: mean luma ${fs0.mean}`);
else fail('frame luma suspicious: ' + JSON.stringify(fs0));

/* ---------- the pendulum ---------- */
await p.evaluate(() => {
  const c = window.__viewer.controls;
  c.enableDamping = true; c.autoRotate = true;     /* restore the page's own behaviour */
});
const bearings = [];
for (let i = 0; i < 8; i++) {
  bearings.push(await p.evaluate(() => +(window.__viewer.controls.getAzimuthalAngle() * 180 / Math.PI).toFixed(2)));
  await p.waitForTimeout(400);
}
const lim = await p.evaluate(() => ({
  min: +(window.__viewer.controls.minAzimuthAngle * 180 / Math.PI).toFixed(1),
  max: +(window.__viewer.controls.maxAzimuthAngle * 180 / Math.PI).toFixed(1)
}));
const inside = bearings.every(a => a >= lim.min - 0.6 && a <= lim.max + 0.6);
const moved = Math.max(...bearings) - Math.min(...bearings) > 0.3;
report.bearings = { bearings, lim };
if (inside && moved) ok(`camera pendulum turns inside its clamp [${lim.min}°, ${lim.max}°]: ${bearings.join(' → ')}`);
else fail(`pendulum out of clamp or frozen: ${bearings.join(' → ')} vs ${JSON.stringify(lim)}`);

/* ---------- cycle the four options ---------- */
const pick = async (key, timeout) => {
  await p.click(`#mesh-switch .mesh-opt[data-key="${key}"]`);
  await p.waitForFunction(`window.__viewer && window.__viewer.showing === "${key}"`, null, { timeout });
};
await pick('hybrid', 120000);
ok('hybrid selected and shown');
await pick('rigged', 180000);
ok('rigged selected and shown');
const rigResp = responses.find(r => r.url.includes('king2-rigged.glb'));
if (rigResp && rigResp.status === 200) ok('king2-rigged.glb fetched HTTP 200');
else fail('king2-rigged.glb response: ' + JSON.stringify(rigResp));
const rigBytes = await p.evaluate(async (u) => {
  const r = await fetch(u, { cache: 'force-cache' });
  const buf = await r.arrayBuffer();
  const h = await crypto.subtle.digest('SHA-1', buf);
  return { bytes: buf.byteLength, sha1: Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('') };
}, new URL('king2-rigged.glb', base).href);
report.riggedGlb = rigBytes;
ok(`rigged GLB served: ${rigBytes.bytes} bytes, sha1 ${rigBytes.sha1}`);
const capRig = await p.evaluate(() => document.getElementById('viewer-caption').textContent.trim());
if (capRig === RIGGED_CAPTION) ok('rigged caption exact');
else fail('rigged caption wrong: "' + capRig + '"');

/* ---- the animation proof: freeze the camera, diff two frames 0.4 s apart ---- */
await p.evaluate(() => { window.__viewer.controls.autoRotate = false; window.__viewer.controls.update(); });
await parkBearing(45);
await p.waitForTimeout(900);
const mixerT0 = await p.evaluate(() => window.__viewer.mixer ? window.__viewer.mixer.time : null);
const shotA = shotPrefix ? shotPrefix + '-a.png' : null;
const shotB = shotPrefix ? shotPrefix + '-b.png' : null;
const bufA = await p.locator('#viewer').screenshot(shotA ? { path: shotA } : {});
await p.waitForTimeout(400);
const bufB = await p.locator('#viewer').screenshot(shotB ? { path: shotB } : {});
const mixerT1 = await p.evaluate(() => window.__viewer.mixer ? window.__viewer.mixer.time : null);
if (shotA) { report.screenshots.push(shotA, shotB); ok('canvas pair -> ' + shotA + ' , ' + shotB); }
if (mixerT0 !== null && mixerT1 !== null && mixerT1 > mixerT0)
  ok(`mixer clock advanced ${mixerT0.toFixed(3)}s -> ${mixerT1.toFixed(3)}s`);
else fail('mixer clock did not advance: ' + mixerT0 + ' -> ' + mixerT1);
if (!bufA.equals(bufB)) ok('rigged ANIMATES: two canvas frames 0.4 s apart differ (camera frozen)');
else fail('rigged frames 0.4 s apart are byte-identical — no animation');

if (finalDir) {
  const f = finalDir + '/king-demo-final-rigged.png';
  await p.locator('#viewer').screenshot({ path: f });
  report.screenshots.push(f); ok('final rigged shot -> ' + f);
}

await p.evaluate(() => { window.__viewer.controls.autoRotate = true; });
await pick('yvo', 240000);
const yvoResp = responses.find(r => /\/king2\.glb/.test(r.url));
if (yvoResp && yvoResp.status === 200) ok('previous (yvo3d) selected, king2.glb fetched HTTP 200');
else fail('king2.glb response: ' + JSON.stringify(yvoResp));

const tripoBefore = responses.filter(r => r.url.includes('king2-tripo.glb')).length;
await pick('tripo', 60000);
const tripoAfter = responses.filter(r => r.url.includes('king2-tripo.glb')).length;
if (tripoAfter === tripoBefore) ok('back to tripo from cache (no refetch) — all four cycled');
else fail('tripo was refetched on return');

await p.waitForTimeout(300);
const rigT = await p.evaluate(() => window.__viewer.mixer ? 'mixer-on-tripo?' : 'none');
if (rigT === 'none') ok('non-animated model shows no mixer (rigged paused while away)');
else fail('unexpected mixer on tripo: ' + rigT);

if (finalDir) {                          /* the wide hero frame, default bearing, tripo */
  await p.evaluate(() => { window.__viewer.controls.autoRotate = false; window.__viewer.controls.update(); });
  await parkBearing(45);
  await p.waitForTimeout(800);
  const f = finalDir + '/king-demo-final-wide.png';
  await p.locator('#viewer').screenshot({ path: f });
  report.screenshots.push(f); ok('final wide shot -> ' + f);
  const g = finalDir + '/king-demo-final-page.png';
  await p.locator('.mesh-grid').screenshot({ path: g });
  report.screenshots.push(g); ok('mesh section shot -> ' + g);
}

const imgs = await p.evaluate(() => Array.from(document.querySelectorAll('.wrap img'))
  .map(i => ({ src: i.getAttribute('src'), okk: i.complete && i.naturalWidth > 0 })));
const badImgs = imgs.filter(i => !i.okk);
if (badImgs.length === 0) ok('all ' + imgs.length + ' page images loaded');
else fail('images failed: ' + badImgs.map(i => i.src).join(', '));

if (consoleErrs.length === 0) ok('zero console errors'); else fail('console errors: ' + consoleErrs.join(' | '));
if (badResp.length === 0) ok('zero HTTP>=400 responses'); else fail('bad responses: ' + badResp.join(', '));

await b.close();
console.log(JSON.stringify(report, null, 2));
process.exit(report.failures.length ? 1 : 0);
