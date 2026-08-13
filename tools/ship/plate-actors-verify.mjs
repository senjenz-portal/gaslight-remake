#!/usr/bin/env node
/**
 * plate-actors-verify.mjs — behavioural pass over the ACTOR section of
 * king-demo/living-plate/. Additive: the 46 checks in living-plate-verify.mjs
 * are untouched and still have to pass alongside these.
 *
 * The claims here are about pixels and z-order, so almost nothing is taken on
 * the page's word:
 *   · the inpaint is re-diffed from the shipped PNGs, not read off a manifest;
 *   · the chair layer is proved free by comparing its own opaque pixels
 *     against the room layer underneath it;
 *   · the puppet's motion is a measured delta that has to beat a control
 *     rectangle of the same size with the ambient light held still;
 *   · the occlusion is proved by DIFFING THE STAGE against itself with the
 *     actor hidden — his visible footprint has to be disjoint from the
 *     chair's own alpha, while overlapping the chair's bounding box.
 *
 *     node tools/ship/plate-actors-verify.mjs <baseUrl> <outDir> [label]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { decodePng } from '../png.mjs';

const REPO = '/Users/samz/Documents/gaslight-remake';
const BASE = (process.argv[2] || 'http://127.0.0.1:8899').replace(/\/$/, '');
const OUT = process.argv[3] || path.join(REPO, 'shots');
const LABEL = process.argv[4] || 'local';
const SHIP = path.join(REPO, 'site-deploy/king-demo/living-plate');
const WORK = path.join(OUT, 'work-actors-' + LABEL);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const checks = [];
const failures = [];
const ok = (name, pass, detail) => {
  const line = `${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`;
  checks.push(line);
  if (!pass) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(line);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL_PAGE = `${BASE}/king-demo/living-plate/`;

/* newest cut manifest on disk — the page's numbers are held against it */
function newestManifest(rel) {
  const root = path.join(REPO, 'assets/raw/lanea-actors');
  const dirs = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory());
  dirs.sort();
  for (let i = dirs.length - 1; i >= 0; i--) {
    const p = path.join(root, dirs[i], rel);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return null;
}

function px(img, x, y) {
  const i = (y * img.width + x) * img.channels;
  return [img.data[i], img.data[i + 1], img.data[i + 2],
          img.channels === 4 ? img.data[i + 3] : 255];
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* mean |RGB delta| between two equally sized PNG buffers */
function meanDelta(bufA, bufB) {
  const a = decodePng(bufA), b = decodePng(bufB);
  if (a.width !== b.width || a.height !== b.height) return NaN;
  let sum = 0, n = 0;
  for (let y = 0; y < a.height; y += 2) {
    for (let x = 0; x < a.width; x += 2) {
      const p = px(a, x, y), q = px(b, x, y);
      sum += Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
      n += 3;
    }
  }
  return n ? sum / n : NaN;
}

/* ================================================== A · THE SHIPPED PNGs */
const MAN = newestManifest('matte/manifest-matte.json');
const OCC = newestManifest('matte/manifest-occluder.json');
const SPR = (newestManifest('manifest-sprite.json') || {}).entries;
ok('assets · cut manifests on disk', !!MAN && !!OCC && !!SPR,
   MAN ? `matte + occluder + sprite` : 'missing');

/* the inpaint, re-diffed from the two shipped room layers */
{
  const a = decodePng(fs.readFileSync(path.join(SHIP, 'room.png')));
  const b = decodePng(fs.readFileSync(path.join(SHIP, 'room-clean.png')));
  ok('inpaint · the two room layers are the same size',
     a.width === b.width && a.height === b.height, `${a.width}x${a.height}`);
  /* the crop the model was allowed to touch, in ROOM-layer pixels, plus the
     6 px dilation and 2 px feather the paste used */
  const [cx0, cy0, cx1, cy1] = MAN.crop;
  const RX = 306, RY = 36, PAD = 10;
  const box = [cx0 - RX - PAD, cy0 - RY - PAD, cx1 - RX + PAD, cy1 - RY + PAD];
  let changed = 0, outside = 0;
  let mnx = 1e9, mny = 1e9, mxx = -1, mxy = -1;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      if (dist(px(a, x, y), px(b, x, y)) <= 6) continue;
      changed++;
      if (x < mnx) mnx = x; if (y < mny) mny = y;
      if (x > mxx) mxx = x; if (y > mxy) mxy = y;
      if (x < box[0] || y < box[1] || x >= box[2] || y >= box[3]) outside++;
    }
  }
  ok('inpaint · only the figure\'s own region changed',
     outside === 0 && changed > 4000,
     `${changed} px changed, ${outside} of them outside the allowed region`);
  const fig = MAN.cutout;
  const insideFig = mnx >= fig.x - RX - 20 && mny >= fig.y - RY - 20 &&
                    mxx <= fig.x + fig.w - RX + 20 && mxy <= fig.y + fig.h - RY + 20;
  ok('inpaint · the change is where the man stood',
     insideFig,
     `changed bbox (${mnx},${mny})-(${mxx},${mxy}) vs figure ` +
     `(${fig.x - RX},${fig.y - RY})-(${fig.x + fig.w - RX},${fig.y + fig.h - RY})`);
}

