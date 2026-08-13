# PIPELINE-RESEARCH — Synthesis: the character pipeline recommendation

Date: 2026-08-10. Synthesized from 9 research lanes (8 web, 1 empirical) plus direct
inspection of this repo (figures.js contract, tools/headcut.mjs + kinghybrid.mjs,
review/hybrid renders, assets/raw/hunyuan empirical run).

---

## 0. Executive summary

**Buy rigging, not animation.** Every lane converges on the same shape: the scarce,
purchasable artifact is a *skinned mesh on a standard skeleton* (skeleton + blend
weights). Animation is NOT scarce for this app — the repo already owns a
better-than-clip locomotion system (procedural gait with a measured 0.05 m foot-slide
gate that baked walk clips would *regress*, per round-8 history), and for future works
the free Mixamo library + name-based clip binding covers walk/idle/gestures once every
character shares one skeleton.

**The keystone is a canonical-skeleton contract, not a vendor.** Define one ~16-bone
skeleton spec (Mixamo-compatible names, identity rest rotations, +Z facing) as JSON in
the repo. A headless normalizer script (gltf-transform / bpy) forces every auto-rigged
GLB to conform. Then: characters are interchangeable, clips transfer by bone name with
zero runtime retargeting, the app's existing `pose()` can drive the bones directly
(Lane 7 Mode A), and the rigging vendor becomes a swappable commodity behind the
contract — which is the real lock-in defense.

**Winner: Scenario generation (already working) + Tripo platform rig API + headless
normalizer + Mode A app integration.** ~$0.55–0.95/character, ~0 manual minutes,
falsifiable this week for under $5 using the already-generated `king2-tripo.glb`.
Meshy-via-fal.ai is the drop-in second source ($0.20/rig, no subscription); self-hosted
Make-It-Animatable (MIT, emits Mixamo skeletons) is the long-term cost/lock-in exit ramp.
The in-flight head-graft hybrid is a *legitimate production pattern* (Quake3/Roblox
lineage) and the right ship vehicle for the current work — keep it as Tier 2 — but it is
not the endgame, because full-body AI identity (costume, silhouette) is where generation
earns its keep.

---

## 1. The convergent architecture (what all lanes agree on)

1. **Stylize-first image step is load-bearing.** Portrait/concept → Gemini/flux with a
   FIXED prompt template: full-body, front-facing, **A-pose, arms away from body, legs
   apart**, flat colors, plain background. Template constancy is what keeps a cast
   coherent (Lane 6) and A-pose is the #1 controllable predictor of auto-rig success
   (Lanes 0/1/2/3). `king2` was generated arms-at-side — acceptable for the head graft,
   a risk for rigging; fix upstream in the prompt, not downstream in DCC.
2. **Always run Scenario's synchronous `POST /v1/generate/remove-background` before any
   image→3D call** (Lane 8, empirical): with the raw plate, Hunyuan meshed the backdrop
   into a 2×2 ground disc; the cutout fixed it. Cheap, scripted, already proven in
   `tools/hunyuan3d.py`.
3. **Tripo 3.1 stays the base-mesh generator.** Lane 8's head-to-head (same input, same
   harness) : Tripo wins likeness, limb separation (fingers vs mittens; arms vs
   arm-cape fusion), glTF hygiene (normals present, matte material, 1.8 MB vs 4.3 MB);
   Hunyuan wins only exact face-count. Hunyuan = diversity fallback only.
4. **Rig via API/ML, never per-character DCC.** Mixamo/AccuRig are quality-competitive
   but GUI-bound (3–10 manual min/char, ToS-gray automation, maintenance-mode platform)
   — disqualified as the *primary* path by the no-manual constraint; retained as the
   documented fallback tier and as a one-time free clip-library source (commercial-OK).
