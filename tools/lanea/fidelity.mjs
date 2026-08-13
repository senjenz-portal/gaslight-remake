/** lanea/fidelity.mjs — for each stage, capture N live frames and the reference
 *  still from the SAME stage box, so "how far has it drifted from the plate"
 *  is measured through identical scaling and cropping. */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import { createServer } from 'node:http';
const DIR='/Users/samz/Documents/gaslight-remake/site-deploy/king-demo/living-plate';
const OUT='/Users/samz/Documents/gaslight-remake/tools/lanea/work/fidelity';
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const PORT=8394, MIME={'.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.json':'application/json'};
const srv=createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);
  const f=path.join(DIR,u==='/'?'index.html':u);
  if(!f.startsWith(DIR)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}
  const size=fs.statSync(f).size,type=MIME[path.extname(f)]||'application/octet-stream',range=req.headers.range;
  if(range){const m=/bytes=(\d*)-(\d*)/.exec(range);const s=m[1]?+m[1]:0,e=m[2]?+m[2]:size-1;
    res.writeHead(206,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Range':`bytes ${s}-${e}/${size}`,'Content-Length':e-s+1});
    return fs.createReadStream(f,{start:s,end:e}).pipe(res);}
  res.writeHead(200,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Length':size});
  fs.createReadStream(f).pipe(res);}).listen(PORT);
const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:1240,height:1000},deviceScaleFactor:1});
const p=await ctx.newPage();
await p.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await p.waitForTimeout(2600);
for(const [stage,sect] of [['stage-room','s-breathed'],['stage-layers','s-layered']]){
  const el=await p.$('#'+stage);
  for(let i=0;i<10;i++){ fs.writeFileSync(path.join(OUT,`${stage}-live${i}.png`),await el.screenshot()); await p.waitForTimeout(430); }
  await p.click(`#${sect} .opt[data-mode="ref"]`); await p.waitForTimeout(900);
  fs.writeFileSync(path.join(OUT,`${stage}-ref.png`),await el.screenshot());
  await p.click(`#${sect} .opt[data-mode="live"]`); await p.waitForTimeout(700);
}
await b.close(); srv.close(); console.log('ok');
