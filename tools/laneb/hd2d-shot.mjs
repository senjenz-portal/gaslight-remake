/**
 * hd2d-shot.mjs — headless verifier + screenshotter for the LANE B HD-2D page.
 *
 *   node hd2d-shot.mjs <out.png> [query] [waitMs]
 *
 * Loads the page in a real GPU-backed Chromium, fails loudly on any console
 * error or failed request (a silent 404 on the sprite sheet would otherwise
 * just look like "the King didn't show up"), lets the animation settle, then
 * prints the page's own __hd2d.report() alongside a measured frame rate.
 */
import { chromium } from 'playwright';
import process from 'node:process';

const out = process.argv[2] || '/tmp/hd2d.png';
const query = process.argv[3] || '';
const waitMs = parseInt(process.argv[4] || '2600', 10);
const URLBASE = 'http://127.0.0.1:8899/king-demo/hd2d/index.html';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });

await page.goto(URLBASE + (query ? '?' + query : ''), { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction('window.__hd2d !== undefined', null, { timeout: 20000 });
await page.waitForTimeout(waitMs);

// measure real frame rate over a second of wall clock
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; (performance.now() - t0 < 1000) ? requestAnimationFrame(tick) : res(n * 1000 / (performance.now() - t0)); };
  requestAnimationFrame(tick);
}));

const report = await page.evaluate(() => window.__hd2d.report());
await page.screenshot({ path: out });
await browser.close();

console.log(JSON.stringify({ out, query, fps: Math.round(fps * 10) / 10, report, errors }, null, 1));
if (errors.length) process.exitCode = 2;
