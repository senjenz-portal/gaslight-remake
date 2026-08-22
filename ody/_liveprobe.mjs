/* where the LIVE body stands when the reader reaches these units, versus where
   the bake found it — the number an authored station has to be chosen against */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.join(REPO, 'site-deploy');
const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.svg':'image/svg+xml' };
const srv = http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u.endsWith('/'))u+='index.html';
  const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!existsSync(f)||statSync(f).isDirectory()){r.writeHead(404);r.end();return;}
  r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${srv.address().port}`;
const br = await chromium.launch({ headless:true, args:['--enable-gpu','--use-angle=metal','--mute-audio'] });
const pg = await br.newPage({ viewport:{width:1500,height:1100} });
pg.on('pageerror', e=>console.log('ERR',e.message));
await pg.goto(`${BASE}/living-odyssey/3d/?harness=1`,{waitUntil:'load'});
await pg.waitForFunction('window.__sceneReady === true',null,{timeout:120000});
for (const u of ['ody-iv-03-auger','ody-iv-05-hiss','ody-iv-12-doorway','ody-i-07-council','ody-v-07-lastofall','ody-iii-08-lookhere','ody-vi-14-sailedon']) {
  const o = await pg.evaluate(async (id)=>{
    const B=window.__book; await B.seek(id); B.run(1.6);
    const c=window.__cine(); const cine=B.stage; const cam=window.__book.stage.camera;
    const A=[]; for(const [k,a] of cine.actors) A.push([k,[+a.group.position.x.toFixed(2),+a.group.position.y.toFixed(2),+a.group.position.z.toFixed(2)]]);
    return { id, set:document.body.dataset.set, cls:c.cls, size:+c.size.toFixed(3), inFrame:+c.inFrame.toFixed(3),
             cx:+c.cx.toFixed(3), cy:+c.cy.toFixed(3), camY:+c.camY.toFixed(2), focus:+c.focus.toFixed(2),
             campos:[+cam.position.x.toFixed(2),+cam.position.y.toFixed(2),+cam.position.z.toFixed(2)], actors:A };
  }, u);
  console.log(JSON.stringify(o));
}
await br.close(); srv.close();
