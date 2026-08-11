#!/usr/bin/env node
/**
 * headbench.mjs — [8b-1] the eye-judgement rig. Same LOCKED azimuth and the same
 * 26-degree-down elevation the diorama camera is nailed to (main.js ISO), same
 * lights, same pose the unit puts the man in — but pulled in until the head fills
 * the plate, so the geometry can be seen while it is being cut. It moves the
 * CAMERA only, never the sim, and it never runs in a lap.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d; };
const outDir = path.join(ROOT, String(flag('out', 'shots/round-8b-head/bench')));
const port = Number(flag('port', 8150));
const dist = Number(flag('dist', 1.35));
fs.mkdirSync(outDir, { recursive: true });

const SHOTS = [
  { unit: 'i-16-iamking', who: 'client', tag: 'king-unmasked' },
  { unit: 'i-15-condescend', who: 'client', tag: 'king-masked' },
  { unit: 'i-13-delicacy', who: 'holmes', tag: 'holmes' },
  { unit: 'i-13-delicacy', who: 'watson', tag: 'watson' },
];

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERR', String(e.message).slice(0, 300)));
await p.goto(`http://127.0.0.1:${port}/app/index.html?harness=1`, { waitUntil: 'domcontentloaded' });
await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
await p.evaluate(() => window.__mute(true));
const units = await p.evaluate(() => window.__units().map(u => u.id));

for (const S of SHOTS) {
  const i = units.indexOf(S.unit);
  await p.evaluate((n) => window.__gotoUnit(n), i);
  await p.evaluate(() => { for (let k = 0; k < 102; k++) window.__advance(1 / 60); });
  const info = await p.evaluate(({ who, dist }) => {
    const { THREE, camera, world } = window.__refs;
    const fig = world.figures[who];
    const hs = fig.dims.headTopY - fig.dims.headY;
    const eye = new THREE.Vector3();
    fig.joints.head.updateWorldMatrix(true, false);
    eye.set(0, fig.dims.face.eyeY, 0).applyMatrix4(fig.joints.head.matrixWorld);
    // the LOCKED rig: main.js ISO { azim 0.86, elev 0.46 }
    const az = 0.86, el = 0.46;
    camera.position.set(eye.x + dist * Math.sin(az) * Math.cos(el),
                        eye.y + dist * Math.sin(el),
                        eye.z + dist * Math.cos(az) * Math.cos(el));
    camera.lookAt(eye);
    camera.fov = 30; camera.updateProjectionMatrix();
    window.__renderNow();
    const e = fig.joints.head.rotation;
    return { hs: +hs.toFixed(4), headPitchDeg: +(e.x * 180 / Math.PI).toFixed(2),
             headYawDeg: +(e.y * 180 / Math.PI).toFixed(2),
             drive: { present: +fig.drive.present.toFixed(2), unmask: +fig.drive.unmask.toFixed(2),
                      look: +fig.drive.look.toFixed(2), yaw: +fig.drive.yaw.toFixed(3) },
             face: fig.dims.face };
  }, { who: S.who, dist });
  const view = await p.evaluate(() => window.__state().view);
  await p.screenshot({ path: path.join(outDir, `${S.tag}.png`),
    clip: { x: view.x, y: view.y, width: view.w, height: view.h } });
  console.log(S.tag, JSON.stringify(info));
}
await b.close();
