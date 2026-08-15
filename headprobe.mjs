#!/usr/bin/env node
/**
 * headprobe.mjs — ROUND 8b [8b-1] the head-proportion bench.
 *
 * Not part of the gate: this is the cheap loop the head rework is JUDGED on, so
 * the expensive lap only ever runs on a head that already measures right. It
 * answers, at the REAL cameras, the four numbers round 8b asks for:
 *   · heads tall   — stature / headSpan
 *   · w/d          — the head's own bbox, width against depth (>= 1.15)
 *   · belowBand    — fraction of the head's PAINTED pixels under the eye band
 *   · chin         — the chin point's screen position, and whether it is on the
 *                    plate (the "is the jaw silhouette presented?" question)
 * and drops a 2x close-up crop of each head so the geometry can be judged by eye.
 *
 * usage: node tools/headprobe.mjs [--out DIR] [--ratio 1440x900] [--units a,b,c]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d; };

const outDir = path.join(ROOT, String(flag('out', 'shots/round-8b-head')));
const ratio = String(flag('ratio', '1440x900')).split('x').map(Number);
const SETTLE = 1.7;
const FIXED_DT = 1 / 60;

/* the framings this round is judged at: the mask gate and the unmask are the
 * acid test, i-13 is the one settled framing holding all three heads, i-00 is
 * the establishing frame and i-22 the desk two-shot. */
const DEFAULT = 'i-00-head,i-11-hadnote,i-13-delicacy,i-15-condescend,i-16-iamking,i-22-myphoto';
const UNITS = String(flag('units', DEFAULT)).split(',');
const WHO = { 'i-00-head': ['holmes', 'watson'],
              'i-11-hadnote': ['client'],
              'i-13-delicacy': ['holmes', 'watson', 'client'],
              'i-15-condescend': ['client'],
              'i-16-iamking': ['client'],
              'i-22-myphoto': ['holmes', 'watson', 'client'] };

function portOpen(p) {
  return new Promise((res) => {
    const s = net.connect({ host: '127.0.0.1', port: p }, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    s.setTimeout(500, () => { s.destroy(); res(false); });
  });
}

const port = Number(flag('port', 0)) || 8150;
if (!await portOpen(port)) { console.error(`nothing listening on ${port}`); process.exit(2); }
const baseUrl = `http://127.0.0.1:${port}/app/index.html`;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: ratio[0], height: ratio[1] }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERR ' + String(e.message).slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await page.goto(baseUrl + '?harness=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
await page.evaluate(() => window.__mute(true));

const settle = (s) => page.evaluate((n) => {
  const q = 1 / 60; let k = Math.round(n / q);
  while (k-- > 0) window.__advance(q);
  window.__renderNow();
}, s);

/* the per-figure measurement. Hide the head, re-render, keep the pixels that
 * changed — the same hide-and-diff lap.mjs [R8-4] uses — then bin them along the
 * head's OWN up axis so a pitched head is measured on its own terms. */
