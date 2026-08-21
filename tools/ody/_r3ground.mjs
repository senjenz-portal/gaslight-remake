import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = '/Users/samz/Documents/gaslight-remake/site-deploy';
const UNITS = (process.argv[2] || 'ody-ii-05-strangers').split(',');
const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.mp4':'video/mp4','.css':'text/css'};
const server = http.createServer((req,res)=>{const url=decodeURIComponent(new URL(req.url,'http://x').pathname);let f=path.join(ROOT,url);if(existsSync(f)&&statSync(f).isDirectory())f=path.join(f,'index.html');if(!existsSync(f)){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport:{width:1600,height:940}});
page.on('pageerror',e=>console.log('PAGEERR',String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/living-odyssey/3d/?harness=1`,{waitUntil:'domcontentloaded'});
await page.waitForFunction('window.__ready === true',null,{timeout:180000});
await page.evaluate('window.__mute(true)'); await page.evaluate('window.__ensureAll()');
for (const u of UNITS) {
  await page.evaluate(async k=>{await window.__gotoUnit(k);},u);
  await page.evaluate('window.__advance(4.0)');
  const r = await page.evaluate(()=>{
    const S=window.__refs.stage, cv=document.getElementById('stage3d');
    const off=document.createElement('canvas');
    const grab=()=>{S.render();off.width=cv.width;off.height=cv.height;const g=off.getContext('2d',{willReadFrequently:true});g.drawImage(cv,0,0);return g.getImageData(0,0,off.width,off.height);};
    const luma=(im,i)=>0.2126*im.data[i]+0.7152*im.data[i+1]+0.0722*im.data[i+2];
    const on=grab(); const out={};
    for(const [id,a] of Object.entries(S.actors)){
      if(!a.group.visible||a.mode==='off') continue;
      const gw=a.gshadow?a.gshadow.visible:false, pw=a.scaleShadow?a.scaleShadow.visible:false;
      if(a.gshadow)a.gshadow.visible=false; if(a.scaleShadow)a.scaleShadow.visible=false;
      const offIm=grab();
      if(a.gshadow)a.gshadow.visible=gw; if(a.scaleShadow)a.scaleShadow.visible=pw;
      let n=0,sum=0,mx=0;
      for(let i=0;i<on.data.length;i+=4){const d=luma(offIm,i)-luma(on,i);if(d>4){n++;sum+=d;if(d>mx)mx=d;}}
      out[id]={px:n,mean:+(n?sum/n:0).toFixed(2),max:+mx.toFixed(1),pool:pw,ground:gw};
    }
    return out;
  });
  console.log(u, JSON.stringify(r));
}
await browser.close(); server.close();
