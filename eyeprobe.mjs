#!/usr/bin/env node
/**
 * eyeprobe.mjs — ROUND 8c [8c-2] "two eye shadows, not one bar", as a number.
 *
 * The review's finding was a SHAPE finding: the under-boss undercut ran nearly the
 * full width of the face, so at diorama size the eye band read as a visor slot.
 * lap.mjs's own `band` bin cannot answer it — that bin is every pixel in the band's
 * height, so the bosses, the nose bridge and the temple lifts are all inside it and
 * its median is dominated by the LIT ones. This measures the thing the review
 * actually named: how many SEPARATED dark regions the band contains.
 *
 * Method, on the same hide-and-diff pixels the face-luma law uses:
 *   1. keep the head's own pixels, solve each one's (u, t) in the head's own
 *      screen basis (u = head-spans right of the nose, t = head-spans up from the
 *      head joint), exactly as lap.mjs [R8-4] does;
 *   2. take the band rows (t inside the figure's own face.eyeY +- bandH/2) and bin
 *      them by u into columns;
 *   3. take the CHEEK reference from t 0.30-0.46 (lit mid-face, below the band);
 *   4. a column is DARK if its median luma is below `--k` (default 0.80) of the
 *      cheek's median — a RELATIVE threshold, so it means "in shadow against this
 *      man's own lit face" at any exposure;
 *   5. count runs of adjacent dark columns. TWO runs, separated by a lit bridge,
 *      is a pair of eyes. ONE run spanning the face is the visor slot.
 *
 * WHAT THIS TOOL CAN AND CANNOT SEE, measured after [8c-2] landed. The band it
 * takes is the figure's own `face.eyeY +- bandH/2` = the cage's recessed ring pair
 * (t 0.502..0.588 of the head span). [8c-2] lifts that floor back to face level
 * everywhere the socket is NOT and closes each window with a lower lid, and the
 * face fill ([8c-1]) comes from 47 degrees above — so the band is now the LIT brow
 * plate and the two shadows sit at t 0.46..0.51, under the lid and BELOW the band.
 * At the two close-ups this therefore reports the band 37-40/40 lit columns, and
 * it is right about the strip it measures: that strip is no longer where the eye
 * is. It stays as the visor-slot regression test (a band that goes dark across the
 * face again is the old shape coming back). The SHAPE question — how many shadows
 * and is there a lit bridge — is answered by `tools/facemap.mjs`, which sweeps the
 * whole face in t and prints it; widening this window instead does not work,
 * because a column's p20 over a strip twice as tall is diluted by the lit lid and
 * boss in the same column (measured: 2 runs, both on one side of the nose).
 *
 * usage: node tools/eyeprobe.mjs [--out DIR] [--ratio 1440x900] [--units a,b]
 *                                [--k 0.80] [--cols 40] [--port 8150]
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

const outDir = path.join(ROOT, String(flag('out', 'shots/8c-eyes')));
const ratio = String(flag('ratio', '1440x900')).split('x').map(Number);
const K = Number(flag('k', 0.80));
const COLS = Number(flag('cols', 40));
const SETTLE = 1.7;
const UNITS = String(flag('units', 'i-13-delicacy,i-15-condescend,i-16-iamking,i-22-myphoto'))
  .split(',');
const WHO = { 'i-13-delicacy': ['holmes', 'watson', 'client'],
              'i-15-condescend': ['client'], 'i-16-iamking': ['client'],
              'i-22-myphoto': ['holmes', 'watson', 'client'] };

const port = Number(flag('port', 0)) || 8150;
const portOpen = (p) => new Promise((res) => {
  const s = net.connect({ host: '127.0.0.1', port: p }, () => { s.destroy(); res(true); });
  s.on('error', () => res(false));
  s.setTimeout(500, () => { s.destroy(); res(false); });
});
if (!await portOpen(port)) { console.error(`nothing listening on ${port}`); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: ratio[0], height: ratio[1] }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERR ' + String(e.message).slice(0, 300)));
await page.goto(`http://127.0.0.1:${port}/app/index.html?harness=1`,
                { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
await page.evaluate(() => window.__mute(true));

const settle = (s) => page.evaluate((n) => {
  const q = 1 / 60; let k = Math.round(n / q);
  while (k-- > 0) window.__advance(q);
  window.__renderNow();
}, s);

const measure = (who, cols, k) => page.evaluate(({ w, cols: NC, k: KK }) => {
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

  /* the head's own pixels: hide it, re-render, keep what changed. The VIZARD is
   * excluded from the hidden set on purpose — while it is worn it is a prop over
   * the sockets, and a measurement of the sockets has to be of the sockets. */
  const isMask = (o) => { for (let n = o; n; n = n.parent) {
    if (n.name === 'maskNode') return true; if (n === headJ) return false; } return false; };
  const seen = [], box = new THREE.Box3();
  headJ.traverse((o) => { if (!o.isMesh || !o.visible || isMask(o)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    seen.push(o);
    box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); });
  if (box.isEmpty()) return { who: w, noHead: true };
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const px of [box.min.x, box.max.x])
    for (const py of [box.min.y, box.max.y])
      for (const pz of [box.min.z, box.max.z]) {
        const p = toPx(v.set(px, py, pz));
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(DW, Math.ceil(x1)); y1 = Math.min(DH, Math.ceil(y1));
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < 8 || bh < 8) return { who: w, tooSmall: [bw, bh] };
  const grab = () => { const b = new Uint8Array(bw * bh * 4);
    gl.readPixels(x0, DH - y1, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  window.__renderNow(); const A = grab();
  const was = seen.map((o) => o.visible);
  seen.forEach((o) => { o.visible = false; });
  window.__renderNow(); const B = grab();
  seen.forEach((o, i) => { o.visible = was[i]; });
  window.__renderNow();

  const fc = fig.dims.face;
  const bandLo = (fc.eyeY - fc.bandH / 2) / hs, bandHi = (fc.eyeY + fc.bandH / 2) / hs;
  /* the face's own front plane only: |u| <= U covers nose to the edge of the
   * un-bevelled front face, which is where a socket can be at all. */
  const U = 0.34;
  const col = Array.from({ length: NC }, () => []);
  const cheek = [];
  let bandPx = 0;
  for (let j = 0; j < bh; j++) {
    const sy = y1 - 1 - j;
    for (let i = 0; i < bw; i++) {
      const q = (j * bw + i) * 4;
      if (A[q] === B[q] && A[q + 1] === B[q + 1] && A[q + 2] === B[q + 2]) continue;
      const L = 0.2126 * A[q] + 0.7152 * A[q + 1] + 0.0722 * A[q + 2];
      const dx = (x0 + i) - pA.x, dy = sy - pA.y;
      const u = (dx * ey.y - dy * ey.x) / det;
      const t = (ex.x * dy - ex.y * dx) / det;
      if (Math.abs(u) > U) continue;
      if (t >= 0.30 && t <= 0.46) cheek.push(L);
      if (t < bandLo || t > bandHi) continue;
      bandPx++;
      const ci = Math.min(NC - 1, Math.max(0, Math.floor((u + U) / (2 * U) * NC)));
      col[ci].push(L);
    }
  }
  const q = (arr, f) => { if (!arr.length) return null;
    const s2 = arr.slice().sort((p, r) => p - r);
    return s2[Math.min(s2.length - 1, Math.floor(f * s2.length))]; };
  const med = (arr) => q(arr, 0.5);
  const cheekMed = med(cheek);
  if (cheekMed === null || bandPx < 40) return { who: w, thin: [bandPx, cheek.length] };
  const thr = cheekMed * KK;
  /* the per-column statistic is the DARKEST FIFTH, not the median: the band is
   * 0.086 of the span tall and the socket is the lower part of it, so a column
   * median is dominated by the boss and the lid that bound the pocket. p20 is
   * "the shadow this column actually contains". */
  const prof = col.map((c, i) => ({
    u: +(-U + (i + 0.5) * (2 * U) / NC).toFixed(3),
    n: c.length, med: c.length ? +q(c, 0.20).toFixed(1) : null,
    p50: c.length ? +med(c).toFixed(1) : null }));
  // runs of adjacent DARK columns (columns with no pixels break nothing: skipped)
  const runs = [];
  let cur = null;
  for (const p of prof) {
    if (p.med === null) continue;
    const dark = p.med < thr;
    if (dark) { if (!cur) { cur = { u0: p.u, u1: p.u, px: 0, lum: [] }; runs.push(cur); }
                cur.u1 = p.u; cur.px += p.n; cur.lum.push(p.med); }
    else cur = null;
  }
  const lit = prof.filter((p) => p.med !== null && p.med >= thr);
  return { who: w,
           headPx: [bw, bh], bandPx, cheekPx: cheek.length,
           cheekMed: +cheekMed.toFixed(1), thr: +thr.toFixed(1),
           bandT: [+bandLo.toFixed(3), +bandHi.toFixed(3)], tilt: fc.tilt,
           masked: w === 'client' ? window.__maskState().attached : false,
           darkRuns: runs.length,
           runs: runs.map((r) => ({ u: [r.u0, r.u1], px: r.px,
             med: +(r.lum.reduce((a, b) => a + b, 0) / r.lum.length).toFixed(1),
             ratio: +((r.lum.reduce((a, b) => a + b, 0) / r.lum.length) / cheekMed).toFixed(3) })),
           litCols: lit.length, cols: prof.filter((p) => p.med !== null).length,
           profile: prof.map((p) => p.med === null ? '-' : p.med),
           profileP50: prof.map((p) => p.p50 === null ? '-' : p.p50) };
}, { w: who, cols, k });