const measure = (who, opts = {}) => page.evaluate(({ w, hideMask, withMask }) => {
  const { THREE, renderer, camera, world } = window.__refs;
  const fig = world.figures[w], slot = world.slots[w];
  if (!fig || !slot || !slot.visible) return { who: w, offStage: true };
  const headJ = fig.joints.head;
  const view = window.__state().view, dpr = renderer.getPixelRatio();
  const gl = renderer.getContext();
  const DW = renderer.domElement.width, DH = renderer.domElement.height;
  const hs = fig.dims.headTopY - fig.dims.headY;
  const v = new THREE.Vector3();
  const toPx = (p) => { v.copy(p).project(camera);
    return { x: (view.x + (v.x + 1) / 2 * view.w) * dpr,
             y: (view.y + (1 - v.y) / 2 * view.h) * dpr }; };
  headJ.updateWorldMatrix(true, true);
  const at = (x, y, z) => toPx(v.set(x, y, z).applyMatrix4(headJ.matrixWorld));
  const pA = at(0, 0, 0), pB = at(0, hs, 0), pC = at(hs, 0, 0);
  const ex = { x: pC.x - pA.x, y: pC.y - pA.y };
  const ey = { x: pB.x - pA.x, y: pB.y - pA.y };
  const det = ex.x * ey.y - ex.y * ey.x;
  if (!isFinite(det) || Math.abs(det) < 1e-6) return { who: w, degenerate: true };

  // ---- the head's own box, in HEAD-LOCAL space: w vs d, honestly ----
  const isMask = (o) => { for (let n = o; n; n = n.parent)
    { if (n.name === 'maskNode') return true; if (n === headJ) return false; } return false; };
  const maskNode = headJ.getObjectByName('maskNode');
  const maskWas = maskNode ? maskNode.visible : null;
  if (hideMask && maskNode) maskNode.visible = false;
  const seen = [], local = new THREE.Box3(), world3 = new THREE.Box3();
  const inv = new THREE.Matrix4().copy(headJ.matrixWorld).invert();
  headJ.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    if (isMask(o) && !withMask) return;                       // the prop, not the head
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    seen.push(o);
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    world3.union(b);
    local.union(o.geometry.boundingBox.clone()
      .applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
  });
  if (local.isEmpty()) return { who: w, noHead: true };
  const headW = local.max.x - local.min.x;
  const headD = local.max.z - local.min.z;
  const headH = local.max.y - local.min.y;

  // the chin: the lowest point of the head cage on its own centre line, taken
  // from the built geometry rather than from a typed guess
  const chinY = local.min.y, chinZ = fig.dims.face.chinZ ?? local.max.z;
  const chinP = at(0, chinY, chinZ);
  const jawP = at(0, chinY + headH * 0.16, chinZ);
  const inView = (p) => (p.x / dpr >= view.x && p.x / dpr <= view.x + view.w &&
                         p.y / dpr >= view.y && p.y / dpr <= view.y + view.h);

  // ---- the painted pixels ----
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const px of [world3.min.x, world3.max.x])
    for (const py of [world3.min.y, world3.max.y])
      for (const pz of [world3.min.z, world3.max.z]) {
        const p = toPx(v.set(px, py, pz));
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(DW, Math.ceil(x1)); y1 = Math.min(DH, Math.ceil(y1));
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < 4 || bh < 4) return { who: w, tooSmall: [bw, bh] };
  const grab = () => { const b = new Uint8Array(bw * bh * 4);
    gl.readPixels(x0, DH - y1, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  window.__renderNow(); const A = grab();
  const was = seen.map((o) => o.visible);
  seen.forEach((o) => { o.visible = false; });
  window.__renderNow(); const B = grab();
  seen.forEach((o, i) => { o.visible = was[i]; });
  if (maskNode) maskNode.visible = maskWas;
  window.__renderNow();

  const fc = fig.dims.face;
  const bandLo = (fc.eyeY - fc.bandH / 2) / hs, bandHi = (fc.eyeY + fc.bandH / 2) / hs;
  const BINS = { cheek: [0.02, 0.40], face: [0.02, 0.66], hair: [0.74, 1.10] };
  const acc = { cheek: [], face: [], hair: [], band: [] };
  let changed = 0, below = 0, above = 0, inBand = 0;
  let chinPx = 0;                       // painted px under the jaw line
  for (let j = 0; j < bh; j++) {
    const sy = y1 - 1 - j;
    for (let i = 0; i < bw; i++) {
      const k = (j * bw + i) * 4;
      if (A[k] === B[k] && A[k + 1] === B[k + 1] && A[k + 2] === B[k + 2]) continue;
      changed++;
      const L = 0.2126 * A[k] + 0.7152 * A[k + 1] + 0.0722 * A[k + 2];
      const dx = (x0 + i) - pA.x, dy = sy - pA.y;
      const u = (dx * ey.y - dy * ey.x) / det;
      const t = (ex.x * dy - ex.y * dx) / det;
      if (t < bandLo) below++; else if (t > bandHi) above++; else inBand++;
      if (t < 0.16) chinPx++;
      if (Math.abs(u) > 0.30) continue;
      for (const [nm, r2] of Object.entries(BINS))
        if (t >= r2[0] && t <= r2[1]) acc[nm].push(L);
      if (t >= bandLo && t <= bandHi) acc.band.push(L);
    }
  }
  const stat = (arr) => { if (!arr.length) return null;
    arr.sort((p, q) => p - q);
    const q = (f) => +arr[Math.min(arr.length - 1, Math.floor(f * arr.length))].toFixed(1);
    return { n: arr.length, p50: q(0.5), p90: q(0.9), max: +arr[arr.length - 1].toFixed(1),
             darkFrac: +(arr.filter((L) => L < 26).length / arr.length).toFixed(3) }; };
  return {
    who: w,
    H: +fig.dims.H.toFixed(3), headSpan: +hs.toFixed(4),
    headsTall: +(fig.dims.H / hs).toFixed(2),
    spanFrac: +(hs / fig.dims.H).toFixed(4),
    headW: +headW.toFixed(4), headD: +headD.toFixed(4), headH: +headH.toFixed(4),
    wd: +(headW / headD).toFixed(3),
    masked: w === 'client' ? window.__maskState().attached : false,
    changed, below, inBand, above,
    belowFrac: changed ? +(below / changed).toFixed(3) : null,
    chinPxFrac: changed ? +(chinPx / changed).toFixed(3) : null,
    chinScreen: { x: +(chinP.x / dpr).toFixed(1), y: +(chinP.y / dpr).toFixed(1),
                  on: inView(chinP) },
    jawScreen: { x: +(jawP.x / dpr).toFixed(1), y: +(jawP.y / dpr).toFixed(1),
                 on: inView(jawP) },
    box: [x0, y0, x1, y1], dpr,
    bandT: [+bandLo.toFixed(3), +bandHi.toFixed(3)], tilt: fc.tilt,
    cheek: stat(acc.cheek), face: stat(acc.face), hair: stat(acc.hair), band: stat(acc.band),
  };
}, { w: who, hideMask: !!opts.hideMask, withMask: !!opts.withMask });

