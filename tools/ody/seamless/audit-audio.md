# Audio audit — living-odyssey shipped assets + mixing layer

Audit of `site-deploy/living-odyssey/assets/audio/` (20 mp3s, 44.1 kHz stereo 128 kbps)
and `site-deploy/living-odyssey/app/audio.js` + call sites, against the sherlock book
(`site-deploy/living/`) as the reference implementation. Measured with ffmpeg
(`loudnorm` EBU R128 input stats, `astats`) and numpy over decoded PCM (spectral
flatness = geometric/arithmetic mean of the 100 Hz–8 kHz power spectrum per 93 ms
frame, median across frames; envelope = 50 ms RMS windows). **No fixes applied —
findings only.**

Owner's complaint: "audio is not as engaging as possible, sometimes it's just noises."
The data agrees, and says why: **the two clips that carry the story's climax are
clipped broadband hiss played 2–3x above the lane's own suggested volume, the opening
bed is functionally silent, and the mix table shipped in its admittedly-provisional
state** (audio.js:61 — "provisional mix, to be trimmed against
assets/audio/manifest.json's suggested_volume once the lane's curation lands" — the
curation landed 2026-08-15; the trim never happened).

---

## 1. Per-file measurements

SFM = spectral flatness (median frame): < 0.05 tonal/textured, 0.05–0.15 noisy-textured,
> 0.15 noise-like. "Overs" = decoded samples ≥ 0.999 FS (mp3 decode overshoot); maxAbs
is the decoded float peak. Dead = fraction of 50 ms windows below −60 dBFS.

