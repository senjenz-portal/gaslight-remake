// Verify the king-demo v3 page: load, console errors, GLB render, unmask toggle,
// lightbox open/close, full-page screenshot, and a face close-up via the camera hook.
// Usage: node tools/verify-king-demo-v3.mjs <baseUrl> <screenshotPath> [faceShotPath]
import { chromium } from 'playwright';

const base = process.argv[2];
const shot = process.argv[3];
const faceShot = process.argv[4];
if (!base || !shot) { console.error('usage: verify-king-demo-v3.mjs <baseUrl> <screenshotPath> [faceShotPath]'); process.exit(2); }

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

  // hero layout sanity: the viewer should be (near) full content width
  const layout = await page.evaluate(() => {
    const v = document.getElementById('viewer').getBoundingClientRect();
    const w = document.querySelector('.wrap').getBoundingClientRect();
    return { viewer: Math.round(v.width), wrap: Math.round(w.width), vh: Math.round(v.height) };
  });
  console.log(`layout: viewer ${layout.viewer}px wide (wrap ${layout.wrap}px, ${layout.vh}px tall)`);
  if (layout.viewer < layout.wrap - 80) failures.push(`viewer not full content width (${layout.viewer} vs wrap ${layout.wrap})`);

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

  // lightbox: click the photograph -> overlay opens with the image; Esc closes; click closes
  await page.click('img[src="king2-both-photo.png"]');
  await page.waitForTimeout(400);
  const lb1 = await page.evaluate(() => {
    const lb = document.getElementById('lightbox');
    const img = lb.querySelector('img');
    const r = lb.getBoundingClientRect();
    return {
      open: lb.classList.contains('open'),
      visible: getComputedStyle(lb).display !== 'none',
      src: img.getAttribute('src') || '',
      full: r.width >= window.innerWidth - 2 && r.height >= window.innerHeight - 2
    };
  });
  if (!lb1.open || !lb1.visible) failures.push('lightbox did not open on photograph click');
  if (!/king2-both-photo/.test(lb1.src)) failures.push(`lightbox src is "${lb1.src}", expected the photograph`);
  if (!lb1.full) failures.push('lightbox overlay is not full-screen');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const lbEsc = await page.evaluate(() => document.getElementById('lightbox').classList.contains('open'));
  if (lbEsc) failures.push('Esc did not close the lightbox');
  // reopen via a mesh thumb, close by clicking the overlay
  await page.click('img[src="king2-tripo.meshthumb.jpg"]');
  await page.waitForTimeout(300);
  const lb2open = await page.evaluate(() => document.getElementById('lightbox').classList.contains('open'));
  if (!lb2open) failures.push('lightbox did not open on mesh-thumb click');
  await page.mouse.click(40, 40);
  await page.waitForTimeout(300);
  const lb2closed = await page.evaluate(() => !document.getElementById('lightbox').classList.contains('open'));
  if (!lb2closed) failures.push('overlay click did not close the lightbox');
  console.log('lightbox: open/Esc-close/reopen/click-close OK');

  await page.screenshot({ path: shot, fullPage: true });
  console.log('screenshot: ' + shot);

  // face close-up: drive the viewer camera to the head via the page hook
  if (faceShot) {
    const moved = await page.evaluate(() => {
      const v = window.__viewer;
      if (!v) return false;
      v.controls.autoRotate = false;
      v.controls.minDistance = 0.05;
      v.controls.target.set(0, 1.68, 0);            /* head height on a 1.9-unit figure */
      v.camera.position.set(0.74, 1.70, 0.74);      /* azimuth 45° — the model's frontal axis */
      v.controls.update();
      return true;
    });
    if (!moved) failures.push('face close-up: window.__viewer hook missing');
    await page.waitForTimeout(1200);                 /* let damping settle + frames render */
    const viewer = await page.locator('#viewer');
    await viewer.screenshot({ path: faceShot });
    console.log('face shot: ' + faceShot);
  }
} catch (e) {
  failures.push('exception: ' + e.message);
}

// audio play rejection in headless is tolerated; it is caught in-page and never reaches console
for (const err of consoleErrors) failures.push('console error: ' + err);

await browser.close();
console.log(failures.length ? 'FAILURES:\n' + failures.map(f => ' - ' + f).join('\n') : 'ALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
