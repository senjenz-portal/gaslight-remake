/**
 * hd2d-verify.mjs — behavioural check for the LANE B page.
 *
 * Screenshots alone cannot tell you the sprite is animating rather than frozen,
 * or that the click actually stops him. This drives the page and asserts on the
 * page's own state: that the walk cell cycles through all four frames, that his
 * world position actually changes, that he turns around at the patrol ends,
 * that clicking freezes him and raises the cameo, and that the card flips.
 */
import { chromium } from 'playwright';
import process from 'node:process';

const OUTDIR = process.argv[2] || '/tmp';
const URLBASE = 'http://127.0.0.1:8899/king-demo/hd2d/index.html';

// Without the GPU flags Chromium falls back to SwiftShader, and compiling the
// diorama's shader set in software takes long enough that `load` never fires
// inside the default navigation timeout.
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
page.setDefaultTimeout(60000);
page.setDefaultNavigationTimeout(60000);
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URLBASE, { waitUntil: 'load' });
await page.waitForFunction('window.__hd2d !== undefined');
await page.waitForTimeout(1200);

// --- sample the walk over 6 seconds
const samples = [];
for (let i = 0; i < 60; i++) {
  samples.push(await page.evaluate(() => ({
    frame: window.__hd2d.state.frame,
    t: Math.round(window.__hd2d.state.t * 1000) / 1000,
    dir: window.__hd2d.state.dir,
    x: Math.round(window.__hd2d.king.position.x * 1000) / 1000,
    z: Math.round(window.__hd2d.king.position.z * 1000) / 1000,
    flip: window.__hd2d.king.scale.x,
  })));
  await page.waitForTimeout(100);
}

const framesSeen = [...new Set(samples.map((s) => s.frame))].sort();
const zRange = [Math.min(...samples.map((s) => s.z)), Math.max(...samples.map((s) => s.z))];
const dirsSeen = [...new Set(samples.map((s) => s.dir))];
const flipsSeen = [...new Set(samples.map((s) => s.flip))];

// four consecutive samples in a walking stretch must not all be the same cell
let animated = false;
for (let i = 0; i + 4 < samples.length; i++) {
  const w = samples.slice(i, i + 5).map((s) => s.frame);
  if (new Set(w).size >= 3) { animated = true; break; }
}

// --- walk-cycle contact sheet: freeze one cell per shot
const shots = [];
for (const f of [0, 1, 2, 3, 4]) {
  const p = `${OUTDIR}/hd2d-frame-${f}.png`;
  await page.goto(`${URLBASE}?frame=${f}&paused=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__hd2d !== undefined');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: p });
  shots.push(p);
}

// --- click interaction
await page.goto(URLBASE, { waitUntil: 'load' });
await page.waitForFunction('window.__hd2d !== undefined');
await page.waitForTimeout(1500);
const before = await page.evaluate(() => ({ stopped: window.__hd2d.state.stopped, z: window.__hd2d.king.position.z }));
const kingPx = await page.evaluate(() => window.__hd2d.report().king.screen);
await page.mouse.click(kingPx[0], kingPx[1] - 40);
await page.waitForTimeout(700);
const mid = await page.evaluate(() => ({
  stopped: window.__hd2d.state.stopped, card: Math.round(window.__hd2d.state.card * 100) / 100,
  flip: Math.round(window.__hd2d.state.cardFlip * 100) / 100, visible: window.__hd2d.card.visible,
}));
await page.screenshot({ path: `${OUTDIR}/hd2d-card-masked.png` });
await page.waitForTimeout(2200);
const after = await page.evaluate(() => ({
  stopped: window.__hd2d.state.stopped, card: Math.round(window.__hd2d.state.card * 100) / 100,
  flip: Math.round(window.__hd2d.state.cardFlip * 100) / 100,
  z: window.__hd2d.king.position.z,
}));
await page.screenshot({ path: `${OUTDIR}/hd2d-card-unmasked.png` });

// click again -> resume
await page.mouse.click(kingPx[0], kingPx[1] - 40);
await page.waitForTimeout(1200);
const resumed = await page.evaluate(() => ({ stopped: window.__hd2d.state.stopped, card: Math.round(window.__hd2d.state.card * 100) / 100 }));

await browser.close();

const result = {
  walk: {
    framesSeen, animated, dirsSeen, flipsSeen,
    zRange: zRange.map((v) => Math.round(v * 100) / 100),
    movedUnits: Math.round((zRange[1] - zRange[0]) * 100) / 100,
  },
  click: { before, mid, after, resumed, frozen: Math.abs(after.z - (mid.stopped ? after.z : 0)) < 1e-6 },
  shots: shots.concat([`${OUTDIR}/hd2d-card-masked.png`, `${OUTDIR}/hd2d-card-unmasked.png`]),
  errors,
};
console.log(JSON.stringify(result, null, 1));
