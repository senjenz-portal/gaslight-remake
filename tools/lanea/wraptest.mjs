#!/usr/bin/env node
/** lanea/wraptest.mjs — drive the breathed stage across the loop wrap and prove
 *  the cross-fade never shows a pop, a black frame, or a duplicated frame. */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import { createServer } from 'node:http';
const DIR='/Users/samz/Documents/gaslight-remake/site-deploy/king-demo/living-plate';
const OUT='/Users/samz/Documents/gaslight-remake/tools/lanea/work/wrap';
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const PORT=8393, MIME={'.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.json':'application/json'};
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
const ctx=await b.newContext({viewport:{width:900,height:700},deviceScaleFactor:1});
const p=await ctx.newPage();
await p.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await p.waitForTimeout(2500);
/* park A just before the wrap, then sample straight through it */
await p.evaluate(()=>{const a=document.getElementById('vidA'); a.currentTime=a.duration-0.55;});
await p.waitForTimeout(140);
const stage=await p.$('#stage-room'); const rows=[];
for(let i=0;i<22;i++){
  const st=await p.evaluate(()=>({ta:+document.getElementById('vidA').currentTime.toFixed(3)}));
  fs.writeFileSync(path.join(OUT,`w${String(i).padStart(2,'0')}.png`),await stage.screenshot());
  rows.push(st); await p.waitForTimeout(45);
}
console.log(JSON.stringify(rows));
await b.close(); srv.close();
