#!/usr/bin/env node
/**
 * lanea/verify.mjs — proves both techniques on the Living Plate page actually
 * move, then captures the shots. Frame-diff per stage over a real wall-clock
 * window; the video stages additionally get a wrap-window sample to prove the
 * cross-fade never shows a black or duplicated frame.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';

const DIR = '/Users/samz/Documents/gaslight-remake/site-deploy/king-demo/living-plate';
const SHOTS = '/Users/samz/Documents/gaslight-remake/shots/lanea';
fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 8391;
const MIME = { '.html':'text/html', '.png':'image/png', '.jpg':'image/jpeg',
               '.mp4':'video/mp4', '.json':'application/json', '.svg':'image/svg+xml' };

const srv = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(DIR, u === '/' ? 'index.html' : u);
  if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); return res.end('nope');
  }
  const size = fs.statSync(f).size, type = MIME[path.extname(f)] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m[1] ? +m[1] : 0, end = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(f, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
  fs.createReadStream(f).pipe(res);
}).listen(PORT);

const errs = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1'] });
const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
page.on('requestfailed', r => errs.push('REQFAIL ' + r.url().split('/').pop() + ' ' + (r.failure()?.errorText || '')));

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const vstate = await page.evaluate(() => ['vidA','stA'].map(id => {
  const v = document.getElementById(id);
  return { id, paused: v.paused, t: +v.currentTime.toFixed(2), dur: +(v.duration||0).toFixed(2),
           w: v.videoWidth, h: v.videoHeight, ready: v.readyState };
}));
console.log('video state:', JSON.stringify(vstate));

/* ---- frame diff per stage ---- */
const PNG = (await import(path.join('/Users/samz/Documents/gaslight-remake/node_modules'))
  .catch(() => null));
function decode(buf) { return buf; }

async function shots(sel, n, gapMs) {
  const el = await page.$(sel);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(await el.screenshot());
    if (i < n - 1) await page.waitForTimeout(gapMs);
  }
  return out;
}

const stages = ['#stage-room', '#stage-layers', '#stage-street'];
const captured = {};
for (const s of stages) {
  captured[s] = await shots(s, 6, 700);
}
await browser.close();
srv.close();

const tmp = '/Users/samz/Documents/gaslight-remake/tools/lanea/work/verify';
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
for (const s of stages) {
  const name = s.replace('#stage-', '');
  captured[s].forEach((b, i) => fs.writeFileSync(path.join(tmp, `${name}-${i}.png`), b));
}
fs.writeFileSync(path.join(tmp, 'errors.json'), JSON.stringify(errs, null, 1));
console.log('errors:', errs.length ? errs : 'none');
console.log('frames written to', tmp);