const units = await page.evaluate(() => window.__units().map(u => u.id));
const out = [];
for (const id of UNITS) {
  const idx = units.indexOf(id);
  if (idx < 0) { console.log(`!! no unit ${id}`); continue; }
  await page.evaluate((n) => window.__gotoUnit(n), idx);
  await settle(SETTLE);
  await page.screenshot({ path: path.join(outDir, `${id}--plate.png`) });
  for (const who of (WHO[id] || ['client'])) {
    const r = await measure(who);
    if (r.masked) {
      r.noMask = await measure(who, { hideMask: true });
      r.plusMask = await measure(who, { withMask: true });
      r.belowNoMask = r.noMask.belowFrac; r.belowPlusMask = r.plusMask.belowFrac;
    }
    out.push({ unit: id, ...r });
    if (r.box) {
      const [bx0, by0, bx1, by1] = r.box, d = r.dpr || 1;
      const pad = Math.max(24, (by1 - by0) * 0.35);
      const clip = {
        x: Math.max(0, Math.round(bx0 / d - pad)), y: Math.max(0, Math.round(by0 / d - pad)),
        width: Math.min(ratio[0], Math.round((bx1 - bx0) / d + pad * 2)),
        height: Math.min(ratio[1], Math.round((by1 - by0) / d + pad * 2)) };
      await page.screenshot({ path: path.join(outDir, `${id}--${who}-head.png`), clip });
    }
    const g = (v, ok) => `${v}${ok ? '' : '  <<'}`;
    console.log(`${id.padEnd(17)} ${who.padEnd(7)} ` +
      (!r.chinScreen ? JSON.stringify(r).slice(0, 120)
       : `heads=${g(r.headsTall, r.headsTall >= 6.0 && r.headsTall <= 6.7)} ` +
         `span=${r.spanFrac} w/d=${g(r.wd, r.wd >= 1.15)} ` +
         `below=${g(r.belowFrac, r.belowFrac >= 0.45)} chin=${g(r.chinScreen.on, r.chinScreen.on)} ` +
         `px=${r.changed} face.p90=${r.face && r.face.p90} hair.p90=${r.hair && r.hair.p90} ` +
         `band.dark=${r.band && r.band.darkFrac}` +
         (r.masked ? ` [noMask=${r.belowNoMask} +mask=${r.belowPlusMask}]` : '')));
  }
}
fs.writeFileSync(path.join(outDir, 'head.json'), JSON.stringify({ ratio, out, errs }, null, 2));
if (errs.length) console.log('ERRORS', errs.slice(0, 5));
await browser.close();
