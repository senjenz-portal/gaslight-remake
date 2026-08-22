/**
 * _listencheck.mjs — DOES THE LOUDEST THING IN THE TRACK HAPPEN ON SCREEN?
 *
 * The remix ledger says where the mixer INTENDED to put each cue. That is a
 * claim about the mixer, not about the film. This reads the finished mp4 back
 * the way a listener meets it — no ledger, no log, just the rendered track —
 * finds the loudest transients in it, and pulls the FRAME at each one so the
 * picture can be looked at. A hit that lands on nothing is then visible, and
 * the ledger is only consulted afterwards, to name what was supposed to be
 * there.
 *
 * A transient is scored as ATTACK: the 10 ms RMS at t against the quietest
 * 10 ms in the 150 ms before it, weighted by how loud t actually is — so a
 * loud steady bed never wins and a click in silence never wins either.
 *
 *   node tools/ody/_listencheck.mjs <mp4> [--n 3] [--gap 2.5] [--frames dir]
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
const run = promisify(execFile);

const A = process.argv.slice(2);
const argOf = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const MP4 = path.resolve(A[0]);
const N = +argOf('--n', 3), GAP = +argOf('--gap', 2.5);
const OUT = path.resolve(argOf('--frames', path.join(path.dirname(MP4), '_listen')));
const SR = 48000, HOP = 0.010, WIN = 0.010;

await mkdir(OUT, { recursive: true });
const wav = path.join(OUT, path.basename(MP4, '.mp4') + '.f32');
await rm(wav, { force: true });
/* THE TRACK AS IT SHIPS — both channels, no downmix. `-ac 1` is not a free
   read: ffmpeg folds stereo with a -3 dB pan law, so correlated material
   (which this mix is: every source is mono, adelay'd to both sides) comes
   back three decibels hot and a clean -2.6 dBFS master measures as +0.2. */
await run('ffmpeg', ['-v', 'error', '-y', '-i', MP4, '-map', '0:a:0',
  '-ar', String(SR), '-f', 'f32le', wav], { maxBuffer: 1 << 26 });

const { readFile } = await import('node:fs/promises');
const buf = await readFile(wav);
const st = new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2);
const CH = +(await run('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
  '-show_entries', 'stream=channels', '-of', 'csv=p=0', MP4])).stdout.trim() || 2;
const a = new Float32Array(Math.floor(st.length / CH));
for (let i = 0; i < a.length; i++) {           /* the envelope reads the sum */
  let s = 0; for (let c = 0; c < CH; c++) s += st[i * CH + c];
  a[i] = s / CH;
}

const hop = Math.round(HOP * SR), win = Math.round(WIN * SR);
const env = [];
for (let i = 0; i + win <= a.length; i += hop) {
  let s = 0; for (let j = i; j < i + win; j++) s += a[j] * a[j];
  env.push(Math.sqrt(s / win));
}
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -120);
const back = Math.round(0.150 / HOP);
const score = env.map((v, i) => {
  let floor = Infinity;
  for (let k = Math.max(0, i - back); k < i; k++) floor = Math.min(floor, env[k]);
  if (!isFinite(floor)) floor = v;
  return db(v) + Math.min(24, Math.max(0, db(v) - db(floor)));   /* loud AND a rise */
});

const picked = [];
const used = new Array(env.length).fill(false);
const order = score.map((s, i) => [s, i]).sort((x, y) => y[0] - x[0]);
for (const [s, i] of order) {
  if (picked.length >= N) break;
  if (used[i]) continue;
  picked.push({ t: +(i * HOP).toFixed(3), score: +s.toFixed(1),
                rms: +db(env[i]).toFixed(1) });
  const g = Math.round(GAP / HOP);
  for (let k = Math.max(0, i - g); k < Math.min(env.length, i + g); k++) used[k] = true;
}
picked.sort((x, y) => x.t - y.t);

/* peak, in the sample domain, on the deliverable itself — the loudest sample
   in the loudest CHANNEL, which is what clips a converter */
let peak = 0; for (let i = 0; i < st.length; i++) peak = Math.max(peak, Math.abs(st[i]));

for (const p of picked) {
  p.frame = path.join(OUT, `${path.basename(MP4, '.mp4')}-t${String(p.t).replace('.', '_')}.png`);
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(p.t), '-i', MP4,
    '-frames:v', '1', p.frame], { maxBuffer: 1 << 24 });
}
await rm(wav, { force: true });
const res = { mp4: MP4, dur: +(a.length / SR).toFixed(2),
              peakDbfs: +db(peak).toFixed(2), transients: picked };
await writeFile(path.join(OUT, path.basename(MP4, '.mp4') + '.listen.json'),
  JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify(res, null, 1));