/* the chair layer is free: its opaque pixels ARE the room layer's pixels */
{
  const chair = decodePng(fs.readFileSync(path.join(SHIP, 'chair.png')));
  const room = decodePng(fs.readFileSync(path.join(SHIP, 'room-clean.png')));
  const L = OCC.layer, RX = 306, RY = 36;
  let n = 0, worst = 0, sum = 0;
  for (let y = 0; y < chair.height; y++) {
    for (let x = 0; x < chair.width; x++) {
      const c = px(chair, x, y);
      if (c[3] < 250) continue;
      const r = px(room, L.x - RX + x, L.y - RY + y);
      const d = dist(c, r);
      sum += d; worst = Math.max(worst, d); n++;
    }
  }
  ok('occluder · the chair layer paints exactly what is under it',
     n > 15000 && worst < 2 && sum / n < 0.05,
     `${n} opaque px · mean ${(sum / n).toFixed(4)} · worst ${worst.toFixed(2)} RGB`);
}

/* the walk strip really is four frames on one baseline */
{
  const w = decodePng(fs.readFileSync(path.join(SHIP, 'walk.png')));
  const s = SPR[SPR.length - 1];
  const cw = s.cell[0], ch = s.cell[1];
  ok('sprite · four cells of the declared size',
     w.width === cw * s.frames && w.height === ch && s.frames === 4,
     `${w.width}x${w.height} = ${s.frames} x ${cw}x${ch}`);
  const feet = [], heights = [];
  for (let f = 0; f < s.frames; f++) {
    let lo = 1e9, hi = -1;
    for (let y = 0; y < ch; y++) {
      for (let x = f * cw; x < (f + 1) * cw; x++) {
        if (px(w, x, y)[3] > 128) { if (y < lo) lo = y; if (y > hi) hi = y; }
      }
    }
    feet.push(hi); heights.push(hi - lo + 1);
  }
  const spread = Math.max(...heights) - Math.min(...heights);
  ok('sprite · every frame stands on one baseline and is one height',
     Math.max(...feet) - Math.min(...feet) <= 1 && spread <= 3,
     `feet ${feet.join(',')} · heights ${heights.join(',')}`);
}

/* ==================================================== B · THE LIVE PAGE */
const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle',
         '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${r.url()}`); });
page.setDefaultTimeout(60000);

const resp = await page.goto(URL_PAGE, { waitUntil: 'load', timeout: 90000 });
ok('page · HTTP 200', resp.status() === 200, 'status ' + resp.status());
await page.waitForFunction(() => !!window.__actors, null, { timeout: 20000 }).catch(() => {});
ok('page · actor harness present', await page.evaluate(() => !!window.__actors));

