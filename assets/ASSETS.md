# ASSETS.md — Beat-I Integration Authority (gaslight-remake)

Reconciled 2026-08-09 against disk. Every path, dimension, tri count, hash map, duration,
line count and lap result below was independently re-verified (PNG/GLB magic bytes parsed,
mp3s decoded to PCM and RMS-measured, curated-vs-raw sha256 compared). Raws under
`assets/raw/**` are immutable provenance — never edit or serve them; curated files are the
only integration surface. Do not regenerate anything without checking the TODO ranking first.
GAP-FILL 2026-08-10 (this file updated in place): king.glb, 4 new plates (king cameos x2,
irene cameo, both-photo), 4 new audio cues (step/reveal/book/mask-drop). New entries verified
by the generating lane: PNG headers parsed, GLB parsed + sha-compared, mp3 PCM-measured.

Slice: Sherlock Holmes Ch.1 Beat I — Watson's arrival at 221B, the anonymous undated note,
press-and-hold watermark inspection, hoofbeats/carriage arrival, diegetic page turn to the
masked client. Style law (mandatory on every image prompt, including the no-text tail):
stylized low-poly 3D game diorama, isometric, faceted dark rock base, dark navy gradient,
Prussian-blue night, amber glow, no text / no letters / blank weathered sign boards.

---

## 1. Plates (2D) — `assets/plates/`

All true PNG (RGB, 8-bit, non-interlaced, 300 dpi pHYs). Verified free of text artifacts by
the generating lane. `backdrop.png` is the locked style reference — match everything to it.

