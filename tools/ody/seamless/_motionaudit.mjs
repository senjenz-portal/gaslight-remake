/* MOTION-CONTINUITY AUDIT — continuous 30 fps recording of every key
 * crossing/walk, per the _motionprobe.mjs pattern (harness __advance).
 * Per frame: actor screen positions read off the RENDERED boxes
 * (getBoundingClientRect -> toPlate, transforms included, so bob shows)
 * plus the pose marks and strip frames. NDJSON per run in /tmp/motion/. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs'; import path from 'node:path';
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
function serve(dir,port){const s=createServer(async(q,r)=>{try{const u=decodeURIComponent(q.url.split('?')[0]);const b=await readFile(path.join(dir,u==='/'?'index.html':u));r.writeHead(200,{'content-type':MIME[path.extname(u==='/'?'index.html':u)]||'application/octet-stream','cache-control':'no-store'});r.end(b);}catch(e){r.writeHead(404).end('');}});return new Promise(ok=>s.listen(port,()=>ok(s)));}

/* Action scripts, reader-faithful where a jump would contaminate the walk:
 * a __gotoUnit replay resets pose opacities, so a staging walk that a real
 * reader gets (op 1 at the old marks) degenerates to land-on-mark + fade.
 * For those, jump EARLIER and __click forward like a reader.
 * NO __renderNow: it is a dt=0 step that zeroes the stride speed and
 * repaints walkers as standing cuts — __advance has already painted. */
const RUNS = [
  ['shore-landfall',   [['goto','bard'],                    ['rec', 9.0]]],
  ['shore-hunt',       [['goto','dawn1'],                   ['rec',10.0]]],
  // camp settled -> click dawn1 (hunt runs) -> click smoke: the LIVE council walk
  ['shore-council',    [['goto','lawless'],['adv',1.0],['click'],['adv',7.0],
                        ['click'],                          ['rec',11.0]]],
  // continue as the reader: smoke -> council gate -> the dash aboard + strait
  ['shore-crossing',   [['click'],['gate'],                 ['rec', 9.0]]],
  ['cave-entry',       [['goto','head2'],                   ['rec', 6.0]]],
  ['cave-giant-entry', [['goto','return2'],                 ['rec', 8.0]]],
  ['cave-flock-out',   [['goto','quiverlid'],               ['rec', 6.5]]],
  ['cave-flock-in',    [['goto','return3'],                 ['rec', 7.0]]],
  ['cave-ram-stream',  [['goto','dawn5'],                   ['rec',15.0]]],
  ['cave-free-men',    [['goto','freed'],                   ['rec', 7.0]]],
];
const FPS = 30, DT = 1 / FPS;

fs.mkdirSync('/tmp/motion', {recursive:true});
const srv = await serve('/Users/samz/Documents/gaslight-remake/site-deploy/living-odyssey', 8874);
const br = await chromium.launch();
const pg = await br.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
pg.on('pageerror', (e)=>console.log('PAGEERROR', e.message));
await pg.goto('http://127.0.0.1:8874/?harness=1',{waitUntil:'load'});
await pg.waitForFunction(()=>window.__ready===true,{timeout:30000});
await pg.evaluate(()=>window.__mute(true));

