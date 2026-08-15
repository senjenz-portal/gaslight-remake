/**
 * minilap.mjs — ONE BEAT, played the reader's way, shot unit by unit.
 *
 * The full lap is 95 units and two minutes; a staging fix needs the four frames
 * it changed, now, and it needs them taken the way the reader takes them —
 * entering the leaf and then clicking, so every gateAct fires (`__gotoUnit`
 * replays `act` but not `gateAct`, which is how the shipped portrait proof came
 * to hold two Nortons).
 *
 * So: jump ONCE to the first unit named, then walk forward with the reader's
 * own verbs. Every unit gets a screenshot and the SET's own snapshot.
 *
 *   node tools/living/minilap.mjs --from hansom --to twentyfive \
 *        --shots shots/rigfix --tag before
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = path.join(ROOT, 'site-deploy', 'living');
const args = process.argv.slice(2);
const argv = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FROM = argv('--from', 'hansom');
const TO = argv('--to', FROM);
const SHOTS = path.resolve(argv('--shots', path.join(ROOT, 'shots', 'minilap')));
const TAG = argv('--tag', '');
const PORT = +argv('--port', 8817);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const srv = createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(SITE, u === '/' ? 'index.html' : u);
    const b = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream',
                         'cache-control': 'no-store' });
    res.end(b);
  } catch (e) { res.writeHead(404).end(); }
});
await new Promise((r) => srv.listen(PORT, r));

fs.mkdirSync(SHOTS, { recursive: true });
const br = await chromium.launch();
const page = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
await page.goto(`http://127.0.0.1:${PORT}/?harness=1`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__ready === true, { timeout: 60000 });
await page.evaluate(() => window.__mute(true));

const T = (dt) => page.evaluate((d) => window.__advance(d), dt);
const st = () => page.evaluate(() => window.__state());
const shot = async (name) => {
  await page.evaluate(() => window.__renderNow());
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
};

const units = await page.evaluate(() => window.__units());
const iFrom = units.findIndex((u) => u.key === FROM);
const iTo = units.findIndex((u) => u.key === TO);
if (iFrom < 0 || iTo < 0) { console.error('unknown unit key'); process.exit(2); }

await page.evaluate((k) => window.__gotoUnit(k), FROM);
await T(1.0);

const out = [];
for (let i = iFrom; i <= iTo; i++) {
  const u = (await st()).unit;
  // the camera damps in; a segment has to be allowed to play its middle
  await T(u.seg ? 3.0 : 1.5);
  const name = `${TAG ? TAG + '-' : ''}${String(i).padStart(2, '0')}-${u.key}`;
  await shot(name);
  out.push({ i, key: u.key, focus: u.focus, verb: u.verb, target: u.target || null,
             snap: (await st()).stage });
  /* a `wait` unit's whole point is what happens AFTER its first frame, so it
     gets a second shot at the far end of the thing it is waiting for */
  if (u.seg) { await T(3.6); await shot(name + '-settled'); }
  if (u.wait === 'roll') { await T(8.6); await shot(name + '-settled'); }
  if (u.wait === 'ring' || u.wait === 'sovereign') {
    await T(5.0); await shot(name + '-settled');
  }
  if (i === iTo) break;
  const r = u.verb === 'target'
    ? await page.evaluate(() => window.__gateClick())
    : await page.evaluate(() => window.__click());
  if (u.verb === 'target' && !r.ok) console.error('GATE FAILED', u.key, JSON.stringify(r));
  await T(0.4);
}
fs.writeFileSync(path.join(SHOTS, `${TAG || 'minilap'}.json`),
                 JSON.stringify({ from: FROM, to: TO, errors: errs, units: out }, null, 1));
console.log(JSON.stringify({ shots: SHOTS, units: out.length, errors: errs.slice(0, 6) }));
await br.close();
srv.close();
process.exit(0);