| file | LUFS | TP dBTP | LRA | SFM | dead | overs / maxAbs | DC | verdict |
|---|---|---|---|---|---|---|---|---|
| bleat-flock.mp3 | −26.9 | −11.3 | 1.8 | 0.014 | 1% | 0 / 0.30 | ok | **textured** — real bleats, distinct onsets; quiet master |
| boulder-boom.mp3 | −25.5 | −4.3 | 3.7 | 0.000 | 6% | 0 / 0.54 | ok | **textured** — shaped rumble (33.6 dB env swing); 67% of energy < 100 Hz, weak on small speakers |
| bowl-drain.mp3 | −17.7 | −3.8 | 0.9 | 0.009 | 23% | 0 / 0.91 | ok | **textured** gurgle — but NEVER FIRED (see §2d) |
| cave-bed.mp3 | −33.5 | −3.8 | 5.3 | 0.0001 | 0% | 0 / 0.65 | ok | **textured** bed — drips + murmur, most tonal file in the set; loop seam jumps 9.6 dB (end −31.1 dB vs start −40.7 dB per 100 ms RMS) every 25 s |
| cave-fire-bed.mp3 | −42.0 | −8.7 | 4.6 | **0.305** | 0% | 0 / 0.22 | ok | **noise-like** — the "crackle" reads as faint steady hiss at −42 LUFS; also never fired (§2a) |
| click-soft.mp3 | −36.6 | −17.5 | 0.0 | 0.010 | 56% | 0 / 0.19 | ok | engine click, shared byte-identical with sherlock — fine |
| dawn-birds.mp3 | −30.8 | −14.9 | 23.2 | 0.016 | **61%** | 0 / 0.17 | ok | **textured but sparse** — real chirps (80% energy > 4 kHz), yet 3 of its 5 s are silence; fired as `wind` (semantic mismatch) |
| ember-hiss.mp3 | −33.3 | −0.2 | 0.0 | **0.167** | 2% | 0 / 0.66 | ok | **noise-like** — undifferentiated rumble-hiss (energy smeared 29% < 100 Hz through 26% > 4 kHz, no pitch, no envelope shape); stands in for FIVE unrelated ids incl. `sob` and `chop` |
| fire-roar.mp3 | **−4.3** | **+2.4** | 0.3 | 0.037 | 7% | **10 841** / **1.60** | −0.005 | **distorted** — hottest file in the set, true-peak clipped at source (~0.5 s cumulative overs), 64% subsonic rumble |
| giant-roar.mp3 | −11.7 | −0.4 | 5.9 | 0.0003 | 20% | 600 / 1.35 | **+0.020** | **musical** voice-like roar — but 2% DC offset (start/stop thump) and intersample overs |
| giant-snore.mp3 | −13.3 | −0.4 | 16.7 | 0.0003 | 27% | 2 094 / 1.35 | ok | **musical** snore with real breath cycle — NEVER FIRED (§2a) |
| oar-stroke.mp3 | −15.6 | −0.3 | 0.0 | 0.091 | 33% | 61 / 1.34 | ok | **textured** stroke-splash, has attack/decay; borderline hissy tail, intersample overs |
| page-turn.mp3 | −26.5 | −8.0 | 0.0 | 0.127 | 35% | 0 / 0.56 | ok | engine cue, shared with sherlock — paper is noise by nature, acceptable |
| reveal.mp3 | −12.5 | −2.3 | 0.0 | 0.144 | 5% | 0 / 0.57 | ok | **borderline noise** — 98% of energy > 4 kHz, zero envelope onsets: a bright hiss-swish (shared with sherlock, same problem there) |
| rock-whoosh-splash.mp3 | −11.1 | **+0.2** | 14.7 | 0.085 | 15% | 689 / 1.38 | ok | **textured** whoosh→splash with real 63 dB envelope arc — the best-shaped big cue; true-peak overs at source |
| sea-bed.mp3 | −34.3 | −14.3 | 4.5 | 0.015 | 0% | 0 / 0.26 | ok | tonal but **static** — 7.6 dB total envelope dynamics, env σ 2.6 dB, no slow cycle (env autocorr peak 0.13): a flatline whoosh, fatiguing on loop; 0.021 FS step at the loop wrap (click every 25 s) |
| shore-day-bed.mp3 | −34.4 | −18.2 | 5.5 | **0.160** | 0% | 0 / 0.12 | **noise-like** — static surf/wind hiss, 2 envelope onsets in 25 s, no wave cycle (autocorr 0.18); also never fired (§2a) |
| shore-night-bed.mp3 | **−55.8** | −26.9 | 2.3 | 0.017 | 0% | 0 / 0.05 | **functionally silent** — 20+ dB below every other bed; at GAIN 0.55 it plays at ≈ −61 LUFS effective. Whatever texture it has is inaudible |
| stake-sizzle.mp3 | **−5.0** | **+1.7** | 0.2 | **0.475** | 5% | 344 / 1.50 | −0.006 | **pure noise** — highest flatness in the set, centroid 5.7 kHz, clipped at source: white-noise burst, the literal "just noises" file |
| wine-pour.mp3 | −17.1 | −0.4 | 0.0 | 0.001 | 22% | 77 / 1.35 | ok | **textured** liquid trickle, tonal and shaped; minor intersample overs |

Loudness spread of the raw files: **−4.3 to −55.8 LUFS (51 LU)**. The lane's
manifest knew this — it shipped `suggested_volume` 0.3 on every hot file and 1.0
on every quiet one — but audio.js does not use those numbers (§2b).

---

## 2. Mixing layer — audio.js + call sites vs sherlock

The `AudioManager` class is a byte-for-byte sibling of sherlock's (same bed
cross-fade τ = fade/3, same cue path, same hold(+50%) lean-in, same
`setBedGain`). Every gap is in the **data and wiring around it**, not the engine.

### (a) Beds are ducked under nothing — constant level = fatigue. Confirmed.
- No call site anywhere ducks a bed under a cue. `hold(k)` only **raises** the
  current bed (×(1+0.5k), audio.js:228). There is no sidechain, no duck on
  `cue()`, no slow modulation.
- Dynamic bed gain exists (`setBedGain` / `st.gain`) but is used **once** in the
  whole book: `sea.js:672` (`0.8 + 0.5·rowEffort − 0.6·veil`). `shore.js` and
  `cave.js` never touch it — the cave bed sits at one constant gain across
  beats 2–5, roughly 60 of the 82 units. Sherlock is structurally the same (one
  use, `chase.js:437` pursuit gap), but sherlock's dominant bed (hearth,
  −30.5 LUFS @ 0.55 ≈ −35.7 effective) is audible and tonal, so the constancy
  reads as room tone; odyssey's constancy is either silence (shore) or a
  flatline whoosh (sea) or hiss under 25–31 dB cue explosions (cave).
