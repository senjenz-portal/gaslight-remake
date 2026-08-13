#!/usr/bin/env node
/**
 * neckfix-manifest.mjs — raw-first manifest for the THROAT CLEANUP stage,
 * same schema as the graft lane's (assets/raw/graft/<ts>/manifest.json):
 * inputs, outputs, params, sha256, plus the stage reports that justify them
 * (tools/blender-neckfix.py's JSON, tools/graftverify.mjs's JSON for the full
 * and the shrunk GLB, and tools/cravatcheck.mjs's band report).
 *
 * usage: node tools/neckfix-manifest.mjs
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
const IN = P(PLATES, 'king2-rigged-goodface.glb');
const IN_SHRUNK = P(PLATES, 'king2-rigged-goodface.shrunk.glb');
const OUT = P(PLATES, 'king2-rigged-goodface-v2.glb');
const SHRUNK = P(PLATES, 'king2-rigged-goodface-v2.shrunk.glb');
const REVIEW = P('review/graft');
const DEPLOY = ['site-deploy/king-demo/king2-rigged.glb',
  'site-deploy/king-demo/blender/blender-cleaned.glb']
  .map((p) => P(p)).filter((p) => fs.existsSync(p));

const blender = read(P('review/graft/neckfix-blender-report.json'));
const vFull = read(P('review/graft/verify-neckfix-full.json'));
const vShrunk = read(P('review/graft/verify-neckfix-shrunk.json'));
const band = read(P('review/graft/neckfix-cravatcheck.json'));

const renders = fs.readdirSync(REVIEW).filter((f) => f.startsWith('neckfix') && f.endsWith('.png'))
  .sort().map((f) => entry(path.join(REVIEW, f)));

const manifest = {
  lane: 'throat cleanup (lane A, after the head transplant)',
  generator: 'tools/blender-neckfix.py (Blender 5.2 via blender-mcp: neck-cylinder '
    + 'classification by base-colour texture + face normal + sliver aspect, buried-lining '
    + 'cut, 240-tri flat-shaded cravat band skinned 60/40 Neck/Head, UVs pinned into the '
    + "body's own navy) + tools/rigshrink.mjs (body PNG -> JPEG, face bake passed through) "
    + '+ tools/graftverify.mjs + tools/cravatcheck.mjs',
  generatedAt: new Date().toISOString(),
  params: blender.params,
  inputs: [entry(IN), entry(IN_SHRUNK)],
  outputs: [entry(OUT), entry(SHRUNK), ...renders],
  deployedTo: DEPLOY.map((p) => rel(p)),
  stats: {
    blender,
    band,
    verify: { full: vFull.after, shrunk: vShrunk.after, before: vShrunk.before },
  },
};
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const rawDir = P('assets/raw/neckfix', stamp);
fs.mkdirSync(rawDir, { recursive: true });
const dest = path.join(rawDir, 'manifest.json');
fs.writeFileSync(dest, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({
  manifest: rel(dest),
  outputs: manifest.outputs.slice(0, 2),
  renders: renders.length,
  headline: {
    cut: blender.cut.deleted,
    cravatTris: blender.cravat.tris,
    rideDrift_mm: vShrunk.after.rideDrift_mm,
    crownTravel_mm: vShrunk.after.crownTravel_mm,
    seam: vShrunk.after.seam,
    seamBefore: vShrunk.before.seam,
    clip: vShrunk.after.clips[0],
  },
}, null, 2));
