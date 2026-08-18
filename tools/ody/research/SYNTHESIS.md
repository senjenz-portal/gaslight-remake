# SYNTHESIS — six research lanes vs the "pasted layer" complaint

Written 2026-08-17. Inputs: `research/{games,github,papers,x-posts,shaders,one-image}.md`,
grounded against what we already measured/shipped (`seamless/audit-integration.md`,
`seamless/explore-regrade.md` — regrade dE 20.3→6.7, `seamless/explore-onplate-sam2.md` —
on-plate+SAM2 GO) and the in-flight SHOT architecture (`shots-proto/` — authored
native-res close-up plates in a `static shots` registry, deterministic raise over a
still-stepping world).

Judged for OUR SYSTEM: deterministic DOM/CSS runtime, 1408x768 plates + RGBA cutouts,
no WebGL (SVG/CSS filters OK), ~$25/chapter, python+node, NB Pro / Seedance via
Scenario / Replicate / ElevenLabs.

---

## 1. CONSENSUS — why the composites read pasted

Ranked by how many independent lanes name the factor. "Our status" is against the
audit + shipped fixes.

| # | factor | named by | our status |
|---|--------|----------|------------|
| 1 | **Light mismatch beyond palette** — direction, color spill, wrap, rim; character pixels born under a different light than the scene | **6/6 lanes** (games #4/#6/#9, github IC-Light "single strongest fix", papers "the #1 pasted-layer tell", x-posts takeaway 1 "never let final character pixels come from a different generation pass than the scene light", shaders framing, one-image A2) + our audit (b) | **HALF-FIXED.** Regrade ships palette+luminance (dE 20.3→6.7) but explore-regrade's own verdict: the residual is "true relighting effects a color transfer cannot synthesize." No light wrap, no motivated rim (sherlock's `ireneRim` device never ported), no directional gradient. |
| 2 | **Close-up is the wrong asset class** — a scaled-up wide-shot cutout, where every shipped precedent authors per-shot art (FF7/RE per-angle plates, VN event CGs, practitioner "close-ups deserve their own asset class") | **5 lanes** (games #1 — its "single highest-leverage finding", one-image entire lane, papers §6, x-posts #4 + takeaway 2, github Real-ESRGAN sharpness note) | **IN FLIGHT, art path missing.** SHOT architecture (mechanism) prototyped; the shots themselves are still planned as composites. The lanes say the shot ART must be fused, not just native-res. |
| 3 | **Missing contact shadow / ground occlusion** | 5 sources (games #2/#4, github GPSDiffusion, papers §4, one-image A2/C2) + audit verdict #1 (dominant, binary, 100% of settles) | **FIXED** — shadowgen.py + grounding occluders shipped; on-plate spike additionally proved real shadows bake into generated pixels (but land OUTSIDE the binary matte — carry the band). |
| 4 | **Grain / spatial-frequency mismatch** — actor cleaner or noisier than plate; the CRT-era unifier was shared final softness | **4 lanes** (games #4/#6, shaders #2 "cheapest global win", x-posts takeaway 3 "the final tell", github Real-ESRGAN "mismatched sharpness is one of the pasted tells") | **NOT FIXED.** No shared grain layer, no unified resample chain, no stage-level post pass. |
| 5 | **Edge register** — matte rim 1.8x steeper than the plate's own edges (audit c); the "sticker edge" | 4 sources (games #6, shaders #4, x-posts #7, audit c) | **NOT FIXED.** No erode/feather/decontamination pass in the matte bake. |
| 6 | **Nothing in front of the character** — atmosphere/occluder sandwich; scene matter OVER actors welds the depth stack | 3 lanes (games #7 Vanillaware + #4 occlusion, shaders #6, x-posts #5) | **PARTIAL.** Occluders shipped; atmosphere-over-actors exists only as cave's `bloomFire` — and the audit control case (b3-36 Ulysses) shows it is the one device that made a color-matched actor nearly sit. Not generalized. |
| 7 | **Shading-language mismatch at the source** — flat poly facets in an airbrushed painting (audit: interior p99 gradient 2–3x plate's); Disco/Hades: one visual grammar, "regrade-after is exactly what reads as pasted" | 3 sources (games #3/#8, one-image D1 — over-locked refs recreate the paste-look even inside one-image pipelines, audit c interior register) | **NOT FIXED.** Canonical sheets are generated in a character-generic register, not derived from plate style samples. |
| 8 | **No single post pass over the composed stack** (per-layer grades can disagree) | 2 lanes (games #2 HD-2D, shaders #3) — overlaps #4 | **NOT FIXED**, trivially cheap. |

The audit's control case is the load-bearing fact for reading this table: in b3-36
Ulysses matched the plate to dE noise (dL −0.3, dW −4.2) **and still read pasted** —
so color (which we fixed) was never sufficient; the unfixed tells (#1 light
direction/wrap, #4 grain, #5 edge, plus close-up scale #2) are what remain of the
complaint, and the complaint being *worst at close-ups* is exactly what factor #2
predicts.

---

## 2. THE RECOMMENDATION — five adoptions we have NOT done

Ranked by reader impact x feasibility under our constraints. Current pipeline stage
list for slotting: (1) plate gen + slice/occluders → (2) actor poses off canonical
sheets + matte → (3) regrade bake (per-cut-per-mark) → (4) shadow + grounding →
(5) strips/motion (Seedance) + deflicker → (6) audio → (7) gates + lap. In flight:
(S) SHOT registry.

### R1. Fused close-up shots: paint the character INTO the plate, one image per SHOT
- **What:** For the 3–6 hero close-ups per chapter, stop compositing. NB Pro EDIT
  mode: existing plate (or its native-res crop) + canonical sheet refs + explicit
  integration language ("place CHARACTER here, match the plate's grading, cast
  contact shadow, keep identity") → one fused full-frame image that becomes the
  SHOT plate. The plate stays pixel-stable outside the character; light, shadow,
  grain and edge are the model's job, born correct. Where the shot needs
  interactivity or strip motion, SAM2 (Replicate) re-cuts the character from the
  fused shot + one inpaint for the character-free plate — recomposite is seam-free
  by construction (proved in the on-plate spike: recomposite Δ ≈ bg noise floor).
- **Tool/model:** NB Pro (already paid); SAM2 via Replicate for recovery; Real-ESRGAN
  (~$0.002/img, Replicate or local ncnn) to 2x the plate crop first so the shot is
  native-res.
- **Cost:** $0.134/image official ($0.067 batched); 4 shots x 4 candidates ≈ **$2/chapter**.
- **Pipeline slot:** new stage (2b) "shotgen" feeding the SHOT registry — the
  in-flight architecture is the delivery vehicle; this fills it with the right art.
- **Lap gate:** shot-raise gate (shot plate visibly raised at its unit, proven by
  missing) + **identity gate** (canonical-face fidelity check vs sheet — the known
  failure mode, flagged by both the on-plate spike and one-image D1) + a pasted-look
  score on the fused frame (libcom HarmonyScore as the automated QA number).

### R2. Light wrap + edge decontamination baked into the matte pass
- **What:** One python pass at stage (2)/(3): erode alpha 0.5–1.5px + ~0.5px feather
  (kills the sticker edge and matte fringe); band = dilate(alpha, 4–8px) − alpha,
  filled with gaussian-blurred plate sampled at the mark, screened at 30–60% ("feel
  it, never see it"). Per-cut-per-mark, cacheable, byte-deterministic — same shape
  as the regrade bake.
- **Tool/model:** PIL/numpy, no model. **Cost: $0.**
- **Pipeline slot:** extends the existing matte→regrade bake (regrade.py already
  has the ring-sample + light-anchor machinery; the rim color source is the same).
- **Lap gate:** rim-register gate — actor rim peak-gradient ratio vs plate edges at
  each audited settle ≤ 1.3x (audit measured 1.8x avg); halo px within band budget.

### R3. One shared grain + grade pass over the composed stage
- **What:** A single baked tiling grain PNG (seeded numpy — NOT live feTurbulence,
  which is only approximately stable cross-browser) blended `overlay`/`soft-light`
  over plate+actors+insets inside an `isolation: isolate` stage; plus one stage-level
  SVG `feComponentTransfer` grade so no layer can disagree in tone. Static filters =
  paint-once cost; animated actors stay outside per-element filter chains.
- **Tool/model:** python bake + one DOM layer + one filter node. **Cost: $0.**
- **Pipeline slot:** runtime stage wrapper (stage.js/sets), asset baked at chapter
  build; the CRT-era shared-softness trick, deterministically.
- **Lap gate:** noise-register gate — noise spectrum (std of high-pass) of actor
  crop vs plate ring within tolerance at each settle; lap screenshot determinism
  unchanged (two runs byte-identical).

### R4. IC-Light bg-conditioned relight for the residual (targeted, not blanket)
- **What:** Where the regrade residual stays high (sea-stern class, dE ~9) or the
  ledger's light anchor demands a directional gradient the color transfer cannot
  make (fire-side wrap), run IC-Light v1 FBC (cutout + plate → relit cutout, original
  alpha kept) BEFORE the regrade; the deterministic regrade then tone-locks the
  result. Seed-pinned, offline, shipped as a baked PNG.
- **Tool/model:** IC-Light v1 on Replicate (`zsxkib/ic-light`, ~$0.026/run, Apache-2.0).
  ~$1/chapter at 30 cuts; in practice fewer (only residual cases).
- **Pipeline slot:** optional stage (2c) between matte and regrade, triggered by a
  dE/light-anchor rule in the ledger.
- **Lap gate:** identity gate vs canonical sheet (SD1.5 melts faces — the known
  risk) + dE-at-settle ≤ the regrade-only baseline + fire-side luminance-asymmetry
  gate (the measurement already exists in the on-plate spike).

### R5. Atmosphere sandwich generalized: the plate's own haze/bloom OVER the actors
- **What:** Promote cave's `bloomFire` — the device the audit's control case proved —
  to a per-scene law: extract each plate's bloom/haze (python: blurred
  luminance-thresholded plate, or one authored translucent layer per scene) and
  composite it ABOVE the actor group (`screen` for glow, `multiply` for fog/shade
  density). Anything sitting on top of both plate and character welds them into one
  depth stack; blend-layer budget ≤3 (grain + atmosphere + wrap) with `isolation`.
- **Tool/model:** python extract; optionally one NB Pro layer/scene. **Cost: $0–0.5/chapter.**
- **Pipeline slot:** stage (1) slice tooling emits an `atmo` layer per scene state;
  sets mount it over `.actors`.
- **Lap gate:** atmosphere-over-actor gate — sampled actor-region pixels show the
  wash contribution in the states that have one (proven by missing: remove layer →
  gate fails), plus low-end scroll/paint budget check.

Total added spend ≈ **$3–4/chapter** — well inside $25. Deliberately NOT adopted:
GPU/runtime relighting and full WebGL migration (shaders #11's own verdict:
DOM fixes first, hybrid canvas only if close-ups still fail after R1–R3);
LoRA-per-character (one-image A7: reference sheets beat it at our cast size);
libcom/PCTNet as a regrade replacement (papers: "lateral movement" — our regrade
already lands dE 4–8).

---

## 3. THE FORK VERDICT — better compositing vs no-composite vs hybrid

**The evidence favors the HYBRID, split by camera stop — and it is lopsided, not a
compromise.**

- **For close-ups, the no-composite school wins outright.** It is the only point
  where every lane that speaks to it converges: 25 years of shipped pre-rendered
  games never zoomed a composite (games #1); VNs institutionalized the event CG for
  exactly this failure; the papers lane calls in-scene generation "the honest fix"
  for hero close-ups; practitioners' takeaway is "close-ups deserve their own asset
  class"; and our own on-plate spike proved the mechanism end-to-end on our assets
  (firelight and a real contact shadow baked into the pixels — things the flat-navy
  pipeline cannot produce at any price — with SAM2 recovering a stable layer for
  $0.01–0.02). Meanwhile the audit's control case proves the ceiling of pure
  compositing: a color-perfect actor still read pasted.
- **For wides and mediums, better compositing wins on cost, determinism, and risk.**
  The composite path is already two-thirds fixed by our shipped work (dE 20.3→6.7,
  shadows, occluders), the remaining tells (wrap, edge, grain) have $0 baked fixes
  (R2/R3), and regenerating 60–80 wide beats per chapter would burn the budget,
  risk identity drift at 20–75px actor scale where it buys nothing (drift is "mild
  at 75px" per the spike — i.e., the paste-tells are also mild there), and
  jeopardize the hotspot/layout determinism the lap depends on. One-image D1 is the
  cautionary tale from the other side: whole-frame generation with over-locked refs
  recreates the copy-paste look — no-composite is not automatically integrated either.
- **IC-Light-class relight is a patch inside the composite lane, not the third way.**
  The github/papers lanes rate it the strongest single compositing fix, but that
  assessment assumes no regrade; ours already took the color term to dE 4–8, so
  relight only earns its identity risk on the residual cases (R4's trigger rule).

Operationally: R2+R3 finish the composite lane for wides; R1 makes the SHOT lane
fused-by-construction for closes; SAM2 re-cut (proved) bridges the two whenever a
fused shot needs interactive layers. Seedance-with-fused-first-frame extends the
same law to video insets (the inset can no longer disagree with the page around it).

---

## 4. ONE-DAY EXPERIMENT — settle what the evidence cannot

The evidence cannot tell us: (a) whether NB Pro plate-EDIT holds our painted style,
plate pixel stability, and canonical identity at close-up scale; (b) whether baked
wrap+grain+edge (R2+R3) closes the wide-shot residual without IC-Light; (c) whether
a SAM2 re-cut of a fused shot survives recompositing (halo, shadow band) at
close-up scale, where the on-plate spike only proved 75px actors.

**Fixture (morning, ~2h):** 4 settles — the three worst audited (b2-24
Ulysses-at-fire, b3-36 seated giant, b5-61 rams) + one true close-up framing (bowl
offer at SHOT scale, plate crop 2x'd via Real-ESRGAN). For each, build a 6-column
sheet at true reading scale:
C1 shipped composite (control) · C2 +R2/R3 bake (wrap+edge+grain+stage grade) ·
C3 IC-Light v1 relight → regrade (R4) · C4 NB Pro fused EDIT (plate + sheet refs,
integration prompt) · C5 = C4 → SAM2 re-cut → recomposite on clean plate ·
C6 Qwen-Image-Edit fused (open-weights control column, Replicate).

**Measures (afternoon, ~3h, all machinery exists):** ring dE + dCCT (regrade.py) ·
rim peak-gradient ratio + interior p99 (audit method) · high-pass noise delta
actor-vs-ring · plate-stability diff outside the character (C4/C6: how much of our
QA'd plate the edit repainted) · identity score vs canonical sheet (existing
fidelity gate) · recomposite Δ vs fused frame (C5, spike method). Then a blind
paired ranking of the sheets (owner + 2 readers), close-up sheet scored separately.

**Budget:** ~16 NB Pro edits ($2.20), ~8 Qwen edits ($0.40), ~8 IC-Light runs
($0.21), SAM2 + ESRGAN pennies ≈ **$3.**

**Decision rules (evening):**
- C4 wins the close-up blind AND identity gate passes AND plate-stability diff is
  bounded → R1 ships as the SHOT art path. If identity fails on NB Pro but C6
  passes → swap the fused-shot model, same architecture.
- C2 brings rim ratio ≤1.3x and ties-or-wins the wide-shot blind vs C3 → skip
  IC-Light for wides entirely (R4 stays a residual-only tool); if C3 clearly beats
  C2 on the fire settles → widen R4's trigger.
- C5 recomposite ≈ C4 within the spike's noise floor at close-up scale → fused
  shots keep full interactivity; if not, fused close-ups ship as flat SHOT plates
  (video-inset style) and interactivity stays on the wide framing.