for (const f of ['room-clean.png', 'chair.png', 'walk.png', 'actor/part-head.png',
                 'actor/part-pipe.png', 'actor/part-torso.png', 'actor/part-skirt.png',
                 'actor/part-legs.png']) {
  const r = await page.request.get(URL_PAGE + f);
  ok(`assets · ${f} served`, r.status() === 200, 'HTTP ' + r.status());
}

/* the page's geometry is the cut's geometry */
{
  const g = await page.evaluate(() => window.__actors.geom());
  const map = {head:'ap-head', pipe:'ap-pipe', torso:'ap-torso', skirt:'ap-skirt', legs:'ap-legs'};
  const bad = [];
  for (const [k, id] of Object.entries(map)) {
    const m = MAN.parts[k], p = g.parts[id];
    if (!m || !p || m.x !== p.x || m.y !== p.y || m.w !== p.w || m.h !== p.h)
      bad.push(`${k}: page ${p && [p.x, p.y, p.w, p.h]} vs cut ${m && [m.x, m.y, m.w, m.h]}`);
    if (m && (m.pivot[0] !== g.hinge[{head:'act-neck', pipe:'act-arm', torso:'act-chest',
                                      skirt:'act-hip', legs:'act-root'}[k]][0]))
      bad.push(`${k}: pivot x drifted`);
  }
  const L = OCC.layer, cl = g.layers['act-chair'];
  if (cl.x !== L.x || cl.y !== L.y || cl.w !== L.w || cl.h !== L.h)
    bad.push('chair layer box drifted');
  ok('geometry · the page is drawn with the cut\'s own numbers', bad.length === 0,
     bad.slice(0, 3).join(' | ') || '5 parts + 5 hinges + the chair, all matching');
}

/* z-order: DOM order, and nothing carrying a z-index to fake it */
{
  const order = await page.evaluate(() => window.__actors.order());
  const ids = order.map((o) => o.id);
  const iRoom = ids.indexOf('act-room'), iFig = ids.indexOf('act-figure'),
        iChair = ids.indexOf('act-chair'), iLamp = ids.indexOf('act-lamp');
  const zs = order.filter((o) => o.id !== 'act-targets').map((o) => o.z);
  ok('z-order · the actor is inserted between the room and the chair',
     iRoom >= 0 && iRoom < iFig && iFig < iChair && iChair < iLamp,
     ids.join(' → '));
  ok('z-order · no z-index anywhere in the stack — it is DOM order or nothing',
     zs.every((z) => z === 'auto'), zs.join(','));
}

await page.$eval('#stage-actors', (el) => el.scrollIntoView({ block: 'center' }));
await sleep(1200);
const box = await (await page.$('#stage-actors')).boundingBox();
const clipOf = (x, y, w, h) => ({
  x: Math.round(box.x + box.width * (x / 1408)),
  y: Math.round(box.y + box.height * (y / 768)),
  width: Math.max(2, Math.round(box.width * (w / 1408))),
  height: Math.max(2, Math.round(box.height * (h / 768))),
});
const grab = (clip) => page.screenshot({ clip });
/* his gown, clear of the fire and candle emissives; and a control rectangle
   of the same size on a part of the plate nobody is standing on */
const R_ACTOR = clipOf(590, 300, 62, 200);
const R_CTRL = clipOf(330, 300, 62, 200);

