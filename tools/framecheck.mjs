#!/usr/bin/env node
/**
 * framecheck.mjs — [8b-4] the framing bench. Walks every unit at reader cadence
 * (SETTLE per unit, exactly like a lap) and reports, per unit: each figure's
 * box against the inset, how far each figure's CROWN is outside the plate, and
 * the King's mover state. Not a gate — the cheap loop the camera refits are
 * fitted on. Also dumps the King's pacing over kingEnter/kingExit.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d; };
const port = Number(flag('port', 8150));
const ratio = String(flag('ratio', '1440x900')).split('x').map(Number);
const SETTLE = 1.7, DT = 1 / 60;

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: ratio[0], height: ratio[1] },
                                 deviceScaleFactor: 1 });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERR', String(e.message).slice(0, 300)));
await p.goto(`http://127.0.0.1:${port}/app/index.html?harness=1`, { waitUntil: 'domcontentloaded' });
await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
await p.evaluate(() => window.__mute(true));
const adv = (s) => p.evaluate((n) => { let k = Math.round(n * 60);
  while (k-- > 0) window.__advance(1 / 60); window.__renderNow(); }, s);

/* ---- pacing: replay kingEnter / kingExit frame by frame ---- */
for (const [unit, act, span] of [['i-11-hadnote', 'kingEnter', 6.0],
                                 ['i-35-briony', 'kingExit', 4.5]]) {
  const units = await p.evaluate(() => window.__units().map(u => u.id));
  await p.evaluate((n) => window.__gotoUnit(n), units.indexOf(unit));
  const rows = await p.evaluate(async ({ span }) => {
    const { world } = window.__refs;
    const m = world.movers.client, fig = world.figures.client;
    const out = [];
    for (let i = 0; i < Math.round(span * 60); i++) {
      window.__advance(1 / 60);
      out.push([+(i / 60).toFixed(3), +m.speed.toFixed(4),
                +(fig.metric.cad || 0).toFixed(3), +(fig.metric.stride || 0).toFixed(4),
                +m.pos.x.toFixed(3), +m.pos.z.toFixed(3), m.walking ? 1 : 0,
                +m.yaw.toFixed(3)]);
    }
    return out;
  }, { span });
  const walking = rows.filter(r => r[6]);
  const peakV = Math.max(...rows.map(r => r[1]));
  const peakF = Math.max(...walking.map(r => r[2]), 0);
  const maxStride = Math.max(...walking.map(r => r[3]), 0);
  const t0 = walking.length ? walking[0][0] : null;
  const t1 = walking.length ? walking[walking.length - 1][0] : null;
  console.log(`${act}: peak speed ${peakV.toFixed(3)} m/s, peak cadence ${peakF.toFixed(2)} Hz, ` +
    `max stride ${maxStride.toFixed(3)} m, walking ${t0}..${t1}s (${walking.length} frames)`);
  // where is he at the frames the lap shoots?
  for (const t of [1.7, 3.4, 5.1]) {
    const r = rows[Math.round(t * 60)];
    if (r) console.log(`    t=${t}s  x=${r[4]} z=${r[5]} v=${r[1]} cad=${r[2]} walking=${r[6]} yaw=${r[7]}`);
  }
}

/* ---- per-unit framing ---- */
const units = await p.evaluate(() => window.__units());
await p.evaluate(() => window.__gotoUnit(0));
const rowsOut = [];
for (let i = 0; i < units.length; i++) {
  await p.evaluate((n) => window.__gotoUnit(n), i);
  await adv(SETTLE);
  const st = await p.evaluate(() => {
    const s = window.__state();
    const { THREE, camera, world } = window.__refs;
    const v = new THREE.Vector3();
    const view = s.view;
    const crown = {};
    for (const who of ['holmes', 'watson', 'client']) {
      const fig = world.figures[who], slot = world.slots[who];
      if (!fig || !slot || !slot.visible) continue;
      fig.joints.head.updateWorldMatrix(true, false);
      v.set(0, fig.dims.headTopY - fig.dims.headY, 0).applyMatrix4(fig.joints.head.matrixWorld);
      v.project(camera);
      const x = view.x + (v.x + 1) / 2 * view.w, y = view.y + (1 - v.y) / 2 * view.h;
      crown[who] = { x: +x.toFixed(1), y: +y.toFixed(1),
                     outTop: +(view.y - y).toFixed(1),
                     outLeft: +(view.x - x).toFixed(1),
                     outRight: +(x - (view.x + view.w)).toFixed(1) };
    }
    return { id: s.unit.id, focus: s.unit.focus, view, figures: s.figures, crown };
  });
  rowsOut.push(st);
  const f = st.figures || {};
  const bad = [];
  for (const [who, fr] of Object.entries(f)) {
    if (fr && fr.inset > 0.02 && fr.inset < 0.995) bad.push(`${who} inset ${fr.inset}`);
  }
  for (const [who, c] of Object.entries(st.crown)) {
    if (c.outTop > 0) bad.push(`${who} crown ${c.outTop}px above the plate`);
    if (c.outLeft > 0) bad.push(`${who} crown ${c.outLeft}px left`);
    if (c.outRight > 0) bad.push(`${who} crown ${c.outRight}px right`);
  }
  if (bad.length) console.log(`${st.id.padEnd(17)} ${String(st.focus).padEnd(11)} ${bad.join('; ')}`);
}
fs.writeFileSync(path.join(ROOT, 'shots/round-8b-head/frames.json'),
                 JSON.stringify(rowsOut, null, 1));
await b.close();
