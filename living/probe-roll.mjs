/**
 * probe-roll.mjs — WHY DOES `wait: roll` NEVER RELEASE ON THE LIVE SITE?
 *
 * The live lap failed one functional assertion the local lap passes:
 *   twentyfive: never released from wait:roll
 * and 39 turn-wait complaints. Both smell like the same thing — S.stall, the
 * seconds subtracted out of story time while a leaf's bytes are in flight.
 * Localhost stalls ~0 s; the real wire stalls seconds. So this probe reads the
 * two clocks (story `t`, `wall`, and `stall`) either side of the roll and
 * reports what the roll is actually measuring against.
 *
 * Usage: node tools/living/probe-roll.mjs [--base URL]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = path.join(ROOT, 'site-deploy', 'living');
const args = process.argv.slice(2);
const argv = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = argv('--base', null);
const PORT = +argv('--port', 8823);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };

function serve(dir, port) {
  const srv = createServer(async (req, res) => {
    try {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const p = path.join(dir, u === '/' ? 'index.html' : u);
      if (!p.startsWith(dir)) { res.writeHead(403).end(); return; }
      const body = await readFile(p);
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream',
                           'cache-control': 'no-store' });
      res.end(body);
    } catch (e) { res.writeHead(404).end(String(e.message)); }
  });
  return new Promise((ok) => srv.listen(port, () => ok(srv)));
}

const srv = BASE ? { close() {} } : await serve(SITE, PORT);
const URL_ = (BASE ? BASE.replace(/\/$/, '') : `http://127.0.0.1:${PORT}`) + '/?harness=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL_, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__ready === true, { timeout: 60000 });
await page.evaluate(() => window.__mute(true));
console.log('reading ' + URL_);

const st = () => page.evaluate(() => {
  const s = window.__state();
  return { i: s.i, key: s.unit && s.unit.key, t: s.t, wall: s.wall, stall: s.stall,
           blocked: s.blocked, set: s.set, stage: s.stage };
});
const T = (dt) => page.evaluate((d) => window.__advance(d), dt);

/* Land on the cab gate the way the lap does, then fire it. */
await page.evaluate(async () => await window.__gotoUnit('toogood'));
await T(0.6);
let s = await st();
console.log(`at ${s.key}: story t=${s.t}  wall=${s.wall}  STALL=${s.stall}  set=${s.set}`);

await page.evaluate(() => window.__gateClick());
await T(0.1);
s = await st();
const rollAt = await page.evaluate(() => window.__state().stage.roll);
console.log(`gate fired. story t=${s.t}  STALL=${s.stall}  chase.S.roll=${rollAt}`);
console.log(`  => the roll's own zero is ${rollAt}, story time is ${s.t}, ` +
            `so k starts at (${s.t} - ${rollAt})/8 = ${((s.t - rollAt) / 8).toFixed(3)}`);

/* walk to twentyfive the way the lap does */
for (const k of ['shabby', 'halfsov', 'twentyfive']) {
  await page.evaluate(async (key) => await window.__gotoUnit(key), k);
  await T(0.85);
}
s = await st();
console.log(`at ${s.key}: blocked=${s.blocked}  story t=${s.t}  STALL=${s.stall}`);

const trace = [];
for (let i = 0; i < 40; i++) {
  await T(0.5);
  const q = await page.evaluate(() => {
    const x = window.__state();
    return { t: x.t, stall: x.stall, i: x.i, blocked: x.blocked,
             rolled: x.stage.rolled, rolling: x.stage.rolling, gapM: x.stage.gapM,
             roll: x.stage.roll };
  });
  trace.push(q);
  if (!q.blocked) break;
}
const last = trace[trace.length - 1];
console.log(`pumped ${trace.length} x 0.5 s of story time.`);
console.log(`  first: t=${trace[0].t} rolled=${trace[0].rolled} gapM=${trace[0].gapM} roll0=${trace[0].roll}`);
console.log(`  last:  t=${last.t} rolled=${last.rolled} gapM=${last.gapM} blocked=${last.blocked}`);
console.log(`  story seconds since the roll's zero: ${(last.t - last.roll).toFixed(3)} (needs 8.0)`);
console.log(last.blocked ? 'STILL BLOCKED — reproduced' : 'released');

await browser.close();
srv.close();