/* ------------------------------------------- 1 · THE IDLE IS REALLY IDLING */
{
  await page.evaluate(() => window.__actors.stillAmbient(true));
  await page.mouse.move(box.x + box.width / 2, box.y - 200);
  await sleep(900);

  const a = await grab(R_ACTOR), ac = await grab(R_CTRL);
  /* four hinges on four different periods: two instants can catch any one of
     them at the same phase twice, so take the RANGE over a sweep instead */
  const KEYS = ['chest', 'hip', 'arm', 'neck'];
  const sweep = [];
  for (let i = 0; i < 12; i++) { sweep.push(await page.evaluate(() => window.__actors.pose())); await sleep(240); }
  const range = {};
  KEYS.forEach((k) => {
    const v = sweep.map((s) => s[k]);
    range[k] = Math.max(...v) - Math.min(...v);
  });
  const b = await grab(R_ACTOR), bc = await grab(R_CTRL);

  ok('idle · every hinge is moving, each on its own cycle',
     KEYS.every((k) => range[k] > 0.15),
     KEYS.map((k) => `${k} ±${(range[k] / 2).toFixed(2)}°`).join(' · '));
  ok('idle · nothing asks a painted cut-out for more than 3°',
     sweep.every((s) => KEYS.every((k) => Math.abs(s[k]) < 3.0)),
     KEYS.map((k) => `${k} max ${Math.max(...sweep.map((s) => Math.abs(s[k]))).toFixed(2)}°`).join(' · '));

  const dA = meanDelta(a, b), dC = meanDelta(ac, bc);
  ok('idle · he measurably moves, and the plate beside him does not',
     dA > 1.2 && dA > dC * 3, `actor Δ ${dA.toFixed(2)} vs control Δ ${dC.toFixed(2)} RGB`);

  /* the head turn is the slow one: it has to cross most of its range */
  const looks = [];
  for (let i = 0; i < 14; i++) { looks.push(await page.evaluate(() => window.__actors.pose().look)); await sleep(500); }
  ok('idle · the head turns towards the window on a slow cycle',
     Math.max(...looks) - Math.min(...looks) > 0.35,
     `look ${Math.min(...looks).toFixed(2)}..${Math.max(...looks).toFixed(2)} over 7 s`);
}

/* ------------------------------------------------------- 2 · THE GESTURE */
{
  const before = await grab(R_ACTOR);
  const cb = await grab(R_CTRL);
  const armBefore = (await page.evaluate(() => window.__actors.pose())).arm;
  await page.click('#tgt-act-holmes');
  await sleep(340);
  const g = await page.evaluate(() => window.__actors.pose());
  const after = await grab(R_ACTOR);
  const ca = await grab(R_CTRL);
  ok('gesture · the click raises the pipe hand', g.gesture > 0.9 && g.arm - armBefore > 5,
     `gesture ${g.gesture.toFixed(2)} · arm ${armBefore.toFixed(2)}° → ${g.arm.toFixed(2)}°`);
  const d = meanDelta(before, after), dc = meanDelta(cb, ca);
  ok('gesture · it is visible, and only on him',
     d > 2 && d > dc * 3, `Δ ${d.toFixed(2)} vs control Δ ${dc.toFixed(2)} RGB`);
  /* the hero shot wants the plate, not the tool-tip the click left hovering */
  await page.mouse.move(box.x + box.width / 2, box.y - 220);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'plate-actors-idle.png'), clip: box });
  await sleep(1500);
  ok('gesture · it releases and he goes back to breathing',
     (await page.evaluate(() => window.__actors.pose().gesture)) === 0);
}

