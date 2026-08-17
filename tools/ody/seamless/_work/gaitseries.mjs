/* gait series diagnostic — record mark-velocity series for the problem walks */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
function serve(dir, port) {
  const s = createServer(async (q, r) => {
    try {
      const u = decodeURIComponent(q.url.split('?')[0]);
      const b = await readFile(path.join(dir, u === '/' ? 'index.html' : u));
      r.writeHead(200, { 'content-type': MIME[path.extname(u === '/' ? 'index.html' : u)] || 'application/octet-stream', 'cache-control': 'no-store' });
      r.end(b);
    } catch (e) { r.writeHead(404).end(''); }
  });
  return new Promise((ok) => s.listen(port, () => ok(s)));
}
const RUNS = [
  ['bard', 'u', 9.0],
  ['dawn1', 'c0', 8.0],
  ['head2', 'c11', 6.0],
  ['return3', 'g', 8.0],
  ['dawn5', 'ram0', 15.0],
  ['freed', 'gram', 5.0],
];
const srv = await serve('/Users/samz/Documents/gaslight-remake/site-deploy/living-odyssey', 8875);
const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1440, height: 900 } });
pg.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await pg.goto('http://127.0.0.1:8875/?harness=1', { waitUntil: 'load' });
await pg.waitForFunction(() => window.__ready === true, { timeout: 30000 });
await pg.evaluate(() => window.__mute(true));
for (const [unit, id, secs] of RUNS) {
  const landed = await pg.evaluate(async (u) => await window.__gotoUnit(u), unit);
  if (!landed) { console.log(unit, 'NOT FOUND'); continue; }
  const pts = await pg.evaluate(({ n, id }) => {
    const a = window.__refs.stage.active;
    const pick = () => {
      let p = null;
      if (id === 'u') { const P = a.pose && a.pose.u; p = P && [P.x, P.y]; }
      else if (id === 'g') { const G = a.state && a.state.giant; p = G && [G.x, G.y]; }
      else if (id === 'gram') { const r = a.state && a.state.ramAt; p = r && [r[0], r[1]]; }
      else if (/^ram\d/.test(id)) { const g = a.ramGait && a.ramGait[+id.slice(3)]; p = g && g.at && [g.at[0], g.at[1]]; }
      else { const P = a.pose && a.pose[id]; p = P && [P.x, P.y]; }
      return p ? [+p[0].toFixed(3), +p[1].toFixed(3)] : null;
    };
    const out = [];
    for (let i = 0; i < n; i++) {
      window.__advance(1 / 60); window.__advance(1 / 60);
      out.push(pick());
    }
    return out;
  }, { n: Math.round(secs * 30), id });
  const v = [];
  for (let i = 1; i < pts.length; i++) {
    const A = pts[i - 1], B = pts[i];
    v.push(A && B ? +(Math.hypot(B[0] - A[0], B[1] - A[1]) * 30).toFixed(1) : null);
  }
  console.log(`\n=== ${unit}:${id} ===`);
  for (let i = 0; i < v.length; i += 15) {
    console.log((i / 30).toFixed(1) + 's', JSON.stringify(v.slice(i, i + 15)));
  }
}
await br.close(); srv.close();
