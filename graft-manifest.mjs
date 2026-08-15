#!/usr/bin/env node
/**
 * graft-manifest.mjs — raw-first manifest for the LANE A head transplant,
 * same schema as the hybrid lane's (assets/raw/hybrid/<ts>/manifest.json):
 * inputs, outputs, params, sha256, plus the stage reports that justify them
 * (tools/blender-headgraft.py's JSON and tools/graftverify.mjs's JSON).
 *
 * usage: node tools/graft-manifest.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(ROOT, p);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const entry = (p) => ({ filename: rel(p), bytes: fs.statSync(p).size, sha256: sha(p) });
const P = (...a) => path.join(ROOT, ...a);
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const PLATES = 'assets/plates/king-v2';
const BODY = P(PLATES, 'king2-rigged-fixed.glb');
const HEAD = P(PLATES, 'king2-head.glb');
const OUT = P(PLATES, 'king2-rigged-goodface.glb');
const SHRUNK = P(PLATES, 'king2-rigged-goodface.shrunk.glb');
const REVIEW = P('review/graft');

const blender = read(P('review/graft/graft-blender-report.json'));
const verify = read(P('review/graft/verify-goodface.json'));
const verifyShrunk = read(P('review/graft/verify-goodface-shrunk.json'));

const renders = fs.readdirSync(REVIEW).filter((f) => f.endsWith('.png')).sort()
  .map((f) => entry(path.join(REVIEW, f)));

const manifest = {
  lane: 'head-transplant (lane A)',
  generator: 'tools/blender-headgraft.py (Blender 5.2 headless: UV-correspondence '
    + 'Umeyama fit, counterpart face cut, rigid mixamorig:Head bind, rim weld) + '
    + 'tools/rigshrink.mjs (body PNG -> JPEG, face bake passed through) + '
    + 'tools/graftverify.mjs (headless three.js head-ride / seam / renders)',
  generatedAt: new Date().toISOString(),
  params: {
    uvQuantisation: 1e5,
    rigidHeadWeightThreshold: 0.9,
    rimWeldMaxDistance_m: 0.004,
    shrinkQuality: 0.85,
    shrinkMaxPx: null,
    fit: blender.fit,
  },
  inputs: [entry(BODY), entry(HEAD)],
  outputs: [entry(OUT), entry(SHRUNK), ...renders],
  stats: {
    blender,
    verify: { full: verify.after, shrunk: verifyShrunk.after, before: verify.before },
  },
};
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const rawDir = P('assets/raw/graft', stamp);
fs.mkdirSync(rawDir, { recursive: true });
const dest = path.join(rawDir, 'manifest.json');
fs.writeFileSync(dest, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({
  manifest: rel(dest),
  outputs: manifest.outputs.slice(0, 2),
  renders: renders.length,
  headline: {
    rideDrift_mm: verify.after.rideDrift_mm,
    crownTravel_mm: verify.after.crownTravel_mm,
    seam: verify.after.seam,
    clip: verify.after.clips[0],
  },
}, null, 2));
