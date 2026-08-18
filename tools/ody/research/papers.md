# Research lane: papers — making composited characters belong to plates (2023–2026)

Context: Living Book = deterministic DOM/CSS reader; 1408x768 plates + RGBA character cutouts
(regraded to plate palette + contact shadows). Complaint: characters read as pasted layers at
close-ups. Everything below runs at GENERATION time (python/node, Replicate/Scenario/NB Pro),
so runtime determinism is unaffected. Budget ~$25/chapter.

Key architectural insight that recurs below: most 2025-26 methods operate on a FLATTENED
composite. Our layered runtime survives if we adopt the pattern:
**composite → relight/harmonize full frame → re-cut character with SAM 2 (original alpha as prior) → re-layer**.
Shadow generators are even friendlier: they can emit the shadow as a separate multiply sprite.

---

## 1. Relighting (the true replacement for our palette regrade)

### IC-Light — "Scaling In-the-Wild Training for Diffusion-based Illumination Harmonization and Editing" (lllyasviel, ICLR 2025 oral) — [ADOPT-CANDIDATE]
- https://github.com/lllyasviel/IC-Light • Replicate: https://replicate.com/zsxkib/ic-light (~$0.026/run)
- Two SD1.5-based models: text-conditioned and **background-conditioned** relighting. The
  bg-conditioned model takes our exact inputs (fg cutout + plate) and re-renders the character
  under the plate's illumination — directional light, color spill, ambient — not just a color match.
  Character pixels stay in place, so our existing alpha matte still applies after relight.
- Why adopt: v1 is Apache-2.0, on Replicate, ~30 shots/chapter ≈ $0.80. Directly attacks
  "regrade isn't relighting." Measurably fixes light direction/color-bleed mismatch, the #1
  pasted-layer tell.

### IC-Light v2 (Flux-based, Oct 2024→2025) — [EXPERIMENT]
- https://github.com/lllyasviel/IC-Light/discussions/98 • hosted: https://fal.ai/models/fal-ai/iclight-v2 ($0.10/MP)
- Much better detail/texture preservation than v1 (v1 can melt fine detail — bad at close-ups).
- Why experiment, not adopt: weights non-commercial, hosted-only via fal (adds a provider), ~4x
  v1 cost. Worth an A/B on our worst close-up before committing.

### LBM — Latent Bridge Matching (Jasper Research, ICCV 2025 Highlight) — [ADOPT-CANDIDATE (license caveat)]
- https://arxiv.org/abs/2503.07535 • https://github.com/gojasper/LBM • https://huggingface.co/jasperai/LBM_relighting
- Bridge matching in latent space: fg+bg → relit fg in **a single inference step** (SDXL-scale, 3B).
  SOTA on object relighting/harmonization benchmarks; also does shadow generation in the same
  framework. Cheapest possible per-image cost (1 step) — effectively free at our volume, self-hosted.
- Caveat: released weights are CC BY-NC 4.0. Fine for a personal/free web book; not if the book is
  ever monetized. Verify before making it the default path.

### LumiNet (CVPR 2025) — [NOT-FOR-US]
- https://luminet-relight.github.io/ • paper: https://openaccess.thecvf.com/content/CVPR2025/papers/Xing_LumiNet_Latent_Intrinsics_Meets_Diffusion_Models_for_Indoor_Scene_Relighting_CVPR_2025_paper.pdf
- Transfers full indoor lighting (cast shadows, inter-reflections) between whole scenes via latent
  intrinsics. Impressive, but it relights the SCENE, not a fg against a given bg — wrong shape for
  our fg-to-plate problem, and heavier than IC-Light/LBM.

### SwitchLight (Beeble, CVPR 2024) — [EXPERIMENT]
- https://arxiv.org/abs/2402.18848 • product: https://www.beeble.ai/
- PBR-grade human relighting (normals+albedo decomposition then re-render). Best-in-class for
  faces, which is exactly where our close-ups fail. Commercial API only — cost/lock-in; try it on
  2-3 hero close-ups before deciding.

### SpotLight — shadow-guided object relighting (arXiv Nov 2024, training-free) — [EXPERIMENT]
- https://arxiv.org/abs/2411.18665
- You specify the desired cast shadow; the diffusion renderer relights the inserted object to be
  consistent with it. Interesting for us because we already author contact shadows — this inverts
  them into a lighting control signal. Research code maturity unclear.

### UniRelight (NVIDIA, NeurIPS 2025) — [NOT-FOR-US]
- https://github.com/nv-tlabs/UniRelight • https://huggingface.co/nvidia/UniRelight
- Joint albedo estimation + relit video in one pass, built on Cosmos world models. Beautiful,
  temporally consistent shadows/reflections — but Cosmos-scale GPU requirements and research
  licensing blow our budget/tooling for marginal gain over TC-Light/RelightVid on short insets.

