# MEMORY-ROUNDS MINE — every 3D-asset / review-loop / gate lesson, with its incident
Mined 2026-08-21 from:
- /Users/samz/.claude/projects/-Users-samz-Documents/memory/gaslight-remake.md (round-by-round memory)
- tools/ody/BAR-3D.md (Fable's 3D sign-off bar)
- .src-worktree/review/fable-pass/notes.md (rounds 1-4, F1-F17)
- tools/ody/REVIEW-notes.md (Fable round-2 eye review, E1-E5)

Format: each finding is a LAW (must hold, enforced), RECIPE (do it this way), GOTCHA
(trap that cost us a round), or DEAD-END (tried, killed — don't retry). Each carries
its originating incident and the numbers.

---

## A. THE 3D ASSET PIPELINE (character photo-rig)

### A1. RECIPE — The proven character pipeline, ~$1-3/character, zero manual DCC
Portrait → NB Pro (gemini-3-pro-image, tools/nbpro*.py) → Tripo 3.1 smart-low-poly via
Scenario (tools/tripo3d.py) → free auto-rig (Make-It-Animatable HF Space, Mixamo
skeleton) → Blender normalizer (tools/blender-normalize-weights.py, headless-
deterministic) → three.js AnimationMixer.
UPGRADED (photo-rig lane, 2026-08-20/21): NB Pro stylize → NB Pro multi-view →
tripo-p1-multiview-to-3d → tripo-rigging-v1 (biped) / v2-5 (quadruped).
Costs measured: King photo-rig lane ~$3 (4 NB Pro images + 2 Scenario jobs, ~6 min job
time); Polyphemus ~$3.0 incl. 6 NB Pro images; crew pair $1.93, ram $1.69 — both under
$2 caps. Rig jobs 70 CU, multiview mesh 75 CU.
INCIDENT: three separate builds (King 6c1267f, Polyphemus 6c1f791, cast 5ae846b) all
smoke-PASS live with this exact chain.

### A2. LAW — STYLIZE FIRST (the anti-photoreal law)
Never feed a photo/photoreal portrait straight to reconstruction. NB Pro i2i to a
smooth game-avatar register FIRST; reconstruction comes out dramatically cleaner.
INCIDENT: King photo-rig (2026-08-20) — stylize-first mesh was dramatically cleaner
than the old photo-direct Tripo mesh from the original pipeline.
COROLLARY (cast round): STYLIZE-SKIP is legal when the source is ALREADY a low-poly
render — crew/ram canonicals went straight to multi-view (same-person gates: tunic
dRGB 13, fleece dRGB 7) and Tripo P1 reconstructed them cleanly.

### A3. RECIPE — Multi-view generation with the accepted front as reference
Generate left+back views WITH the accepted front image attached as reference
(tools/nbpro_edit_mv.py, multi-image Gemini i2i). Gate with a same-person check:
crown-band hair mass lum<150 non-skin + lining-where-edge-visible + coat dRGB<=30.
GOTCHA inside: the first gate draft FAILED on 2 instrument artifacts, not real drift —
tune the instrument before condemning the asset.

### A4. GOTCHA — Tripo catalog traps (cost a blind alley each)
- Tripo Rigging 2.5 is QUADRUPED+ ONLY (rigType quadruped|hexapod|octopod|avian|
  serpentine|aquatic). Rigging V1 is the biped track: 41 joints, twist bones, banked
  biped:walk retarget at rig time, includeRiggedModel=true returns rig-only + retarget
  GLBs.
- biped:idle IS banked in rigging-v1 (allowedValues incl. idle/run/jump/hurt).
- 3d23d models accept the RECONSTRUCTION JOB'S OWN OUTPUT ASSET ID as `model` — no
  re-upload.
- Public catalog = GET /models/public?filter=... — plain /models is team-private only.
- Two retarget jobs in PARALLEL against the SAME mesh asset id work fine (70 CU each).

### A5. GOTCHA — rigging-v1 has NO posture hints; fix posture code-side
The live schema exposes model/animation/includeRiggedModel ONLY — no skeleton/pelvis
hint. Posture defects CANNOT be fixed by re-rigging.
INCIDENT (demo3d c38ef93): Ulysses rig pelvis at 0.485 of stature (low), banked walk
bowed the head 16.3-20.4°.
FIX PATTERN (held 3 times — Ulysses, Polyphemus, crew/ram): bake a local-X counter-
rotation into the clip's quaternion tracks per key (slerp right-invariant → exact) +
zero the bind back-lean on node rotations, all BEFORE the mixer. Shared CLIP_CORR
{Spine02:4, NeckTwist01:5, Head:6} took head bow 16-20.5° → 1.4-6.1°. Instrument:
tools/rigpitch.py (numpy-only GLB skeleton parse, --corr tuner).
SUB-GOTCHA: rigpitch --corr applies corr to REST too — tune off the WALK numbers only.

### A6. LAW — THE GROUNDING LAW (two escalations)
v1: a retargeted clip drives the skeleton BELOW the bind-pose bbox. INCIDENT: the King
sank to mid-thigh. Ground by sweeping the clip for min foot-bone world Y; measure the
bind sole BEFORE the mixer exists — mixer.setTime(0) already applies clip frame 0, not
the bind pose.
v2 (MESH-accurate): a quadruped's hoof MESH hangs below its last limb JOINT — the
joint sweep left the great ram FLOATING. Sweep the SKINNED VERTICES:
SkinnedMesh.getVertexPosition(i, v) sampled at 24 clip times, lift by the min. (This
three build has no boneTransform.)

### A7. GOTCHA — THREE sanitizes '::' out of node names
Tripo quadruped skeleton names joints 'tripo::Head_2' etc.; three.js PropertyBinding
sees 'tripoHead_2'. Bind against the sanitized name or nothing animates.

### A8. RECIPE — $0 cast multiplication and prop tricks
- One rig, many actors: slate elder = HSL tint on the crew rig ($0); flock = the ram
  rig at the ewes' 24 px stock height ($0).
- Walk+idle on ONE model: load both retarget GLBs, play the idle clip's tracks on the
  walk model's mixer — same rig, node names bind.
- Props pure code: kylix bowl 492 tris, ember-tip stake 186 tris with MATERIAL-STATE
  glow + PointLight cycling 16 s on simT, wineskin 348 tris; mulberry32 seeds. Smoke
  asserts the glow toggles.
- Per-member 'grade' albedo multiplier in the cast registry. INCIDENT: near-white
  fleece went BLUE under the night hemi fill (warm-albedo crew was fine) — fixed with
  grade [1.30, 1.10, 0.82], smoke asserts slate warm-mass → 0.

### A9. LAW — POSTURE IS CHARACTER; amend the gate, don't "fix" the model
INCIDENT (Polyphemus): the hunch is canon. Measured canonical stance with
tools/polystance.py (hip→head band centroid lean; head rides LEVEL at 0.75°), then
AMENDED gates around it: |standing-0.75|<=8, walk/idle dev <=12. Ram nod range 8.8°
(law <=12), body pitch -5.2..+3.7 through the clip. The gate encodes the character
sheet, not a generic "upright" ideal.

### A10. RECIPE — Instrument a signature feature end-to-end, accept honest failures
INCIDENT (Polyphemus eye, O.1): tools/polyeye_stats.py = frontal saturated-amber blob
detector + structural profile-orb (bright-orb + warm-gold compound in the brow zone,
4-15.5% of figure height; nose sits lower). First profile FAILED honestly (sclera
only) → regenerated. On the BAKED mesh a strict profile shows sclera bulge only — the
iris faces forward in 3D (physical, NOT drift); turntable proof needs --gain 1.3
because raw renders are dim.

### A11. DEAD-END — verdicts from PIPELINE-RESEARCH.md
- Hybrid head-graft = Tier 2 (not the mainline).
- Blender from-scratch heads = likeness front-only; does NOT replace Tripo.
- Procedural quadruped fallback: never needed — rigging-v2-5 made the ram a real
  photo-rig.
- Nolan-Odyssey movie frames as motion seeds: DECLINED (film IP + actor likeness on a
  public site). All motion seeds come from our own sealed canonicals.
- SAM 2 for matting the video loops: never needed — navy-key on flat #1a2038 held at
  0.0% bg contamination. (SAM2-on-plate for hero MOTION is a separate conditional GO
  at ~$0.33/motion, reserved for hero moments; conditions = identity drift + shadow-
  band carry.)

---

## B. 3D SETS (img2threejs staged builds, sea3d)

### B1. LAW — THE BAR (BAR-3D.md, Fable's sign-off; verbatim criteria)
1. SAME PLACE, SAME MOOD — side-by-side compare.jpg vs the painted plate at the
   book's framing; landmarks in position, the plate's light story present.
2. NO BLOCKOUT SURVIVORS — every visible object through form AND material passes;
   a set WITHOUT ITS PASS LOG (per-pass render + judgment) is an AUTOMATIC FAIL.
3. THE WATER LAW — water is a surface: wine-dark base, coherent emissive moonpath
   with seeded sparkle, swell, shoreline foam. "Square white confetti" is the named
   failure.
4. CRAFT DENSITY at the cave's level — createCaveScene.js is the shipped bar for
   prop count / silhouette richness / material variety per m².
5. STORY INTEGRITY — the 81-unit walk passes on the rebuilt set, all gates green,
   zero console errors, per-beat screenshots refreshed. "Lap clean" is NOT sign-off.
6. FABLE'S EYE, FINAL — majors block, minors logged with round number. The owner's
   eye outranks Fable's; Fable's outranks every instrument.

### B2. RECIPE — Staged passes, each rendered through the REAL page
sea3d.js rebuilt via img2threejs stages (spec→blockout→structure→form→material→
lighting), EACH pass rendered through the real page and judged vs the plate, logged
with renders in 3d/sea/passes/passlog.md. The log is the proof (see B1.2).

### B3. LAW — THE PLATE IS A LIT RENDER: bake the painter's light, keep the live rig weak
Bake the plate's own light logic into VERTEX COLOR (gradeFacets: lit/dark by facet
normal · painter-moon direction + eastDark), then keep live lights weak (key 1.4 /
hemi 0.95). Light the set from where the PAINTER lit it (up-left-front), not where the
prop moon sits.

### B4. RECIPE — The water pattern
ONE world-space plane, swell displaced in the vertex shader (flatShading derivatives
relight facets for free), per-face attributes for band/spark/foam/glow,
`totalEmissiveRadiance += diffuseColor.rgb*0.26` as the painted floor (plate water is
never black). Moonpath = 2.6 m QUANTISED-hash patches — per-face dither reads as
sequins, which was the pass-1 defect class.

### B5. GOTCHA — BUG CLASS: inside-out winding on hand-built wall quads
You see the culled INTERIOR: black faces + mottling through the silhouette. Check
winding FIRST when a custom-grid mass renders dark/hollow; the turntable catches it at
90°/180°.

### B6. GOTCHA — BUG CLASS: additive billboard vs ORTHO depth (sea3d round 4)
A sprite big enough to carry a painted sky wash sits IN FRONT of geometry farther
along the view axis (moon at z -11.8 vs upstage water at z -30) and bleached the
moonpath: 3,436 blown px vs the plate's 1,349 (182 with the halo off). renderOrder
does NOT help — sprites are in the transparent pass, drawn after all opaque solids.
FIX: put the wash on the SKY DOME as a per-fragment term. Ortho ⇒ screen distance =
world distance perpendicular to the view axis; take the axis from the third row of
`viewMatrix` in the shader so it holds under orbit at any pixel scale.

### B7. LAW — MEASURE, don't eyeball, exposure and tone
- Probe plate PIXELS numerically before judging tone. INCIDENT: eye said "pale grey
  cliff", probe said RGB 68,59,64 — the render was 2x too bright.
- Fable said "several stops darker than the plate": closed by measuring BOTH compare
  halves at the same 1408x768 — mean 30.8|23.0|31.8, median 18.1|12.5|18.0, bottom
  decile 60.7%|81.8%|61.3% (plate|before|after). Instruments made permanent:
  tools/ody/work/sea_expose.py + sea_band.py.
- MEASURE THE FLOOR OUTSIDE THE GLOW: round 2 read the "far-sky floor" as L~30 from
  INSIDE the moon's wash; the frame corners are L 11.6. That one bad datum built the
  halo 2.5x too small. Sample corners, not convenient pixels.

### B8. GOTCHA — Cool-cast on warm materials: lift AND desaturate, don't just brighten
Near-black `coolDark` + steep gamma leaves half-turned facets to the hemi ALONE, so a
saturated navy hemi repaints warm sandstone cold. Lift the dark end of the pair AND
desaturate the fill; raising intensity alone doesn't fix the hue.

### B9. GOTCHA — Discrete dice on a matching facet grid = confetti
1.9 m shard-gap dice on a ~1.9 m facet grid produced per-facet confetti wherever the
envelope narrows. Ramp the gate OPEN continuously and dim over the last third instead.
Also cap `open` < 1 — an uncapped spine welds into one clipped white blob.

### B10. LAW — Keep the ledger contract sacred across rebuilds
sea3d rebuilt with SEA_WORLD/splashAt/ROCKS/sockets untouched → story3d walked all 81
units + both throws UNCHANGED. Sets may be rebuilt; the contract may not drift.

---

## C. SCENE UNDERSTANDING / NAV (SAM2 lane)

### C1. RECIPE — SAM2 labels the scene, ledger boxes fill the gaps
meta/sam-2 on Replicate (automatic mask gen, ~40s) over the plate → 84 regions →
label by ledger-box overlap >=0.4 (position/colour fallback) → walkable = floor band
minus (masks + ledger boxes) dilated by HALF-FOOTPRINT → 4px A* grid (bit-packed),
string-pull smoothing, supercover LOS.
FEASIBILITY NUMBERS: auto-ledger mean mask-IoU 0.295 / union-bbox-IoU 0.380 over 12
core boxes. Well-segmented: fire ring .61/.80, racks .66-.72, boulder .63, tubs
.57-.77. UNSEGMENTED (ledger boxes saved us): firewood pile, logsRight, fire rimNW.
FOUND BEYOND LEDGER: whey tub, cream bowl, grey mouth stone — now block nav honestly.
VERDICT: SAM2 augments the hand ledger; it does not replace it.

### C2. LAW — DECAL LAW
Flat floor-paint regions (grayStd < 24 within mask, >=90% inside the floor band) are
walkable DECALS, not obstacles. Clean separation measured: decals <=19.5, real objects
>=34.1. Without it the giant-seat chute closes.

### C3. LAW — Footprint-not-fortress
Big uniform dilations DISCONNECT the world: demo3d's 10px fire law + big dilations
closed a 14px lane (whey-tub base to ring-box top). Half-footprint ellipse (9/5 px,
fire 12/6) + cell-center-walkable + dilation >= cell-diagonal guarantees paths
formally never touch raw masks/boxes (margin ~2-3px) while keeping ONE connected
component.

### C4. LAW — PROCESSION LAW
All cast on the audited corridor at ONE shared speed → spacing invariant forever (min
gap measured 180.5 px); no actor can cross another or a ledger box; every position is
pure f(simT) off seed 940127. Determinism byte-identical in smoke.

### C5. RECIPE — Particles as pure GPU functions
3 ShaderMaterial Points systems (120 embers / 50 smoke / 140 dust = 310), ALL flight
in the vertex shader as pure f(uTime=simT, baked mulberry32 seeds) — zero CPU per
frame, one draw call each, loop-free Lissajous for motes.

### C6. GOTCHA — Playwright headless = SwiftShader; frame-time gates need real GPU
~520 ms/frame on ANY of these pages under default headless (shipped demo3d was gated
that way too). Launch args --use-angle=metal --enable-gpu --ignore-gpu-blocklist →
real M4 GPU, 16.7 ms. Never write a frame-time gate without them.

### C7. RECIPE — Cutout occluders ride the book's ground lines
firering/woodpile/tub *-front-shut.png occluders use the living book's GROUND lines
(503/550/546): actor footY past the ground line → cutout z 5/45. 3D and 2D share one
grounding truth.

---

## D. REVIEW LOOPS — the laws that came from being wrong

### D1. LAW — "Lap clean" is NOT visual acceptance; every fix ships WITH its own lap assertion
INCIDENT (Fable round 1, 2026-08-13): 14 defects, 8 MAJOR — five of them were
CLAIMED FIXED and were not (F7 ring push never wired, F9 Watson still painted, F10
heading still black at ~2% luminance, F4 bride still faceless, F8 no vehicle). None
had lap assertions. The law was written into the round-1 verdict; round 2 shipped 14
per-fix gates all green and was ACCEPTED. lap.mjs now carries per-fix gates
permanently and supports --base <url> for live laps.

### D2. LAW — The eye outranks the instrument; "physically correct" is a defect wearing an explanation
INCIDENT (round 4, F15-extended): round 3 exempted lamp2's column because its front
cut drew a parked rig "correctly" behind the post. The user's eye rejected it — a
carriage merged with a standard at a DWELL reads broken whichever wins the paint
order. Norton's cab dwelt at u 0.36 (body 664..829) square across lamp2 for three
units. Hierarchy is codified in BAR-3D §6: owner's eye > Fable's eye > every
instrument.

### D3. LAW — Fix the CLASS, not the instance
INCIDENT: round 3 fixed two parks and KEPT the lamp2 exemption; round 4 had to remove
the class entirely — at every settle, every rig clears EVERY true post column >= 10
plate px, 11 settles measured. Same pattern in the teleport round: Sol found ONE
1-frame snap; the fix was the swapActor tween law over ALL 8844 tick-pairs, and "every
handoff between animation states is a defect site."

### D4. LAW — Assert PAINT layers directly; never infer from state
INCIDENT (round 4, F17 — the mask): room.js painted `un` off S.unmask alone; the
sentinel (-1e9) clamped the fade to 1, so the standing King rendered bare-faced FOUR
UNITS before the mask gate. The STATE was always right; the PAINT ignored it. THREE
review rounds missed it (walk frames carry masked art; 01-16 is legitimately unmasked;
the 01-14 dwell was only seen at contact-sheet scale). Fix: paint obeys S.masked;
sprite opacities asserted on all three paths (ormstein 1/0, iamking 0/1, letter1 0/1).
Related timing gotcha: goto-replay re-fires walks at NOW — dwell 3.5s+ before reading
standing sprites.

### D5. LAW — Gates must measure the RENDERED thing, not the model's anchor
INCIDENT (flash+seams round): the stance gate measured the ANCHOR, reported 0.000px
drift while the real PIXEL slid 12-13px. Rebuilt optical. Same family as D4: assert
what the reader sees.

### D6. LAW — REPRODUCE first, through the reader's own harness; settle shots hide dwell and mid-travel bugs
INCIDENT (round 3, F15 — "cart passes through the light"): the defect lived in the
dwell AFTER motion; settle shots hid it. tools/living/_crossingprobe.mjs steps every
rig travel at 4fps through the reader's own harness. Offline pixel-walks misled TWICE
before this — reproduce in-harness BEFORE modelling geometry offline. Review EVERY
scene (9 contact sheets, all 74 frames), not just the evidence frames.

### D7. LAW — Sampled-still review misses continuous-motion defects; instruments must cover what the eye can't
INCIDENT (seamless round): user's "drifting/floating, placement wrong, audio just
noise" — audio had shipped with ZERO ear review, motion with still-frame review only.
Gained: velocity-profile instruments, gait physics (step pulse off strip plant
anchors), audio mastering gates (LUFS bands, TP<=-1, SFM<=0.3, duck>=6dB), per-set
REGRADE bake (dE 22-36 → 4-8), contact shadows (the book had ZERO shadows),
perspective gate (drawn scale within 12% of plate-implied px/m).

### D8. RECIPE — External reviewer (fresh eyes) catches what your own gates can't
INCIDENT (Sol round): GPT-5.6-sol via Codex CLI caught 2 CRITICALS the lap missed —
a hold soft-fail deadlock (reader stranded forever) and the sacrifice tableau MISSING
while all gates were green (§3.4 recommitted as a staging-body assertion). Practical:
codex `-i` takes mp4 VIDEO; prompt via stdin when images attached;
--skip-git-repo-check at non-git roots; full output in ~/.codex/sessions/ if tail
clips.

### D9. GOTCHA — When capturing motion for review, RESOLVE THE GATES first
INCIDENT (Sol round): unresolved gates made dwells read as static → 2 false positives
in the external review.

### D10. LAW — The 3D-actor verdict itself (the biggest finding of all)
After ALL experiments (3D track, blender, living-plate, hd2d, bento engine bake-off):
the ART is the product; 3D characters LOST to painted plates + sprite cutouts by the
user's eye, repeatedly. The Living Book (2D-first, 38-unit grammar byte-identical) is
the capstone. 3D is now the demo3d/cast exploration lane, held to the plate's look
via BAR-3D — not the mainline reader.

### D11. LAW — Staging must be asserted AT the ticks, per the accepted stage proof
INCIDENT (REVIEW-notes E2): the blinding tableau had the stake's glowing tip aimed at
the FIRE, not the eye; the sprawl lay behind the crew line reading as grey stone. Fix:
restage per the accepted stage proof AND make the O.9 gate assert tip-in-eye-box AT
auger AND bore ticks — not just once.

### D12. LAW — Actors belong to their acts; gate mounting to the act
INCIDENT (E1 MAJOR): ram actors loose on the cave floor in Beats III/IV when they
belong to Beat V only. Gating them to dawn/escape acts also killed E5 (cool/crisp ram
cutouts vs warm firelight) for free — one class fix, two defects.

### D13. LAW — Close-up floors (the CLOSE-UP LAW round)
Owner: "scene large, character small = worse, esp. small screens." Per-unit class
floors audited off the CONTRACT staging column: character close >=30% of panel
height, two-shot >=22% (floor = drawnH*k/768); wides only for headings/arrivals/
establishing, max 2/beat after heading. 20 units recomposed, 9 new lenses, LAP CLEAN
46 gated settles, worst margin 21.9%/22.
KEY FINDING: k 8-14 closes on 11-13 px/m sets look GOOD — the plate blurs painterly
(free DoF read) while 600+px actor cuts stay crisp.
GOTCHAS: (1) high k magnifies plant glide — no close on a mid-walk principal
(anti-skate is a CSS-px law); (2) gate miss-probes must avoid the enlarged hit
surface (council miss re-aimed to open sand); (3) ledger lenses HAD DRIFTED from sets
— re-recorded, 47 lenses. Registries drift; re-audit them each round.

### D14. LAW — Every fix round can REGRESS an earlier fix; re-review the polish
INCIDENT (flash+seams): the arrival settle "polish" introduced a 64px snap — a
regression found only by Sol's re-review of the seam class. Teleport law: swapActor
tween 120ms fade + 180ms mark lerp, [teleport] gate = per-tick centre <=3.5px + zero
bare art swaps, 8844 tick-pairs green.

---

## E. VIDEO / MOTION ASSETS

### E1. RECIPE — Pose bridges: condition video on TWO gated stills
Seedance conditioned on first=pose A, last=pose B: the video IS the action between
approved keyframes. Gates: endpoint match <=15%, monotone progress, play-once driver
clamps frames to act k. 10/10 shipped. Loop variant (vidgen.py first+last-frame trick)
= closure by construction; loop closure gate <=12%.

### E2. LAW — ANTI-SKATE + honest failure
Planted foot <=2.5 css px/frame (measured 0.45 on shipped loops). King retune:
pxPerFrame = 2·stride/n + walkToward speed caps — killed the damp's 216-550 px/s
opening sprints. HONEST FAILURE precedent: crew-row kept 4 frames because 10-frame
cycles failed gates — ship the honest asset, not the pretty liar.

### E3. LAW — [strip-luma <=4]: deflicker between gated endpoints
INCIDENT: the falling giant FLASHED — Seedance exposure pumping, 13.6 luma
adjacent-cell swing across strip cells. deflicker.py ramp-normalizes between gated
endpoints; law is adjacent-cell luma swing <=4.

### E4. GOTCHA — THE BLOB LAW (e0a0871): >4 concurrent <video> elements
Chromium's media loader suspends + self-aborts one (net::ERR_ABORTED, no code at
fault). FIX: Stage.loadVideo owns ALL video bytes — single owner, budgeted.
SIBLING GOTCHA: vid.src + later vid.load() = self-aborting fetch — ONE load only,
ready-promise at birth.
LAP SIBLING: a late __gotoUnit on the read's page rewinds hero-clip videos; the
aborted range fetch trips zero-console-errors (flaky requestfailed) — run the [shot]
band probe on its OWN page.

