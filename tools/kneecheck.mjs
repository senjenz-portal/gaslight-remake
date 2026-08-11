import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8150/app/index.html?harness=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
await p.evaluate(() => window.__mute(true));
const units = await p.evaluate(() => window.__units().map(u => u.id));
for (const [unit, at] of [['i-11-hadnote', 1.7], ['i-11-hadnote', 2.6], ['i-13-delicacy', 1.7], ['i-22-myphoto', 1.7], ['i-35-briony', 1.2], ['i-37-door', 1.7]]) {
  await p.evaluate((n) => window.__gotoUnit(n), units.indexOf(unit));
  await p.evaluate((n) => { let k = Math.round(n*60); while (k-- > 0) window.__advance(1/60); window.__renderNow(); }, at);
  const r = await p.evaluate(() => {
    const { THREE, renderer, camera, world } = window.__refs;
    const fig = world.figures.client, slot = world.slots.client;
    if (!slot.visible) return { off: true };
    const gl = renderer.getContext();
    const DW = renderer.domElement.width, DH = renderer.domElement.height;
    const view = window.__state().view, dpr = renderer.getPixelRatio();
    const grab = (x0,y0,bw,bh) => { const buf = new Uint8Array(bw*bh*4);
      gl.readPixels(x0, DH-y0-bh, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf); return buf; };
    // the knee band, from the rig: mid-thigh to mid-shin, both legs
    const v = new THREE.Vector3(); const pts = [];
    for (const sid of ['L','R']) {
      const j = fig.joints['lowerLeg'+sid]; j.updateWorldMatrix(true, false);
      for (const dy of [0.12, -0.12]) for (const dx of [-0.14, 0.14]) for (const dz of [-0.18, 0.18]) {
        v.set(dx, dy, dz).applyMatrix4(j.matrixWorld).project(camera);
        pts.push([(view.x + (v.x+1)/2*view.w)*dpr, (view.y + (1-v.y)/2*view.h)*dpr]);
      }
    }
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for (const [x,y] of pts) { x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y); }
    x0=Math.max(0,Math.floor(x0)); y0=Math.max(0,Math.floor(y0));
    x1=Math.min(DW,Math.ceil(x1)); y1=Math.min(DH,Math.ceil(y1));
    const bw=x1-x0, bh=y1-y0;
    if (bw < 2 || bh < 2) return { offPlate: true, bw, bh };
    const legs = [];
    slot.traverse(o => { if (o.isMesh && /seg:(upper|lower)Leg|seg:foot/.test(o.name)) legs.push(o); });
    window.__renderNow(); const A = grab(x0,y0,bw,bh);
    const was = legs.map(o=>o.visible); legs.forEach(o=>o.visible=false);
    window.__renderNow(); const B = grab(x0,y0,bw,bh);
    legs.forEach((o,i)=>o.visible=was[i]); window.__renderNow();
    let changed = 0;
    for (let i=0;i<A.length;i+=4) if (A[i]!==B[i]||A[i+1]!==B[i+1]||A[i+2]!==B[i+2]) changed++;
    return { box:[bw,bh], boxPx: bw*bh, legPx: changed, frac: +(changed/(bw*bh)).toFixed(3) };
  });
  console.log(unit, JSON.stringify(r));
}
await b.close();
