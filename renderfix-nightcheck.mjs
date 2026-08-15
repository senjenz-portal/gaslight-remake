#!/usr/bin/env node
/* The one claim worth testing head-on: the Baker Street diorama's night mood SURVIVED.
 * Same live assets, same frozen camera, the only difference being the document — the
 * pre-fix king-demo/index.html served out of git HEAD~1 versus the shipped one. Compares
 * patches that contain no figure at all. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'https://senjenz-portal.github.io/gaslight-remake/';
const BEFORE = fs.readFileSync('/tmp/king-before.html', 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* fractional patches of pure street: shopfront, far cobbles, sky, near kerb */
const PATCHES = {
  shopfront: [0.05, 0.10, 0.10, 0.14],
  sky:       [0.72, 0.04, 0.12, 0.10],
  cobbles:   [0.22, 0.72, 0.10, 0.10],
  kerb:      [0.86, 0.55, 0.08, 0.12],
};

const SAMPLE = `(patches) => {
  const c = window.__viewer.renderer.domElement;
  const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
  g.getContext('2d').drawImage(c, 0, 0);
  const out = {};
  for (const k in patches){
    const f = patches[k];
    const d = g.getContext('2d').getImageData(
      Math.floor(f[0]*g.width), Math.floor(f[1]*g.height),
      Math.floor(f[2]*g.width), Math.floor(f[3]*g.height)).data;
    let r=0,gg=0,b=0; const n = d.length/4;
    for (let i=0;i<d.length;i+=4){ r+=d[i]; gg+=d[i+1]; b+=d[i+2]; }
    out[k] = [Math.round(r/n), Math.round(gg/n), Math.round(b/n)];
  }
  return out;
}`;

async function shoot(browser, useBefore) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  if (useBefore) {
    await page.route('**/king-demo/index.html*', (r) => r.fulfill({ contentType: 'text/html', body: BEFORE }));
    await page.route('**/king-demo/', (r) => r.fulfill({ contentType: 'text/html', body: BEFORE }));
  }
  await page.goto(`${BASE}king-demo/index.html?cb=${Date.now()}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__meshLoaded === true', null, { timeout: 90000 });
  /* freeze the pendulum at its start azimuth so both runs share one camera */
  await page.evaluate(() => {
    window.__viewer.controls.autoRotate = false;
    window.__viewer.camera.position.set(2.42, 1.62, 4.30);
    window.__viewer.controls.update();
  });
  await wait(2500);
  const patches = await page.evaluate(new Function('return ' + SAMPLE)(), PATCHES);
  await page.screenshot({ path: `/Users/samz/Documents/gaslight-remake/shots/nightcheck-${useBefore ? 'before' : 'after'}.png` });
  await ctx.close();
  return patches;
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const before = await shoot(browser, true);
const after = await shoot(browser, false);
await browser.close();

console.log('patch        before           after            delta');
let worst = 0;
for (const k in before) {
  const d = before[k].map((v, i) => Math.abs(v - after[k][i]));
  worst = Math.max(worst, ...d);
  console.log(k.padEnd(12), String(before[k]).padEnd(16), String(after[k]).padEnd(16), String(d));
}
console.log('\nworst per-channel delta on street-only patches:', worst, '/255');
fs.writeFileSync('/Users/samz/Documents/gaslight-remake/shots/renderfix-nightcheck.json',
  JSON.stringify({ before, after, worstDelta: worst }, null, 2));