- The bed FILES themselves have no slow cycle to hide it (envelope autocorr
  peaks 0.10–0.18, all < 0.3 across 2–20 s lags): static file × constant gain =
  truly static. Plus audible 25 s loop artifacts (cave 9.6 dB seam jump, sea
  wrap click).

### (b) Cue gains vs sherlock — the table was never trimmed. Confirmed, with receipts.
- Sherlock audio.js:30 — "suggested_volume out of assets/audio/manifest.json,
  **trimmed for the mix**" — and its GAIN tracks its manifest within ~±0.15 on
  most slots (knock 0.85=sv 0.85, hoofbeats 0.7≈0.65, step 0.6≈0.7, page 1.0=1.0).
- Odyssey audio.js:61 — "**provisional mix, to be trimmed** … once the lane's
  curation lands." The manifest landed 2026-08-15 with suggested_volume set;
  the table was never reconciled and is **anti-correlated** with it:

| file (manifest sv) | fired as → GAIN | vs sv | effective LUFS |
|---|---|---|---|
| stake-sizzle (0.3) | `hiss` 0.9, `grind` 0.8 | **3.0x / 2.7x hot** | **−5.9 / −6.9** |
| fire-roar (0.3) | `sword` 0.45 (`fire` 0.7 unused) | 1.5x hot | −11.2 |
| rock-whoosh-splash (0.3) | `rock-tear` 0.9 | **3.0x hot** | −12.0 |
| giant-roar (0.3) | `seize` 0.75, `shout` 0.7, `groan` 0.6 | 2.0–2.5x hot | −14.2 … −16.1 |
| wine-pour (0.47) | `pour` 0.9 | 1.9x hot | −18.0 |
| oar-stroke (0.61) | `oars` 0.75, `keel` 0.7 | 1.2x hot | −18.1 / −18.7 |
| sea-bed (0.48) | bed `sea` 0.65 | 1.35x hot | −38.0 |
| bleat-flock (1.0) | `flock` .75 / `bleats` .7 / `goats` .6 | cut | −29.4 … −31.3 |
| ember-hiss (1.0) | `sputter` .7 / `embers` .6 / `chop` .5 / `sob` .35 / `lots` .3 | cut | −36.4 … −43.7 |
| dawn-birds (1.0) | `wind` 0.5, `dawn` 0.6 | cut | −36.8 |
| cave-bed (0.87) | bed `cave` 0.6 | cut | −37.9 |
| shore-night-bed (1.0) | bed `shore` 0.55 | cut | **−61.0** |

  Everything the lane flagged HOT is fired 1.5–3x above its suggestion; everything
  flagged quiet is cut further. Effective spread across fired cues: **−5.9 to
  −46.5 LUFS (40 LU)**; sherlock's fired cues cluster −19…−26 with deliberate
  outliers (rocket −11.6 as the climax). At the blinding, the odyssey jumps from
  the cave bed at −37.9 straight to `grind`/`hiss` at −6.9/−5.9 — a **31 dB leap
  of clipped white noise**, twice in three units (units.js:427, 442).
- Fades: identical engine (beds τ=fade/3 both books; cues have **no** envelope —
  raw `src.start()`, no declick ramp — in both). Odyssey passes `opts.gain` at
  **zero** call sites (main.js:217 `audio.cue(u.sfx)` bare; `stage.cue` forwards
  only delay) — same shape as sherlock, but sherlock survives on its tuned table.
- Layering: sherlock's `EXTRA_SFX = { hadnote: [['knock',0],['step',0.62]] }`
  composes moments; odyssey's `EXTRA_SFX = {}` (main.js:85) — empty. Outside
  sea.js's two scheduled rock throws, no odyssey moment is layered or delayed.

### (c) Cues fired at raw generation level with hiss. Confirmed — worst offenders:
- **stake-sizzle** at 0.9/0.8: −5 LUFS source, TP +1.7 dBTP, SFM 0.475. Decoded
  peak 1.50 × 0.9 gain = 1.35 into the destination clamp → **audible digital
  clipping** on top of source clipping.
