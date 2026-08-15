#!/usr/bin/env node
/* Independent re-verification of the shipped render rig on the LIVE pages.
 * Written fresh (does not reuse renderfix-verify.mjs) so the check is not the same
 * code that produced the claim. Playwright, chromium, hard timeouts everywhere. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'https://senjenz-portal.github.io/gaslight-remake/';
const SHOTS = '/Users/samz/Documents/gaslight-remake/shots';
const cb = () => `cb=${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const checks = [], failures = [], screenshots = [];
const ok = (s) => { checks.push(s); console.log('  ok   ' + s); };
const bad = (s) => { failures.push(s); console.log('  FAIL ' + s); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* pixel stats are taken in-page off the live canvas instead of decoding a PNG */
const CANVAS_STATS = `(args) => {
  const sel = args[0], boxFrac = args[1];
  const c = document.querySelector(sel);
  const g = document.createElement('canvas');
  g.width = c.width; g.height = c.height;
  const ctx = g.getContext('2d');
  ctx.drawImage(c, 0, 0);
  const x0 = Math.floor(boxFrac[0] * g.width), y0 = Math.floor(boxFrac[1] * g.height);
  const w  = Math.floor(boxFrac[2] * g.width), h  = Math.floor(boxFrac[3] * g.height);
  const d = ctx.getImageData(x0, y0, w, h).data;
  let n = 0, L = 0, S = 0, H = 0, R = 0, G = 0, B = 0, nonBlack = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i+1], b = d[i+2];
    if (r + gg + b > 90) nonBlack++;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    if (mx < 40 || r <= gg || gg < b) continue;
    const l = (mx + mn) / 2, dd = mx - mn;
    if (dd < 12) continue;
    const s = dd / (255 - Math.abs(mx + mn - 255) || 1);
    let hue = 60 * (((gg - b) / dd) % 6); if (hue < 0) hue += 360;
    if (hue < 5 || hue > 45) continue;
    n++; L += l / 2.55; S += s * 100; H += hue; R += r; G += gg; B += b;
  }
  const px = d.length / 4;
  return n ? { skinPx:n, L:+(L/n).toFixed(1), S:+(S/n).toFixed(1), H:+(H/n).toFixed(1),
               rgb:[Math.round(R/n), Math.round(G/n), Math.round(B/n)], coverage:+(nonBlack/px).toFixed(3) }
           : { skinPx:0, coverage:+(nonBlack/px).toFixed(3) };
}`;

