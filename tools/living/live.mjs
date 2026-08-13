/**
 * live.mjs — two things the scripted lap cannot check.
 *
 * 1. THE LIVE PATH. The lap drives the sim through __setTime with ?harness=1,
 *    which is exactly the code path a reader never takes. This loads the page
 *    with no flags and reads it with a real mouse, so the rAF loop, the wall
 *    clock, the CSS transitions and the audio unlock all get exercised.
 * 2. THE TRANSIENTS. The pantomimes live between the units the lap shoots —
 *    the note in flight, the mask in the air, the walk mid-stride. Those are
 *    caught by stepping the sim to a fraction of a second after the act.
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
const SHOTS = path.join(ROOT, 'shots', 'living');
const PORT = 8809;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };

const srv = createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(SITE, u === '/' ? 'index.html' : u);
    const b = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(b);
  } catch (e) { res.writeHead(404).end(); }
});
await new Promise((r) => srv.listen(PORT, r));

const fails = [];
const br = await chromium.launch();

/* ---- 1. the live path, with a real mouse -------------------------------- */
{
  const pg = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errs = [];
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await pg.goto(`http://127.0.0.1:${PORT}/`);            // NO harness flag
  await pg.waitForFunction(() => window.__ready === true, { timeout: 30000 });
  const before = await pg.evaluate(() => window.__state());
  if (before.harness) fails.push('the live page came up in harness mode');
  await pg.waitForTimeout(3400);                         // unit 0 is auto/3.0 s
  const auto = await pg.evaluate(() => window.__state());
  if (auto.i !== 1) fails.push(`the auto unit did not advance itself on the rAF clock (i=${auto.i})`);
  if (!(auto.t > 3.0)) fails.push(`the wall clock never reached the sim (t=${auto.t})`);
  for (let i = 0; i < 3; i++) { await pg.mouse.click(1000, 450); await pg.waitForTimeout(260); }
  const after = await pg.evaluate(() => window.__state());
  if (after.i !== 4) fails.push(`three real clicks moved ${auto.i} -> ${after.i}, expected 4`);
  if (typeof window !== 'undefined') { /* node */ }
  const hooksLeaked = await pg.evaluate(() => typeof window.__gotoUnit);
  if (hooksLeaked !== 'undefined') fails.push('mutating harness hooks are exposed without ?harness=1');
  await pg.screenshot({ path: path.join(SHOTS, '41-live-mouse-read.png') });
  if (errs.length) fails.push('live console errors: ' + errs.join(' | '));
  console.log(`live path: t=${after.t.toFixed(2)}s unit=${after.i} errors=${errs.length}`);
  await pg.close();
}

/* ---- 2. the transients -------------------------------------------------- */
{
  const pg = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await pg.goto(`http://127.0.0.1:${PORT}/?harness=1`);
  await pg.waitForFunction(() => window.__ready === true);
  await pg.evaluate(() => window.__mute(true));
  const shot = async (n) => { await pg.evaluate(() => window.__renderNow());
                              await pg.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  const at = async (key, dt, n) => {
    await pg.evaluate((k) => window.__gotoUnit(k), key);
    await pg.evaluate((d) => window.__advance(d), dt);
    await shot(n);
    return pg.evaluate(() => window.__state());
  };
  const toss = await at('post', 0.34, '42-note-in-flight');
  if (!(toss.stage.acts.includes('noteToss'))) fails.push('noteToss never fired');
  await pg.evaluate(() => window.__gotoUnit('condescend'));
  await pg.evaluate(() => window.__advance(0.8));
  await pg.evaluate(() => window.__gateClick());
  await pg.evaluate(() => window.__advance(0.3));
  await shot('43-mask-in-the-air');
  const m = await pg.evaluate(() => window.__state());
  if (m.stage.king.masked) fails.push('the mask gate did not unmask him');
  if (!(m.stage.king.maskFlown > 0.2 && m.stage.king.maskFlown < 0.9)) {
    fails.push(`the mask is not in flight (${m.stage.king.maskFlown})`);
  }
  const ex = await at('briony', 0.9, '44-exit-mid-stride');
  if (ex.stage.king.walking !== 'exit') fails.push(`the exit walk is not running (${ex.stage.king.walking})`);
  const dim = await at('undated', 1.4, '45-dim-under-plate');
  if (!(dim.stage.plate.dim > 0.9)) fails.push(`the world did not dim under the plate (${dim.stage.plate.dim})`);
  console.log(`transients: toss/mask/exit/dim captured`);
  await pg.close();
}

await br.close();
srv.close();
console.log(fails.length ? 'LIVE FAILED:\n  ' + fails.join('\n  ') : 'LIVE CLEAN');
process.exit(fails.length ? 1 : 0);
