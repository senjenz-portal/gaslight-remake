#!/usr/bin/env node
/**
 * rigshrink.mjs — shrink a rigged GLB by re-encoding its embedded PNG texture
 * as JPEG, WITHOUT a GLTFLoader/GLTFExporter round trip (skinning, animation
 * and accessor bytes stay byte-identical; only the image bufferView and the
 * JSON chunk change).
 *
 * The FBX2glTF output of the Make-It-Animatable pipeline carries one 8.6 MB
 * PNG-recoded baseColor texture (material alphaMode OPAQUE — no alpha to
 * lose). This re-encodes it at JPEG quality 0.85 through a real chromium
 * canvas (same headless pattern as kinghybrid.mjs), then rebuilds the BIN
 * chunk: every bufferView copied in original-offset order, re-aligned to 4
 * bytes, offsets rewritten, images[0].mimeType set to image/jpeg.
 *
 * Handles EVERY image in the file, not just images[0]: the head-transplanted
 * king (tools/blender-headgraft.py) carries two — the body's 8.6 MB PNG plus
 * the graft's already-JPEG face bake — and only the PNGs get re-encoded, so
 * the clean face texture is passed through byte-for-byte.
 *
 * usage: node tools/rigshrink.mjs --in SRC.glb --out DST.glb [--quality 0.85]
 *          [--max 0]        # optional: downscale re-encoded images to fit
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const SRC = path.resolve(flag('in', ''));
const DST = path.resolve(flag('out', ''));
const QUALITY = Number(flag('quality', 0.85));
const MAXPX = Number(flag('max', 0));            /* 0 = keep native size */
if (!SRC || !DST) { console.error('need --in and --out'); process.exit(2); }

/* ---- parse the GLB ---------------------------------------------------- */
const buf = fs.readFileSync(SRC);
if (buf.readUInt32LE(0) !== 0x46546c67) { console.error('not a GLB'); process.exit(2); }
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;                      /* skip BIN chunk header */

const shots = json.images.map((img, i) => {
  const bv = json.bufferViews[img.bufferView];
  const bytes = buf.subarray(binStart + bv.byteOffset,
                             binStart + bv.byteOffset + bv.byteLength);
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  console.error(`image ${i} (${img.name || '-'}): bufferView ${img.bufferView}, `
    + `${bv.byteLength} bytes, png=${png}`);
  return { i, img, bv, bytes, png };
});
const todo = shots.filter((s) => s.png);
if (!todo.length) { console.error('no PNG texture — nothing to do'); process.exit(2); }

/* ---- re-encode PNG -> JPEG through a chromium canvas ------------------ */
const b = await chromium.launch({ headless: true });
const page = await b.newPage();
const encoded = [];
for (const s of todo) {
  const out = await page.evaluate(async ({ b64, q, max }) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = rej;
      img.src = 'data:image/png;base64,' + b64;
    });
    const k = max > 0 ? Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)) : 1;
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k);
    cv.height = Math.round(img.naturalHeight * k);
    const cx = cv.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    return { b64: cv.toDataURL('image/jpeg', q).split(',')[1],
             w: cv.width, h: cv.height, srcW: img.naturalWidth, srcH: img.naturalHeight };
  }, { b64: s.bytes.toString('base64'), q: QUALITY, max: MAXPX });
  const jpeg = Buffer.from(out.b64, 'base64');
  console.error(`  -> jpeg ${out.w}x${out.h} (from ${out.srcW}x${out.srcH}), `
    + `${jpeg.length} bytes (q=${QUALITY})`);
  encoded.push({ ...s, jpeg, meta: out });
}
await b.close();
const replace = new Map(encoded.map((e) => [e.img.bufferView, e.jpeg]));

/* ---- rebuild the BIN chunk: same bufferViews, new image bytes --------- */
const align4 = (n) => (n + 3) & ~3;
const order = [...json.bufferViews.keys()]
  .sort((a, c) => json.bufferViews[a].byteOffset - json.bufferViews[c].byteOffset);
const parts = [];
let cursor = 0;
for (const i of order) {
  const bv = json.bufferViews[i];
  const bytes = replace.get(i)
    || buf.subarray(binStart + bv.byteOffset, binStart + bv.byteOffset + bv.byteLength);
  cursor = align4(cursor);
  bv.byteOffset = cursor;
  bv.byteLength = bytes.length;
  parts.push({ at: cursor, bytes });
  cursor += bytes.length;
}
const binLen = align4(cursor);
const bin = Buffer.alloc(binLen);
for (const p of parts) p.bytes.copy ? p.bytes.copy(bin, p.at) : bin.set(p.bytes, p.at);

for (const e of encoded) e.img.mimeType = 'image/jpeg';
json.buffers[0].byteLength = binLen;

/* ---- write the GLB ----------------------------------------------------- */
let jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
if (jsonBytes.length % 4) jsonBytes = Buffer.concat(
  [jsonBytes, Buffer.alloc(4 - (jsonBytes.length % 4), 0x20)]);
const total = 12 + 8 + jsonBytes.length + 8 + binLen;
const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0);           /* magic */
out.writeUInt32LE(2, 4);                    /* version */
out.writeUInt32LE(total, 8);
out.writeUInt32LE(jsonBytes.length, 12);
out.writeUInt32LE(0x4e4f534a, 16);          /* JSON */
jsonBytes.copy(out, 20);
out.writeUInt32LE(binLen, 20 + jsonBytes.length);
out.writeUInt32LE(0x004e4942, 24 + jsonBytes.length);   /* BIN */
bin.copy(out, 28 + jsonBytes.length);
fs.writeFileSync(DST, out);
console.log(JSON.stringify({
  src: SRC, dst: DST,
  srcBytes: buf.length, dstBytes: out.length,
  quality: QUALITY, maxPx: MAXPX || null,
  textures: shots.map((s) => {
    const e = encoded.find((x) => x.i === s.i);
    return e
      ? { image: s.i, name: s.img.name, from: 'png', pngBytes: s.bytes.length,
          jpegBytes: e.jpeg.length, w: e.meta.w, h: e.meta.h,
          srcW: e.meta.srcW, srcH: e.meta.srcH }
      : { image: s.i, name: s.img.name, passthrough: s.img.mimeType,
          bytes: s.bytes.length };
  }),
}, null, 2));