5. **Normalize every rig to the canonical skeleton offline** (rename bones, rebind to
   identity rest, prune extras, zero hip XZ in clips, validate ≤4 influences /
   normalized weights). This single script preserves ~90% of `figures.js`'s animation
   half verbatim (Lane 7) and eliminates runtime `SkeletonUtils.retargetClip` (documented
   fragile: three.js #25288, #25751, discourse 54892/65149).
6. **Automated QC gate, vendor-independent.** Every auto-rigger mislabels weights on
   some stylized shapes (StraySpark 2026: Tripo over-smoothed shoulders, Meshy 5–15 cm
   hip offsets, even best-in-class AccuRig is scale-fussy). Scripted turntable +
   walk-cycle render per character → accept / regenerate (retry ≈ $0.35–0.65) → route
   irreducible failures to the fallback tier. The repo's `?harness=1` lap gates
   (byte-identical laps, footSlide ≤ 0.05 m) stay the final arbiter.

---

## 2. Top 3 pipelines, ranked

### #1 — Scenario gen + Tripo platform rig API + canonical-skeleton normalizer (RECOMMENDED)

Requires the one thing not yet in hand: a Tripo platform key (platform.tripo3d.ai,
self-serve, prepaid credits @ $0.01, wallet separate from Studio).

Per character, fully scripted:
1. Portrait → flux/Gemini stylize template (A-pose, full body, plain bg).
2. Scenario `remove-background` (sync) → cutout asset.
3. Generate: keep Scenario Tripo 3.1 (already working, billed to existing sub) — or
   move gen to the Tripo key (`v3.1` + `smart_low_poly` 30+10 cr, or `P1-20260311`
   native game-ready low-poly) once the key exists.
4. `POST /v3/animations/rig-check` (task_id or uploaded GLB) — **free** riggability
   gate; on `riggable=false`, regenerate with adjusted prompt/seed (only costs the gen).
5. `POST /v3/animations/rig` `{spec:'mixamo', rig_type:'biped', out_format:'glb'}` — 25 cr.
6. Download IMMEDIATELY (result URLs die in 5 minutes) into `assets/`, manifest per
   repo convention.
7. Headless normalizer (gltf-transform or bpy): bone renames → canonical map, rebind to
   identity rest, prune, validate, palette-quantize / flatten() texture per style law.
8. App: Mode A `createSkinnedFigure()` — existing `pose()` drives `skeleton.bones`
   (see §4). No AnimationMixer required for locomotion.
9. Optional flourishes: `/v3/animations/retarget` presets (90+ on the v1.0 biped rig,
   10 cr/clip, `bake_animation:true`) as additive clips later (Mode B additive layer).

- **Cost/character:** ~$0.55 (gen on Scenario + rig $0.25 + normalize $0) to ~$0.95
  (gen on Tripo key + smart-low-poly + rig) ; +$0.10/preset clip if wanted. Wall time
  ~5–8 min, parallelizable.
- **Manual minutes/character:** ~0 (a ~1-min QA glance at the turntable render).
- **Why #1:** only vendor with the full chain behind ONE key; free rig-check makes the
  retry loop nearly free; `spec:'mixamo'` emits standard bone names (least normalizer
  work); fastest + cleanest bone naming in the one independent 2026 benchmark
  (StraySpark), best-in-class on a *stylized* test character; rig tech is UniRig from
  Tripo's own lab — the hosted, maintained version of the best open model.
- **First experiment (cheapest falsification, ~$5, half a day):** create key, top up
  $5. Feed the EXISTING `assets/plates/king-v2/king2-tripo.glb` (upload path:
  `file_token`/URL input is documented) → rig-check → rig → load rigged GLB in the
  vendored three.js and (a) dump skeleton: are bones nameable to the canonical map? is
  a scripted rebind-to-identity-rest clean? (b) drive two bones from a stub `pose()`;
  (c) buy ONE retarget walk clip and confirm it plays in AnimationMixer (the single
  undocumented link in Lane 0). Kill criteria: rig-check rejects arms-at-side meshes
  even after A-pose regen; weights unusable at story-scene distance; GLB clips don't
  load. Each criterion costs ≤ $1 to test.

### #2 — Meshy rigging via fal.ai (second source; no subscription) or Meshy Pro (all-in-one)

Same shape as #1 with the rig step swapped:
1–3. Identical (Scenario gen + remove-background), or Meshy `image-to-3d`
   (`smart-topology`, `target_polycount` 4–8k, **`pose_mode:'a-pose'`** — the only
   generator with an explicit canonical-pose parameter, worth testing for that alone).
4. Pre-rotate GLB to face +Z (gltf-transform script; Meshy 422s otherwise), verify
   textured + <300k faces.
5. `fal-ai/meshy/rigging/multi-animation`: $0.20/rig + $0.12/clip, up to 10 clips in
   ONE call, explicitly accepts external GLBs — **no Meshy account needed**. (Or Meshy
   Pro $20/mo: rig 0–5 cr, 600+ preset library, 10 concurrent.)
6. Normalizer: same script, bigger rename map (Meshy bone names are non-standard) +
   hip-pivot validation (its known defect).
7–8. Same as #1.

- **Cost/character:** ~$0.50 (gen) + $0.20 rig (+$0.12/clip) ≈ **$0.70–1.30**; or
  ~$0.30–1.00 all-in on Meshy Pro.
- **Manual minutes/character:** ~0 (+ same QA glance).
- **Why #2:** near-identical economics and scriptability; independent evidence says
  Meshy's rig tolerates the *widest topology variation* (good for weird stylized
  shapes) but has the hip-pivot offset defect (5–15 cm → foot sliding — partially
  masked by Mode A since our gait solver, not clips, plants feet, but a bad hip pivot
  still corrupts limb-length measurement); non-standard bone names mean more normalizer
  surface. Keep as the QC-failure second opinion and price hedge.
