/* _heroseed.mjs — SEED the four hero-clip inset plates from the REAL stage:
 * jump each unit, advance to the action's own instant (never a crossfade —
 * the probe waits for tween:null so no ghost-double is baked into a seed),
 * screenshot the staged tableau (real actors at their marks on the real
 * plate state — lighting and register baked), and crop a 16:9 box TIGHT to
 * the action, clamped inside the painted panel. For the small-subject shots
 * (underbelly, splash) the camera is zoomed for the shot: the actor cuts are
 * higher-res than plate scale (prop-splash is 510 px of source for a 76 px
 * plume), so a zoomed screenshot carries REAL resolution a post-crop upscale
 * cannot. One-shot pairs (seize/splash) reuse the FIRST shot's clip rect for
 * the end pose so first/last frames are pixel-registered.
 *
 * Crops land as device-px PNGs in assets/raw/ody-heroclips/seeds/ plus
 * seeds.json (crop rects, action boxes in crop-normalized coords, staged
 * instants of record — the gate tool reads this file, nothing re-measures
 * by eye). Usage: node tools/ody/_heroseed.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = path.join(ROOT, 'site-deploy', 'living-odyssey');
const OUT = path.join(ROOT, 'assets', 'raw', 'ody-heroclips', 'seeds');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const srv = createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(SITE, u === '/' ? 'index.html' : u);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch (e) { res.writeHead(404).end(); }
});
await new Promise((ok) => srv.listen(8819, ok));

const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://127.0.0.1:8819/?harness=1');
await pg.waitForFunction(() => window.__ready);
await pg.evaluate(() => window.__mute(true));

/* plate-space 16:9 box -> css clip rect via the stage's own mapping, CLAMPED
 * inside the panel (a crop that leaves the painting is void, not action) */
const clipOf = async (cx, cy, pw) => pg.evaluate(({ cx, cy, pw }) => {
  const st = window.__refs.stage;
  const ph = pw * 9 / 16;
  const a = st.toScreen(cx - pw / 2, cy - ph / 2);
  const b = st.toScreen(cx + pw / 2, cy + ph / 2);
  const r = st.root.getBoundingClientRect();
  let w = b.x - a.x, h = b.y - a.y, x = a.x, y = a.y;
  if (x < r.left) x = r.left;
  if (y < r.top) y = r.top;
  if (x + w > r.right) x = r.right - w;
  if (y + h > r.bottom) y = r.bottom - h;
  return { x, y, width: w, height: h,
           panel: [r.left, r.top, r.right, r.bottom] };
}, { cx, cy, pw });

/* Park the camera DIRECTLY (no setFocus): sea's focusPlate rides the world
 * transform, so a re-focus between a pair's two shots pans the pair apart —
 * measured 12.8 plate px between splash and splash-end. The pair's law is a
 * LOCKED camera; the world beneath may move, that is the action. renderNow
 * steps dt=0, so the parked cam3 survives the per-step refreshFocus. */
const camTo = (cx, cy, k) => pg.evaluate(({ cx, cy, k }) => {
  const st = window.__refs.stage;
  st.cam3 = { x: cx, y: cy, k, wx: cx, wy: cy, wk: k };
  window.__renderNow();
}, { cx, cy, k });

const state = () => pg.evaluate(() => window.__state());
const manifest = { plate: '1408x768 plate px; crops are 16:9 boxes in plate space',
                   viewport: '1440x900 @dsf2', seeds: {} };

async function snapCrop(name, cx, cy, pw, meta = {}, reuseClip = null) {
  await pg.evaluate(() => window.__renderNow());
  const clip = reuseClip || await clipOf(cx, cy, pw);
  const file = path.join(OUT, name + '.raw.png');
  const { panel, ...rect } = clip;
  await pg.screenshot({ path: file, clip: rect });
  /* the crop's own plate rect (through the live mapping) — the gate tool maps
     plate-space action/identity boxes into crop pixels with THIS, never by eye */
  const plateRect = await pg.evaluate((r) => {
    const st = window.__refs.stage;
    const a = st.toPlate(r.x, r.y), b = st.toPlate(r.x + r.width, r.y + r.height);
    return [a.x, a.y, b.x - a.x, b.y - a.y];
  }, rect);
  manifest.seeds[name] = { plateCtr: [cx, cy], plateW: pw, cssClip: rect,
                           plateRect, ...meta };
  console.log('[seed]', name, 'plate ctr', cx, cy, 'w', pw, 'css',
              JSON.stringify(rect), 'plateRect', JSON.stringify(plateRect.map((v) => +v.toFixed(1))));
  return clip;
}

/* the unit's own lens frame: the panel's central 16:9 window (for the action
 * a close lens already frames — a plate-space box wider than the lens window
 * would clamp off the panel into the leaf's margin) */
const lensClip = () => pg.evaluate(() => {
  const st = window.__refs.stage;
  const r = st.root.getBoundingClientRect();
  const W16 = r.height * 16 / 9;
  return { x: r.left + (r.width - W16) / 2, y: r.top, width: W16, height: r.height };
});