const stats = {};

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  /* ================= page 1: king-demo ================= */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = [], bads = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('response', (r) => { if (r.status() >= 400) bads.push(r.status() + ' ' + r.url()); });

    const resp = await page.goto(`${BASE}king-demo/index.html?${cb()}`, { waitUntil: 'load', timeout: 60000 });
    resp && resp.status() === 200 ? ok(`main: HTTP ${resp.status()}`) : bad(`main: HTTP ${resp && resp.status()}`);

    await page.waitForFunction('window.__rig && window.__stage', null, { timeout: 45000 });

    const rig = await page.evaluate(() => ({
      env: window.__rig.environment, envI: window.__rig.environmentIntensity,
      figTone: window.__rig.figTone, stageTone: window.__rig.stageTone,
      neutral: window.__rig.neutral, aces: window.__rig.aces, lights: window.__rig.lights(),
    }));
    stats.mainRig = rig;
    rig.env ? ok('main: figScene HAS an environment (PMREM RoomEnvironment)') : bad('main: no scene.environment');
    rig.envI === 0.6 ? ok('main: environmentIntensity 0.6 (night value)') : bad(`main: environmentIntensity ${rig.envI}, expected 0.6`);
    rig.figTone === rig.neutral ? ok('main: figure pass uses NeutralToneMapping') : bad(`main: figure tone ${rig.figTone} != Neutral ${rig.neutral}`);
    rig.stageTone === rig.aces ? ok('main: stage pass KEEPS ACESFilmicToneMapping — night mood preserved') : bad(`main: stage tone ${rig.stageTone} != ACES ${rig.aces}`);
    rig.lights.length === 2 ? ok(`main: two shaping lights only (${rig.lights.map((l) => l.type + ' ' + l.intensity).join(', ')}); env is the fill`)
      : bad(`main: ${rig.lights.length} lights in figScene, expected 2`);

    /* stage still ticking + lamps still flickering (the diorama's own life) */
    const f0 = await page.evaluate(() => window.__stage.frames);
    const e0 = await page.evaluate(() => window.__stage.lampEmissive);
    await wait(1300);
    const f1 = await page.evaluate(() => window.__stage.frames);
    const e1 = await page.evaluate(() => window.__stage.lampEmissive);
    f1 > f0 + 20 ? ok(`main: stage tick alive (${f1 - f0} frames in 1.3 s)`) : bad(`main: stage tick stalled (${f1 - f0} frames)`);
    e0 !== e1 ? ok(`main: gas lamps still flicker (${e0} -> ${e1})`) : bad('main: gas lamps stopped flickering');

    /* Every mesh option renders. The canvas is four fifths Baker Street and its brick and
     * gaslight are skin-coloured too, so the box is a WORLD-SPACE head — the head of a
     * figure normalised to 1.9 m standing at the origin — projected through the page's own
     * camera. No THREE import needed: camera.position.clone() hands us a Vector3. */
    const HEAD_BOX = [[-0.30, 1.58, -0.30], [0.30, 1.93, 0.30]];
    const STREET = [0.03, 0.62, 0.06, 0.06];    /* a patch of street only — night must not lift */
    stats.main = {};
    for (const key of ['tripo', 'hybrid', 'rigged', 'yvo']) {
      await page.click(`.mesh-opt[data-key="${key}"]`, { timeout: 15000 });
      await page.waitForFunction((k) => {
        const el = document.querySelector(`.mesh-opt[data-key="${k}"]`);
        return el && el.classList.contains('active');
      }, key, { timeout: 15000 });
      await page.evaluate(() => { window.__viewer.controls.autoRotate = false; });   /* freeze the pendulum */
      await wait(3500);                          /* lazy GLB fetch + a few frames */
      const s = await page.evaluate(([min, max]) => {
        const cam = window.__viewer.camera, c = window.__viewer.renderer.domElement;
        const v = cam.position.clone();
        let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
        for (const cx of [min[0], max[0]]) for (const cy of [min[1], max[1]]) for (const cz of [min[2], max[2]]) {
          v.set(cx, cy, cz).project(cam);
          const px = (v.x * 0.5 + 0.5) * c.width, py = (-v.y * 0.5 + 0.5) * c.height;
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
        x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
        const w = Math.min(c.width - x0, Math.ceil(x1 - x0)), h = Math.min(c.height - y0, Math.ceil(y1 - y0));
        const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
        g.getContext('2d').drawImage(c, 0, 0);
        const d = g.getContext('2d').getImageData(x0, y0, w, h).data;
        let n = 0, L = 0, S = 0, H = 0, R = 0, G = 0, B = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], gg = d[i + 1], b = d[i + 2];
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dd = mx - mn;
          if (mx < 40 || r <= gg || gg < b || dd < 12) continue;
          let hue = 60 * (((gg - b) / dd) % 6); if (hue < 0) hue += 360;
          if (hue < 5 || hue > 45) continue;
          n++; L += (mx + mn) / 2 / 2.55; S += (dd / (255 - Math.abs(mx + mn - 255) || 1)) * 100;
          H += hue; R += r; G += gg; B += b;
        }
        return n ? { box: [x0, y0, w, h], skinPx: n, L: +(L / n).toFixed(1), S: +(S / n).toFixed(1),
                     H: +(H / n).toFixed(1), rgb: [Math.round(R / n), Math.round(G / n), Math.round(B / n)] }
                 : { box: [x0, y0, w, h], skinPx: 0 };
      }, HEAD_BOX);
      const street = await page.evaluate(new Function('return ' + CANVAS_STATS)(), ['#viewer', STREET]);
      stats.main[key] = { ...s, street: street.rgb || null, streetCoverage: street.coverage };
      s.skinPx > 300 ? ok(`main/${key}: renders — ${s.skinPx} skin px in the projected head box, L${s.L} S${s.S} H${s.H} rgb ${s.rgb}`)
        : bad(`main/${key}: only ${s.skinPx} skin px in the projected head box ${s.box}`);
      await page.screenshot({ path: `${SHOTS}/recheck-main-${key}.png`, fullPage: false });
      screenshots.push(`${SHOTS}/recheck-main-${key}.png`);
      await page.evaluate(() => { window.__viewer.controls.autoRotate = true; });
    }

    /* the rigged take must still animate — with the camera frozen so motion is the model's */
    await page.click('.mesh-opt[data-key="rigged"]', { timeout: 15000 });
    await wait(3000);
    const frozen = await page.evaluate(() => {
      window.__viewer.controls.autoRotate = false;
      return { autoRotate: window.__viewer.controls.autoRotate, hasMixer: !!window.__viewer.mixer };
    });
    stats.riggedFrozen = frozen;
    frozen.hasMixer ? ok('main: rigged take carries an AnimationMixer (mixamo run clip)') : bad('main: rigged take has no mixer');
    const anim = await page.evaluate(async () => {
      const c = document.querySelector('#viewer');
      const grab = () => { const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
        g.getContext('2d').drawImage(c, 0, 0); return g.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
      const a = grab();
      await new Promise((r) => setTimeout(r, 900));
      const b = grab();
      let diff = 0;
      for (let i = 0; i < a.length; i += 40) if (Math.abs(a[i] - b[i]) > 8) diff++;
      return diff;
    });
    stats.riggedAnimDiff = anim;
    anim > 200 ? ok(`main: rigged take still animates (${anim} sampled pixels moved in 0.9 s)`) : bad(`main: rigged take looks frozen (${anim} pixels moved)`);

    /* control: the same measurement on a STATIC mesh, camera still frozen. Whatever this
     * reads is the floor (gas-lamp flicker); the rigged number has to clear it. */
    await page.click('.mesh-opt[data-key="tripo"]', { timeout: 15000 });
    await wait(2000);
    await page.evaluate(() => { window.__viewer.controls.autoRotate = false; });
    const ctrl = await page.evaluate(async () => {
      const c = document.querySelector('#viewer');
      const grab = () => { const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
        g.getContext('2d').drawImage(c, 0, 0); return g.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
      const a = grab(); await new Promise((r) => setTimeout(r, 900)); const b = grab();
      let diff = 0; for (let i = 0; i < a.length; i += 40) if (Math.abs(a[i] - b[i]) > 8) diff++;
      return diff;
    });
    stats.staticControlDiff = ctrl;
    anim > ctrl * 3 ? ok(`main: motion is the model's, not the camera's (rigged ${anim} vs static control ${ctrl})`)
      : bad(`main: rigged motion ${anim} not clear of the static floor ${ctrl}`);
    await page.evaluate(() => { window.__viewer.controls.autoRotate = true; });

    /* lightbox */
    await page.click('.side-stack img', { timeout: 15000 });
    await wait(400);
    const lb = await page.evaluate(() => document.getElementById('lightbox').classList.contains('open'));
    lb ? ok('main: lightbox still opens') : bad('main: lightbox did not open');
    await page.keyboard.press('Escape');
    await wait(300);

    /* the money shot: default option, full page */
    await page.click('.mesh-opt[data-key="tripo"]', { timeout: 15000 });
    await wait(2500);
    await page.screenshot({ path: `${SHOTS}/render-fix-live-main.png`, fullPage: true });
    screenshots.push(`${SHOTS}/render-fix-live-main.png`);

    errs.length === 0 ? ok('main: zero console errors') : bad(`main: ${errs.length} console errors — ${errs.slice(0, 3).join(' | ')}`);
    bads.length === 0 ? ok('main: no 4xx/5xx responses') : bad(`main: ${bads.length} bad responses — ${bads.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }

  /* ================= page 2: blender ================= */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = [], bads = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('response', (r) => { if (r.status() >= 400) bads.push(r.status() + ' ' + r.url()); });

    const resp = await page.goto(`${BASE}king-demo/blender/index.html?${cb()}`, { waitUntil: 'load', timeout: 60000 });
    resp && resp.status() === 200 ? ok(`blender: HTTP ${resp.status()}`) : bad(`blender: HTTP ${resp && resp.status()}`);

    await page.waitForFunction('window.__blender && window.__blender.clean.renderer && window.__blender.scratch.renderer', null, { timeout: 45000 });
    await page.waitForFunction('window.__blender.clean.loaded && window.__blender.scratch.loaded', null, { timeout: 60000 });
    ok('blender: cleaned rig GLB loaded');
    ok('blender: from-scratch head GLB loaded');

    const brig = await page.evaluate(() => ({
      cleanTone: window.__blender.clean.renderer.toneMapping,
      scratchTone: window.__blender.scratch.renderer.toneMapping,
      exposure: window.__blender.clean.renderer.toneMappingExposure,
      cleanEnv: !!window.__blender.clean.scene.environment,
      scratchEnv: !!window.__blender.scratch.scene.environment,
      cleanEnvI: window.__blender.clean.scene.environmentIntensity,
      scratchEnvI: window.__blender.scratch.scene.environmentIntensity,
    }));
    stats.blenderRig = brig;
    (brig.cleanTone === 7 && brig.scratchTone === 7) ? ok('blender: both viewers use NeutralToneMapping')
      : bad(`blender: tone ${brig.cleanTone}/${brig.scratchTone}, expected 7/7 (Neutral)`);
    brig.exposure === 1 ? ok('blender: exposure 1.0') : bad(`blender: exposure ${brig.exposure}`);
    (brig.cleanEnv && brig.scratchEnv) ? ok('blender: both scenes HAVE an environment (PMREM RoomEnvironment)')
      : bad(`blender: env clean=${brig.cleanEnv} scratch=${brig.scratchEnv}`);
    (brig.cleanEnvI === 0.6 && brig.scratchEnvI === 0.6) ? ok('blender: environmentIntensity 0.6 on both')
      : bad(`blender: environmentIntensity ${brig.cleanEnvI}/${brig.scratchEnvI}`);

    await wait(3000);
    stats.blender = {};
    for (const [name, sel, box] of [['clean', '#viewer-clean', [0.42, 0.02, 0.34, 0.32]], ['scratch', '#viewer-scratch', [0.20, 0.10, 0.60, 0.60]]]) {
      const s = await page.evaluate(new Function('return ' + CANVAS_STATS)(), [sel, box]);
      stats.blender[name] = s;
      s.skinPx > 300 ? ok(`blender/${name}: renders — ${s.skinPx} skin px, L${s.L} S${s.S} H${s.H}`)
        : bad(`blender/${name}: only ${s.skinPx} skin px`);
    }

    const bf0 = await page.evaluate(() => window.__blender.clean.frames);
    await wait(1200);
    const bf1 = await page.evaluate(() => window.__blender.clean.frames);
    bf1 > bf0 + 20 ? ok(`blender: clean viewer rendering (${bf1 - bf0} frames in 1.2 s)`) : bad(`blender: clean viewer stalled (${bf1 - bf0} frames)`);

    const banim = await page.evaluate(async () => {
      const c = document.querySelector('#viewer-clean');
      const grab = () => { const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
        g.getContext('2d').drawImage(c, 0, 0); return g.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
      const a = grab(); await new Promise((r) => setTimeout(r, 900)); const b = grab();
      let diff = 0; for (let i = 0; i < a.length; i += 40) if (Math.abs(a[i] - b[i]) > 8) diff++;
      return diff;
    });
    stats.blenderAnimDiff = banim;
    banim > 200 ? ok(`blender: cleaned rig still runs its animation (${banim} sampled pixels moved)`) : bad(`blender: cleaned rig frozen (${banim})`);

    await page.click('.side img, figure img', { timeout: 15000 }).catch(() => {});
    await wait(400);
    const lb = await page.evaluate(() => document.getElementById('lightbox').classList.contains('open'));
    lb ? ok('blender: lightbox still opens') : bad('blender: lightbox did not open');
    await page.keyboard.press('Escape');
    await wait(300);

    await page.screenshot({ path: `${SHOTS}/render-fix-live-blender.png`, fullPage: true });
    screenshots.push(`${SHOTS}/render-fix-live-blender.png`);

    errs.length === 0 ? ok('blender: zero console errors') : bad(`blender: ${errs.length} console errors — ${errs.slice(0, 3).join(' | ')}`);
    bads.length === 0 ? ok('blender: no 4xx/5xx responses') : bad(`blender: ${bads.length} bad responses — ${bads.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }

  await browser.close();
  const report = { base: BASE, when: new Date().toISOString(), checks, failures, screenshots, stats };
  fs.writeFileSync(`${SHOTS}/renderfix-recheck-report.json`, JSON.stringify(report, null, 2));
  console.log('\n' + (failures.length ? `${failures.length} FAILURES` : 'all checks passed') + ` — ${checks.length} checks`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
