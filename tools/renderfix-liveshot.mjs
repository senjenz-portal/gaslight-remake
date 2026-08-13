#!/usr/bin/env node
/** renderfix-liveshot.mjs — the two live evidence shots for the render-rig fix. */
import { chromium } from 'playwright';
const BASE = 'https://senjenz-portal.github.io/gaslight-remake/';
const SHOTS = '/Users/samz/Documents/gaslight-remake/shots';
const b = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader'] });
const errs = [];

/* main king demo — the rigged take on the Baker Street stage */
{
  const ctx = await b.newContext({ viewport:{width:1440,height:1240}, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  p.setDefaultTimeout(120000);
  p.on('console', m => { if (m.type()==='error') errs.push('main '+m.text().slice(0,200)); });
  p.on('pageerror', e => errs.push('main PAGEERR '+String(e.message).slice(0,200)));
  await p.goto(BASE + 'king-demo/index.html', { waitUntil:'domcontentloaded', timeout:120000 });
  await p.waitForFunction('window.__meshLoaded === true', null, { timeout:180000 });
  await p.evaluate(() => Array.from(document.querySelectorAll('#mesh-switch .mesh-opt'))
    .find(o => o.dataset.key === 'rigged').click());
  await p.waitForFunction("window.__viewer && window.__viewer.showing === 'rigged'", null, { timeout:180000 });
  await p.waitForTimeout(2500);
  await p.locator('#viewer-fig').scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  await p.screenshot({ path: SHOTS + '/render-fix-live-main.png' });
  await ctx.close();
}

/* blender demo — both viewers in one frame */
{
  const ctx = await b.newContext({ viewport:{width:1440,height:1240}, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  p.setDefaultTimeout(120000);
  p.on('console', m => { if (m.type()==='error') errs.push('blender '+m.text().slice(0,200)); });
  p.on('pageerror', e => errs.push('blender PAGEERR '+String(e.message).slice(0,200)));
  await p.goto(BASE + 'king-demo/blender/index.html', { waitUntil:'domcontentloaded', timeout:120000 });
  await p.waitForFunction('window.__blender && window.__blender.clean.loaded && window.__blender.scratch.loaded',
    null, { timeout:180000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: SHOTS + '/render-fix-live-blender.png', fullPage:true });
  await ctx.close();
}
await b.close();
console.log(JSON.stringify({ errs }, null, 1));
