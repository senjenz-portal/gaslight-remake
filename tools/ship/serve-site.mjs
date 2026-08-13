#!/usr/bin/env node
/**
 * serve-site.mjs — static server for site-deploy exactly as GitHub Pages sees it:
 * the repo root is the web root, so /king-demo/hd2d/ resolving ../../app/vendor/
 * is a real integration test and not an artefact of serving a subdirectory.
 *
 * Range requests are implemented because <video> in Chromium will happily play a
 * 200 response but a review that cannot seek cannot prove a loop.
 *
 *     node tools/ship/serve-site.mjs [port]
 */
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/samz/Documents/gaslight-remake/site-deploy';
const PORT = Number(process.argv[2] || 8899);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.css': 'text/css; charset=utf-8',
  '.hdr': 'application/octet-stream', '.wasm': 'application/wasm',
};

createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(ROOT, u);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404 ' + u); }
  const size = fs.statSync(f).size;
  const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m[1] ? +m[1] : 0;
    const end = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`,
                         'Content-Length': end - start + 1 });
    return fs.createReadStream(f, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...base, 'Content-Length': size });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('serving ' + ROOT + ' on http://127.0.0.1:' + PORT));
