/**
 * _stationsheet.mjs — CHOOSE A STATION BY LOOKING THROUGH IT.
 *
 * The volume test says the lens is not in rock and the sight-line test says the
 * furniture is not in the way, and both can pass on a frame that is a flat wall
 * of cave floor: the cave is a BOWL, so "floor level" at the downstage rim is
 * under the ground. The honest instrument is the picture. This seeks a unit,
 * plants the camera at each candidate station in turn, renders, and writes the
 * frames to a contact sheet — plus the floor height under each station, taken
 * by raycasting the set's own geometry.
 *
 *   node tools/ody/_stationsheet.mjs <unit> <candidates.json>
 */
import http from 'node:http';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.join(REPO, 'site-deploy');
const OUT = path.join(REPO, 'tools', 'ody', 'work', 'stationsheet');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(r);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const CAND = JSON.parse(await readFile(process.argv[3], 'utf8'));
const br = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=metal', '--mute-audio'] });
const pg = await br.newPage({ viewport: { width: 1500, height: 1100 } });
pg.on('pageerror', (e) => console.log('ERR', e.message));
await pg.goto(`${BASE}/living-odyssey/3d/?harness=1`, { waitUntil: 'load' });
await pg.waitForFunction('window.__sceneReady === true', null, { timeout: 120000 });
await pg.evaluate(() => document.documentElement.classList.add('noverlay'));

for (const group of CAND) {
  await pg.evaluate(async ({ unit, hold }) => { await window.__book.seek(unit); window.__book.run(hold || 1.6); },
    { unit: group.unit, hold: group.hold });
  const clip = await pg.evaluate(() => {
    const b = document.getElementById('stage3d').getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) };
  });
  for (const c of group.stations) {
    const info = await pg.evaluate(({ pos, look, fov }) => {
      const S = window.__book.stage, cam = S.camera;
      cam.position.set(pos[0], pos[1], pos[2]);
      cam.lookAt(look[0], look[1], look[2]);
      if (fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
      S.render();
      /* the ground under the lens, off the set's own geometry */
      const THREE = window.__book.stage.THREE || null;
      let floorY = null;
      try {
        const rc = new (window.__THREE || {}).Raycaster ? new window.__THREE.Raycaster() : null;
        if (rc) {
          rc.set({ x: pos[0], y: 40, z: pos[2] }, { x: 0, y: -1, z: 0 });
          const hits = rc.intersectObject(S.scene, true).filter((h) => h.object.visible);
          if (hits.length) floorY = +hits[0].point.y.toFixed(3);
        }
      } catch (e) { void e; }
      void THREE;
      return { floorY, camY: cam.position.y };
    }, c);
    await pg.screenshot({ path: path.join(OUT, `${group.unit}-${c.name}.png`), clip });
    console.log(group.unit, c.name, JSON.stringify({ ...c, ...info }));
  }
}
await br.close(); server.close();
console.log('sheet at', OUT);
