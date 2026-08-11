#!/usr/bin/env node
/**
 * manifest.mjs — raw-first bookkeeping for the APP SCAFFOLD lane.
 *
 * This lane generates no model/image/audio downloads, but it does produce
 * artefacts the orchestrator has to be able to verify: the runtime source,
 * the vendored three (which must match the pinned version exactly), and the
 * review harness's screenshot rounds. Each is hashed into an immutable
 * manifest under assets/raw/app-scaffold/<timestamp>/.
 *
 *   node tools/manifest.mjs [--round 0]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const roundArg = argv.indexOf('--round');
const round = roundArg >= 0 ? argv[roundArg + 1] : '0';

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const outDir = path.join(ROOT, 'assets', 'raw', 'app-scaffold', stamp);
fs.mkdirSync(outDir, { recursive: true });

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function walk(dir, filter = () => true, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, filter, acc);
    else if (filter(p)) acc.push(p);
  }
  return acc;
}

const entry = (p) => ({
  filename: path.relative(ROOT, p),
  bytes: fs.statSync(p).size,
  sha256: sha(p),
});

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const threeVer = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'node_modules/three/package.json'), 'utf8')).version;
const pwVer = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'node_modules/playwright/package.json'), 'utf8')).version;
let chromium = 'unknown';
try {
  chromium = execSync('node -e "import(\'playwright\').then(p=>p.chromium.launch().then(async b=>{console.log(b.version());await b.close()}))"',
    { cwd: ROOT, encoding: 'utf8' }).trim();
} catch (_) {}

const runtime = walk(path.join(ROOT, 'app'), p => /\.(js|html|py)$/.test(p) && !p.includes('/vendor/'));
const vendor  = walk(path.join(ROOT, 'app', 'vendor'));
const tools   = walk(HERE, p => /\.mjs$/.test(p));
const shotsDir = path.join(ROOT, 'shots', `round-${round}`);
const shots   = walk(shotsDir, p => /\.(png|json)$/.test(p));

let lap = null;
const lapPath = path.join(shotsDir, 'lap.json');
if (fs.existsSync(lapPath)) {
  const j = JSON.parse(fs.readFileSync(lapPath, 'utf8'));
  lap = {
    round: j.round, url: j.url, port: j.port, when: j.when, fatal: j.fatal,
    ratios: j.reports.map(r => ({
      ratio: r.ratio, shots: r.shots.length,
      live: r.shots.filter(s => !s.dead).length,
      units: `${r.visited}/${r.total}`, simSeconds: r.simSeconds, simFrames: r.simFrames,
      gltfReady: r.gltfReady, slots: r.slots, requests: r.requests.length,
      offOrigin: r.offOrigin.length,
      audioCues: r.audio ? r.audio.cues : [],
      findings: r.pageErrors.length + r.consoleErrors.length + r.httpErrors.length +
                r.dead.length + r.wedges.length + r.offOrigin.length,
    })),
  };
}

const manifest = {
  lane: 'app-scaffold',
  generator: 'hand-authored source + tools/lap.mjs (playwright chromium screenshots)',
  generatedAt: new Date().toISOString(),
  note: 'This lane produces no API-generated media. Entries are the runtime ' +
        'source, the vendored three build, the harness, and one screenshot round. ' +
        'Shots are reproducible: same round + same code = same pixels (sim-time clock).',
  versions: {
    node: process.version, three: threeVer, playwright: pwVer, chromium,
    package: { name: pkg.name, type: pkg.type },
  },
  runtimeDependencies: 'none at runtime — ES modules + importmap to app/vendor/ only',
  app: { files: runtime.map(entry) },
  vendor: {
    source: 'node_modules/three@' + threeVer,
    files: vendor.map(entry),
    importmap: { three: './vendor/three.module.js', 'three/addons/': './vendor/' },
  },
  tools: { files: tools.map(entry) },
  shots: {
    round: Number(round),
    dir: path.relative(ROOT, shotsDir),
    count: shots.filter(p => p.endsWith('.png')).length,
    files: shots.map(entry),
  },
  lap,
};

const out = path.join(outDir, 'manifest.json');
fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(out);
console.log(`app ${runtime.length} · vendor ${vendor.length} · tools ${tools.length} · shots ${manifest.shots.count}`);
