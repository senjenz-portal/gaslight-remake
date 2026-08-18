/* _shotseed.mjs — SHOTGEN lane seeds, the _nomanseed.mjs pattern generalized.
 * For each <unitKey>:<shotName> arg: jump to the unit on the REAL stage
 * (__gotoUnit replays the leaf's acts), let the walk/settle laws finish
 * (dwell 4.0 s — round-4 law: 3.5s+ before reading standing sprites),
 * screenshot the panel's own 16:9 lens window (the current k-pushed crop the
 * reader sees: real actors at their marks, lighting and register baked).
 * Device-px PNG -> /tmp/ody-shots/seed-<shot>.png + seed JSON (plateRect
 * through the live mapping + cam + unit, for the gate tool).
 * Run: node tools/ody/_shotseed.mjs council:shot-council sword:shot-sword ...
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
await new Promise((ok) => srv.listen(8824, ok));

const jobs = process.argv.slice(2).map((a) => {
  const [unit, shot] = a.split(':');
  return { unit, shot };
});
const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://127.0.0.1:8824/?harness=1');
await pg.waitForFunction(() => window.__ready);
await pg.evaluate(() => window.__mute(true));
/* the seed is the WORLD, not the chrome: the gate ring, hold ring and the
 * leader hairline are reader UI — hide them for the tableau (prototype A's
 * prompt had to say "remove the thin stray diagonal line"; this removes the
 * class at the source instead). */
await pg.addStyleTag({ content:
  '#target,#leader,#hold,#cue,.ring,.ring2{display:none !important;' +
  'opacity:0 !important;}' });

for (const { unit, shot } of jobs) {
  await pg.evaluate(async (u) => { await window.__gotoUnit(u); }, unit);
  await pg.evaluate(() => window.__advance(4.0));   // settle law: 3.5s+ dwell
  await pg.evaluate(() => window.__renderNow());
  const q = await pg.evaluate(() => window.__state());
  const clip = await pg.evaluate(() => {
    const st = window.__refs.stage;
    const r = st.root.getBoundingClientRect();
    const W16 = r.height * 16 / 9;
    return { x: r.left + (r.width - W16) / 2, y: r.top, width: W16, height: r.height };
  });
  await pg.screenshot({ path: path.join(OUT, `seed-${shot}.png`), clip });
  const plateRect = await pg.evaluate((r) => {
    const st = window.__refs.stage;
    const a = st.toPlate(r.x, r.y), b = st.toPlate(r.x + r.width, r.y + r.height);
    return [a.x, a.y, b.x - a.x, b.y - a.y];
  }, clip);
  fs.writeFileSync(path.join(OUT, `seed-${shot}.json`), JSON.stringify({
    unit, shot, lens: q.unit && q.unit.focus,
    cam: q.stage && q.stage.cam, cssClip: clip, plateRect,
    viewport: '1440x900 @dsf2',
  }, null, 1));
  console.log(`[seed] ${shot} <- ${unit}`,
    'cam', JSON.stringify(q.stage && q.stage.cam),
    'plateRect', JSON.stringify(plateRect.map((v) => +v.toFixed(1))));
}
await br.close();
srv.close();
