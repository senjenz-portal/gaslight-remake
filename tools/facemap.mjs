#!/usr/bin/env node
/**
 * facemap.mjs — ROUND 8c [8c-2] WHERE the shadow on a face is, as a picture made
 * of characters. The bench the "two eye shadows, not one bar" ruling is read on.
 *
 * Why this exists next to `eyeprobe.mjs`. eyeprobe asks "is the BAND dark, and in
 * how many pieces?", where the band is the figure's own `face.eyeY +- bandH/2` —
 * the cage's recessed ring pair (0.502..0.588 of the head span). After [8c-2] that
 * strip is the wrong strip: the fix LIFTS the socket floor back to face level
 * everywhere the socket is not and closes each window with a lower lid, so the
 * band is now the lit brow plate and the two shadows sit at t 0.46-0.51 — under
 * the lid, BELOW the band. eyeprobe reports the band all-lit at the two close-ups
 * and it is telling the truth about the strip it measures; it simply cannot see
 * the eye. Nor can a taller window fix it: a column's p20 over a strip twice as
 * tall is diluted by the lit lid and boss inside the same column, and a per-row
 * median over rows 0.026 tall calls every column dark. The honest instrument for a
 * SHAPE question is the shape.
 *
 * So this prints the head's own pixels as a grid in the head's own basis:
 *   u across  = head-spans right of the nose (the same u as eyeprobe/lap [R8-4]),
 *   t up      = head-spans above the head joint,
 *   each cell = the darkest fifth (p20) of the pixels that fall in it, rendered
 *               '#' below 0.6 of the cheek median, '*' below 0.8, '.' lit, ' ' empty,
 * with the cheek reference taken from t 0.30..0.46 exactly as eyeprobe takes it.
 * Two '*' regions at socket height with a lit bridge between them is a pair of
 * eyes; one region running the row is the visor slot the review named.
 *
 * The head's pixels are isolated the same way the face-luma law isolates them:
 * render, hide every mesh under the head joint EXCEPT the vizard, render again,
 * keep what changed. The vizard stays because while it is worn it is a prop over
 * the sockets, and a measurement of the sockets has to be of the sockets.
 *
 * usage: node tools/facemap.mjs [--units a,b] [--ratio 1440x900] [--out DIR]
 *                               [--port 8150]
 * The map goes to stdout and, if --out is given, to DIR/facemap-<ratio>.txt.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d; };
const port = Number(flag('port', 0)) || 8150;
const UNITS = String(flag('units', 'i-16-iamking,i-15-condescend,i-13-delicacy')).split(',');
const ratio = String(flag('ratio', '1440x900')).split('x').map(Number);
const outDir = flag('out', null);
/* 28 columns over the front face and 22 rows from the jaw to the crown: at the
 * close-ups that is ~15 px a cell, and at i-13 (an 80 px head) ~3 px a cell —
 * coarse, which is the point, because the question is what a reader sees. */
const NU = 28, NT = 22, T0 = 0.22, T1 = 0.80;
const lines = [];
const say = (s) => { console.log(s); lines.push(s); };

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: ratio[0], height: ratio[1] }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERR', String(e.message).slice(0, 200)));
await p.goto(`http://127.0.0.1:${port}/app/index.html?harness=1`, { waitUntil: 'domcontentloaded' });
await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
await p.evaluate(() => window.__mute(true));
const units = await p.evaluate(() => window.__units().map((u) => u.id));

