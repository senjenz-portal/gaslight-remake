# Research lane: shaders — engine-side integration without WebGL (+ the WebGL case)

Date: 2026-08-17
System: Living Book — deterministic DOM/CSS reader, 1408x768 painted plates + RGBA cutout actors.
Complaint: actors read as layers pasted on an image, worst at close-ups.
Constraints: deterministic (no wall-clock/random at runtime), no WebGL currently (DOM/CSS/SVG filters OK), ~$25/chapter gen budget, python+node tooling.

Key framing from film compositing: the "pasted-on" read comes from three mismatches — **edge** (matte line vs. plate), **grain/texture** (actor is cleaner or noisier than plate), and **light** (no background light bleeding onto the subject). Every finding below attacks one of those. The single highest-leverage technique is light wrap (finding 1); the cheapest global win is shared grain + shared grade (findings 2–3).

---

## 1. Faux light wrap: blurred-plate rim band masked to the actor — [ADOPT-CANDIDATE]

The film-industry answer to exactly our complaint. Light wrap = blur a copy of the *background*, clip it to a thin band just inside the subject's edge, blend (screen/add) so background light appears to bend around the subject. See [PremiumBeat: What is Light Wrapping?](https://www.premiumbeat.com/blog/what-is-light-wrapping-tips-tutorials/), [ActionVFX light wrap tutorial](https://www.actionvfx.com/blog/how-to-create-easy-light-wrap-fx-free-preset-after-effects-quick-tips-tutorial), [Max Klomeier: Introduction to Light Wrapping](https://max-klomeier.medium.com/introduction-light-wrapping-70b03f2092c3), [Digital Anarchy Light Wrap manual (PDF)](https://digitalanarchy.com/manuals/LightWrapFantastic_Manual.pdf).