- **First experiment (~$0.32, one hour):** one fal.ai call with the rotated
  `king2-tripo.glb` + action_ids [0,1] → inspect hip pivot height and shoulder weights
  in the viewer. No account, no subscription.

### #3 — Self-hosted Make-It-Animatable (MIT) + Blender headless + Mixamo clip bank (endgame economics)

1–3. Identical generation front end.
4. Rented CUDA worker (RunPod/vast.ai 4090, ~$0.40/hr; nothing in this lane runs on
   Apple Silicon) running Make-It-Animatable headless via its `_pipeline()` (bpy pip
   module, no GUI): mesh → **Mixamo-standard skeleton + weights in <1 s**; flags:
   input-pose=A, use_normal, weight post-processing. Fallbacks on same box: UniRig /
   SkinTokens (both MIT, VAST/Tripo lab) for non-humanoids.
5. bpy normalizer + `export_scene.gltf(export_animation_mode='ACTIONS')` (multi-clip
   GLB export verified in exporter source).
6. One-time: hand-download ~20 Mixamo clips (free, commercial-OK, no redistribution),
   bake once against the canonical skeleton → shared `animations.glb` for all
   characters, forever.
- **Cost/character:** <$0.05 compute amortized; $0 licenses. **Setup:** 1–2 weeks
  (GPU worker, deploy, QC glue) — the real price.
