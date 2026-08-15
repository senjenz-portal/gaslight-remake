#!/usr/bin/env node
/**
 * renderfix-verify.mjs — verify the render-rig fix (IBL + Neutral tone mapping) on BOTH
 * king-demo viewers, and keep every behaviour that was there before.
 *
 * Per page it proves: no console errors, the rig is actually installed (environment map +
 * the tone-mapping curve on the figure pass), every mesh option loads and draws, the rigged
 * take still animates with the camera frozen, the stage still ticks (its gas lamps breathe),
 * and it measures the skin statistics off the live canvas so the "before" and "after" can be
 * compared with numbers instead of adjectives.
 *
 * usage: node tools/renderfix-verify.mjs <baseUrl> --tag <name> [--before <dir>]
 *   --before <dir>  serve dir/king.html and dir/blender.html in place of the live documents
 *                   (used to shoot the pre-fix baseline from git HEAD)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2];
const argOf = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const TAG = argOf('--tag') || 'run';
const BEFORE = argOf('--before');
const SHOTS = argOf('--shots') || '/Users/samz/Documents/gaslight-remake/shots';
if (!base) { console.error('usage: renderfix-verify.mjs <baseUrl> --tag <name> [--before <dir>]'); process.exit(2); }
fs.mkdirSync(SHOTS, { recursive: true });

const report = { base, tag: TAG, checks: [], failures: [], screenshots: [], stats: {} };
const ok = (m) => { report.checks.push(m); console.error('ok:   ' + m); };
const fail = (m) => { report.failures.push(m); console.error('FAIL: ' + m); };

/* Skin statistics, byte-identical to tools/renderbench/bench.mjs stats(), but measured
 * inside a WORLD-SPACE box projected through the page's own camera — on the king demo the
 * whole canvas is four fifths Baker Street, whose brick and gaslight are skin-coloured too.
 * The box is the head of a figure normalised to 1.9 m standing at the origin. */
const SKIN_FN = `(canvas, camera, min, max) => {
  const W = canvas.width, H = canvas.height;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  if (camera){
    const mul = (e, v) => [
      e[0]*v[0] + e[4]*v[1] + e[8]*v[2]  + e[12]*v[3],
      e[1]*v[0] + e[5]*v[1] + e[9]*v[2]  + e[13]*v[3],
      e[2]*v[0] + e[6]*v[1] + e[10]*v[2] + e[14]*v[3],
      e[3]*v[0] + e[7]*v[1] + e[11]*v[2] + e[15]*v[3]];
    const V = camera.matrixWorldInverse.elements, P = camera.projectionMatrix.elements;
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]){
      const c = mul(P, mul(V, [x, y, z, 1]));
      const sx = ( c[0]/c[3]*0.5 + 0.5) * W, sy = (-c[1]/c[3]*0.5 + 0.5) * H;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
  } else { x0 = 0; y0 = 0; x1 = W; y1 = H; }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(W, Math.ceil(x1));  y1 = Math.min(H, Math.ceil(y1));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently:true });
  cx.drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data;
  let n = 0, sl = 0, ss = 0, sh = 0, sr = 0, sg = 0, sb = 0;
  for (let i = 0; i < d.length; i += 4){
    const r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b), l = (mx+mn)/2, dl = mx-mn;
    if (dl < 1e-4) continue;
    const s = dl / (1 - Math.abs(2*l - 1));
    let hh = 0;
    if (mx === r) hh = 60*(((g-b)/dl)%6); else if (mx === g) hh = 60*((b-r)/dl+2); else hh = 60*((r-g)/dl+4);
    if (hh < 0) hh += 360;
    if (hh > 8 && hh < 48 && s > 0.12 && s < 0.75 && l > 0.18 && l < 0.96 && r > g && g > b){
      n++; sl += l; ss += s; sh += hh; sr += r; sg += g; sb += b;
    }
  }
  if (!n) return { skinPx:0, box:[x0, y0, w, h] };
  return { skinPx:n, L:+(100*sl/n).toFixed(1), S:+(100*ss/n).toFixed(1), H:+(sh/n).toFixed(1),
           rgb:[Math.round(255*sr/n), Math.round(255*sg/n), Math.round(255*sb/n)],
           box:[x0, y0, w, h] };
}`;