| File | Dims | Role in Beat I | Gotchas |
|---|---|---|---|
| `backdrop.png` | 1408x768 | STYLE MASTER. 221B cutaway: Holmes at fire in dressing gown, Watson seated, violin on desk. Palette/light reference for all lanes; optional 2D backdrop art. | Locked reference — do not restyle other assets away from it. |
| `note-plate.png` | 1408x768 | The folded blank cream letter on a side table (units i-03..i-05). Crossfade source for the inspection beat. | Pairs with watermark-plate for the hold interaction. |
| `watermark-plate.png` | 1408x768 | Press-and-hold payoff (i-06-hold → i-07-watermark): letter backlit by lantern, interlaced-knot watermark glowing through the paper. | Watermark only reads where the lantern backlights the paper — a crossfade note-plate → watermark-plate driven by hold-k sells the beat. Watermark is an abstract knot, NOT the Eg/P/Gt monogram the text describes (no-text law); the margin text carries the letters. |
| `street-arrival.png` | **1024x1024** | Baker Street night exterior, hansom+horse under gas lamp (i-11-hoofbeats window/street beat). | Only square plate — plan crops/letterboxing; all others are 1408x768 landscape. |
| `cameo-holmes.png` | 1408x768 | Speaker cameo card, Holmes bust (gaunt, hawk-nosed, dark-green gown accent). | Busts on near-flat dark-navy ground (NOT the reference repo's oval wooden frame) — cut/mask cleanly to card shape. App has no cameo-card surface yet (see TODO #9). |
| `cameo-watson.png` | 1408x768 | Speaker cameo card, Watson bust (brown moustache, brown tweed accent). | Faint herringbone micro-texture on the tweed — slightly off the flat-shaded law; best available candidate. Same masking note as Holmes. |
| `page-texture.png` | 1408x768 | Aged cream paper fill for the book margin / page face. | Edgeless, no vignette, but NOT seamlessly tileable — use as a single stretched fill or mirror-tile; do not naive-repeat. |
| `cameo-king-masked.png` | 1408x768 | Speaker cameo card, the masked client bust: black vizard domino mask, deep blue high-collar cloak with flame-orange lining, cream jacket, heavy bearded jaw. Caption "THE MASKED CLIENT" (unit hadnote on). | Same masking note as other cameos (bust on near-flat navy ground, cut to card shape). Costume matches king.glb — the 2D/3D pair reads as one man. |
| `cameo-king-unmasked.png` | 1408x768 | The cameo FLIP payoff at the unmask gate (iamking): same man, mask off, proud heavy jaw, same blue/orange cloak + cream jacket. Caption "WILHELM VON ORMSTEIN · KING OF BOHEMIA". | Hair tone reads slightly warmer than the masked card — acceptable at cameo size; the costume carries the identity match. |
| `cameo-irene.png` | 1408x768 | Speaker cameo card, Irene Adler bust: dark hair swept up (small tiara), poised, deep-red bodice as the single accent. Caption "IRENE ADLER" (unit letmesee). | Clean navy ground, cuts to card shape like the others. |
| `both-photo.png` | 1408x768 | The plate for unit `both` ("We were both in the photograph."): sepia Victorian cabinet photograph of the tall broad man and the dark-haired woman standing side by side, formal pose, dark ground, simple frame baked in. | Fully sepia (intentionally outside the navy/amber palette — it IS a photograph). Height difference sells "the tall man"; frame is part of the art, don't add another border. Closes the CONTENT.md `both-photo` fallback. |

RAW/PROVENANCE: `assets/raw/nbpro/20260809-220938/` — 14 candidates (7 subjects x 2) +
`manifest.json` (sha256 per raw, model ids, full prompts, picks map, plates_sha256 —
all hash-verified against disk). **Raw files are JPEG bytes under .png names**
(gemini-3-pro-image delivered image/jpeg); curated plates were transcoded to true PNG —
never re-serve raws as PNG, always use `assets/plates/`.
Generator: gemini-3-pro-image via `tools/nbpro.py`; prompts in `tools/nbpro_prompts.json`.
GAP-FILL RUN: `assets/raw/nbpro/20260810T053818Z/` — 8 candidates (4 subjects x 2) +
`manifest.json` (full prompts, picks + pick criteria, curated plates_sha256). Same
raw-JPEG-bytes gotcha; curated copies transcoded to true PNG (RGB 8-bit, 300 dpi) via sips.
Rejected: cameo-king-masked-a (edge-cropped), cameo-king-unmasked-b (multi-colour, breaks
single-accent law), cameo-irene-b (pedestal bust), both-photo-b (light paper ground, top hat).

---

## 2. 3D models (GLB) — `assets/3d/`

All glTF 2.0 binary, verified magic + parsed: 1 mesh / 1 primitive / 1 material,
exactly 100,000 tris each (800k total for the set of 8), UVs + normals + 3 PNG PBR textures
(basecolor / metallic-roughness / normal), ~8.1–8.9 MB each.

**SCALE WARNING (applies to every GLB):** YVO3D-normalized to ~2.0 units on the longest
axis, centered at origin — NOT metre scale. Engine convention is 1 unit = 1 m, Y-up,
ground y=0. Scale then lift by `scale x |bbox min.y|` (figures have feet at y ≈ -1.0).
Exact local bboxes: `assets/raw/scenario3d/20260809-221500/manifest.json` → `files[].verify.bboxLocal`.

| File | bbox (parsed) | Target scale | Role in Beat I | Gotchas |
|---|---|---|---|---|
| `holmes.glb` | 0.83x1.96x0.51 | ~0.90 (1.75 m), lift +Y ≈ 0.88 | Holmes standing in grey dressing gown, **note raised in his LEFT hand at chest height** — the watermark prop. Swap into slot `holmes`. | Curated file IS the v2 mesh (sha-verified == raw `holmes-v2.glb`). The note is baked into the figure geometry — conflicts with the scaffold's separate `note` slot + 3D reveal (see TODO #5). Put the hold hotspot on the baked prop or keep the slot note and accept two notes on screen. |
| `watson.glb` | 0.80x1.96x0.47 | ~0.90, lift +Y ≈ 0.88 | Watson standing, brown tweed 3-piece, bowler in his RIGHT hand. Slot `watson`. | Clean. |
| `fireplace.glb` | 1.91x1.96x0.62 | ~0.75 (1.5 m) | Victorian fireplace w/ mantel, blank-faced clock, geometric ember bed. Slot `hearth`. | Intentionally shallow (0.62 deep) — place flush against the -Z back wall; add the amber point light behind the grate (scene's hearth flicker light already exists). |
| `armchair.glb` | 1.39x1.96x1.28 | ~0.60 (1.2 m) | Wingback armchair, oxblood tufted leather — Watson's seat / room dressing. | **No dedicated slot exists** — parent into slot `room` or add a slot (TODO #4). |
| `side-table.glb` | 1.96x1.88x1.96 | ~0.38 (0.7 m) | Round pedestal table, 3 claw feet — where the note rests (i-03). | Same no-slot issue as armchair. Texture drifted washed-out grey vs the mahogany concept — darken/tint the material toward mahogany at load (TODO #6). |
| `hansom-cab.glb` | 0.58x0.80x**1.96 (long axis = Z)** | ~2.0 (4 m horse+carriage) | Carriage arrival outside the window (i-11). Slot `carriage` (child of `street`). | Four-wheeled brougham/growler silhouette, not a strict two-wheel hansom — reads fine as "carriage arrival"; regenerate only if a strict hansom is demanded (TODO #8). |
| `king.glb` | 1.26x1.96x0.67 | **~1.12 (2.2 m), lift +Y ≈ 1.12** | The masked client / King of Bohemia. Slot `client` (the clientEnter beat, unit hadnote). Black vizard over the eyes, deep blue floor-length cloak with flame-orange lining, cream jacket, tall black boots. | At 1.12 he stands 2.2 m vs Holmes/Watson at 1.75 (0.90) — the ENORMOUS read comes from that delta, don't shrink him to "fit". Mask verified over the eyes in the mesh render (raw `king.meshthumb.jpg`); at diorama distance the black eye-band + orange-lined cloak are the identity carriers. Same flat:true swap note as the other figures. Widest figure in the set (1.26 wide at shoulders/cloak) — keep his entrance path clear of the door frame. |
| `king-unmasked.glb` | 1.26x1.96x0.66 | **~1.12 (2.2 m), lift +Y ≈ 1.12** | The King REVEALED — swap into slot `client` inside the `kingUnmask` beat (unit iamking; the mask-drop pantomime covers the swap). Same man/costume as king.glb: proud heavy bearded jaw, brown-grey hair, deep blue cloak with flame-orange lining, cream jacket, tall black boots — NO mask. Closes round-1 **C1**. | Same scale recipe as king.glb (2.2/1.9629 ≈ 1.121, feet at local y ≈ -1.0) — keep the ENORMOUS delta vs Holmes/Watson at 0.90. Mask verified ABSENT at face zoom in the mesh render (raw `king-unmasked.meshthumb.jpg`) vs the masked thumb A/B. Concept = NB Pro i2i unmask edit of the ORIGINAL king concept (identity-preserving), so silhouette/bbox match king.glb within 0.01 — the swap won't pop. Same flat:true note as the other figures. |

Style/perf gotchas for the whole set:
- Textures are baked PBR, slightly more photoreal/worn than the flat-shaded law. Silhouettes
  are faceted and on-style. To lock the look: swap to MeshLambert/flat material sampling only
  basecolor (the scaffold's `swapSlot(..., {flat:true})` option is the hook).
- 600k tris total is fine on desktop; decimate (gltf-transform simplify) for low-end iPad.
- Swap path: `await window.__swapSlot('holmes','../assets/3d/holmes.glb',{scale,yaw,y,flat:true})`
  — fix pivots with the opts, never move the slot itself (slot transforms are the diorama contract;
  focus anchors survive `slot.replace()`).

RAW/PROVENANCE: `assets/raw/scenario3d/20260809-221500/` — 7 concepts + 7 GLBs (incl.
rejected holmes v1 + its concept), mesh thumbnails, per-job logs, `manifest.json` with
Scenario asset/job ids, sha256 map (verified: all curated GLBs byte-identical to their raws;
curated `holmes.glb` == raw `holmes-v2.glb`). Regen: `tools/scenario3d.py pipeline`
(concept ~40s, mesh ~7–9 min; YVO3D internal errors are transient — retry same concept).
GAP-FILL RUN: `assets/raw/scenario3d/20260810T053818Z/` — king concept + GLB + meshthumb +
`manifest.json` (concept prompt with locked style tail, job/asset ids, verify block).
Curated `king.glb` sha-verified byte-identical to raw
(`685a3c95481ce73e721f24fe72e5dffc807126f0875dfe9880eabb013e5d0e53`). Accepted on attempt 1.
ROUND-2 C1 RUN: `assets/raw/nbpro/20260810T064409Z/` — 2 i2i unmask candidates of the
ORIGINAL king concept via `tools/nbpro_edit.py` (gemini-3-pro-image, contents = [inlineData
image, text]; same raw-JPEG-bytes-under-.png gotcha) + `manifest.json` (input image sha,
full instruction, picks + criteria; a picked, near-duplicates). Then
`assets/raw/scenario3d/20260810T064603Z/` — pick transcoded to true PNG (provenance frag),
mesh via `tools/scenario3d.py mesh`, `king-unmasked.glb` + meshthumb + `manifest.json`.
First YVO3D job failed transient-internal (documented in manifest `jobs_note`); retry of the
same concept succeeded. Curated `assets/3d/king-unmasked.glb` byte-identical to raw
(`a625a653ecbff912c547308fefcca4bea07c5f10164042e78da6804c5615ba86`). Accepted on mesh attempt 1.

---

## 3. Audio — `assets/audio/`

All mp3, 44100 Hz stereo, 128 kbps CBR (Scenario / ElevenLabs SFX v2). Durations and levels
re-measured on decoded PCM; provenance sha256 verified curated == raw source for all 7.
`assets/audio/manifest.json` carries per-file sha256, raw source, loop points, levels.

| File | Duration | RMS / peak dBFS | Play at | Role / app cue mapping |
|---|---|---|---|---|
| `room-bed.mp3` | 25.051 s | -37.3 / **0.0 (full scale)** | 0.8, loop | Sitting-room bed (fire crackle + clock tick) → app bed `hearth` (i-00, i-14). Loop the ENTIRE file 0→25.051 s (seamless-loop mode). Peak decodes at full scale (manifest says -0.3) — do not boost. |
| `street-bed.mp3` | 25.051 s | -40.1 / -27.0 | 1.0, loop | Distant London night → app bed `street` (i-11). Intentionally distant; ~27 dB headroom, duck under room-bed if layered. |
| `page-turn.mp3` | 1.515 s | -34.6 / -8.0 | 1.0 | Diegetic page turn → app cue `page` (fires on the i-13→i-14 page change). Decays to silence by ~1.2 s — safe to start the visual turn on trigger. |
| `paper-rustle.mp3` | 1.515 s | -46.4 / -17.6 | 1.0 | Letter unfold/handling → app cue `paper` (i-02-post, i-06-hold). |
| `hoofbeats.mp3` | 8.046 s | -21.1 / **0.0 (full scale)** | **≤0.65** | Approach-and-stop → app cue `hoofbeats` (i-11). Cap volume so it reads as outside the window. Fully stopped by ~7.5 s; the unit's 2.6 s dwell auto-advances under it — fine, but never overlap door-knock with it. |
| `door-knock.mp3` | 2.038 s | -28.4 / -2.0 | 0.85 | Firm triple knock → app cue `door` (i-01-arrival, i-14-hadnote). First hit lands within 0.1 s, no lead-in. |
| `click-soft.mp3` | 0.522 s | -38.5 / -17.5 | 0.4–0.6 | Text-advance tick. **No app cue id fires it today** — wire to the click-verb advance if wanted; debounce rapid taps or use a small player pool. |
| `step.mp3` | 2.000 s | -21.4 / -2.4 | **≤0.7** | Two heavy boot footsteps on wooden stairs → app cue `step` (i-13-stairs, the colossus on the stair). Cap ≤0.7 so it reads beyond the room door; peak is hot at -2.4. |
| `reveal.mp3` | 1.000 s | -23.3 / -6.9 | 0.4–0.5 | Soft airy non-musical shimmer → app cue `reveal` (press-and-hold watermark payoff). Fire when the hold RESOLVES, not on press; keep subtle. |
| `book.mp3` | 1.480 s | -23.8 / -0.6 | **≤0.7** | Heavy book pulled from shelf + opened → app cue `book` (gaz1 i-08 AND the index-lookup gate). Peak near full scale — never boost. |
| `mask-drop.mp3` | 0.480 s | -29.8 / -5.4 | 0.85 | Small lacquered object hitting wooden floor — the mask hurled down at the unmask gate (iamking). No app cue id yet; wire to the mask-gate resolve. Starts instantly, silent by ~0.48 s. |

All previously-synthesised cues (`book`, `step`, `reveal`) now have generated files — the
synth fallbacks in `app/audio.js` can be retired at integration. `mask-drop` is NEW (no
synth equivalent existed); the mask-tear pantomime at the `iamking` gate is its only call site.

Loop gotcha: mp3 codec priming (~1152 samples) can gap naive loopers (e.g. expo-av
isLooping). Use a gapless player (AVAudioPlayer numberOfLoops is fine), crossfade
50–100 ms at the seam, or transcode beds to caf/wav at build time. In the scaffold's
WebAudio manager, decoded AudioBuffers loop gaplessly — replace `BEDS`/`CUES` in
`app/audio.js` with decoded buffers; call sites (`audio.bed(id)`, `audio.cue(id)`,
`audio.hold(k)`) do not change.

RAW/PROVENANCE: `assets/raw/audio/20260810T051136Z/` (main run, 14 raws),
`.../20260810T051501Z/` (room-bed re-roll, 2 raws — v2 curated), `.../20260810T051113Z/`
(smoke test, 1 raw), `.../20260810T053955Z/` (gap-fill run: step/reveal/book/mask-drop,
8 raws, all 8 valid, v1 picked for each). Regen: `tools/audiogen.py --only <name> --variants N`
(30 creative units per generation; parses creds itself — the story-orbit `.env` breaks
shell `source` at line 82, so don't source it for this tool). The four new specs are in
audiogen.py's SOUNDS table alongside the originals.

---

## 4. App scaffold — `app/` (the thing these assets drop into)

Verified: all files present at reported line counts; vendored three 0.185.1 (2.2 MB);
round-0 lap CLEAN at both ratios (36/36 shots live, 15/15 units, 0 findings, 13 same-origin
requests, no /node_modules/). Shots: `shots/round-0/{1440x900,1024x1366}/` (18 PNGs each)
+ `shots/round-0/lap.json`. Scaffold manifest: `assets/raw/app-scaffold/20260810T052534Z/manifest.json`.

- RUN: `python3 app/serve.py` → http://127.0.0.1:8150/app/index.html (walks 8150–8160,
  writes `app/.port`). Review lap: `node tools/lap.mjs <round>`.
- DETERMINISM: any new harness MUST load `?harness=1` (latches sim control pre-rAF; kills
  CSS animation). Verified byte-identical PNGs across laps with it, all-different without.
- 15 units in `app/units.js`: i-00-title … i-14-hadnote; page turn fires between i-13 and
  i-14. Hold grammar: press fills k at 1/1.8 s, release bleeds 0.75x; resolving does NOT
  advance ("one click the verb, one click the page").
- 12 slots: rock, room, window, hearth, door, desk, holmes, watson, client, note, street,
  carriage. Camera azimuth/elevation LOCKED 0.86/0.46 rad — open sides are +X/+Z; place
  new props unoccluded from that one direction. Room 7.2x5.4 m, 3.3 m walls, note prop
  0.42x0.30 m, rock plateau top y≈0.1.
- Full hook contract (`__unit`, `__state`, `__swapSlot`, `__setTime`, …) documented in the
  scaffold lane notes and in-file; `window.__ready === true` gates boot.
- Audio ids the scene fires (round-0 order): door, paper, paper, reveal, book, hoofbeats,
  step, page, door — map per the table in §3.

---

## 5. TODO — gaps, ranked by how much they hurt the slice

1. ~~**No masked-client GLB.**~~ **CLOSED 2026-08-10:** `assets/3d/king.glb` curated
   (100k tris, bbox 1.26x1.96x0.67, mask-over-eyes verified in mesh render). Swap into
   slot `client` at scale ~1.12 / lift +1.12 per §2. The violet placeholder can retire.
2. ~~**Nothing is wired yet.**~~ **CLOSED 2026-08-10 (round-1 integration):** all 7 GLBs
   swap in via `GLB_PLAN` (`app/main.js`) using real-world `height`/`depth` + `lift:true`
   + `flat:true` — `assets.tris === 700000`, `assets.missing === []`; 11/11 audio files
   prefetched and decoded to AudioBuffers (`assets.audioMissing === []`), synth kept only
   as a fallback; the watermark beat is the 2D crossfade (note-plate→watermark-plate ∝
   hold k); page-texture is the stretched page ground; both-photo plays at unit `both`;
   all five cameo cards flip on change. Verified by `node tools/lap.mjs 1` (exit 0,
   61 shots × 2 ratios).
3. ~~**Three audio cues have no generated asset.**~~ **CLOSED 2026-08-10:** `step.mp3`,
   `reveal.mp3`, `book.mp3` generated + curated (§3), synth fallbacks can retire; plus
   NEW `mask-drop.mp3` for the unmask-gate pantomime (no app cue id yet — wire at the
   mask-gate resolve).
4. ~~**armchair.glb and side-table.glb have no slot.**~~ **CLOSED:** slots `armchair` and
   `sidetable` added — 14 slots total, both GLBs load.
5. **Note-prop conflict — STILL OPEN and now VISIBLE.** holmes.glb bakes a raised letter
   into the figure mesh; the scaffold's separate `note` slot is the hold target. Both are
   on camera from unit `post` to unit `gaz1`: Holmes holds the baked letter while the
   reader's note floats unsupported mid-room with the cue ring on it
   (`shots/round-1/1024x1366/05-i-05-hold.png`). Resolutions, cheapest first: (a) an
   art-lane holmes.glb without the baked letter, (b) parent the slot note to a hand-height
   offset on the holmes rig so the two read as one letter changing hands, (c) hide the slot
   note and raycast the baked prop (loses the lift-to-lamp motion).
6. ~~**side-table.glb texture is washed-out grey.**~~ **CLOSED:** tinted `0x9a6038` at load.
7. **GLB textures are more photoreal than the flat-shaded law** — `flat:true` (Lambert,
   basecolour only, normal + metallic-roughness samplers dropped) is applied to all 7 in
   `GLB_PLAN`. **Decimation NOT needed and NOT applied**: all 700k tris are retained and
   the shipping DPR2 path measures p50 3–4 ms / p95 4–6 ms on ANGLE/Metal at both review
   ratios (`shots/round-1/lap.json` → `reports[].perf`). Re-measure before targeting a
   low-end iPad; GLB geometry alone costs ~2.3 ms of that.
8. **hansom-cab.glb is a four-wheel growler, not a two-wheel hansom.** Fine for the window
   beat; regenerate only if strict silhouette is demanded.
9. **Cameo card + leader line DONE; chapter-head ornament still missing.** The cameo card
   masks the landscape busts into a rounded oval lower-left with a small-caps caption and
   flips holmes → king-masked → king-unmasked → irene; the hairline leader draws on 27/38
   units. `cameo-watson.png` is wired in `CAMEO_URLS` but **no unit uses it** (Watson is
   the reader). No headpiece ornament art exists — the head unit uses a rule + numeral.
10. **Minor style deviations, accept or re-roll late:** cameo-watson herringbone
    micro-texture; page-texture not tileable (stretch/mirror only); **street-arrival.png
    (1024x1024) is still UNUSED** — the carriage beat is 3D only.
11. **king-unmasked.glb (NEW, round-2 C1) is not wired.** Builder: inside the `kingUnmask`
    beat (unit iamking) swap slot `client` king.glb → `assets/3d/king-unmasked.glb`, same
    opts (height 2.2 / lift / flat:true, yaw unchanged); fire it at the mask-drop moment so
    the pantomime covers the swap, alongside `mask-drop.mp3`. Silhouette/bbox match within
    0.01 so the swap won't pop.
12. ~~**Level/loop hygiene at mix time.**~~ **CLOSED:** beds get an 80 ms seam crossfade
    baked into the decoded buffer, so `loop = true` is gapless. Shipping levels in
    `app/audio.js` `BED_FILES`/`CUE_FILES` are the §3 caps: room-bed 0.80, street-bed 0.55
    (ducked), hoofbeats 0.65, door 0.85, book 0.70, step 0.70, reveal 0.45, mask-drop 0.85,
    click 0.40. Re-measured on ffmpeg decode, the four gap-lane cues are HOTTER than the
    manifest claims — step peaks **-0.4** dBFS (manifest -2.4), book **-0.5** (manifest
    -0.6), reveal mean **-19.8** (manifest -23.3). Treat the caps as hard ceilings.

---

## 6. Report-vs-disk mismatches found during reconciliation

Nothing material. Two sub-dB audio measurement deltas (decoder rounding):
- room-bed.mp3 peak decodes at 0.0 dBFS here vs -0.3 in the manifest — treat as full-scale.
- paper-rustle.mp3 RMS decodes at -46.4 dBFS vs -47.4 reported.

Everything else matched exactly: plate dims/PNG-ness/300 dpi, raw-JPEG-bytes claim, all
manifest sha256 maps (plates, GLBs, audio raw+curated), GLB tri counts and bboxes, curated
holmes == holmes-v2, audio durations, scaffold line counts, 18+18 shots, lap 0-findings.
