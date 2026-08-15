// Verify the king-demo page: load, console errors, GLB render, unmask toggle.
// Usage: node tools/verify-king-demo.mjs <baseUrl> <screenshotPath>
import { chromium } from 'playwright';

const base = process.argv[2];
const shot = process.argv[3];
if (!base || !shot) { console.error('usage: verify-king-demo.mjs <baseUrl> <screenshotPath>'); process.exit(2); }

const failures = [];
const consoleErrors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

try {
  const resp = await page.goto(base, { waitUntil: 'load', timeout: 45000 });
  if (!resp || resp.status() !== 200) failures.push(`page load status ${resp ? resp.status() : 'none'}`);

  // wait for the GLB to finish loading (hook set by the page), then 3s of rendering
  await page.waitForFunction(() => window.__meshLoaded === true, null, { timeout: 60000 })
    .catch(() => failures.push('GLB did not finish loading within 60s (__meshLoaded never set)'));
  await page.waitForTimeout(3000);

  // canvas non-black check: draw the WebGL canvas to 2D and measure brightness
  const px = await page.evaluate(() => {
    const gl = document.getElementById('viewer');
    const c = document.createElement('canvas');
    c.width = 160; c.height = 200;
    const ctx = c.getContext('2d');
    ctx.drawImage(gl, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      sum += v; if (v > max) max = v;
    }
    return { avg: sum / (d.length / 4), max };
  });
  if (px.max < 25) failures.push(`canvas looks black (avg ${px.avg.toFixed(1)}, max ${px.max})`);
  console.log(`canvas pixels: avg ${px.avg.toFixed(1)}, max ${px.max}`);

  // unmask toggle: click, assert src change; click again, assert it reverts
  const src0 = await page.getAttribute('#portrait', 'src');
  await page.click('#unmask');
  await page.waitForTimeout(800);
  const src1 = await page.getAttribute('#portrait', 'src');
  const cap1 = await page.textContent('#mask-caption');
  if (src0 === src1) failures.push('unmask click did not change #portrait src');
  if (!/unmasked/.test(src1 || '')) failures.push(`after click src is ${src1}, expected king2-unmasked.png`);
  if (!/Wilhelm von Ormstein/i.test(cap1 || '')) failures.push(`caption after unmask: "${cap1}"`);
  await page.click('#unmask');
  await page.waitForTimeout(800);
  const src2 = await page.getAttribute('#portrait', 'src');
  if (!/king2-masked/.test(src2 || '')) failures.push(`second click did not restore mask (src ${src2})`);
  console.log(`unmask toggle: ${src0} -> ${src1} -> ${src2}`);

  await page.screenshot({ path: shot, fullPage: true });
  console.log('screenshot: ' + shot);
} catch (e) {
  failures.push('exception: ' + e.message);
}

// audio play rejection in headless is tolerated; it is caught in-page and never reaches console
for (const err of consoleErrors) failures.push('console error: ' + err);

await browser.close();
console.log(failures.length ? 'FAILURES:\n' + failures.map(f => ' - ' + f).join('\n') : 'ALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
