# Research lane: games — how shipped games sat characters on painted backgrounds

Context: Living Book = deterministic DOM/CSS reader, 1408x768 painted plates + RGBA cutout
characters (AI-generated, matted, regraded, contact shadows, strip/bridge sprites, video insets).
Complaint: characters read as pasted layers, worst at close-ups.
Constraints: deterministic runtime, no WebGL (DOM/CSS/SVG filters OK), ~$25/chapter gen budget,
python+node, NB Pro / Seedance via Scenario / Replicate (SAM 2 etc.) / ElevenLabs.

Tags: [ADOPT-CANDIDATE] fits constraints now · [EXPERIMENT] plausible but unproven under our
constraints · [NOT-FOR-US] violates constraints or wrong cost/benefit.

---

## 1. Camera discipline: nobody zooms the plate — a close-up is new authored art

- FF7/8/9 and Resident Evil never scale a pre-rendered plate. Every camera angle is a separately
  authored render; hero moments cut to FMV. Fixed viewpoints were embraced as a design tool, not
  fought. ([jmeiners: An Adventure in Pre-Rendered Backgrounds](https://www.jmeiners.com/pre-rendered-backgrounds/),
  [GamingBolt FF7 tech deep-dive](https://gamingbolt.com/final-fantasy-7-a-tech-deep-dive-into-the-rpg-classic),
  [Hundstrasse: Immovable Viewpoint](https://hundstrasse.com/2017/09/20/immovable-viewpoint-reminiscing-about-pre-rendered-backgrounds/))
- Visual novels formalize the same rule: close-ups are **event CGs** — dedicated full-frame art
  where character + environment are painted as ONE image, precisely because sprite-on-BG
  presentation cannot survive a close-up. Where devs must zoom a sprite, the accepted practice is
  authoring a separate 2x-resolution close-up crop, never scaling the standard sprite.
  ([Fuwanovel: Event CGs – An Anatomy of Visual Novels](https://forums.fuwanovel.moe/blogs/entry/4209-event-cgs-%E2%80%93-an-anatomy-of-visual-novels/),
  [VNDev Wiki: Event CG](https://vndev.wiki/Event_CG),
  [Pitch Black Serenade: canvas sizes for sprites/BGs/CGs](https://pitchblackserenade.wordpress.com/visual-novel-basic-art-tutorial-canvas-size-for-sprites-backgrounds-cgs/))

**[ADOPT-CANDIDATE]** — This is the single highest-leverage finding for the close-up complaint:
close-ups should be *generated as unified single images* (character painted INTO the plate by NB
Pro, one render, one light, one grain), not layer composites at higher magnification. Costs one
extra image per hero shot, well inside $25/chapter, fully deterministic (it's just another asset).

---

## 2. HD-2D (Octopath Traveler): a single unifying post pass over the composed scene

Square Enix's HD-2D never lets sprite and diorama read as separate passes because *everything*
goes through one shared pipeline: sprites and 3D write to the same G-buffer, one deferred lighting
pass, then scene-wide tilt-shift depth of field, bloom, and a single ACES filmic tone map over the
whole composed frame. Screen-space contact shadows ray-marched at sprite feet ground the sprites.
DoF is depth-weighted so background blur never bleeds onto the focused sprite.
([HD-2D — Wikipedia](https://en.wikipedia.org/wiki/HD-2D),
[Unreal Engine spotlight on Octopath](https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true),
[dev.to: Creating an HD-2D rendering pipeline](https://dev.to/gaurav_de/creating-an-hd-2d-rendering-pipeline-on-dx12-205k))

- **Whole-scene grade AFTER compositing** (tone curve, vignette, slight desaturation lift applied
  to the composed stack, not per-layer): **[ADOPT-CANDIDATE]** — a wrapper div with a shared SVG
  `feComponentTransfer`/`feColorMatrix` filter over plate+cutouts is cheap, deterministic, and
  directly attacks "layers graded separately."
- **Tilt-shift / DoF framing** (blur the plate slightly behind an in-focus character during
  emphasis beats): **[ADOPT-CANDIDATE]** — CSS `filter: blur()` on the plate only; games prove
  that a *shared depth story* (one thing sharp, rest falls off) reads as one camera, not layers.
- **Per-sprite normal maps + dynamic relight**: **[EXPERIMENT]** — SVG `feDiffuseLighting` with a
  distant light exists in DOM and is deterministic, but per-pixel SVG lighting on large cutouts is
  a perf risk and normals for AI cutouts must be generated (Replicate normal-estimation models).
- **Screen-space contact shadows**: **[NOT-FOR-US]** as ray-marching (needs GPU), but the
  *principle* (shadow must touch the exact silhouette at the feet, alpha-tested, no gap /
  "Peter Panning") should be a QA check on our existing baked contact shadows.

---

## 3. Disco Elysium: simplify character shading into planes + one brush language everywhere

ZA/UM's problem statement is literally ours: "make 3D characters look and feel like they belong in
a painted environment." Their answers:
- Character normal maps were hand-painted / simplified into flat planes so the light on characters
  computes the way an *illustrator* would paint it — killing the CG-smooth shading that instantly
  separates a character from painted art.
  ([Disco Elysium — Wikipedia](https://en.wikipedia.org/wiki/Disco_Elysium),
  [Disco Elysium artbook notes](https://www.scribd.com/document/734363544/Disco-Elysium-Artbook))
- Backgrounds are paint projected onto camera-mapped 3D (4K–16K textures), so characters and BG
  share one camera and one light rig; GDC talk: Siim Raidma, "Turpentine Fumes and Shaders: Art
  Tech in Disco Elysium."
  ([Game Developer GDC announce](https://www.gamedeveloper.com/art/come-to-gdc-and-see-how-i-disco-elysium-i-s-unique-style-was-achieved-),
  [Unity forum workflow thread](https://discussions.unity.com/t/disco-elysium-graphics-workflow/764047))
- The glue is Rostov's bold brushwork applied to *everything* — one stylization hand, not a
  per-asset style. ([MCV/Develop: The Art of Disco Elysium](https://mcvuk.com/business-news/we-knew-immediately-that-we-needed-to-make-a-game-with-a-striking-and-unique-look-to-accompany-the-writing-a-look-that-would-balance-the-mundane-with-the-unfamiliar-and-strange-the-art/))

**[ADOPT-CANDIDATE]** (generation-side, not runtime): prompt/LoRA-discipline the character
generator to the *plate's* brush economy — big planar light shapes, no photoreal micro-shading, no
airbrush gradients — and regrade with the same stylization pass as the plate. The paste-on read at
close-up is mostly *shading-language mismatch*, which no runtime filter fixes.
**[NOT-FOR-US]**: their actual dynamic light rig (real 3D scene lighting).

---

## 4. Classic pre-rendered games (FF7–9, Resident Evil): record the light rig with the plate; unify final resolution

- Per-scene light data shipped with each background: character light direction/color was authored
  to match the plate, including the two-shadow trick (dark primary shadow + lighter secondary) so
  characters cast shadows consistent with the render's lighting.
  ([RetroGameTalk: Pre-Rendered Backgrounds](https://retrogametalk.com/threads/pre-rendered-backgrounds-a-look-at-the-art-and-beauty-of-the-traditional-technique.9570/),
  [jmeiners](https://www.jmeiners.com/pre-rendered-backgrounds/))
- The era's secret unifier was **shared final resolution/softness**: 3D characters and 2D renders
  blended "quite successfully" largely because both were crushed to 320x224 through CRT softness —
  one shared spatial frequency. Modern crisp displays *broke* this (RE HD remasters look more
  pasted than the originals).
  ([Pekoeblaze: Low-resolution graphics in classic RE](https://pekoeblaze.wordpress.com/2021/11/02/low-resolution-graphics-in-the-classic-resident-evil-games/))
- Occlusion by tile draw-order (character walks behind plate elements) sold the character as being
  *inside* the image, not on it. ([GamingBolt FF7](https://gamingbolt.com/final-fantasy-7-a-tech-deep-dive-into-the-rpg-classic))

**[ADOPT-CANDIDATE]** — three concrete moves:
1. Author a per-plate "light manifest" (key direction, color, secondary fill) at generation time
   and validate every cutout against it (generation QA gate, python).
2. Unify spatial frequency: ensure cutouts are downsampled/re-sharpened through the SAME resample
   chain as the plate; a shared faint blur+grain overlay (fixed-seed SVG `feTurbulence`) over the
   composed scene is the CRT trick, deterministically.
3. More mid-scene occluders: slice foreground plate elements into overlay layers so characters
   pass BEHIND plate geometry routinely — occlusion is the cheapest "inside the image" cue.

---

## 5. Pillars of Eternity: ship auxiliary buffers (depth/normal/albedo) with the painted plate

Obsidian rendered each 2D background four times — beauty, depth, normals, albedo — and used the
buffers at runtime for per-pixel occlusion of characters, dynamic lights that affect the painting,
and character shadows landing correctly on it.
([Obsidian update #79: Graphics and Rendering](https://eternity.obsidian.net/eternity/news/update--79-graphics-and-rendering-),
[Projection Space: Pillars of Eternity's Rendering Techniques](https://projectionspace.wordpress.com/2016/05/06/pillars-of-eternitys-rendering-techniques/))

**[EXPERIMENT]** — we can't consume buffers on GPU, but offline we can: run a depth-estimation
model (Replicate, e.g. Depth-Anything/MiDaS) on each plate once, then *bake* its products:
occlusion mask layers (auto-derive the "character walks behind this" slices in #4), depth-graded
DoF mattes for close-up beats, and foot-placement/shadow-scale per anchor point. One depth pass
per plate is pennies. **[NOT-FOR-US]**: runtime per-pixel relighting from those buffers.

---

## 6. Film compositing canon (what games borrowed): light wrap + edge treatment + grain match

The pasted-on read is the classic keyed-greenscreen problem, with a standard fix stack:
1. **Light wrap** — blur the background plate, blend it into the foreground's edge band so BG
   light "bleeds" onto the character rim. Rule: feel it, never see it.
2. **Edge blur/decontamination** — soften the matte edge 1px; kill halo from matting.
3. **Grain/texture match** — regrain the WHOLE composite with one grain layer so every element
   shares noise statistics.
([Premiumbeat: What is Light Wrapping?](https://www.premiumbeat.com/blog/what-is-light-wrapping-tips-tutorials/),
[ProVideo Coalition: How to Light Wrap](https://www.provideocoalition.com/how-to-light-wrap/),
[Max Klomeier: Introduction Light Wrapping](https://max-klomeier.medium.com/introduction-light-wrapping-70b03f2092c3))

**[ADOPT-CANDIDATE]** — all three are implementable two ways under our constraints:
(a) baked into the cutout at generation time (python/PIL: light-wrap band sampled from the plate
behind each anchor position — deterministic per anchor), or (b) live in DOM: a blurred copy of the
plate clipped by the character's alpha edge (CSS `mask` + `filter: blur`), plus one fixed-seed
`feTurbulence` grain div over the scene. Bake (a) for static anchors; (b) only where characters
slide across the plate.

---

## 7. Vanillaware (Odin Sphere / 13 Sentinels): the atmosphere sandwich + strong backlights

Vanillaware layers 2D planes in depth and puts *strong backlights and atmosphere between the
layers* — haze, sunset glow, neon spill drawn as translucent layers IN FRONT of characters, not
just behind. Characters carry painted backlight/bounce gradients keyed to each scene's light
source. This is layered-cutout presentation, shipped AAA-pretty — the closest cognate to Living
Book that exists.
([PlayStation Blog: How Vanillaware brings 2D art to life in 13 Sentinels](https://blog.playstation.com/2020/08/10/how-atlus-x-vanillaware-bring-2d-art-to-life-in-13-sentinels-aegis-rim/),
[Vanillaware — Wikipedia](https://en.wikipedia.org/wiki/Vanillaware))

**[ADOPT-CANDIDATE]** — add a generated translucent "atmosphere layer" per scene (light shafts,
haze gradient, particulate glow) composited OVER the characters at low opacity. Anything sitting
on top of both plate and character instantly welds them into one depth stack. Deterministic
(static PNG/gradient, or strip-animated), one cheap NB Pro generation per scene.

---

## 8. Hades (Supergiant): one palette/line language across characters and environments

Supergiant's integration is art-direction, not shaders: characters are 3D models sculpted directly
against Jen Zee's painted portraits, then rendered back into the shared comic-ink language — same
line weight, same saturated high-contrast palette as the environments. The unifier is that
character art and environment art come from one visual grammar.
([Game Developer: how Supergiant brought Hades' hand-painted characters to life](https://www.gamedeveloper.com/art/learn-how-supergiant-brought-i-hades-i-hand-painted-characters-to-life),
[pointnthink: The Art of Hades](https://www.pointnthink.fr/en/the-art-of-hades-en/))

**[ADOPT-CANDIDATE]** (pipeline principle) — our canonical sheets should be *derived from plate
style samples* (same palette swatches, same edge/line treatment in the prompt), not generated in a
character-generic style then regraded after. Regrade-after is exactly what reads as pasted.

---

## 9. VN color-grade practice: per-scene tone layer clipped to the sprite + motivated rim light

Working VN artists' standard recipe: a per-scene grade layer (multiply/overlay gradient in the
scene's ambient color) clipped onto the sprite; slight blur to match BG texture softness; rim
light placed to separate character from BG the way photographers do (light rim against dark BG
area, shadow side against light BG area) — separation must look *motivated* by scene light.
([Clip Studio: VN art pre-production](https://tips.clip-studio.com/en-us/articles/5445),
[Lemma Soft: sprite design tips](https://lemmasoft.renai.us/forums/viewtopic.php?t=60675),
[Lemma Soft: Not all art makes good sprites](https://lemmasoft.renai.us/forums/viewtopic.php?t=40475))

**[ADOPT-CANDIDATE]** — formalize our regrade as a per-scene *tone layer* (single ambient-color
gradient at fixed blend/opacity derived from the plate's palette stats, python-baked), and add a
motivated rim pass: rim color = sampled from the plate region behind the character's silhouette.

---

## 10. Norco: palette quantization + dithering as the unifier

Norco welds characters into scenes by forcing everything through one limited palette with heavy
dithering — shared color statistics and shared texture beat per-layer fidelity.
([PC Gamer: Norco is a pixel art lover's dream](https://www.pcgamer.com/adventure-game-norco-is-a-pixel-art-lovers-dream/),
[The Art of NORCO](https://store.steampowered.com/app/1919990/The_Art_of_NORCO/))

**[EXPERIMENT]** — full palette quantization would fight our painterly look, but a *soft* version
(offline: remap cutout colors toward the plate's dominant-palette centroids by ~30–50%, python
k-means, deterministic) is a measurable, tunable version of "regrade to plate palette" — worth an
A/B against the current regrade.

---

## Cross-cutting synthesis (ranked for our complaint)

1. **Close-ups: stop compositing, start authoring** (VNs' event CGs; FF/RE per-shot plates) — the
   close-up paste-on problem is solved by every shipped precedent the same way: unified per-shot
   art. [ADOPT-CANDIDATE]
2. **One post pass over the composed stack** (HD-2D tone map; CRT-era shared resolution; film
   regrain) — shared grade + shared grain + shared softness after compositing. [ADOPT-CANDIDATE]
3. **Light wrap + motivated rim, baked per anchor** (film comp canon; VN practice). [ADOPT-CANDIDATE]
4. **Atmosphere/occluder sandwich** (Vanillaware layers-in-front; FF7 tile occlusion) — put scene
   matter in front of characters. [ADOPT-CANDIDATE]
5. **Shading-language match at generation** (Disco Elysium planar shading; Hades one grammar) —
   fix the source style, don't just filter the output. [ADOPT-CANDIDATE]
6. Depth-map-derived occlusion/DoF mattes per plate (Pillars buffers, offline). [EXPERIMENT]
7. Soft palette quantization to plate centroids (Norco). [EXPERIMENT]
8. Runtime dynamic relighting (Disco/Pillars/HD-2D lighting rigs), GPU contact-shadow ray-march.
   [NOT-FOR-US] — needs GPU/nondeterminism we don't have; the offline bakes above capture most value.