/* mean colour of a fractional rectangle — used on street-only patches to prove the diorama's
 * night mood is untouched by the figure-pass rig */
const MEAN_FN = `(canvas, fx0, fy0, fx1, fy1) => {
  const W = canvas.width, H = canvas.height;
  const x = Math.floor(fx0*W), y = Math.floor(fy0*H);
  const w = Math.max(1, Math.floor((fx1-fx0)*W)), h = Math.max(1, Math.floor((fy1-fy0)*H));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently:true });
  cx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4){ r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
  return [Math.round(r/n), Math.round(g/n), Math.round(b/n)];
}`;

/* the head of a 1.9 m figure standing at the origin, and a whole 0.34 m head bust */
const HEAD_BOX = [[-0.30, 1.58, -0.30], [0.30, 1.93, 0.30]];
const BUST_BOX = [[-0.22, 0.00, -0.22], [0.22, 0.35, 0.22]];

const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist'] });

/* ======================= page 1 — the king demo ======================= */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000);
  const errs = [], badResp = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('PAGEERR ' + String(e.message).slice(0, 300)));
  p.on('response', (r) => { if (r.status() >= 400) badResp.push(r.status() + ' ' + r.url()); });
  if (BEFORE) {
    const body = fs.readFileSync(path.join(BEFORE, 'king.html'), 'utf8');
    await p.route('**/king-demo/', (r) => r.fulfill({ contentType: 'text/html', body }));
    await p.route('**/king-demo/index.html', (r) => r.fulfill({ contentType: 'text/html', body }));
  }
  const resp = await p.goto(base + 'king-demo/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (resp.status() === 200) ok('king-demo HTTP 200'); else fail('king-demo HTTP ' + resp.status());
  await p.waitForFunction('window.__meshLoaded === true', null, { timeout: 120000 });
  ok('king-demo default mesh loaded');

  /* the rig itself */
  const rig = await p.evaluate(() => window.__rig ? ({
    environment: window.__rig.environment, envI: window.__rig.environmentIntensity,
    figTone: window.__rig.figTone, stageTone: window.__rig.stageTone,
    neutral: window.__rig.neutral, aces: window.__rig.aces, lights: window.__rig.lights()
  }) : null);
  report.stats.rig = rig;
  if (!BEFORE) {
    if (rig && rig.environment) ok('figure scene HAS an environment map (PMREM RoomEnvironment)');
    else fail('no environment on the figure scene: ' + JSON.stringify(rig));
    if (rig && rig.figTone === rig.neutral) ok('figure pass uses NeutralToneMapping');
    else fail('figure tone mapping is not Neutral: ' + JSON.stringify(rig && rig.figTone));
    if (rig && rig.stageTone === rig.aces) ok('stage pass keeps ACESFilmicToneMapping (night mood preserved)');
    else fail('stage tone mapping changed: ' + JSON.stringify(rig && rig.stageTone));
    if (rig && Math.abs(rig.envI - 0.6) < 1e-6) ok('environmentIntensity 0.6 (night page value)');
    else fail('environmentIntensity ' + (rig && rig.envI));
    if (rig && rig.lights.length === 2) ok('two shaping lights only (key + amber rim); the env is the fill');
    else fail('unexpected figure lights: ' + JSON.stringify(rig && rig.lights));
  }

  /* the stage must still be there, and still breathing */
  const st0 = await p.evaluate(() => ({ frames: window.__stage.frames, lamp: window.__stage.lampEmissive }));
  await p.waitForTimeout(1200);
  const st1 = await p.evaluate(() => ({ frames: window.__stage.frames, lamp: window.__stage.lampEmissive }));
  if (st1.frames > st0.frames) ok('stage tick alive (' + (st1.frames - st0.frames) + ' frames in 1.2 s)');
  else fail('stage tick frozen');
  if (st1.lamp !== st0.lamp) ok('gas lamps still flicker (emissive ' + st0.lamp + ' -> ' + st1.lamp + ')');
  else fail('gas lamp emissive did not change');

  /* every mesh option: load, draw, and measure */
  const KEYS = ['tripo', 'hybrid', 'rigged', 'yvo'];
  report.stats.king = {};
  for (const k of KEYS) {
    await p.evaluate((key) => {
      const el = Array.from(document.querySelectorAll('#mesh-switch .mesh-opt'))
        .find((o) => o.dataset.key === key);
      el.click();
    }, k);
    await p.waitForFunction((key) => window.__viewer && window.__viewer.showing === key,
      k, { timeout: 120000 });
    /* freeze the pendulum so the shot is repeatable, then let a few frames land */
    await p.evaluate(() => { window.__viewer.controls.autoRotate = false; });
    await p.waitForTimeout(900);
    const s = await p.evaluate(([fn, box]) => (0, eval)(fn)(document.getElementById('viewer'),
      window.__viewer.camera, box[0], box[1]), [SKIN_FN, HEAD_BOX]);
    s.street = await p.evaluate(([fn]) => (0, eval)(fn)(document.getElementById('viewer'),
      0.02, 0.74, 0.16, 0.96), [MEAN_FN]);
    report.stats.king[k] = s;
    if (s.skinPx > 200) ok(`${k}: head box ${s.skinPx} skin px · L${s.L} S${s.S} H${s.H} · street patch rgb ${s.street}`);
    else fail(`${k}: almost no skin-toned pixels in the head box (${s.skinPx})`);
    const file = path.join(SHOTS, `renderfix-${TAG}-king-${k}.png`);
    await p.locator('#viewer').screenshot({ path: file });
    report.screenshots.push(file);
  }

  /* the rigged take must still animate with the camera frozen */
  await p.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#mesh-switch .mesh-opt'))
      .find((o) => o.dataset.key === 'rigged'); el.click();
  });
  await p.waitForFunction("window.__viewer && window.__viewer.showing === 'rigged'");
  await p.evaluate(() => { window.__viewer.controls.autoRotate = false; });
  await p.waitForTimeout(400);
  const a = await p.locator('#viewer').screenshot();
  await p.waitForTimeout(700);
  const c = await p.locator('#viewer').screenshot();
  const differs = Buffer.compare(a, c) !== 0;
  if (differs) ok('rigged take still animates with the camera frozen');
  else fail('rigged take is frozen');

  /* the lightbox still opens */
  await p.evaluate(() => document.querySelector('.side-stack figure img').click());
  await p.waitForTimeout(300);
  const lb = await p.evaluate(() => document.getElementById('lightbox').classList.contains('open'));
  if (lb) ok('lightbox still opens'); else fail('lightbox did not open');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);

  /* whole page */
  await p.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#mesh-switch .mesh-opt'))
      .find((o) => o.dataset.key === 'rigged'); el.click();
  });
  await p.waitForTimeout(800);
  const pageShot = path.join(SHOTS, `renderfix-${TAG}-king-page.png`);
  await p.locator('#viewer-fig').screenshot({ path: pageShot });
  report.screenshots.push(pageShot);

  if (errs.length) fail('king-demo console errors: ' + JSON.stringify(errs));
  else ok('king-demo: zero console errors');
  if (badResp.length) fail('king-demo bad responses: ' + badResp.join(', '));
  else ok('king-demo: no 4xx/5xx');
  await ctx.close();
}

