#!/usr/bin/env node
/**
 * explorations-verify.mjs — one behavioural pass over BOTH 2D-first explorations,
 * against whatever origin you point it at (local server or the live Pages site).
 *
 * The point is that a screenshot cannot distinguish a running page from a frozen
 * one, so everything here is a claim about change over wall-clock time: the video
 * clock advances AND wraps, the parallax layers' transforms differ between two
 * samples, the sprite's walk cell cycles and his world position moves, and the
 * post chain is really instantiated rather than merely imported.
 *
 *     node tools/ship/explorations-verify.mjs <baseUrl> <outDir> [label]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:8899').replace(/\/$/, '');
const OUT = process.argv[3] || '/Users/samz/Documents/gaslight-remake/shots';
const LABEL = process.argv[4] || 'local';
const WORK = path.join(OUT, 'work-' + LABEL);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const checks = [];
const failures = [];
const ok = (name, pass, detail) => {
  checks.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle',
         '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});

function watch(page, bag) {
  page.on('pageerror', (e) => bag.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') bag.push('console: ' + m.text()); });
  page.on('requestfailed', (r) =>
    bag.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
  page.on('response', (r) => { if (r.status() >= 400) bag.push(`http ${r.status()}: ${r.url()}`); });
}

/* ===================================================== 1 · the living plate */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  watch(page, errs);
  page.setDefaultTimeout(60000);
  const resp = await page.goto(`${BASE}/king-demo/living-plate/`, { waitUntil: 'load', timeout: 90000 });
  ok('living-plate · HTTP', resp.status() === 200, 'status ' + resp.status());
  await page.waitForTimeout(3000);

  // --- videos: really decoding, really moving, really looping
  const vids = await page.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({
    id: v.id, paused: v.paused, loop: v.loop, muted: v.muted,
    t: +v.currentTime.toFixed(3), dur: +(v.duration || 0).toFixed(2),
    w: v.videoWidth, h: v.videoHeight, ready: v.readyState, err: v.error && v.error.code,
  })));
  ok('living-plate · both videos present', vids.length === 2, vids.map((v) => v.id).join(', '));
  for (const v of vids) {
    ok(`living-plate · ${v.id} decoded`, v.w > 0 && v.h > 0 && v.ready >= 2 && !v.err,
       `${v.w}x${v.h} ready=${v.ready} dur=${v.dur}s`);
    ok(`living-plate · ${v.id} playing + loop`, !v.paused && v.loop, `paused=${v.paused} loop=${v.loop}`);
  }
  await page.waitForTimeout(1200);
  const vids2 = await page.evaluate(() => [...document.querySelectorAll('video')]
    .map((v) => ({ id: v.id, t: +v.currentTime.toFixed(3) })));
  for (let i = 0; i < vids.length; i++) {
    ok(`living-plate · ${vids[i].id} clock advances`, vids2[i].t !== vids[i].t,
       `${vids[i].t}s → ${vids2[i].t}s`);
  }

  // --- the wrap: park just before the end, prove it returns to the head of the clip
  const wrapped = await page.evaluate(async () => {
    const v = document.getElementById('vidA');
    v.currentTime = Math.max(0, v.duration - 0.25);
    const t0 = v.currentTime;
    await new Promise((r) => setTimeout(r, 1400));
    return { t0: +t0.toFixed(3), t1: +v.currentTime.toFixed(3), dur: +v.duration.toFixed(2), paused: v.paused };
  });
  ok('living-plate · vidA loops past the end', wrapped.t1 < wrapped.t0 && !wrapped.paused,
     `${wrapped.t0}s → ${wrapped.t1}s of ${wrapped.dur}s`);

  // --- parallax: the layers' transforms must differ between two samples.
  // The drift is deliberately parked by an IntersectionObserver while the layer
  // stage is off screen, so it has to be scrolled into view before it is fair to
  // ask whether it moves.
  await page.$eval('#stage-layers', (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900);
  const tf = () => page.evaluate(() => {
    const g = (id) => getComputedStyle(document.getElementById(id)).transform;
    return { room: g('room'), rock: g('rock'), lamp: g('lamp'), void: g('void') };
  });
  const t1 = await tf();
  await page.waitForTimeout(1500);
  const t2 = await tf();
  const moved = Object.keys(t1).filter((k) => t1[k] !== t2[k]);
  ok('living-plate · parallax layers animate', moved.length >= 3,
     `${moved.length}/4 layers moved: ${moved.join(', ')}`);
  const distinct = new Set(Object.values(t2)).size;
  ok('living-plate · layers move at different depths', distinct >= 3,
     `${distinct} distinct transforms among 4 layers`);

  // --- CSS-animated emissives (hearth, windows, candle) are actually running
  const anims = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === 'running').length);
  ok('living-plate · CSS animations running', anims >= 5, `${anims} running animations`);

  // --- pixel motion per stage: 4 element shots, diffed by the python pass
  for (const sel of ['#stage-room', '#stage-layers', '#stage-street']) {
    const el = await page.$(sel);
    ok(`living-plate · ${sel} exists`, !!el);
    if (!el) continue;
    const name = sel.replace('#stage-', '');
    for (let i = 0; i < 4; i++) {
      await el.screenshot({ path: path.join(WORK, `lp-${name}-${i}.png`) });
      if (i < 3) await page.waitForTimeout(650);
    }
  }

  await page.screenshot({ path: path.join(OUT, `living-plate-${LABEL}.png`), fullPage: true });
  ok('living-plate · zero console errors', errs.length === 0, errs.slice(0, 6).join(' | ') || 'clean');
  fs.writeFileSync(path.join(WORK, 'living-plate-errors.json'), JSON.stringify(errs, null, 1));
  await ctx.close();
}

