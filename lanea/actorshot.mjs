#!/usr/bin/env node
/** actorshot.mjs — quick look at the actor stage while it is being built.
 *  node tools/lanea/actorshot.mjs <baseUrl> <outDir> [what]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:8899').replace(/\/$/, '');
const OUT = process.argv[3] || '/tmp/actorshots';
const WHAT = process.argv[4] || 'idle';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${r.url()}`); });

await page.goto(`${BASE}/king-demo/living-plate/`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__actors, null, { timeout: 15000 }).catch(() => {});
await page.$eval('#stage-actors', (el) => el.scrollIntoView({ block: 'center' }));
await sleep(1200);
const box = await (await page.$('#stage-actors')).boundingBox();

if (WHAT === 'idle') {
  await page.screenshot({ path: path.join(OUT, 'idle.png'), clip: box });
  console.log(JSON.stringify(await page.evaluate(() => ({
    pose: window.__actors.pose(), walk: window.__actors.walk(),
    foot: window.__actors.foot(),
    order: window.__actors.order().map((o) => o.id + ':' + o.z),
  })), null, 1));
} else if (WHAT === 'gesture') {
  await page.evaluate(() => window.__actors.gesture());
  await sleep(340);
  await page.screenshot({ path: path.join(OUT, 'gesture.png'), clip: box });
  console.log(JSON.stringify(await page.evaluate(() => window.__actors.pose())));
} else if (WHAT === 'walk') {
  await page.evaluate(() => window.__actors.send());
  for (const [i, ms] of [400, 500, 500, 500, 500].entries()) {
    await sleep(ms);
    await page.screenshot({ path: path.join(OUT, `walk-${i}.png`), clip: box });
    console.log(i, JSON.stringify(await page.evaluate(() => ({
      w: window.__actors.walk(), f: window.__actors.foot() }))));
  }
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, 'arrived.png'), clip: box });
  console.log('arrived', JSON.stringify(await page.evaluate(() => ({
    w: window.__actors.walk(), f: window.__actors.foot() }))));
}
console.log('errors:', errs.length ? errs.slice(0, 6) : 'clean');
await browser.close();
