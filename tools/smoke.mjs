#!/usr/bin/env node
/** smoke.mjs — fast single-unit probe while building. Not part of the gate. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const unit = Number(process.argv[2] ?? 0);
const port = fs.readFileSync(new URL('../app/.port', import.meta.url), 'utf8').trim();
const url = `http://127.0.0.1:${port}/app/index.html?harness=1`;
const ratio = (process.argv[3] || '1440x900').split('x').map(Number);

const gpu = process.argv.includes('--gpu');
const b = await chromium.launch({ args: gpu
  ? ['--use-gl=angle', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  : [] });
const ctx = await b.newContext({ viewport: { width: ratio[0], height: ratio[1] }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errs = [], bad = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
p.on('pageerror', e => errs.push('PAGEERR ' + String(e.message).slice(0, 300)));
p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
await p.goto(url, { waitUntil: 'domcontentloaded' });
await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
await p.evaluate(() => window.__mute(true));
await p.evaluate((n) => window.__gotoUnit(n), unit);
await p.evaluate(() => { window.__advance(1.7); window.__renderNow(); });
const st = await p.evaluate(() => window.__state());
fs.mkdirSync('/tmp/gl-smoke', { recursive: true });
const out = `/tmp/gl-smoke/u${String(unit).padStart(2, '0')}-${ratio[0]}x${ratio[1]}.png`;
await p.screenshot({ path: out });
console.log(JSON.stringify({
  out, unit: st.unit && st.unit.id, verb: st.unit && st.unit.verb,
  focusOnFrame: st.focusScreen.onFrame, target: st.targetScreen,
  view: st.view, plates: st.plates, cameo: st.cameo, leader: st.leader,
  assets: st.assets, audio: { files: st.audio.files, missing: st.audio.missing },
  validate: st.unitErrors, errors: st.errors, consoleErrors: errs, http: bad,
}, null, 2));
if (process.argv.includes('--perf')) console.log(JSON.stringify(await p.evaluate(() => window.__perf(60, 2))));
await b.close();
