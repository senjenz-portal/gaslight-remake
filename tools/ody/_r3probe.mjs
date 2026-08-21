/**
 * _r3probe.mjs — the round-5 bench: boot the 3D book, walk a list of units,
 * screenshot each and dump the colour-continuity evidence (the ONE scene tint
 * per set-state, every live actor's scalar seat, contact kind, and the light
 * rig's numbers). No gates here — this is the fast eye loop.
 *
 *   node tools/ody/_r3probe.mjs [outdir] [unit,unit,...]
 */
import http from 'node:http';
import { mkdir } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ARGS = process.argv.slice(2);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.join(REPO, 'site-deploy');
const OUT = path.join(REPO, 'shots', ARGS[0] || 'r3probe');
const UNITS = (ARGS[1] || 'ody-ii-05-strangers,ody-iii-08-lookhere,ody-iv-03-auger,ody-v-05-dawn')
  .split(',');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(ROOT, url);
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 940 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
page.on('pageerror', (e) => console.log('PAGEERR', String(e)));
await page.goto(`${ORIGIN}/living-odyssey/3d/?harness=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
await page.evaluate('window.__mute(true)');
await page.evaluate('window.__ensureAll()');

for (const key of UNITS) {
  const ok = await page.evaluate(async (k) => {
    if (!window.__unitByKey || !window.__unitByKey(k)) return false;
    await window.__gotoUnit(k); return true;
  }, key).catch((e) => { console.log('GOTOERR', key, String(e)); return false; });
  if (!ok) { console.log('MISSING', key); continue; }
  await page.evaluate('window.__advance(9.0)');
  await page.locator('#stage3d').screenshot({ path: path.join(OUT, `${key}.png`) });
  const ev = await page.evaluate(() => ({
    tint: window.__plate.tint(), grade: window.__plate.actorGrade(),
    light: window.__refs.stage.lightSample,
    lens: window.__refs.stage.lens ? window.__refs.stage.lens.name : null,
  }));
  console.log(`\n=== ${key} lens=${ev.lens} ===`);
  console.log('tint', JSON.stringify(ev.tint));
  console.log('grade', JSON.stringify(ev.grade));
  console.log('light', JSON.stringify(ev.light && { split: ev.light.split, key: ev.light.key,
    cool: ev.light.cool, lum: ev.light.lum, fireLum: ev.light.fireLum }));
}
console.log('\nappErrors', JSON.stringify(await page.evaluate('window.__errors()')));
await browser.close();
server.close();