True engine-side light wrap in one SVG filter is impossible because the `BackgroundImage` filter input is dead in all browsers ([MDN feComposite](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feComposite), [caniuse SVG filters](https://caniuse.com/svg-filters), [SVG WG discussion](https://lists.w3.org/Archives/Public/public-svg-issues/2023Apr/0005.html)) — but **we don't need it: we know the plate at build time.** Two routes:

- **Bake (preferred):** python (PIL + the existing matte): band = dilate(alpha, ~4–8px) − alpha; composite gaussian-blurred plate into band at 30–60% screen; ship it inside the cutout PNG. Zero runtime cost, pixel-deterministic, no model spend.
- **Runtime:** stack a pre-blurred plate copy above the actor, `mask-image` = actor alpha dilated (via SVG `feMorphology dilate` producing the band), `mix-blend-mode: screen`. Lets one blurred plate serve all actor positions.

Why for us: directly kills the cut-out edge read at close-ups; deterministic; ~$0 (compute only). The classic caveat applies: "you just want to feel the lightwrap, you don't really wanna see it."

## 2. One shared film-grain pass over the whole stage — [ADOPT-CANDIDATE]

A single grain layer covering plate + actors + video insets, blended `overlay`/`soft-light`, inside an `isolation: isolate` stage so it can't leak. Grain co-signs every layer into one "photographic" substrate — the classic unifier. Recipes: [CSS-Tricks: Grainy Gradients](https://css-tricks.com/grainy-gradients/), [CSS-Tricks: Animated Grainy Texture](https://css-tricks.com/snippets/css/animated-grainy-texture/), [Codrops: Creating Texture with feTurbulence](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/), [fxhash: All about that grain](https://www.fxhash.xyz/article/all-about-that-grain).

Determinism note: `feTurbulence` is seeded and repeatable per engine, but only "approximately the same result from one browser to the next" ([MDN seed attribute](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/seed), [O'Reilly Using SVG, feTurbulence chapter](https://oreillymedia.github.io/Using_SVG/extras/ch16-feTurbulence.html)). For pixel-stable acceptance tests, prefer a **baked tiling grain PNG** (python, seeded numpy) over live feTurbulence; if grain must "move," step between N pre-baked frames keyed to page/beat index — never wall-clock.

Why for us: cheapest global de-layering win; one static blended layer at 1408x768 is well within DOM perf budget.

## 3. Unified palette/grade: one SVG feComponentTransfer LUT on the stage container — [ADOPT-CANDIDATE]

Apply `filter: url(#scene-grade)` to the stage wrapper so plate + actors + insets pass through the *same* per-channel transfer tables (`type="table"` gradient-map / lift-gamma-gain), guaranteeing they can never disagree in grade. Techniques: [Codrops: Duotone with feComponentTransfer](https://tympanus.net/codrops/2019/02/05/svg-filter-effects-duotone-images-with-fecomponenttransfer/), [CSS-Tricks: SVG duotone](https://css-tricks.com/using-svg-to-create-a-duotone-image-effect/), [utilitybend: Revisiting SVG filters](https://utilitybend.com/blog/revisiting-svg-filters-my-forgotten-powerhouse-for-duotones-noise-and-other-effects/), [Sara Soueidan's SVG Filters series](https://www.sarasoueidan.com/blog/svg-filters-series/).

Limit: SVG gives 1D-per-channel curves only — no 3D LUT (no cross-channel "teal shadows only where red is low"). So keep the heavy regrade in the existing python bake, and use the runtime filter for *scene-level mood* (chapter tint, night/day, flashback) where per-channel is enough.

Why for us: deterministic, one filter node, static (paints once, no per-frame cost); complements rather than replaces the bake pipeline.

## 4. Edge decontamination: erode + micro-blur the matte — [ADOPT-CANDIDATE]

A 0.5–1.5px `feMorphology operator="erode"` on the actor alpha followed by a ~0.5px blur kills the crisp anti-aliased "sticker edge" and any residual matte fringe — the same reason keyers shrink-and-feather mattes. Primitive behavior: [Codrops: Outline with feMorphology](https://tympanus.net/codrops/2019/01/22/svg-filter-effects-outline-text-with-femorphology/), [Vanseo: feMorphology and feTurbulence](https://vanseodesign.com/web-design/svg-filter-primitives-femorphology-and-feturbulence/), [feMorphology reference](https://docs.w3cub.com/svg/element/femorphology).

Prefer **baking** this in the python matting step (SAM 2 mask → erode → feather → light-wrap band from finding 1, one pass): deterministic, zero runtime filter cost, and each px of erode matters at close-up scale so tune per shot class (close-up vs. wide). Caveat from the sources: "watch not to erode too much."

## 5. Fake directional rim light via inner-glow filter chain — [EXPERIMENT]

Normal-map-less rim: `feFlood` (key-light color sampled from the plate) → `feComposite operator="out"` with actor alpha → `feGaussianBlur` → `feOffset` *away* from the light → `feComposite operator="atop"` onto the actor. Reads as a 1-sided light wrap from a specific direction. Recipes: [Riptutorial: Inner Glow shadow filters](https://riptutorial.com/svg/example/12623/shadow-filters--inner-glow), [Stefan Judis: Fancy SVG filters](https://www.stefanjudis.com/blog/fancy-svg-filters/), [W3C Filter Effects spec](https://www.w3.org/TR/SVG11/filters.html), [Carmen Ansio: SVG filter text effects](https://www.carmenansio.com/articles/svg-filters-on-type/). (`feDiffuseLighting`/`feSpecularLighting` exist but need a height map and look plasticky on photographic cutouts — skip.)

Why EXPERIMENT: deterministic and cheap, but light direction must be authored per plate (a per-scene `--light-dir` var), and overdone it *increases* the sticker read. Prototype on 3 close-ups before adopting; consider baking the winner.

## 6. Atmosphere sharing via blend modes: plate's own haze/bloom re-multiplied over actors — [ADOPT-CANDIDATE]

Extract the plate's bloom/haze/fog (python: blurred luminance-thresholded plate, or an authored fog layer) and composite it *above* the actors with `mix-blend-mode: screen` (glow) or `multiply` (shadow/fog density). The actor then sits *inside* the plate's atmosphere instead of in front of it — also gives free volumetric occlusion when actors stand in hazy depth. Reference behavior: [CSS-Tricks: mix-blend-mode](https://css-tricks.com/almanac/properties/m/mix-blend-mode/), [Animation Patterns: Film overlay compositing](https://animationpatterns.art/animations/film-overlay-compositing/), [W3Tweaks: mix-blend-mode explained](https://www.w3tweaks.com/css/css-mix-blend-mode-explained/).

Perf caveat: blend modes on large layers have real cost and historically blended on CPU in some engines ([Mozilla meta bug 1008128](https://bugzilla.mozilla.org/show_bug.cgi?id=1008128), [real-world scroll-jank report](https://github.com/lowtechmag/solar/issues/6), [Smashing: CSS GPU Animation](https://www.smashingmagazine.com/2016/12/gpu-animation-doing-it-right/)). At one static 1408x768 stage with ≤3 blended layers and `isolation` scoping, this is fine; budget blend layers (grain + atmosphere + maybe light wrap = 3) and test on low-end mobile.

## 7. Dither/posterize unification (Obra Dinn direction) — [EXPERIMENT]

`feComponentTransfer type="discrete"` posterizes all layers to a shared palette; a tiled Bayer-matrix overlay adds ordered dither — everything becomes "the same print." Sources: [Surma: Ditherpunk](https://surma.dev/things/ditherpunk/), [maya.land: dither in the browser with CSS](https://maya.land/monologues/2021/02/15/css-dither.html), [Ordered dithering (Wikipedia)](https://en.wikipedia.org/wiki/Ordered_dithering), [untested.sonnet.io gradient dithering](https://untested.sonnet.io/notes/just-some-innocent-gradient-fun/).

Why EXPERIMENT not ADOPT: it's a *style pivot*, not an integration fix — it would fight the painted-plate look we already ship. Worth one styleframe test as a chapter-specific treatment (dream/flashback), where total unification is the point. Fully deterministic (static filter + static tile).

## 8. feTurbulence + feDisplacementMap for hero-moment atmosphere (heat haze, glass, water) — [EXPERIMENT]

Displacing a region of the composed stage warps plate *and* actor with the same field — a strong "same world" cue for specific beats. [Smashing: Deep dive into SVG displacement filtering](https://www.smashingmagazine.com/2021/09/deep-dive-wonderful-world-svg-displacement-filtering/), [Codrops: feDisplacementMap](https://tympanus.net/codrops/2019/02/12/svg-filter-effects-conforming-text-to-surface-texture-with-fedisplacementmap/), [ImageToSVG displacement guide](https://imagetosvg.com/how-to/svg-displacement-map).

Determinism: fixed `seed` + drive `scale`/`baseFrequency` from page/beat state (or a finite keyframed CSS animation with `animation-play-state` controlled by the engine), never wall-clock. Perf: displacement over a small filter region is OK; full-stage animated displacement is the most expensive thing in this doc — keep regions tight ([SVG filter performance tips](https://imagetosvg.com/how-to/svg-filter-performance-tips), [Taylor Hunt: Improving SVG runtime performance](https://codepen.io/tigt/post/improving-svg-rendering-performance)).

## 9. backdrop-filter as the DoF mechanism — [NOT-FOR-US]

`backdrop-filter` only filters what's *behind* an element, so it can't blur actor+plate together as one optical system; SVG `url(#)` filters in backdrop-filter are unsupported in Firefox/Safari ([MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter), [BCD issue #24110](https://github.com/mdn/browser-compat-data/issues/24110), [Firefox bug 1787623](https://bugzilla.mozilla.org/show_bug.cgi?id=1787623)); and it interacts badly with blend modes ([CSS-Tricks: backdrop-filter for UI effects](https://css-tricks.com/using-css-backdrop-filter-for-ui-effects/)). For our DoF need, the honest DOM answer is coarse: put plate and actor in one wrapper and blur the *wrapper* per depth plane (near-plane wrapper sharp, far-plane wrapper blurred) — plane-quantized DoF, not per-pixel. True depth-continuous DoF is a WebGL item (finding 11).

## 10. SVG-filter performance profile on our stage — constraint note (informs all ADOPTs)

Acceleration is uneven: Chromium's GPU filter path only kicks in for already-composited sources ([Chromium filter effects design doc](https://www.chromium.org/developers/design-documents/image-filters/)); Firefox only accelerated feGaussianBlur/feComponentTransfer/feColorMatrix/feComposite etc. as of Firefox 132 ([Phoronix on Firefox 132](https://www.phoronix.com/news/Mozilla-Firefox-132)); Safari does best with CSS filter shorthands rather than `<filter>` chains ([Taylor Hunt: Improving SVG rendering performance](https://codepen.io/tigt/post/improving-svg-rendering-performance)). Our saving grace: a fixed 1408x768 stage with **static** filters is a paint-once cost, not per-frame — expensive filters only hurt when animated or when the filtered element repaints (our strip/bridge sprite swaps do repaint; keep animated actors *outside* heavy per-element filter chains and let the stage-level grade/grain cover them). Rules: tight filter regions (`x/y/width/height` on `<filter>`), short chains, never animate `stdDeviation` on large regions.

## 11. Canvas/WebGL migration — honest assessment — [EXPERIMENT] (hybrid stage only; full migration NOT-FOR-US yet)

What WebGL *uniquely* unlocks over the DOM stack above:
- **True light wrap** sampled from the live composited background under the actor edge (vs. our baked/approximated band) — matters when actors move across varied plate regions.
- **Unified per-pixel DoF**: one blur field over plate+actor with a depth ramp, rack-focus between actor and plate — impossible in DOM (finding 9), and the single biggest close-up realism lever we can't otherwise reach.
- **3D LUTs** (real cross-channel grades, e.g. via a LUT texture) vs. SVG's per-channel curves.
- Grain response to luminance, edge-aware sharpening, contact-shadow modulated by plate light.

Feasibility/perf: a 1408x768 stage = ~1.08M px; a fullscreen quad + a handful of sprite layers + 2–3 post passes is single-digit-ms on any GPU of the last decade — PixiJS's filter architecture (render target → offscreen framebuffer → shader → composite) does exactly this pattern out of the box ([PixiJS filters guide](https://pixijs.com/8.x/guides/components/filters), [custom GLSL filters in Pixi](https://blog.cjgammon.com/custom-filters-with-pixi-js-using-glsl-shaders/), [PixiJS overview](https://pixijs.com/7.x/guides/basics/what-pixijs-is)). Perf is a non-issue at our resolution; Pixi's own caveat (filters expensive "if used too much") targets scenes with hundreds of filtered objects, not 4 layers.

Determinism: shaders are pure functions of uniforms — drive "time" from page/beat state and it's exactly as deterministic as our current engine per device. Cross-GPU bit-exactness is *not* guaranteed (float precision, driver variance) — but SVG filters already only match "approximately" across browsers, so this is not a regression for acceptance testing (test per-browser-per-platform either way).

The real cost is architectural, not performance: a second render path; actors/plates become textures (losing DOM inspectability, CSS-driven layout of insets, and the current strip/bridge animation machinery would need reimplementation as UV offsets); more surface for the deterministic-replay harness to cover.

**Verdict:** not justified as a migration today. Findings 1–4 + 6 attack the exact mismatches (edge/grain/light) that cause the "pasted-on" read and cost days, not weeks. Adopt those first. If close-ups *still* fail after that pass, the right move is a **hybrid**: keep the DOM reader, mount a single `<canvas>` stage (Pixi or ~200 lines of raw WebGL) only for hero close-up pages, where per-pixel light wrap + rack-focus DoF earn their keep. That keeps the blast radius to a page type instead of the engine.

---

## Priority order (impact per unit risk)
1. Bake light wrap band + edge decontamination into the cutout pipeline (findings 1+4, one python pass).
2. Stage-level shared grain layer (finding 2, baked PNG variant).
3. Stage-level grade filter (finding 3).
4. Atmosphere re-multiply layer on scenes that have haze/bloom (finding 6).
5. Prototype directional rim on 3 close-ups (finding 5); decide bake vs. runtime.
6. Only then: hybrid WebGL close-up stage spike (finding 11).