/* ---- 1. SEIZE (firstmeal, cave) — one-shot: clutch -> the seat ---------- *
 * The instant of record: the STATIC clutch (bridge handed off, tween null) —
 * a crossfade instant would bake a ghost double into the seed. */
{
  await pg.evaluate(async () => { await window.__gotoUnit('firstmeal'); });
  await pg.evaluate(() => window.__advance(3.0));
  let q = await state();
  for (let i = 0; i < 30 && !(q.stage.giant.pose === 'clutch' && q.stage.giant.tween == null); i++) {
    await pg.evaluate(() => window.__advance(0.1));
    q = await state();
  }
  const g = q.stage.giant;
  console.log('[firstmeal] segK', q.stage.seg && q.stage.seg.k, 'giant', JSON.stringify(g));
  const b = g.box;
  const cx = b[0] + b[2] / 2 + 10, cy = b[1] + b[3] / 2 - 6;
  const pw = 440;
  await camTo(842, 390, 2.4);              // zoomed out one stop: the crown fits
  const clip = await snapCrop('seize', cx, cy, pw,
    { unit: 'firstmeal', at: `segT ${(q.stage.seg && q.stage.seg.k * 6).toFixed(2)} static clutch`,
      loop: false, action: { giantBox: b, pose: g.pose }, identityPlate: b });
  /* end pose: the SEAT, again never mid-crossfade */
  for (let i = 0; i < 40; i++) {
    await pg.evaluate(() => window.__advance(0.1));
    q = await state();
    if (q.stage.giant.pose === 'seat' && q.stage.giant.tween == null) break;
  }
  console.log('[firstmeal end] giant', JSON.stringify(q.stage.giant));
  await camTo(842, 390, 2.4);               // the SAME parked camera, re-parked
  await snapCrop('seize-end', cx, cy, pw,
    { unit: 'firstmeal', at: 'the seat (end pose)', loop: false,
      action: { giantBox: q.stage.giant.box, pose: q.stage.giant.pose } }, clip);
}

/* ---- 2. TWIST (auger/bore, cave) — loop: the drive turned round --------- *
 * mid-window between the two clock ticks (4.2 / 7.4): the turning pairs, the
 * stake line, the tip pinned on the eye. */
{
  await pg.evaluate(async () => { await window.__gotoUnit('auger'); });
  await pg.evaluate(() => window.__advance(5.6));
  const q = await state();
  console.log('[auger] unit', q.unit && q.unit.key, 'drive', JSON.stringify(q.stage.drive));
  const clip = await lensClip();               // drive-tight's own frame, 16:9
  await snapCrop('twist', 590, 490, 0,
    { unit: 'auger/bore', at: 'drive 5.6', loop: true,
      action: { eye: [676, 495] }, identityPlate: [560, 390, 380, 214] }, clip);
}

/* ---- 3. UNDERBELLY (greatram gate resolution, cave) — loop: the sway ---- *
 * G5 clicked, the escape stream runs, the great ram walks with the slung
 * man beneath; shot ZOOMED (the cuts carry the resolution). */
{
  await pg.evaluate(async () => { await window.__gotoUnit('greatram'); });
  await pg.evaluate(() => window.__advance(2.5));
  const hit = await pg.evaluate(() => window.__gateClick());
  console.log('[greatram] gate', JSON.stringify(hit));
  let r = null, q = null;
  for (let i = 0; i < 200; i++) {
    await pg.evaluate(() => window.__advance(0.25));
    q = await state();
    r = q.stage.flock && q.stage.flock.ram;
    if (r && r.slung && r.box && r.box[0] + r.box[2] / 2 < 560) break;
  }
  console.log('[dawn5] ram', JSON.stringify(r));
  const b = r.box;
  const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2 + 4;
  await camTo(cx, cy, 2.6);
  await snapCrop('underbelly', cx, cy, 400,
    { unit: 'greatram (G5 resolution) -> dawn5 stream', at: 'the slung crossing',
      loop: true, action: { ramBox: b, slung: r.slung }, identityPlate: b });
}

/* ---- 4. SPLASH (rock1, sea) — one-shot: the plume -> the wash ----------- *
 * jeer resolved live, rock 1 lands at 10.8; shot at full plume, end pose on
 * the washed-back water; ZOOMED, both frames on ONE clip rect. */
{
  await pg.evaluate(async () => { await window.__gotoUnit('jeer'); });
  await pg.evaluate(() => window.__advance(1.5));
  const hit = await pg.evaluate(() => window.__gateClick());
  console.log('[jeer] gate', JSON.stringify(hit));
  await pg.evaluate(() => window.__advance(11.3));
  let q = await state();
  console.log('[rock1] unit', q.unit && q.unit.key, 'splash', JSON.stringify(q.stage.splash));
  await camTo(505, 480, 1.9);
  const clip = await snapCrop('splash', 505, 480, 500,
    { unit: 'rock1', at: 'jeer+11.3 full plume', loop: false,
      action: { splashAt: [468, 505] }, identityPlate: [420, 400, 100, 170] });
  await pg.evaluate(() => window.__advance(3.5));
  await camTo(505, 480, 1.9);
  q = await state();
  console.log('[rock1 end] splash', JSON.stringify(q.stage.splash));
  await snapCrop('splash-end', 505, 480, 500,
    { unit: 'rock1', at: 'jeer+14.8 the wash', loop: false,
      action: { splashAt: [468, 505] } }, clip);
}

fs.writeFileSync(path.join(OUT, 'seeds.json'), JSON.stringify(manifest, null, 1));
console.log('seeds ->', OUT);
await br.close();
srv.close();