---

## 2. Image harmonization (color-transfer lineage — our current regrade's family)

### PCT-Net (CVPR 2023) / INR-based dense harmonization (T-CSVT 2023) — [NOT-FOR-US]
- https://github.com/bcmi/Awesome-Image-Harmonization (canonical index; PCT-Net + INR entries)
- Pixel-wise color transforms at full res. Strictly a better regrade — still color-only, cannot add
  directional light, shadow, or edge interaction. This is the ceiling we're already hitting; adopting
  it would be lateral movement.

### Region-to-Region: adaptive regional injection for generative harmonization (arXiv Aug 2025) — [EXPERIMENT]
- https://arxiv.org/abs/2508.09746
- Addresses the classic failure of generative harmonizers (fg identity/detail drift) by injecting
  fg detail regionally while letting the model repaint illumination. Relevant precisely because
  identity drift is what makes generative passes scary for canonical characters. Code available.

### Harmonizer (NVIDIA, 2025-26, HF release) — [EXPERIMENT]
- https://huggingface.co/nvidia/Harmonizer
- Single-step diffusion trained to fix imperfect renders: relighting + re-insertion + PBR shadow
  simulation in one model. Shape matches our problem (fix a near-correct composite cheaply);
  check license + whether it generalizes beyond their novel-view-render domain.

---

## 3. Generative object/character insertion

### Insert Anything (arXiv 2504.15009, Apr 2025; FLUX Fill+Redux; AnyInsertion 159k dataset) — [EXPERIMENT]
- https://github.com/song-wensong/insert-anything • https://song-wensong.github.io/insert-anything/
- Current open AnyDoor successor: reference image + target scene + mask → inserted subject with
  scene-consistent lighting/scale/contact. Person insertion is a first-class task. Beats AnyDoor,
  MimicBrush, ACE++ on identity preservation.
- Why experiment: outputs a flattened frame → needs SAM 2 re-cut to restore our layers; FLUX-dev
  non-commercial license; heavier than a relight pass. But it's the right tool when a pose/contact
  is wrong, not just the lighting.

### Magic Fixup (Adobe, arXiv Aug 2024, code released) — [EXPERIMENT]
- https://magic-fixup.github.io/magic_fixup.pdf • https://github.com/adobe-research/MagicFixup
- Trained on video frame pairs: takes a crude cut-and-transform collage and repaints it
  photorealistically while preserving identity — literally "make the pasted thing belong,"
  including perspective/lighting fixes. The best conceptual match to our complaint.
- Why experiment: Adobe research license (non-commercial), SD-based (identity drift risk on
  canonical faces), flattened output → re-cut required.

### Qwen-Image-Edit 2509/2511 (Alibaba, Apache 2.0, on Replicate) — [ADOPT-CANDIDATE]
- https://huggingface.co/Qwen/Qwen-Image-Edit-2511 • https://replicate.com/qwen/qwen-image-edit
- 20B instruction-based editor; explicitly supports relighting and multi-reference compositing.
  Use as a commercially-safe Magic-Fixup-style pass: feed our composite + "match the character's
  lighting to the scene, add soft contact shadow, keep identity" → re-cut with SAM 2. Apache 2.0,
  already on our Replicate account, ~$0.03-0.06/image. Pairs with NB Pro (Gemini) as a second
  opinion — we already pay for that.

### CrimEdit (arXiv 2509.23708) — [EXPERIMENT]
- https://arxiv.org/pdf/2509.23708 — insertion/removal/movement that also handles the object's
  EFFECTS (shadows, reflections) counterfactually. Relevant when we move a character between
  plates; watch for code.

### HOComp — interaction-aware human-object composition (arXiv 2507.16813) — [NOT-FOR-US]
- https://arxiv.org/pdf/2507.16813 — inserts objects into human interactions (hands etc.). Inverse
  of our problem; narrow scope.

---

## 4. Shadow synthesis for composites (fits our layered runtime BEST)

### GPSDiffusion — Shadow Generation with Geometry Prior (CVPR 2025, code+weights) — [ADOPT-CANDIDATE]
- https://github.com/bcmi/GPSDiffusion-Object-Shadow-Generation • https://cvpr.thecvf.com/virtual/2025/poster/32825
- Predicts rotated bbox + shadow shape geometry, injects into ControlNet → plausible cast shadow
  for an inserted object. Crucially the output shadow can be extracted (diff vs input) and shipped
  as a **separate multiply-blend sprite under the character layer** — zero change to our DOM
  compositing model, replaces our hand-authored contact shadows with light-consistent cast
  shadows. Self-hostable, SD1.5-scale = cheap.

