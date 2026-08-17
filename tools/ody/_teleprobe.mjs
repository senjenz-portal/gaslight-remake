/* Prototype of the lap's [teleport] gate: 1/60-tick full read of the active
 * set's actor group — per visible node: id, frame sig, drawn plate box.
 * Laws: same node + same sig -> centre move <= 3.5 css px/tick (uncovered);
 * a node swap (out+in overlapping pair) needs an active tween/cover. */
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
const RUNS = [['return2', 8.0], ['firstmeal', 7.5], ['neck', 7.5]];
const BREAK = process.argv.includes('--break-tween');
const srv = await serve('/Users/samz/Documents/gaslight-remake/site-deploy/living-odyssey', 8874);
const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await pg.goto('http://127.0.0.1:8874/?harness=1', { waitUntil: 'load' });
await pg.waitForFunction(() => window.__ready === true, { timeout: 30000 });
await pg.evaluate(() => window.__mute(true));
if (BREAK) await pg.evaluate(() => { window.__teleBreak = true; });

for (const [unit, span] of RUNS) {
  const landed = await pg.evaluate(async (u) => await window.__gotoUnit(u), unit);
  if (!landed) { console.log(unit, 'NOT FOUND'); continue; }
  const rows = await pg.evaluate(({ span }) => {
    const sg = window.__refs.stage, S = window.__refs.S;
    const out = [];
    const n = Math.round(span * 60);
    for (let i = 0; i < n; i++) {
      window.__advance(1 / 60);
      const a = sg.active;
      const grp = a && a.actors;
      const row = { css: +sg.F.toFixed(4),
                    tween: !!(a && a.gSwap), cover: !!(S.turn && S.turn.active),
                    veil: a && a.veilK ? +a.veilK : 0, set: sg.activeName, nodes: [] };
      if (grp) {
        for (const nd of grp.children) {
          const cs = getComputedStyle(nd);
          if (+cs.opacity <= 0.05 || cs.display === 'none') continue;
          const cls = nd.className || '';
          if (/\b(occ|emis|prop)\b/.test(cls)) continue;
          const bg = nd.style.backgroundImage || nd.src || '';
          if (/prop-/.test(bg)) continue;
          const r = nd.getBoundingClientRect();
          if (r.width < 3 || r.height < 3) continue;
          if (!nd.__tp) {
            nd.__tp = (window.__tpSeq = (window.__tpSeq || 0) + 1) + ':' +
                      ((bg.match(/([\w-]+)\.(png|jpg)/) || [])[1] || 'node');
          }
          const p = sg.toPlate(r.left, r.top), q = sg.toPlate(r.right, r.bottom);
          row.nodes.push({ id: nd.__tp, sig: nd.style.backgroundPosition || '',
                           b: [+p.x.toFixed(2), +p.y.toFixed(2),
                               +(q.x - p.x).toFixed(2), +(q.y - p.y).toFixed(2)] });
        }
      }
      out.push(row);
    }
    return out;
  }, { span });
  let prev = null, ticks = 0, worst = 0, worstAt = '';
  const viol = [];
  let swaps = 0, tweened = 0;
  rows.forEach((row, ti) => {
    if (prev && prev.set === row.set) {
      ticks++;
      const covered = row.tween || prev.tween || row.cover || row.veil > 0.1;
      const pm = new Map(prev.nodes.map((x) => [x.id, x]));
      const cm = new Map(row.nodes.map((x) => [x.id, x]));
      const outs = prev.nodes.filter((x) => !cm.has(x.id));
      const ins = row.nodes.filter((x) => !pm.has(x.id));
      for (const o of outs) {
        const oc = [o.b[0] + o.b[2] / 2, o.b[1] + o.b[3] / 2];
        const hit = ins.find((x) => {
          const xc = [x.b[0] + x.b[2] / 2, x.b[1] + x.b[3] / 2];
          const overlap = o.b[0] < x.b[0] + x.b[2] && x.b[0] < o.b[0] + o.b[2] &&
                          o.b[1] < x.b[1] + x.b[3] && x.b[1] < o.b[1] + o.b[3];
          return overlap || Math.hypot(xc[0] - oc[0], xc[1] - oc[1]) < 90;
        });
        if (hit) {
          swaps++;
          if (covered) tweened++;
          else viol.push(`t=${(ti / 60).toFixed(2)} BARE SWAP ${o.id} -> ${hit.id}`);
        }
      }
      for (const x of row.nodes) {
        const p = pm.get(x.id);
        if (!p || p.sig !== x.sig || covered) continue;
        const d = Math.hypot((x.b[0] + x.b[2] / 2) - (p.b[0] + p.b[2] / 2),
                             (x.b[1] + x.b[3] / 2) - (p.b[1] + p.b[3] / 2)) * row.css;
        if (d > worst) { worst = d; worstAt = `t=${(ti / 60).toFixed(2)} ${x.id}`; }
        if (d > 3.5) viol.push(`t=${(ti / 60).toFixed(2)} ${x.id} centre ${d.toFixed(1)} css px/tick`);
      }
    }
    prev = row;
  });
  console.log(`==== ${unit}: ${ticks} tick-pairs, swaps ${swaps} (${tweened} covered), ` +
              `worst uncovered ${worst.toFixed(2)} css px (${worstAt}), violations ${viol.length}`);
  for (const v of viol.slice(0, 15)) console.log('   ' + v);
}
await br.close(); srv.close();
