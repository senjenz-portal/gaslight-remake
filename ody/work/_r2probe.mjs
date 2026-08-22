import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = '/Users/samz/Documents/gaslight-remake/site-deploy';
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);if(!f.startsWith(ROOT)||!existsSync(f)||statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch({headless:true,args:['--enable-gpu','--use-angle=metal']});
const p=await b.newPage({viewport:{width:1500,height:1100}});
await p.goto(`${BASE}/living-odyssey/3d/?harness=1`,{waitUntil:'load'});
await p.waitForFunction('window.__sceneReady === true',null,{timeout:120000});
const cases=[['ody-i-10-wineskin',[5.0]],['ody-iv-01-embers',[2.4]],['ody-iv-02-glowing',[1.6,2.8]],['ody-iv-03-auger',[2.2]],['ody-iii-13-neck',[1.6,2.6]],['ody-ii-10-firstmeal',[2.8]],['ody-i-08-cave',[1.6]],['ody-i-12-misgave',[1.6,6.0]],['ody-ii-11-sword',[3.2]],['ody-v-06-feltbacks',[1.6]],['ody-v-09-ramspeech2',[3.4]]];
for(const [id,ts] of cases){
  await p.evaluate(x=>window.__book.seek(x),id);
  let spent=0;
  for(const t of ts){
    const r=await p.evaluate(async (dt)=>{window.__book.run(dt);const c=window.__cine();const rd=window.__read();return {sub:c.sub,setup:c.setup,live:c.live,size:+c.size.toFixed(2),focus:+c.focus.toFixed(2),ok:rd&&rd.ok,why:rd&&rd.why,p90:rd&&+rd.p90.toFixed(3),dark:rd&&+rd.dark.toFixed(3)};}, +(t-spent).toFixed(3));
    spent=t;
    console.log(id,'t='+t,JSON.stringify(r));
  }
}
await b.close(); server.close();
