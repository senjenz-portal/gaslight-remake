#!/usr/bin/env node
/** stagetune.mjs — sweep the king-demo stage placement / camera bearing and dump frames.
 *  usage: node stagetune.mjs <baseUrl> <outDir> [--mesh tripo] [--sweep yaw|az|az2]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:8931/king-demo/';
const out  = process.argv[3] || '/tmp/stagetune';
const arg  = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const mesh  = arg('--mesh', 'tripo');
const sweep = arg('--sweep', 'yaw');
fs.mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
p.on('pageerror', e => errs.push('PAGEERR ' + String(e.message).slice(0, 300)));
await p.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction('window.__meshLoaded === true', null, { timeout: 60000 });
if (mesh !== 'tripo') {
  await p.click(`#mesh-switch .mesh-opt[data-key="${mesh}"]`);
  await p.waitForFunction(`window.__viewer && window.__viewer.showing === "${mesh}"`, null, { timeout: 120000 });
}
await p.locator('#viewer-fig').scrollIntoViewIfNeeded();
await p.evaluate(() => { window.__viewer.controls.autoRotate = false; });

const shot = async (tag) => {
  await p.waitForTimeout(350);
  const f = `${out}/${tag}.png`;
  await p.locator('#viewer').screenshot({ path: f });
  return f;
};
const setAz = async (deg) => {
  await p.evaluate((d) => {
    const c = window.__viewer.controls, cam = window.__viewer.camera;
    const t = c.target, off = cam.position.clone().sub(t);
    const r = off.length(), y = off.y;
    const h = Math.sqrt(Math.max(1e-6, r * r - y * y));
    const a = d * Math.PI / 180;
    cam.position.set(t.x + Math.sin(a) * h, t.y + y, t.z + Math.cos(a) * h);
    c.update();
  }, deg);
};

const made = [];
if (sweep === 'yaw') {
  for (const yaw of [-30, -12, 0, 18, 40]) {
    await p.evaluate((y) => window.__stage.place({ yawDeg: y }), yaw);
    made.push(await shot(`${mesh}-yaw${yaw}`));
  }
} else if (sweep === 'az') {
  for (const az of [-8, 12, 34, 55, 76, 97]) { await setAz(az); made.push(await shot(`${mesh}-az${az}`)); }
} else if (sweep === 'combo') {
  const combos = [
    ['A', { stand: [4.2, 0.16, 4.4], yawDeg: 18 }],
    ['B', { stand: [4.2, 0.16, 4.4], yawDeg: 8 }],
    ['C', { stand: [3.0, 0.14, 4.3], yawDeg: 12 }],
    ['D', { stand: [2.0, 0.14, 4.6], yawDeg: 25 }],
    ['E', { stand: [-0.5, 0.14, 4.5], yawDeg: -10 }],
    ['F', { stand: [4.2, 0.16, 2.2], yawDeg: 30 }],
    ['G', { stand: [-2.4, 0.16, 3.6], yawDeg: 34 }],
    ['H', { stand: [3.2, 0.14, 2.0], yawDeg: -30 }]
  ];
  for (const [k, c] of combos) {
    await p.evaluate((cc) => window.__stage.place(cc), c);
    made.push(await shot(`${mesh}-combo-${k}`));
  }
} else if (sweep === 'arc') {
  const place = JSON.parse(arg('--place', '{}'));
  const tag = arg('--tag', 'P');
  if (Object.keys(place).length) await p.evaluate((c) => window.__stage.place(c), place);
  for (const az of [12, 25, 45, 62, 78]) { await setAz(az); made.push(await shot(`${tag}-az${az}`)); }
} else if (sweep === 'cam') {
  const place = JSON.parse(arg('--place', '{}'));
  if (Object.keys(place).length) await p.evaluate((c) => window.__stage.place(c), place);
  for (const [r, dy] of [[4.13, 0.735], [4.13, 0.40], [4.6, 0.55], [4.6, 0.95], [3.7, 0.55], [5.2, 0.7]]) {
    await p.evaluate(([rr, ddy]) => {
      const c = window.__viewer.controls, cam = window.__viewer.camera, t = c.target;
      const h = Math.sqrt(Math.max(1e-6, rr * rr - ddy * ddy));
      const a = 45 * Math.PI / 180;
      cam.position.set(t.x + Math.sin(a) * h, t.y + ddy, t.z + Math.cos(a) * h);
      c.update();
    }, [r, dy]);
    made.push(await shot(`cam-r${r}-dy${dy}`));
  }
} else if (sweep === 'scale') {
  for (const sc of [0.52, 0.58, 0.64, 0.72]) {
    await p.evaluate((s) => window.__stage.place({ scale: s }), sc);
    made.push(await shot(`${mesh}-scale${String(sc).replace('.', '')}`));
  }
} else {
  made.push(await shot(`${mesh}-default`));
}
console.log(JSON.stringify({ made, errs }, null, 1));
await b.close();