const measure = (who, NU, NT, T0, T1) => p.evaluate(({ w, NU, NT, T0, T1 }) => {
  const { THREE, renderer, camera, world } = window.__refs;
  const fig = world.figures[w], slot = world.slots[w];
  if (!fig || !slot || !slot.visible) return { offStage: true };
  const headJ = fig.joints.head;
  const view = window.__state().view, dpr = renderer.getPixelRatio();
  const gl = renderer.getContext();
  const DW = renderer.domElement.width, DH = renderer.domElement.height;
  const hs = fig.dims.headTopY - fig.dims.headY;
  const v = new THREE.Vector3();
  const toPx = (q) => { v.copy(q).project(camera);
    return { x: (view.x + (v.x + 1) / 2 * view.w) * dpr, y: (view.y + (1 - v.y) / 2 * view.h) * dpr }; };
  headJ.updateWorldMatrix(true, true);
  const at = (x, y, z) => toPx(v.set(x, y, z).applyMatrix4(headJ.matrixWorld));
  const pA = at(0, 0, 0), pB = at(0, hs, 0), pC = at(hs, 0, 0);
  const ex = { x: pC.x - pA.x, y: pC.y - pA.y }, ey = { x: pB.x - pA.x, y: pB.y - pA.y };
  const det = ex.x * ey.y - ex.y * ey.x;
  const isMask = (o) => { for (let n = o; n; n = n.parent) { if (n.name === 'maskNode') return true; if (n === headJ) return false; } return false; };
  const seen = [], box = new THREE.Box3();
  headJ.traverse((o) => { if (!o.isMesh || !o.visible || isMask(o)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    seen.push(o); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const px of [box.min.x, box.max.x]) for (const py of [box.min.y, box.max.y]) for (const pz of [box.min.z, box.max.z]) {
    const q = toPx(v.set(px, py, pz));
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(DW, Math.ceil(x1)); y1 = Math.min(DH, Math.ceil(y1));
  const bw = x1 - x0, bh = y1 - y0;
  const grab = () => { const bb = new Uint8Array(bw * bh * 4);
    gl.readPixels(x0, DH - y1, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, bb); return bb; };
  window.__renderNow(); const A = grab();
  const was = seen.map((o) => o.visible); seen.forEach((o) => { o.visible = false; });
  window.__renderNow(); const B = grab();
  seen.forEach((o, i) => { o.visible = was[i]; }); window.__renderNow();
  const U = 0.34;
  const cell = Array.from({ length: NT }, () => Array.from({ length: NU }, () => []));
  const cheek = [];
  for (let j = 0; j < bh; j++) { const sy = y1 - 1 - j;
    for (let i = 0; i < bw; i++) {
      const q = (j * bw + i) * 4;
      if (A[q] === B[q] && A[q + 1] === B[q + 1] && A[q + 2] === B[q + 2]) continue;
      const L = 0.2126 * A[q] + 0.7152 * A[q + 1] + 0.0722 * A[q + 2];
      const dx = (x0 + i) - pA.x, dy = sy - pA.y;
      const u = (dx * ey.y - dy * ey.x) / det, t = (ex.x * dy - ex.y * dx) / det;
      if (Math.abs(u) > U) continue;
      if (t >= 0.30 && t <= 0.46) cheek.push(L);
      if (t < T0 || t >= T1) continue;
      const ti = Math.floor((t - T0) / (T1 - T0) * NT);
      const ui = Math.min(NU - 1, Math.max(0, Math.floor((u + U) / (2 * U) * NU)));
      cell[ti][ui].push(L);
    }
  }
  const q20 = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(0.20 * s.length)]; };
  const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(0.5 * s.length)]; };
  const fc = fig.dims.face;
  return { hs, cheekMed: med(cheek), bandT: [(fc.eyeY - fc.bandH / 2) / hs, (fc.eyeY + fc.bandH / 2) / hs],
           eyeY: fc.eyeY, bandH: fc.bandH, headPx: [bw, bh],
           grid: cell.map((row) => row.map((c) => (c.length ? Math.round(q20(c)) : null))),
           n: cell.map((row) => row.map((c) => c.length)) };
}, { w: who, NU, NT, T0, T1 });

/* who has a face on the plate at each framing: the King at his two close-ups, and
 * at i-13 the King (still masked) plus Watson, whose head is the wide-framing
 * control — the same builder, the same rings, 80-104 px of head. */
const WHO = { 'i-13-delicacy': ['client', 'watson'], 'i-22-myphoto': ['client', 'holmes'] };
for (const id of UNITS) {
  const idx = units.indexOf(id);
  if (idx < 0) { say(`!! no unit ${id}`); continue; }
  await p.evaluate((n) => window.__gotoUnit(n), idx);
  await p.evaluate(() => { for (let k = 0; k < 102; k++) window.__advance(1 / 60); window.__renderNow(); });
  for (const w of (WHO[id] || ['client'])) {
    const r = await measure(w, NU, NT, T0, T1);
    if (r.offStage) { say(`\n== ${id} ${w}  OFFSTAGE`); continue; }
    const thr = r.cheekMed * 0.80;
    say(`\n== ${id} ${w}  head ${r.headPx}  cheekMed ${r.cheekMed.toFixed(1)} thr ${thr.toFixed(1)} ` +
      `bandT ${r.bandT.map((x) => x.toFixed(3))} (eyeY ${r.eyeY} of hs ${r.hs.toFixed(4)})`);
    say('   t      u: -0.34 ............ +0.34   (# = <0.6 thr, * = <thr, . = lit, space = no px)');
    for (let ti = NT - 1; ti >= 0; ti--) {
      const t = T0 + (ti + 0.5) * (T1 - T0) / NT;
      const row = r.grid[ti].map((z) => z === null ? ' ' : z < thr * 0.6 ? '#' : z < thr ? '*' : '.').join('');
      const mark = (t >= r.bandT[0] && t <= r.bandT[1]) ? ' <BAND' : '';
      say(`  ${t.toFixed(3)}  ${row}${mark}`);
    }
  }
}
if (outDir) {
  const dir = path.join(ROOT, String(outDir));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `facemap-${ratio.join('x')}.txt`), lines.join('\n') + '\n');
}
await b.close();