/* the collector: rendered boxes (transform-applied) + marks + strip frames */
await pg.evaluate(() => {
  const st = window.__refs.stage;
  /* rendered box in plate px; fx/fy = bottom-centre (the feet), ty = top */
  const pb = (node) => {
    if (!node) return null;
    const op = +(node.style.opacity === '' ? 1 : parseFloat(node.style.opacity));
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const a = st.toPlate(r.left, r.top), b = st.toPlate(r.right, r.bottom);
    return { op: +op.toFixed(3), fx: +((a.x + b.x) / 2).toFixed(2),
             fy: +b.y.toFixed(2), ty: +a.y.toFixed(2), w: +(b.x - a.x).toFixed(2) };
  };
  window.__collect = () => {
    const S = window.__state();
    const act = st.active;
    const rec = { t: S.wall, set: st.activeName,
                  cam: S.stage.cam, seg: S.stage.seg || null };
    if (st.activeName === 'shore') {
      const U = act.pose.u;
      rec.u = { mark: [+U.x.toFixed(2), +U.y.toFixed(2)], op: +U.op.toFixed(3),
                walking: !!U.walking, frame: U.frame || 0,
                stand: pb(act.ulysses), strip: pb(act.uStripN) };
      rec.crew = [];
      for (let i = 0; i < 12; i++) {
        const P = act.pose['c' + i];
        rec.crew.push({ mark: [+P.x.toFixed(2), +P.y.toFixed(2)], op: +P.op.toFixed(3),
                        walking: !!P.walking, running: !!P.running, frame: P.frame || 0,
                        stand: pb(act.crew[i]), strip: pb(act.crewStripN[i]),
                        run: i < 3 ? pb(act.runStripN[i]) : null });
      }
      rec.crossing = S.stage.crossing;
    } else if (st.activeName === 'cave') {
      const G = act.state.giant;
      rec.giant = { pose: G.pose, mark: [+G.x.toFixed(2), +G.y.toFixed(2)],
                    walking: !!(G.walk && G.pose === 'stand'), frame: G.frame || 0,
                    strip: pb(act.giantStripN),
                    stand: pb(act.giantN.stand), seat: pb(act.giantN.seat) };
      const U = act.pose.u;
      rec.u = { mark: [+U.x.toFixed(2), +U.y.toFixed(2)], op: +U.op.toFixed(3),
                walking: !!U.walking, frame: U.frame || 0 };
      rec.crew = [];
      for (let i = 0; i < 12; i++) {
        const P = act.pose['c' + i];
        rec.crew.push({ mark: [+P.x.toFixed(2), +P.y.toFixed(2)], op: +P.op.toFixed(3),
                        walking: !!P.walking, striding: !!P.striding, frame: P.frame || 0,
                        stand: pb(act.crew[i]), strip: pb(act.crewStripN[i]) });
      }
      rec.rams = act.rams.map((n, i) => {
        const g = act.ramGait[i];
        return { at: g.at ? g.at.map(v => +v.toFixed(2)) : null,
                 dist: +(+g.dist).toFixed(2), frame: g.frame || 0, box: pb(n) };
      });
      rec.pairs = act.pairs.map(n => pb(n));
      rec.great = { at: act.state.ramAt ? act.state.ramAt.map(v => +v.toFixed(2)) : null,
                    box: pb(act.ramGreatN), slung: pb(act.ramSlungN) };
      rec.flock = S.stage.flock;
    }
    return rec;
  };
});

for (const [id, steps] of RUNS) {
  let ok = true;
  const frames = [];
  for (const [op, arg] of steps) {
    if (op === 'goto') {
      const landed = await pg.evaluate(async (u) => await window.__gotoUnit(u), arg);
      if (!landed) { console.log(id, 'NOT FOUND', arg); ok = false; break; }
    } else if (op === 'adv') {
      await pg.evaluate((s) => window.__advance(s), arg);
    } else if (op === 'click') {
      const u = await pg.evaluate(() => window.__click());
      console.log(id, 'clicked ->', u && u.key);
    } else if (op === 'gate') {
      const g = await pg.evaluate(() => window.__gateClick());
      if (!g.ok) { console.log(id, 'GATE DID NOT FIRE', g); ok = false; break; }
    } else if (op === 'rec') {
      const n = Math.round(arg * FPS);
      for (let f = 0; f < n; f++) {
        const rec = await pg.evaluate((dt) => {
          window.__advance(dt); return window.__collect();
        }, DT);
        rec.f = frames.length;
        frames.push(JSON.stringify(rec));
      }
    }
  }
  if (!ok || !frames.length) continue;
  fs.writeFileSync(`/tmp/motion/${id}.ndjson`, frames.join('\n') + '\n');
  console.log(id, 'recorded', frames.length, 'frames');
}
await br.close(); srv.close();