/* ---------------------------------- 3 · THE WALK, AND WHAT IT WALKS BEHIND */
{
  const start = await page.evaluate(() => window.__actors.walk());
  ok('walk · he starts on the hearth mark', start.at === 'hearth' && !start.walking,
     `${start.at} at (${start.x},${start.y})`);

  await page.click('#tgt-act-send');
  await page.mouse.move(box.x + box.width / 2, box.y - 220);
  const samples = [];
  for (let i = 0; i < 9; i++) {
    await sleep(230);
    samples.push(await page.evaluate(() => ({
      w: window.__actors.walk(), f: window.__actors.foot() })));
    /* shot taken where the argument is: mid-stride, crossing behind the chair */
    if (i === 6) await page.screenshot({ path: path.join(OUT, 'plate-actors-walk.png'), clip: box });
  }
  const mid = samples.filter((s) => s.w.walking);
  ok('walk · he crosses the floor', mid.length >= 3 &&
     mid[mid.length - 1].w.x - mid[0].w.x > 60,
     `x ${mid.map((s) => s.w.x.toFixed(0)).join('→')}`);
  const frames = [...new Set(mid.map((s) => s.w.frame))];
  ok('walk · the sprite cycles its four frames', frames.length >= 3,
     'frames seen: ' + frames.join(','));
  const scales = mid.map((s) => s.w.scale);
  ok('walk · scale eases with depth', scales.every((v, i) => i === 0 || v <= scales[i - 1] + 1e-6) &&
     scales[0] - scales[scales.length - 1] > 0.03,
     `${scales[0].toFixed(3)} → ${scales[scales.length - 1].toFixed(3)}`);
  const worstFoot = Math.max(...samples.map((s) => Math.abs(s.f.dy)));
  ok('walk · his feet stay on the floor line (±4 px, measured off the rendered box)',
     worstFoot <= 4, `worst |Δy| ${worstFoot.toFixed(2)} px over ${samples.length} samples`);

  await page.waitForFunction(() => !window.__actors.walk().walking, null, { timeout: 8000 });
  await sleep(500);
  const end = await page.evaluate(() => window.__actors.walk());
  ok('walk · he arrives on the desk mark and turns back into the puppet',
     end.at === 'desk' && !end.walking &&
     Math.abs(end.x - (await page.evaluate(() => window.__actors.marks().desk))[0]) < 0.5,
     `${end.at} at (${end.x},${end.y}) scale ${end.scale}`);

  /* ---- the occlusion, proved by subtraction.
     Diff the stage against itself with the actor hidden: what changes IS the
     actor's visible footprint. Held against the chair's own alpha, that
     footprint must be empty everywhere the chair is opaque — and must still
     overlap the chair's bounding box, or he is merely standing beside it. */
  await page.evaluate(() => window.__actors.stillAmbient(true));
  await sleep(400);
  const withHim = await grab(box);
  await page.evaluate(() => { document.getElementById('act-figure').style.opacity = '0'; });
  await sleep(300);
  const without = await grab(box);
  await page.evaluate(() => { document.getElementById('act-figure').style.opacity = ''; });

  const A = decodePng(withHim), B = decodePng(without);
  const chair = decodePng(fs.readFileSync(path.join(SHIP, 'chair.png')));
  const L = OCC.layer;
  /* The stage is drawn at ~0.72 of plate scale, so the browser's resampled
     chair edge is a pixel softer than the source alpha and a strict test
     would be measuring bilinear filtering. Erode the chair's opaque mask by
     2 px and ask the real question: does any of him show through the SOLID
     body of the chair. */
  const solid = new Uint8Array(chair.width * chair.height);
  for (let y = 2; y < chair.height - 2; y++) {
    for (let x = 2; x < chair.width - 2; x++) {
      let all = true;
      for (let dy = -2; dy <= 2 && all; dy++)
        for (let dx = -2; dx <= 2 && all; dx++)
          if (px(chair, x + dx, y + dy)[3] < 250) all = false;
      if (all) solid[y * chair.width + x] = 1;
    }
  }
  let seen = 0, throughChair = 0, inChairBox = 0;
  for (let y = 0; y < A.height; y += 1) {
    for (let x = 0; x < A.width; x += 1) {
      if (dist(px(A, x, y), px(B, x, y)) <= 12) continue;
      seen++;
      const plateX = x / A.width * 1408, plateY = y / A.height * 768;
      const cxp = Math.round(plateX - L.x), cyp = Math.round(plateY - L.y);
      if (cxp < 0 || cyp < 0 || cxp >= chair.width || cyp >= chair.height) continue;
      inChairBox++;
      if (solid[cyp * chair.width + cxp]) throughChair++;
    }
  }
  ok('occlusion · at the desk he is genuinely inside the chair\'s footprint',
     seen > 500 && inChairBox > 200,
     `${seen} px of him visible, ${inChairBox} of them inside the chair's box`);
  const solidPx = solid.reduce((a, v) => a + v, 0);
  ok('occlusion · not one pixel of him shows through the body of the chair',
     throughChair === 0,
     `${throughChair} px of the actor over ${solidPx} solid chair px ` +
     `(${OCC.layer.opaquePx} opaque before a 2 px erode)`);

  /* and back again */
  await page.click('#tgt-act-send');
  await page.waitForFunction(() => !window.__actors.walk().walking, null, { timeout: 9000 });
  await sleep(400);
  const home = await page.evaluate(() => ({ w: window.__actors.walk(), f: window.__actors.foot() }));
  ok('walk · and he walks back to the hearth', home.w.at === 'hearth' &&
     Math.abs(home.f.dy) <= 4, `${home.w.at} · foot Δy ${home.f.dy.toFixed(2)} px`);
  await page.evaluate(() => window.__actors.stillAmbient(false));
}

