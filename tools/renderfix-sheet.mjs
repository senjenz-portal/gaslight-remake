#!/usr/bin/env node
/** renderfix-sheet.mjs — one before/after contact sheet from the local A/B shots. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const S = '/Users/samz/Documents/gaslight-remake/shots';
const OUT = '/Users/samz/Documents/gaslight-remake/review/render-fix-before-after.png';
const ROWS = [
  ['king-tripo',    'tripo 3.1 on the stage',      'skin L42.6 S22.1', 'skin L53.2 S42.9'],
  ['king-rigged',   'RIGGED — auto-rig + mixamo',  'skin L43.6 S23.8', 'skin L47.6 S40.0'],
  ['king-yvo',      'previous (yvo3d)',            'skin L39.1 S29.9', 'skin L47.7 S45.6'],
  ['blender-clean', 'blender page — cleaned rig',  'skin L41.5 S27.2', 'skin L63.8 S50.0'],
];
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const cells = ROWS.map(([k, label, sb, sa]) => ({ label,
  before: b64(`${S}/renderfix-before-${k}.png`), after: b64(`${S}/renderfix-after-${k}.png`), sb, sa }));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width: 1700, height: 400 } });
await page.setContent(`<body style="margin:0;background:#0a0e14;font-family:monospace">
<div style="padding:22px 24px 6px;color:#f2e9d4;font-size:26px;font-weight:bold">
RENDER RIG — BEFORE / AFTER, live pages</div>
<div style="padding:0 24px 14px;color:#c9b98f;font-size:16px">
left: ACES 0.9, no environment, blue hemisphere · right: PMREM(RoomEnvironment) 0.6 + NeutralToneMapping 1.0 + metalness 0</div>
${cells.map(c => `<div style="display:flex;gap:10px;padding:8px 24px">
  <div style="flex:1"><div style="color:#8f9dbd;font-size:15px;padding:4px 0">BEFORE · ${c.label} · ${c.sb}</div>
    <img src="${c.before}" style="width:100%;display:block;border:1px solid #2a2417"></div>
  <div style="flex:1"><div style="color:#f0c862;font-size:15px;padding:4px 0">AFTER · ${c.label} · ${c.sa}</div>
    <img src="${c.after}" style="width:100%;display:block;border:2px solid #d8b45a"></div>
</div>`).join('')}
<div style="height:24px"></div></body>`);
await page.waitForTimeout(700);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log(OUT);
