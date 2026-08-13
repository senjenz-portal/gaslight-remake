import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { decodePng } from '/Users/samz/Documents/gaslight-remake/tools/png.mjs';
import fs from 'node:fs'; import path from 'node:path';
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
function serve(dir,port){const s=createServer(async(q,r)=>{try{const u=decodeURIComponent(q.url.split('?')[0]);const b=await readFile(path.join(dir,u==='/'?'index.html':u));r.writeHead(200,{'content-type':MIME[path.extname(u==='/'?'index.html':u)]||'application/octet-stream','cache-control':'no-store'});r.end(b);}catch(e){r.writeHead(404).end('');}});return new Promise(ok=>s.listen(port,()=>ok(s)));}
const PINS=[['post',1.4],['seat',1.6],['iamking',1.4]];
async function go(dir,port){const srv=await serve(dir,port);const br=await chromium.launch();const pg=await br.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});await pg.goto(`http://127.0.0.1:${port}/?harness=1`,{waitUntil:'load'});await pg.waitForFunction(()=>window.__ready===true,{timeout:30000});await pg.evaluate(()=>window.__mute(true));const out={};for(const [k,t] of PINS){await pg.evaluate(async(x)=>await window.__gotoUnit(x),k);await pg.evaluate((d)=>window.__setTime(d),t);await pg.evaluate(()=>window.__renderNow());out[k]={png:await pg.screenshot(),dom:await pg.evaluate(()=>{const el=document.querySelector('.speech,.text,#speech,#text');return {cam:JSON.stringify(window.__refs?.stage?.cam||null), body:(document.body.innerText||'').slice(0,300)};})};}
await br.close();srv.close();return out;}
const A=await go('/tmp/gl-b1-head/living',8841);
const B=await go('/Users/samz/Documents/gaslight-remake/site-deploy/living',8842);
for(const [k] of PINS){
  const a=decodePng(A[k].png),b=decodePng(B[k].png);
  // row profile of diff
  const rows=[];
  for(let y=0;y<a.height;y++){let n=0;for(let x=0;x<a.width;x++){const i=(y*a.width+x)*4;const d=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));if(d>8)n++;}if(n)rows.push([y,n]);}
  console.log('=== '+k+'  camA='+A[k].dom.cam+'  camB='+B[k].dom.cam);
  console.log('  rows with diff: '+rows.length+'  first='+JSON.stringify(rows[0])+' peak='+JSON.stringify(rows.slice().sort((p,q)=>q[1]-p[1])[0])+' last='+JSON.stringify(rows[rows.length-1]));
  console.log('  bodyA: '+JSON.stringify(A[k].dom.body.replace(/\s+/g,' ').slice(0,160)));
  console.log('  bodyB: '+JSON.stringify(B[k].dom.body.replace(/\s+/g,' ').slice(0,160)));
  fs.writeFileSync(`/tmp/b1-${k}-A.png`,A[k].png); fs.writeFileSync(`/tmp/b1-${k}-B.png`,B[k].png);
}
