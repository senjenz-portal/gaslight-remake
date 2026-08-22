import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const ROOT='/Users/samz/Documents/gaslight-remake/site-deploy';
const OUT='/tmp/r2frames';
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);if(!f.startsWith(ROOT)||!existsSync(f)||statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;
await mkdir(OUT,{recursive:true});
const b=await chromium.launch({headless:true,args:['--enable-gpu','--use-angle=metal']});
const p=await b.newPage({viewport:{width:1500,height:1100}});
await p.goto(`${BASE}/living-odyssey/3d/?harness=1`,{waitUntil:'load'});
await p.waitForFunction('window.__sceneReady === true',null,{timeout:120000});
await p.evaluate(()=>document.documentElement.classList.add('noverlay'));
const cases=[['ody-iv-02-glowing',[1.6,2.6]],['ody-ii-10-firstmeal',[2.8]],['ody-ii-11-sword',[3.2]],['ody-iii-13-neck',[1.6]],['ody-i-12-misgave',[6.0]]];
for(const [id,ts] of cases){
  await p.evaluate(x=>window.__book.seek(x),id);
  let spent=0;
  for(const t of ts){
    await p.evaluate(dt=>window.__book.run(dt), +(t-spent).toFixed(3)); spent=t;
    const m=await p.evaluate(()=>{const c=window.__cine();const r=window.__read();return {sub:c.sub,setup:c.setup,p90:r&&+r.p90.toFixed(3),dark:r&&+r.dark.toFixed(3),box:r&&r.box};});
    const png=await p.locator('#stage3d').screenshot();
    await writeFile(path.join(OUT,`${id}-t${t}.png`),png);
    console.log(id,t,JSON.stringify(m));
  }
}
await b.close(); server.close();