### MetaShadow (Adobe, CVPR 2025) — [NOT-FOR-US]
- https://openaccess.thecvf.com/content/CVPR2025/papers/ (Wang et al., "MetaShadow: Object-Centered Shadow Detection, Removal, and Synthesis")
- Strong object-centric detect/remove/synthesize suite, but no public code/weights — nothing to run.

### CoShadow / MultiShadow — multi-object joint shadow generation (arXiv 2603.02743, 2026) — [EXPERIMENT]
- https://arxiv.org/abs/2603.02743 — jointly consistent shadows when several characters are
  inserted in one plate (our crowd scenes). Newest work in the niche; check for code before investing.

---

## 5. Video harmonization/relighting (for our Seedance hero insets)

### TC-Light (NeurIPS 2025) — [EXPERIMENT]
- https://github.com/Linketic/TC-Light • https://arxiv.org/abs/2506.18904
- IC-Light inflated to video + two-stage optimization (exposure alignment, then a canonical
  "Unique Video Tensor"). 300 frames @ 1280x720 on a 40GB A100 — the only long-video relight that
  is plausibly within hobby-GPU/cloud-burst cost. Use to relight/harmonize Seedance insets to the
  plate look so the video moment doesn't pop against the page.

### Light-A-Video (Feb 2025, training-free) — [EXPERIMENT]
- https://bujiazi.github.io/light-a-video.github.io/ — progressive light fusion over IC-Light;
  training-free = cheapest to trial on a 3-5s inset, weaker temporal guarantees than TC-Light.

### RelightVid (arXiv 2501.16330) — [EXPERIMENT]
- https://github.com/Aleafy/RelightVid — video relighting conditioned on background video / text /
  HDR maps with high temporal consistency. Bg-video conditioning matches "make inset match plate."

### VideoAnydoor (SIGGRAPH 2025) — [NOT-FOR-US]
- https://dl.acm.org/doi/10.1145/3721238.3730647 — video object insertion with motion control.
  We already get motion from Seedance; inserting characters into video adds a heavy pipeline for
  a problem we don't have.

---

## 6. Layered / character-consistent generation (avoid compositing instead of fixing it)

### LayerFusion — harmonized fg(RGBA)+bg co-generation (arXiv 2412.04460) — [EXPERIMENT]
- https://arxiv.org/html/2412.04460v1 • https://openreview.net/forum?id=OE2T7AgQFN
- Generates the transparent character layer AND the background with cross-layer interaction, so
  light wrap/shadow agreement is baked in at generation while we still receive separate layers —
  the only line of work that natively outputs our runtime format already harmonized. Needs a
  consistency mechanism for canonical characters before it's usable.

### ART — Anonymous Region Transformer, variable multi-layer generation (CVPR 2025) — [EXPERIMENT]
- via https://github.com/AlonzoLeeeooo/awesome-image-inpainting-studies — multi-layer transparent
  generation; same appeal and same character-consistency gap as LayerFusion.

### UNO (ByteDance, ICCV 2025) / USO (ByteDance, CVPR 2026) / DreamO — subject-consistent FLUX generation — [ADOPT-CANDIDATE for close-ups]
- https://github.com/bytedance/UNO • https://github.com/bytedance/USO
- Feed canonical character sheet as reference → generate the character IN the scene, full-frame,
  with identity consistency. For hero close-ups — exactly where layers fail hardest — the honest
  fix is to stop compositing and generate the shot whole (then optionally SAM 2-cut if parallax
  layers are still wanted). USO ships weights + ComfyUI support; NB Pro (Gemini) with reference
  images is the zero-new-infra version of the same strategy we can trial today.

### PSDiffusion (arXiv 2505.11468) / AlphaVAE (arXiv 2507.09308) — [NOT-FOR-US]
- Multi-layer PSD-style generation / better RGBA VAE. Infra-level research; nothing production-ready
  that beats LayerFusion/ART for our need.

---

## Recommended pipeline change (synthesis)

1. Replace palette regrade with **IC-Light bg-conditioned relight** of each cutout against its
   plate (Replicate, ~$0.026/shot); keep original alpha. (~$1/chapter)
2. Replace hand-authored contact shadows with **GPSDiffusion cast-shadow sprites** (self-hosted,
   diff-extracted, shipped as multiply layers). (~$0)
3. For the 3-6 hero close-ups per chapter: **generate in-scene** with NB Pro reference-conditioning
   or USO/UNO instead of compositing; fall back to a **Qwen-Image-Edit 2511 fixup pass + SAM 2
   re-cut** when layers must be preserved. (~$1-3/chapter)
4. Harmonize Seedance insets with **TC-Light** (or training-free Light-A-Video first) so video
   moments match the graded page. (cloud A100 burst, ~$2-5/chapter)
   Total added cost ≈ $4-9/chapter — inside the $25 envelope.