### E5. RECIPE — Hybrid by camera stop (SHOT architecture, 7-lane research verdict)
Close-ups are AUTHORED SHOTS (character painted/generated IN scene, shot rail in
stage.js, zoom cap k<=2.5, 250ms sim-clock crossfade); wides keep composites + the $0
fixes (light wrap/edge decon, shared seeded grain + stage grade, atmosphere
sandwich). A-recipe: staged-tableau seed → nbpro one-register repaint. B-recipe: seed
→ Seedance clip. SHOT_PENDING in the lap is the ratchet — retire a row when its shot
lands or lens falls to 2.5.

### E6. LAW — Strip cells gated numerically off sealed canonicals
Identity cluster ±20 vs canonical, scale drift, per-frame foot anchors (the King's
anchor law). Ram strip needed palette stat-match (+85 warm → +15). strips.json is the
registry; strip_slice_gate.py the gate.

### E7. LAW — One art register per frame
INCIDENT (F4 MAJOR, the root of "marriage scene looks wrong"): painterly sprite-
Holmes beside faceless low-poly mannequins; Norton in TWO renders at once. Two
Nortons, two worlds. Never mix registers in one frame; the fix repainted all four
participants (0% mannequin cloth in all 4 plates). Round-2 nuance: a low-poly gown
under a painted face was ACCEPTED as the book's cameo-card iconography — register
consistency is judged, not mechanical.

