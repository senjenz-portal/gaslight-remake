/**
 * determinism.mjs — the claim "sim time drives the picture" is only worth
 * making if two laps that step the same numbers paint the same pixels. This
 * loads the page twice, drives both to the same sim times, and diffs the PNGs
 * byte for byte. A wall-clock leak anywhere in the stack shows up here as a
 * frame that will not reproduce.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = path.join(ROOT, 'site-deploy', 'living');
const PORT = 8810;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const srv = createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(SITE, u === '/' ? 'index.html' : u);
    const b = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => srv.listen(PORT, r));

const MARKS = [['head', 1.7], ['hold', 0.9], ['hadnote', 0.7], ['condescend', 1.1],
               ['both', 1.3], ['briony', 0.9]];

async function run(br) {
  const pg = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await pg.goto(`http://127.0.0.1:${PORT}/?harness=1`);
  await pg.waitForFunction(() => window.__ready === true);
  await pg.evaluate(() => window.__mute(true));
  const out = [];
  for (const [key, dt] of MARKS) {
    await pg.evaluate((k) => window.__gotoUnit(k), key);
    await pg.evaluate((d) => window.__advance(d), dt);
    await pg.evaluate(() => window.__renderNow());
    const buf = await pg.screenshot();
    out.push({ key, sha: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) });
  }
  await pg.close();
  return out;
}

const br = await chromium.launch();
const a = await run(br);
const b = await run(br);
await br.close();
srv.close();
const diff = a.filter((x, i) => x.sha !== b[i].sha);
for (let i = 0; i < a.length; i++) {
  console.log(`${a[i].key.padEnd(12)} ${a[i].sha}  ${a[i].sha === b[i].sha ? 'same' : 'DIFFERS ' + b[i].sha}`);
}
console.log(diff.length ? `NOT DETERMINISTIC (${diff.length}/${a.length})` : `DETERMINISTIC (${a.length}/${a.length} frames identical across two loads)`);
process.exit(diff.length ? 1 : 0);