/* ------------------------------------------- 4 · THE BEFORE/AFTER TOGGLE */
{
  const live = await grab(box);
  await page.click('.opt[data-stage="stage-actors"][data-mode="ref"]');
  await sleep(700);
  const st = await page.evaluate(() => ({
    ref: document.getElementById('stage-actors').classList.contains('showref'),
    livingOp: getComputedStyle(document.getElementById('plate-actors')).opacity,
  }));
  const baked = await grab(box);
  ok('toggle · the baked plate really replaces the actor plate',
     st.ref && +st.livingOp < 0.01 && meanDelta(live, baked) > 0.6,
     `showref=${st.ref} living opacity ${st.livingOp} · Δ ${meanDelta(live, baked).toFixed(2)} RGB`);
  await page.click('.opt[data-stage="stage-actors"][data-mode="live"]');
  await sleep(600);
  ok('toggle · and hands it back',
     !(await page.evaluate(() => document.getElementById('stage-actors').classList.contains('showref'))));
}

/* ----------------------------------------- 5 · REDUCED MOTION, AND ERRORS */
{
  const rctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  const rerr = [];
  rp.on('pageerror', (e) => rerr.push('pageerror: ' + e.message));
  rp.on('console', (m) => { if (m.type() === 'error') rerr.push('console: ' + m.text()); });
  await rp.goto(URL_PAGE, { waitUntil: 'load', timeout: 90000 });
  await rp.waitForFunction(() => !!window.__actors, null, { timeout: 20000 }).catch(() => {});
  await rp.$eval('#stage-actors', (el) => el.scrollIntoView({ block: 'center' }));
  await sleep(900);
  const p0 = await rp.evaluate(() => window.__actors.pose());
  await sleep(1600);
  const p1 = await rp.evaluate(() => window.__actors.pose());
  ok('reduced-motion · the idle is withheld',
     ['chest', 'hip', 'arm', 'neck'].every((k) => p0[k] === 0 && p1[k] === 0),
     JSON.stringify(p1));
  await rp.click('#tgt-act-send');
  await sleep(300);
  const w = await rp.evaluate(() => window.__actors.walk());
  ok('reduced-motion · the verbs still answer — the walk arrives as a state change',
     w.at === 'desk' && !w.walking, `${w.at} walking=${w.walking}`);
  await rp.click('#tgt-act-holmes');
  await sleep(200);
  ok('reduced-motion · and so does the gesture',
     (await rp.evaluate(() => window.__actors.pose().gesture)) === 1);
  ok('reduced-motion · zero console errors', rerr.length === 0, rerr.slice(0, 3).join(' | ') || 'clean');
  await rctx.close();
}

ok('page · zero console errors', errs.length === 0, errs.slice(0, 6).join(' | ') || 'clean');
fs.writeFileSync(path.join(WORK, 'checks.json'),
                 JSON.stringify({ base: BASE, checks, failures }, null, 1));
await ctx.close();
await browser.close();

console.log(`\n${checks.filter((c) => c.startsWith('PASS')).length}/${checks.length} actor checks passed on ${BASE}`);
if (failures.length) { console.error('FAILURES:\n - ' + failures.join('\n - ')); process.exit(1); }