- **fire-roar** at 0.45 (`sword` gate): TP +2.4 dBTP, ~0.5 s cumulative flattened
  samples; 1.60 × 0.45 stays under FS but the source distortion ships as-is.
- **rock-whoosh-splash** at 0.9 (`rock-tear`): 1.38 × 0.9 = 1.25 → output clipping.
- **wine-pour** at 0.9: 1.35 × 0.9 = 1.21 → output clipping on the pour peaks.
- **giant-roar** at 0.75 + 2% DC offset → onset/offset thump.
  None of sherlock's cues combine source TP overs with >0.8 table gain like this
  (its hot files — hoofbeats 1.43 maxAbs @0.7, rocket 1.41 @0.85 — sit at −17/−10
  LUFS, not −4/−5).

### (d) Silent and dead wiring (the moments that literally play nothing)
- **`splash` is unmapped**: `sea.js:530` and `sea.js:570` fire `st.cue('splash')`
  for both rock-throw impacts — `FILES` has no `splash` key (only `rock-tear` /
  `rock-whoosh-splash`), so both splashdowns decode to **silence** (logged, not
  heard). The manifest generated rock-whoosh-splash.mp3 for exactly this
  ("both throws share this cue").
- **3 of 6 beds never play**: no unit or set ever fires bed ids `shore-day`
  (shore.js:864 flips the *visual* shoreState to day; audio stays on the
  inaudible night bed), `cave-fire` (fire lit → bed stays fire-less), or `snore`
  (units.js:240's comment promises "snore-bed, fire to low glow (K14)"; no unit
  carries it). giant-snore.mp3, cave-fire-bed.mp3, shore-day-bed.mp3 are shipped,
  decoded, and dead.
- **bowl-drain.mp3 / `drain` id**: never fired ("drained without thought or heed"
  moment plays only `pour`).
- Net effect: Beat I plays over a −61 LUFS bed (silence), the cave never gains its
  fire, the sleeping giant makes no sound, and the two biggest sea impacts are mute
  — while the sounds that DO land are the clipped hiss cues. That is the owner's
  "sometimes it's just noises" from both directions at once.

---

## 3. The five worst sounds (ranked)

1. **stake-sizzle.mp3** — SFM 0.475 (pure white noise), −5 LUFS, true-peak clipped
   at source AND re-clipped at the output (gain 0.9), fired twice at the story's
   climax 31 dB above the bed. The single loudest thing in the book is static.
2. **shore-night-bed.mp3** — −55.8 LUFS master × 0.55 gain ≈ −61 LUFS effective:
   the entire opening/return ambience is functionally silent. Beat I/VI has no
   audible world.
3. **fire-roar.mp3** — TP +2.4 dBTP with ~0.5 s of flattened samples, 64% subsonic;
   ships as the sword-gate payoff: a distorted rumble on full-range, near-nothing
   on laptop speakers.
4. **ember-hiss.mp3** — shapeless broadband rumble-hiss (SFM 0.167, no envelope,
   no pitch) carrying five unrelated dramatic ids — `sob`, `lots`, `embers`,
   `chop`, `sputter`. A grief beat and a stake-carving beat share one indistinct
   noise: the purest case of "just noises".
5. **sea-bed.mp3** — 7.6 dB total envelope dynamics, no wave periodicity, constant
   gain, click at every 25 s wrap: a static flatline under all of Beat VI (its one
   redemption, the sea.js rowEffort gain, modulates a texture with nothing in it).

Dishonorable mentions: **giant-roar.mp3** (+2% DC thump, 2.5x over suggested
volume — the roar itself is actually good), **shore-day-bed.mp3 / cave-fire-bed.mp3
/ giant-snore.mp3** (unheard by wiring, so they can't hurt — or help), **reveal.mp3**
(inherited hiss-swish, 98% energy > 4 kHz, shared with sherlock).

---

*Method notes: LUFS/TP/LRA from `ffmpeg -af loudnorm=print_format=json` input
stats; DC/peaks from `astats`; SFM, envelope, band splits, loop seams, and decoded
overs from numpy over `ffmpeg -f f32le` decodes (mono 22.05k for spectral, native
44.1k for band splits). Analysis scripts at /tmp/ody-audit/. Audited 2026-08-16.*