/* ======================= page 2 — the blender demo ======================= */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000);
  const errs = [], badResp = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('PAGEERR ' + String(e.message).slice(0, 300)));
  p.on('response', (r) => { if (r.status() >= 400) badResp.push(r.status() + ' ' + r.url()); });
  if (BEFORE) {
    const body = fs.readFileSync(path.join(BEFORE, 'blender.html'), 'utf8');
    await p.route('**/king-demo/blender/', (r) => r.fulfill({ contentType: 'text/html', body }));
    await p.route('**/king-demo/blender/index.html', (r) => r.fulfill({ contentType: 'text/html', body }));
  }
  const resp = await p.goto(base + 'king-demo/blender/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (resp.status() === 200) ok('blender HTTP 200'); else fail('blender HTTP ' + resp.status());
  await p.waitForFunction('window.__blender && window.__blender.clean.loaded === true', null, { timeout: 120000 });
  ok('blender: cleaned rig loaded');
  await p.waitForFunction('window.__blender.scratch.loaded === true', null, { timeout: 120000 });
  ok('blender: from-scratch head loaded');

  const rig2 = await p.evaluate(() => ({
    cleanTone: window.__blender.clean.renderer.toneMapping,
    scratchTone: window.__blender.scratch.renderer.toneMapping,
    exposure: window.__blender.clean.renderer.toneMappingExposure
  }));
  report.stats.blenderRig = rig2;
  if (!BEFORE) {
    if (rig2.cleanTone === 7 && rig2.scratchTone === 7) ok('both blender viewers use NeutralToneMapping (7)');
    else fail('blender tone mapping: ' + JSON.stringify(rig2));
  }

  await p.evaluate(() => { window.__blender.scratch.controls.autoRotate = false; });
  await p.waitForTimeout(900);
  report.stats.blender = {};
  for (const [id, name, box] of [['viewer-clean', 'clean', HEAD_BOX],
                                 ['viewer-scratch', 'scratch', BUST_BOX]]) {
    const s = await p.evaluate(([fn, id2, name2, bx]) => (0, eval)(fn)(document.getElementById(id2),
      window.__blender[name2].camera, bx[0], bx[1]), [SKIN_FN, id, name, box]);
    report.stats.blender[name] = s;
    if (s.skinPx > 200) ok(`blender ${name}: ${s.skinPx} skin px · L${s.L} S${s.S} H${s.H}`);
    else fail(`blender ${name}: almost no skin-toned pixels (${s.skinPx})`);
    const file = path.join(SHOTS, `renderfix-${TAG}-blender-${name}.png`);
    await p.locator('#' + id).screenshot({ path: file });
    report.screenshots.push(file);
  }

  const f0 = await p.evaluate(() => window.__blender.clean.frames);
  const b0 = await p.locator('#viewer-clean').screenshot();
  await p.waitForTimeout(700);
  const b1 = await p.locator('#viewer-clean').screenshot();
  const f1 = await p.evaluate(() => window.__blender.clean.frames);
  if (f1 > f0) ok('blender clean viewer is rendering (' + (f1 - f0) + ' frames)'); else fail('clean viewer frozen');
  if (Buffer.compare(b0, b1) !== 0) ok('blender clean rig still runs the animation');
  else fail('blender clean rig is not animating');

  await p.evaluate(() => document.querySelector('.evidence img').click());
  await p.waitForTimeout(300);
  const lb2 = await p.evaluate(() => document.getElementById('lightbox').classList.contains('open'));
  if (lb2) ok('blender lightbox still opens'); else fail('blender lightbox did not open');
  await p.keyboard.press('Escape');

  if (errs.length) fail('blender console errors: ' + JSON.stringify(errs));
  else ok('blender: zero console errors');
  if (badResp.length) fail('blender bad responses: ' + badResp.join(', '));
  else ok('blender: no 4xx/5xx');
  await ctx.close();
}

await b.close();
fs.writeFileSync(path.join(SHOTS, `renderfix-${TAG}-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.failures.length ? 1 : 0);