---

## F. PROCESS / INFRA GOTCHAS

### F1. GOTCHA — Never pipe the lap verdict
`| tail` eats the exit code → shipped a RED build once (SHOT round). Run the lap
bare; read exit status directly.

### F2. GOTCHA — Blender MCP: ONE lane at a time
Concurrent socket commands during renders SEGFAULT Blender (:9876 addon socket).

### F3. GOTCHA — Keys parsing
Scenario/Gemini/ElevenLabs keys in ~/Documents/story-orbit/.env: parse IN-PYTHON —
shell source breaks at line 82; never print values.

### F4. LAW — Raw-first
ALL generated assets under assets/raw/<lane>/<ts>/ with sha256 manifests (and gate
results in manifest.json — photo-rig lane carries 6 gates there). Registries carry
sha twins (tools/ody/shots.json + app/shots.js; 3d/cast.json with file/sha/clips/
scale/tint/grade/posture — the page builds everything from the registry).

### F5. GOTCHA — Workflow-agent stall pattern (struck 3x)
Long art lanes die at the 180s no-progress detector even with anti-stall prompts.
Recovery that works: work SURVIVES on disk — inventory tree + journal, run the lap to
see which gates already pass, finish the remainder inline yourself.

### F6. GOTCHA — Stale views after deploy
Pages caches ~10 min — a look within minutes of a deploy can be stale;
console.story-orbit.org serves no-cache. Check WHICH you're judging before filing a
defect.

### F7. LAW — Ship visible results fast
The user judges by EYE on deployed pages — demo-first over instrument-gated
perfection; they interrupt long loops. Every round above ended in a live deploy +
live smoke.

### F8. RECIPE — units.js is EMITTED; extend the emitter, not the artifact
Shot tokens live in emit_units_ody.py STAGING (+ ORDER_KEYS shot/shotAt,
validateUnits(units, shotsBySet)). Hand-editing emitted files is the drift machine
D13 caught.
