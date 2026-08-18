/* _nomanseed.mjs — seed PROTOTYPE A (painted dialogue shot) from the REAL
 * stage: jump to unit 'noman' (ody-iii-11-noman, the "my name is Noman"
 * exchange on the twoshot lens), let the walk/settle laws finish (dwell
 * 3.5s+ before reading standing sprites — round-4 law), screenshot the
 * panel's own 16:9 lens window (the current k-pushed crop the reader sees:
 * real actors at their marks on cave-shut, lighting and register baked).
 * Device-px PNG -> /tmp/ody-shots/seed-noman.png + seed JSON (plateRect
 * through the live mapping, actor boxes for the gate tool).
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';

const SITE = '/Users/samz/Documents/gaslight-remake/site-deploy/living-odyssey';
const OUT = '/tmp/ody-shots';
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
await new Promise((ok) => srv.listen(8823, ok));

const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://127.0.0.1:8823/?harness=1');
await pg.waitForFunction(() => window.__ready);
await pg.evaluate(() => window.__mute(true));

await pg.evaluate(async () => { await window.__gotoUnit('noman'); });
await pg.evaluate(() => window.__advance(4.0));   // settle law: 3.5s+ dwell
await pg.evaluate(() => window.__renderNow());
const q = await pg.evaluate(() => window.__state());
console.log('[noman] unit', q.unit && q.unit.key, 'cam', JSON.stringify(q.stage && q.stage.cam));
console.log('[noman] stage keys', JSON.stringify(Object.keys(q.stage || {})));
for (const k of ['giant', 'ulysses', 'hero', 'actors'])
  if (q.stage && q.stage[k]) console.log('[noman]', k, JSON.stringify(q.stage[k]).slice(0, 400));

/* the unit's own lens frame: the panel's central 16:9 window */
const clip = await pg.evaluate(() => {
  const st = window.__refs.stage;
  const r = st.root.getBoundingClientRect();
  const W16 = r.height * 16 / 9;
  return { x: r.left + (r.width - W16) / 2, y: r.top, width: W16, height: r.height };
});
await pg.screenshot({ path: path.join(OUT, 'seed-noman.png'), clip });
const plateRect = await pg.evaluate((r) => {
  const st = window.__refs.stage;
  const a = st.toPlate(r.x, r.y), b = st.toPlate(r.x + r.width, r.y + r.height);
  return [a.x, a.y, b.x - a.x, b.y - a.y];
}, clip);
fs.writeFileSync(path.join(OUT, 'seed-noman.json'), JSON.stringify({
  unit: 'ody-iii-11-noman', lens: 'twoshot (unit focus, applyCam-clamped)',
  cssClip: clip, plateRect, state: q.stage, viewport: '1440x900 @dsf2',
}, null, 1));
console.log('[seed] css', JSON.stringify(clip), 'plateRect',
  JSON.stringify(plateRect.map((v) => +v.toFixed(1))));
await br.close();
srv.close();