- **Manual minutes/character:** 0.
- **Why #3 (not #1):** best unit economics, zero vendor lock-in, full determinism
  (pin weights/checkpoints); but research-grade code (missing-bones issues #18/#22),
  thin production evidence, and an ops burden that isn't justified until the cast count
  is dozens-per-month. It is the *exit ramp* if Tripo/Meshy reprice or die — the
  canonical-skeleton contract makes the swap invisible to the app.
- **First experiment ($0, one afternoon):** call the HF Space
  (`jasongzy/Make-It-Animatable`) via `gradio_client` with `king2-tripo.glb`; inspect
  skeleton + weights. Free falsification of the whole lane.

**Explicitly rejected as primaries:** Anything World (viable API, but post-insolvency
~7-person vendor, essentially zero independent quality evidence — worth a free-tier
pilot only as a curiosity); Mixamo/AccuRig manual (violates no-manual, caps throughput
at human clicking speed; retained as documented fallback + clip source); RigAnything
(Adobe noncommercial license — dead); Hunyuan-as-base (empirically worse, Lane 8);
runtime SkeletonUtils retargeting (documented fragility; obviated by the skeleton
contract).

---

## 3. Verdict on the in-flight hybrid head-graft

**A legitimate production pattern and the right ship vehicle for the current work — not
a dead end, not the endgame. Keep it as Tier 2 of a two-tier pipeline.**

- It is *the* proven pattern for rigid-segment casts: Quake 3 tag_head, Roblox
  NeckRigAttachment (billions of daily rigid head swaps), Ready Player Me. The current
  results (`review/hybrid/king2-hybrid.shot-*.png`) confirm it: seam swallowed by the
  collar, mask re-seated, head reads correctly at diorama distance. The animation
  architecture cost is literally zero — the head inherits neck motion; every gate in
  the harness keeps passing.
- Its ceiling: the body stays procedural, so per-character *body* identity (costume,
  silhouette, materials — most of what makes the Tripo king look good) never arrives.
  For "many characters and future projects," generating only heads buys ~30% of the
  visual win for ~100% of a per-character graft-tuning cost (yaw/scale/drop constants
  were hand-derived for king2; that tuning must be automated before graft scales).
- Where it slots permanently:
  - **Tier 1 (target):** full-body skinned character (Pipeline #1), Mode A.
  - **Tier 2 (fallback):** head-graft onto the procedural body whenever Tier 1 fails
    QC (unriggable silhouette, broken weights) or for background characters. Nothing
    shipping today needs to be redone; the king can be upgraded to Tier 1 whenever the
    spike passes.
- Direct carry-overs from the graft work into Tier 1 (none of it is wasted): the
  socket/attachment convention (mask node, carry socket), the neck-plane/collar seam
  law, texture tint/palette matching, headcut's component-filter tricks, and the whole
  headless-chromium GLTFExporter harness.

---

## 4. Migration note — what changes in the three.js app (winning route)

Lane 7 Mode A: **skinned cast, procedural animation retained.** One-time code, days not
weeks; zero per-character app work thereafter.

1. **Skeleton contract** (`app/` or repo root, JSON): ~16 bones mirroring today's J map
   (pelvis, chest, neck, head, upper/lowerArm+hand L/R, upper/lowerLeg+foot L/R),
   Mixamo-compatible names, **identity rest rotations**, +Z facing, rest positions as
   stature fractions. This file is the interface between the rigging pipeline and the
   app; the offline normalizer enforces it — this preserves every hand-tuned gesture
   constant (unmask shX=-0.80/elX=-2.42, toss/reach/carry poses) verbatim.
2. **`createSkinnedFigure()`** alongside `figures.js`: load GLB via existing
   `app/gltf.js`, validate against the contract (names present, rest quats ≈ identity,
   weights normalized, ≤4 influences), measure `thighLen/shinLen/hipX/yHip/shoulder`
   from bind-pose bone translations × scale (replacing the P proportion table — and in
   the same space `pose()` computes in; the YVO3D ~2.0-unit normalization sits ABOVE
   the bones).
3. **`pose(dt,t)` unchanged in spirit:** writes quaternions to `skeleton.bones` instead
   of joint Groups (Bones ARE Object3Ds). Gait solver, plant-lock governor, IK, and all
   scan metrics survive; **no AnimationMixer in the locomotion path**, so the SimClock
   determinism law and byte-identical harness laps hold untouched.
4. **Attachments:** re-create `socket:carryR` as a child of the hand-R bone and
   `maskNode` under the head bone; `fig.joints/fig.socket/fig.mask` keep their handles
   so `scene.js` and `lap.mjs` need near-zero change; mask-tear stays a node detach.
5. **One-liners that will bite otherwise:** `mesh.frustumCulled = false` per cast
   member (SkinnedMesh culls on bind-pose bounds — three.js #11991/#14499); zero/strip
   hips XZ translation in any imported clip (no root motion — staging stays
   code-authoritative via drive.pos/yaw and the teleport valve).
6. **Style law:** AI meshes arrive textured; either bake texture → vertex colors
   offline (palette k-means, as in the graft), or keep basecolor via `flatten()` and
   amend the `fig.style()` ledger for the cast. Decide once, encode in the normalizer.
7. **Later, Mode B additive only:** baked gesture/idle flourish clips
   (`AnimationUtils.makeClipAdditive`, already in the vendored r185 build), one mixer
   per figure stepped with `mixer.update(FIXED_DT)` inside the SimClock stepFn,
   procedural overrides applied every frame AFTER the mixer; scrub by stopAllAction +
   fixed-step replay — **never `mixer.setTime`** (r185 source zeroes action state).
   Baked *walk* clips stay banned: they would resurrect the 0.9–1.65 m foot-slide class
   of bug that rounds 8/8b/8c/8d spent themselves killing.
8. **Head-swap-only variant** (if only Tier 2 ships for a while): no app change at all —
   the graft exports a plain rigid figure; today's code already runs it.

---

## 5. Honest risks

| Risk | #1 Tripo API | #2 Meshy/fal | #3 Self-host MIA | Hybrid graft (Tier 2) | Mitigation |
|---|---|---|---|---|---|
| **Quality** | Shoulder/chest weights over-smoothed (indep. test); "hit-or-miss" animation rep; rig-check criteria undocumented | Hip pivot off 5–15 cm on some chars; mitten-finger fusion; cloth stretch | Missing-bones/robustness issues in repo; thin production evidence; chibi proportions may break it | Style drift head-vs-body (visible in king2: painterly face vs flat body); per-char graft constants not yet automated | Free rig-check + regen loop; automated turntable QC gate; Tier-2 fallback; palette-quantize + flat-shade bake in normalizer; harness gates are final arbiter |
| **Licensing (commercial)** | Paid tier = full commercial rights, no training on your data; **free tier = public + CC-BY, unusable**; VERIFY API wallet inherits paid terms at signup | All paid tiers: outputs "exclusively yours"; free tier CC-BY; fal.ai resale terms — skim once | Code+weights MIT (MIA, UniRig, SkinTokens); Mixamo clips commercial-OK, no raw redistribution, no ML training; **avoid MoMask/HumanML3D (academic terms) and RigAnything (noncommercial)** | Tripo paid terms cover the head mesh | One-page license ledger in repo; never ship free-tier outputs; pin the ToS versions checked |
| **Determinism / repeatability** | Gen is seed-influenced but not guaranteed bit-stable; result URLs expire in **5 min**; rig is one-time per char | Same, + assets expire (`expires_at`) | Fully pinnable (checkpoints, containers) — best in class | Deterministic given inputs (seeded, manifested — already repo law) | Download-immediately + sha256 manifests (repo already does this); determinism lives in *cached artifacts*, not re-generation; runtime determinism preserved by Mode A (no mixer in loop) |
| **Vendor lock-in / longevity** | Single vendor for rig+presets; healthy but VC-backed; pricing can move | Two interchangeable resellers (fal, Meshy) lowers it; Meshy sub optional | None (the exit ramp itself) | None (all local) | **Canonical-skeleton contract makes rig vendors swappable**; Anything World's insolvency is the cautionary tale — never let vendor-hosted state be the only copy of anything |
| **Ops/platform** | 5-min URL expiry; concurrency limits undocumented | +Z-facing 422s; humanoid-biped only | CUDA-only (not this Mac) → cloud GPU ops; bpy one-import-per-process | Playwright/chromium harness already stable | Retry+download built into scripts day one; subprocess-per-job for bpy; keep #2 configured as hot spare |

---

## 6. Decision sequence (this week)

1. **Day 1 ($0):** fal.ai Meshy rig call + HF-Space Make-It-Animatable run, both on the
   existing `king2-tripo.glb` → two free/cheap data points on whether arms-at-side
   stylized meshes rig acceptably at all.
2. **Day 1–2 (~$5):** Tripo platform key + the #1 spike (rig-check → rig → one retarget
   clip → AnimationMixer). This closes the only undocumented link (native Tripo GLB in
   three.js) and tests the normalizer's rebind-to-identity feasibility.
3. **Day 2–3:** regenerate king with the A-pose + remove-background template; rerun
   rig-check on both poses → quantifies how much the pose template matters.
4. **Go:** build normalizer + `createSkinnedFigure()` (Mode A) against whichever rig
   passed cleanest; wire QC turntable; keep graft as Tier 2.
   **No-go (all riggers fail our aesthetic):** the graft pattern is already proven
   in-repo — promote it from interim to primary, automate its per-character constants
   (yaw from nose-probe, scale from head-span law), and revisit rigging in a quarter;
   the field is <18 months old and improving fast.

## 7. Key sources

- Tripo v3 API (rig/rig-check/retarget/pricing/quick-start): developers.tripo3d.ai/en/docs/animations-rig, /animations-rig-check, /animations-retarget, /pricing, /docs/quick-start; ToS: tripo3d.ai/terms
- Meshy API: docs.meshy.ai/en/api/rigging-and-animation, /animation, /image-to-3d; fal.ai/models/fal-ai/meshy/rigging/multi-animation
- Independent rig benchmark: strayspark.studio/blog/ai-auto-rigging-showdown-2026-tripo-meshy-cascadeur-mixamo
- Make-It-Animatable (MIT, CVPR 2025): github.com/jasongzy/Make-It-Animatable (+ HF Space jasongzy/Make-It-Animatable); UniRig / SkinTokens: github.com/VAST-AI-Research
- Mixamo license: helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- Head-graft precedent: icculus.org/gtkradiant/documentation/Model_Manual/model_manual.htm (Quake 3), create.roblox.com/docs/art/modeling/rig-a-humanoid-model
- three.js retarget fragility: github.com/mrdoob/three.js/issues/25288, /25751; discourse.threejs.org/t/65149; SkinnedMesh culling: issues/11991, /14499
- In-repo evidence: app/figures.js (rest-pose + foot-slide law), review/round-8*.md, tools/headcut.mjs + kinghybrid.mjs, review/hybrid/king2-hybrid.shot-*.png, assets/raw/hunyuan/20260811T055832Z/ (Lane 8 empirical)
