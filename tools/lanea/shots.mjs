#!/usr/bin/env node
/** lanea/shots.mjs — final capture + interaction proof for the Living Plate page. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';

const DIR = '/Users/samz/Documents/gaslight-remake/site-deploy/king-demo/living-plate';
const SHOTS = '/Users/samz/Documents/gaslight-remake/shots/lanea';
fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 8392;
const MIME = { '.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.json':'application/json' };
const srv = createServer((req,res)=>{
  const u=decodeURIComponent(req.url.split('?')[0]);
  const f=path.join(DIR,u==='/'?'index.html':u);
  if(!f.startsWith(DIR)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}
  const size=fs.statSync(f).size, type=MIME[path.extname(f)]||'application/octet-stream', range=req.headers.range;
  if(range){const m=/bytes=(\d*)-(\d*)/.exec(range);const start=m[1]?+m[1]:0,end=m[2]?+m[2]:size-1;
    res.writeHead(206,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});
    return fs.createReadStream(f,{start,end}).pipe(res);}
  res.writeHead(200,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Length':size});
  fs.createReadStream(f).pipe(res);
}).listen(PORT);

const errs=[];
const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:1240,height:1000},deviceScaleFactor:2});
const p=await ctx.newPage();
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text());});
await p.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await p.waitForTimeout(3000);

await p.screenshot({path:path.join(SHOTS,'living-plate-page.png'),fullPage:true});
await (await p.$('#stage-room')).screenshot({path:path.join(SHOTS,'breathed-stage.png')});
await (await p.$('#stage-layers')).screenshot({path:path.join(SHOTS,'layered-stage.png')});
await (await p.$('#stage-street')).screenshot({path:path.join(SHOTS,'breathed-street-stage.png')});

/* --- reference toggle --- */
await p.click('#s-layered .opt[data-mode="ref"]');
await p.waitForTimeout(900);
const refOn=await p.evaluate(()=>{
  const s=document.getElementById('stage-layers');
  return {cls:s.classList.contains('showref'),
          refOpacity:getComputedStyle(s.querySelector('.ref')).opacity,
          livingOpacity:getComputedStyle(s.querySelector('.living')).opacity};
});
await (await p.$('#stage-layers')).screenshot({path:path.join(SHOTS,'layered-stage-reference.png')});
const a1=await (await p.$('#stage-layers')).screenshot();
await p.waitForTimeout(1400);
const a2=await (await p.$('#stage-layers')).screenshot();
fs.writeFileSync('/tmp/ref1.png',a1); fs.writeFileSync('/tmp/ref2.png',a2);
await p.click('#s-layered .opt[data-mode="live"]');
await p.waitForTimeout(700);

/* --- lightbox --- */
await p.click('#stage-layers');
await p.waitForTimeout(600);
const lbOpen=await p.evaluate(()=>({open:document.getElementById('lightbox').classList.contains('open'),
                                    src:document.getElementById('lb-img').getAttribute('src')}));
await p.screenshot({path:path.join(SHOTS,'lightbox.png')});
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
const lbClosed=await p.evaluate(()=>document.getElementById('lightbox').classList.contains('open'));

/* --- mobile --- */
const m=await ctx.newPage();
await m.setViewportSize({width:414,height:900});
await m.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await m.waitForTimeout(2500);
await m.screenshot({path:path.join(SHOTS,'living-plate-mobile.png'),fullPage:true});

console.log(JSON.stringify({refToggle:refOn,lightbox:{...lbOpen,closedAfterEsc:!lbClosed},errors:errs},null,1));
await b.close(); srv.close();
