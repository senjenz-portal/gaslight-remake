/* why does the readability gate see a FLAT frame in the cave and the sea, and
   a real one on the shore? asks the canvas itself, three ways. */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.join(REPO, 'site-deploy');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.endsWith('/')) url += 'index.html';
  const f = path.join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const br = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=metal', '--mute-audio'] });
const pg = await br.newPage({ viewport: { width: 1500, height: 1100 } });
pg.on('pageerror', (e) => console.log('ERR', e.message));
await pg.goto(`${BASE}/living-odyssey/3d/?harness=1`, { waitUntil: 'load' });
await pg.waitForFunction('window.__sceneReady === true', null, { timeout: 120000 });

for (const unit of ['ody-i-00-head', 'ody-ii-06-plea', 'ody-iv-05-hiss', 'ody-vi-11-curse']) {
  const out = await pg.evaluate(async (u) => {
    const B = window.__book;
    await B.seek(u); B.run(1.6);
    const cv = B.stage.canvas;
    const stat = (data) => {
      let mn = 1, mx = 0, sum = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const v = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; n++;
      }
      return { min: +mn.toFixed(4), max: +mx.toFixed(4), mean: +(sum / n).toFixed(4), n };
    };
    /* (1) drawImage into a FRESH 2d canvas */
    const c1 = document.createElement('canvas'); c1.width = 160; c1.height = 90;
    const x1 = c1.getContext('2d'); x1.drawImage(cv, 0, 0, 160, 90);
    const a = stat(x1.getImageData(0, 0, 160, 90).data);
    /* (2) the same, but with a render forced in THIS turn first */
    B.stage.render();
    const c2 = document.createElement('canvas'); c2.width = 160; c2.height = 90;
    const x2 = c2.getContext('2d'); x2.drawImage(cv, 0, 0, 160, 90);
    const b = stat(x2.getImageData(0, 0, 160, 90).data);
    /* (3) straight off the GL front buffer */
    const gl = B.stage.renderer.getContext();
    const W = cv.width, H = cv.height;
    const px = new Uint8Array(W * H * 4);
    B.stage.render();
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const c = stat(px);
    return { unit: u, set: document.body.dataset.set, W, H,
             cssW: cv.clientWidth, cssH: cv.clientHeight,
             attrs: B.stage.renderer.getContextAttributes ? B.stage.renderer.getContextAttributes() : null,
             drawImage: a, drawImageAfterRender: b, readPixels: c };
  }, unit);
  console.log(JSON.stringify(out));
  await pg.screenshot({ path: `/tmp/readprobe-${unit}.png`, clip: await pg.evaluate(() => {
    const b = document.getElementById('stage3d').getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) };
  }) });
}
await br.close(); server.close();