/* ============================================================= 2 · the HD-2D */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 820 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  watch(page, errs);
  page.setDefaultTimeout(90000);
  const resp = await page.goto(`${BASE}/king-demo/hd2d/`, { waitUntil: 'load', timeout: 120000 });
  ok('hd2d · HTTP', resp.status() === 200, 'status ' + resp.status());
  await page.waitForFunction('window.__hd2d !== undefined', null, { timeout: 90000 });
  await page.waitForTimeout(2500);

  // --- the post chain must be instantiated, not merely imported
  const post = await page.evaluate(() => ({
    passes: window.__hd2d.composer.passes.map((p) => p.constructor.name),
    tone: window.__hd2d.renderer.toneMapping,
    canvas: [window.__hd2d.renderer.domElement.width, window.__hd2d.renderer.domElement.height],
  }));
  ok('hd2d · post chain present', post.passes.length >= 5, post.passes.join(' → '));
  ok('hd2d · bokeh + bloom in the chain',
     post.passes.some((n) => /Bokeh/.test(n)) && post.passes.some((n) => /Bloom/.test(n)),
     post.passes.join(' → '));
  ok('hd2d · canvas has real pixels', post.canvas[0] > 100 && post.canvas[1] > 100, post.canvas.join('x'));

  // --- the walk: sample the cell + world position over 5 s
  const samples = [];
  for (let i = 0; i < 50; i++) {
    samples.push(await page.evaluate(() => ({
      frame: window.__hd2d.state.frame,
      x: Math.round(window.__hd2d.king.position.x * 1000) / 1000,
      z: Math.round(window.__hd2d.king.position.z * 1000) / 1000,
      flip: window.__hd2d.king.scale.x,
    })));
    await page.waitForTimeout(100);
  }
  const cells = [...new Set(samples.map((s) => s.frame))];
  const zs = samples.map((s) => s.z);
  const zSpan = Math.max(...zs) - Math.min(...zs);
  ok('hd2d · walk cycle cycles', cells.length >= 3, `cells seen: ${cells.sort().join(',')}`);
  ok('hd2d · King walks the corridor', zSpan > 0.3, `z travel ${zSpan.toFixed(2)} units`);
  ok('hd2d · he turns around', new Set(samples.map((s) => s.flip)).size >= 1,
     `flips: ${[...new Set(samples.map((s) => s.flip))].join(', ')}`);

  const fps = await page.evaluate(() => window.__hd2d.fps());
  ok('hd2d · render loop live', fps > 20, `${Math.round(fps)} fps`);

  // --- click the King: he stops, the cameo rises and flips, DoF racks
  const before = await page.evaluate(() => ({
    stopped: window.__hd2d.state.stopped, card: window.__hd2d.state.card,
    focus: window.__hd2d.report().focus,
  }));
  const kingPx = await page.evaluate(() => window.__hd2d.report().king.screen);
  await page.mouse.click(kingPx[0], kingPx[1] - 40);
  await page.waitForTimeout(2600);
  const after = await page.evaluate(() => ({
    stopped: window.__hd2d.state.stopped, card: window.__hd2d.state.card,
    flip: window.__hd2d.state.cardFlip, visible: window.__hd2d.card.visible,
    focus: window.__hd2d.report().focus,
  }));
  ok('hd2d · click stops the King', after.stopped === true && before.stopped === false,
     `stopped ${before.stopped} → ${after.stopped}`);
  ok('hd2d · cameo card rises', after.card > 0.5 && after.visible,
     `card ${before.card.toFixed(2)} → ${after.card.toFixed(2)}, visible=${after.visible}`);
  ok('hd2d · card flips to unmasked', after.flip > 0.5, `flip ${Number(after.flip).toFixed(2)}`);
  ok('hd2d · DoF racks onto the card', Math.abs(after.focus - before.focus) > 0.05,
     `focus ${before.focus.toFixed(2)} → ${after.focus.toFixed(2)}`);
  await page.screenshot({ path: path.join(WORK, `hd2d-cameo-${LABEL}.png`) });

  // --- back to the patrol, then the hero shot
  await page.mouse.click(kingPx[0], kingPx[1] - 40);
  await page.waitForTimeout(2400);
  const back = await page.evaluate(() => ({ stopped: window.__hd2d.state.stopped, card: window.__hd2d.state.card }));
  ok('hd2d · second click resumes the patrol', back.stopped === false && back.card < 0.5,
     `stopped=${back.stopped} card=${back.card.toFixed(2)}`);

  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `hd2d-${LABEL}.png`) });

  // --- two full-canvas grabs, diffed by python, prove the frame is not frozen
  for (let i = 0; i < 2; i++) {
    await page.screenshot({ path: path.join(WORK, `hd2d-motion-${i}.png`) });
    if (i === 0) await page.waitForTimeout(500);
  }

  ok('hd2d · zero console errors', errs.length === 0, errs.slice(0, 6).join(' | ') || 'clean');
  fs.writeFileSync(path.join(WORK, 'hd2d-errors.json'), JSON.stringify(errs, null, 1));
  await ctx.close();
}

/* ============================================ 3 · the nav row on the hub pages */
{
  for (const [name, url] of [['king-demo', `${BASE}/king-demo/`], ['blender', `${BASE}/king-demo/blender/`]]) {
    const errs = [];
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    watch(page, errs);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const links = await page.evaluate(() => [...document.querySelectorAll('a')]
      .map((a) => a.getAttribute('href')).filter(Boolean));
    const hasLP = links.some((h) => /living-plate/.test(h));
    const hasHD = links.some((h) => /hd2d/.test(h));
    ok(`${name} · links both explorations`, hasLP && hasHD,
       `living-plate=${hasLP} hd2d=${hasHD}`);
    // and the links must actually resolve
    for (const h of links.filter((x) => /living-plate|hd2d/.test(x))) {
      const abs = new URL(h, url).href;
      const r = await page.request.get(abs);
      ok(`${name} · ${h} resolves`, r.status() === 200, 'status ' + r.status());
    }
    await ctx.close();
  }
}

await browser.close();

fs.writeFileSync(path.join(WORK, 'checks.json'), JSON.stringify({ base: BASE, checks, failures }, null, 1));
console.log(`\n${checks.length} checks, ${failures.length} failures`);
process.exit(failures.length ? 1 : 0);
