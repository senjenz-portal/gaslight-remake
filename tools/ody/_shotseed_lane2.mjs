/* _shotseed_lane2.mjs — SHOTGEN lane 2 seeds, the PROVEN _nomanseed.mjs
 * recipe verbatim, looped over the four even-only-row plates
 * (SHOTS.md §2a; lane 1 owns every plate with an odd row):
 *   wineskin (shore, ship-mid 8.6)  · scheme (cave, scheme-push 3.2)
 *   greatram (cave, ram-close 3.2)  · menbeg (sea, menbeg-close 14.1)
 * Jump to the unit on the REAL stage, let the walk/settle laws finish
 * (3.5s+ dwell — round-4 law), screenshot the panel's own 16:9 lens window
 * (the k-pushed crop the reader sees: real actors at marks, regrade baked).
 * Device-px PNG -> /tmp/ody-shots-l2/seed-<key>.png + seed JSON.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';

const SITE = '/Users/samz/Documents/gaslight-remake/site-deploy/living-odyssey';
const OUT = '/tmp/ody-shots-l2';
const UNITS = ['wineskin', 'scheme', 'greatram', 'menbeg'];
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const srv = createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(SITE, u === '/' ? 'index.html' : u);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch (e) { res.writeHead(404).end(); }
});
await new Promise((ok) => srv.listen(8824, ok));   // lane 1 may hold 8823

const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://127.0.0.1:8824/?harness=1');
await pg.waitForFunction(() => window.__ready);
await pg.evaluate(() => window.__mute(true));

for (const key of UNITS) {
  await pg.evaluate(async (k) => { await window.__gotoUnit(k); }, key);
  await pg.evaluate(() => window.__advance(4.0));   // settle law: 3.5s+ dwell
  await pg.evaluate(() => window.__renderNow());
  const q = await pg.evaluate(() => window.__state());
  console.log(`[${key}] unit`, q.unit && q.unit.key, 'cam',
    JSON.stringify(q.stage && q.stage.cam));
  const clip = await pg.evaluate(() => {
    const st = window.__refs.stage;
    const r = st.root.getBoundingClientRect();
    const W16 = r.height * 16 / 9;
    return { x: r.left + (r.width - W16) / 2, y: r.top, width: W16, height: r.height };
  });
  await pg.screenshot({ path: path.join(OUT, `seed-${key}.png`), clip });
  const plateRect = await pg.evaluate((r) => {
    const st = window.__refs.stage;
    const a = st.toPlate(r.x, r.y), b = st.toPlate(r.x + r.width, r.y + r.height);
    return [a.x, a.y, b.x - a.x, b.y - a.y];
  }, clip);
  fs.writeFileSync(path.join(OUT, `seed-${key}.json`), JSON.stringify({
    unit: q.unit && q.unit.id, lens: q.unit && q.unit.focus,
    cssClip: clip, plateRect, cam: q.stage && q.stage.cam,
    viewport: '1440x900 @dsf2',
  }, null, 1));
  console.log(`[seed:${key}] plateRect`,
    JSON.stringify(plateRect.map((v) => +v.toFixed(1))));
}
await br.close();
srv.close();