const units = await page.evaluate(() => window.__units().map((u) => u.id));
const out = [];
for (const id of UNITS) {
  const idx = units.indexOf(id);
  if (idx < 0) { console.log(`!! no unit ${id}`); continue; }
  await page.evaluate((n) => window.__gotoUnit(n), idx);
  await settle(SETTLE);
  for (const who of (WHO[id] || ['client'])) {
    const r = await measure(who, COLS, K);
    out.push({ unit: id, ...r });
    if (r.darkRuns === undefined) {
      console.log(`${id.padEnd(17)} ${who.padEnd(7)} ${JSON.stringify(r).slice(0, 150)}`);
      continue;
    }
    console.log(`${id.padEnd(17)} ${who.padEnd(7)} ` +
      `${r.darkRuns} dark run(s) in the band${r.masked ? ' [VIZARD ON]' : ''} — ` +
      r.runs.map((q) => `u ${q.u[0]}..${q.u[1]} med ${q.med} (${q.ratio} of cheek)`)
        .join(' | ') +
      `  cheek med ${r.cheekMed}, threshold ${r.thr}, ${r.litCols}/${r.cols} lit columns`);
  }
}
fs.writeFileSync(path.join(outDir, 'eyes.json'),
                 JSON.stringify({ ratio, k: K, cols: COLS, out, errs }, null, 2));
if (errs.length) console.log('ERRORS', errs.slice(0, 5));
await browser.close();
