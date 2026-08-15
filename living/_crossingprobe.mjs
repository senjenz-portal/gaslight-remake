/* Reproduce the reader's view of every cart-crosses-a-light moment, densely
 * sampled in time, so a mid-travel occlusion bug can be SEEN instead of
 * modelled. Frames land in /tmp/crossing/<unit>-tNN.NN.png. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs'; import path from 'node:path';
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
function serve(dir,port){const s=createServer(async(q,r)=>{try{const u=decodeURIComponent(q.url.split('?')[0]);const b=await readFile(path.join(dir,u==='/'?'index.html':u));r.writeHead(200,{'content-type':MIME[path.extname(u==='/'?'index.html':u)]||'application/octet-stream','cache-control':'no-store'});r.end(b);}catch(e){r.writeHead(404).end('');}});return new Promise(ok=>s.listen(port,()=>ok(s)));}

// [unitId, seconds to sample, step]
const RUNS = [
  ['landau', 7.0, 0.50],    // the landau up the lane -> NEW park short of lamp3
  ['shotout',7.0, 0.50],    // the dwell on her landau, new lens
  ['shabby', 9.5, 0.50],    // the pursuit; follow's NEW roll end
  ['twentyfive', 9.5, 0.50],// the dwell after the pursuit
];

fs.mkdirSync('/tmp/crossing', {recursive:true});
const srv = await serve('/Users/samz/Documents/gaslight-remake/site-deploy/living', 8873);
const br = await chromium.launch();
const pg = await br.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
await pg.goto('http://127.0.0.1:8873/?harness=1',{waitUntil:'load'});
await pg.waitForFunction(()=>window.__ready===true,{timeout:30000});
await pg.evaluate(()=>window.__mute(true));
for (const [unit, span, dt] of RUNS) {
  const landed = await pg.evaluate(async(u)=>await window.__gotoUnit(u), unit);
  if (!landed) { console.log(unit, 'NOT FOUND'); continue; }
  for (let t = 0; t <= span + 1e-9; t += dt) {
    await pg.evaluate((d)=>window.__advance(d), dt);
    await pg.evaluate(()=>window.__renderNow());
    await pg.screenshot({path:`/tmp/crossing/${unit}-t${t.toFixed(2).padStart(5,'0')}.png`});
  }
  console.log(unit, 'sampled', Math.round(span/dt)+1, 'frames');
}
await br.close(); srv.close();
