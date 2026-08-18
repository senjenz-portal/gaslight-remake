# Research Lane: GITHUB — compositing tools/repos for the Living Book

Context: DOM/CSS deterministic reader; 1408x768 plates + RGBA character cutouts. Problem: characters read as
pasted layers at close-up. All candidates below are judged as **offline pipeline tools** (python/node, bake once,
ship deterministic assets) — nothing here needs to run in the browser. Budget ~$25/chapter. Verified 2026-08-17.

---

## 1. Image harmonization toolboxes

### bcmi/libcom — [ADOPT-CANDIDATE]
- https://github.com/bcmi/libcom — Apache-2.0, 734 stars, actively pushed (2026-04)
- The one-stop image-composition toolbox from SJTU BCMI lab. `pip install libcom`. Bundles exactly what we're missing:
  - **PCTNet** photorealistic harmonization (pixel color transforms — fast, resolution-independent, ideal for regrading a cutout to plate palette *per-plate*, better than our current global regrade)
  - **LBM** harmonization (newer diffusion-free option)
  - **GPSDiffusion shadow generation** (drops a plausible cast/contact shadow for an inserted object — directly attacks the "pasted" tell)
  - **RGDiffusion reflection generation**, **HarmonyScoreModel** (score how pasted a composite looks — usable as an automated QA gate in our chapter build), **FOPA/OPA placement scoring**, inharmonious-region detection (MadisNet)
- Runs local; needs Linux + CUDA GPU (Python 3.10, torch>=2.6). On this Mac that means a cheap cloud GPU box or Colab per chapter build — fine for an offline bake step, and $0 marginal API cost.
- Why fit: it is literally a toolbox for "object insertion looks pasted." HarmonyScore as CI gate + PCTNet regrade + GPSDiffusion shadows = three fixes from one dependency, permissive license.

### ZHKKKe/Harmonizer — [EXPERIMENT]
- https://github.com/ZHKKKe/Harmonizer — **no LICENSE file** (ECCV 2022), 410 stars, dormant since 2023
- White-box harmonization: predicts classic filter arguments (brightness/contrast/saturation/etc.) instead of pixels. Uniquely relevant to us: the predicted filter stack could be **exported as a CSS `filter:` chain** on the cutout layer — harmonization that survives our DOM/CSS runtime with zero baked pixels.
- Also does high-res **video harmonization** (frame-consistent by construction, since it outputs smooth filter args).
- Why not ADOPT: missing license = can't vendor; dormant. Worth an experiment to see if "predict filter args → emit CSS filters" beats baked PCTNet output; if it wins, reimplement the idea or get license clarity.

### bcmi/Object-Shadow-Generation-Dataset-DESOBAv2 — [EXPERIMENT]
- https://github.com/bcmi/Object-Shadow-Generation-Dataset-DESOBAv2 — Apache-2.0, CVPR 2024, maintained (2026-02)
- Standalone diffusion shadow generation (model behind libcom's shadow module). Use via libcom instead unless we need to fine-tune shadow style for illustrated plates — diffusion shadow models are trained on photos; may fight our painted look.

---

## 2. Relighting composites

### lllyasviel/IC-Light (v1) — [ADOPT-CANDIDATE]
- https://github.com/lllyasviel/IC-Light — Apache-2.0, 8.5k stars
- Imposes consistent light on a foreground subject: give it our cutout + a text/background light condition (FBC model takes the actual background image) and it relights the character to match the plate's key light. This is the single strongest fix for "layer pasted on an image" at close-up — palette regrade fixes color, IC-Light fixes **light direction and wrap**.
- v1 = SD1.5-based, weights on HF, runs local (needs GPU; slow on MPS) **and is hosted on Replicate** (e.g. `zsxkib/ic-light`), which is already in our toolchain. Pennies per image — fits $25/chapter easily.
- Deterministic: seed-pinned, run offline, ship the baked PNG. Caveat: SD1.5 resolution means run at cutout-crop scale then upscale; can drift identity on faces — gate with our fidelity checks.

### IC-Light v2 / v2-Vary (Flux-based) — [NOT-FOR-US]
- https://github.com/lllyasviel/IC-Light/discussions/98 , https://github.com/lllyasviel/IC-Light/issues/139
- Much better detail preservation + handles **stylized images** (exactly our case), but weights still unreleased as of mid-2026 — available only as fal.ai API / HF Space demo. fal is not in our approved toolchain and there's no license clarity on outputs. Re-check quarterly; if weights drop under Apache, this jumps to ADOPT-CANDIDATE over v1.

---

## 3. Subject insertion

### ali-vilab/AnyDoor — [NOT-FOR-US]
- https://github.com/ali-vilab/AnyDoor — MIT, 4.2k stars, **dead since 2024-04**
- Zero-shot object teleport into a scene (DINOv2 ID tokens + SD2.1 inpainting). Superseded in quality by exactly the model we already pay for: Gemini image (NB Pro) does reference-conditioned subject insertion better, with our canonical sheets as reference. AnyDoor adds a heavy local SD2.1 pipeline for worse identity fidelity. Same verdict for MimicBrush and similar 2024-era insertion repos.
- Note: libcom's generative-composition module (FluxKontext/OSInsert) covers this niche if we ever want a local fallback.

---

## 4. Sprite normal-map lighting

### azagaya/laigter — [EXPERIMENT]
- https://github.com/azagaya/laigter — GPL-3.0, 1.3k stars, **actively developed (pushed 2026-08-17)**
- Automatic normal/parallax/specular/occlusion map generation for 2D sprites. GPL is fine — standalone offline tool (has CLI mode), its license never touches shipped assets.
- The interesting angle for a no-WebGL runtime: SVG `feDiffuseLighting`/`feSpecularLighting` + `feDistantLight` consume an **alpha-channel height map** and are fully deterministic DOM primitives. Laigter's height/parallax output → alpha height map → per-plate SVG light rig on the cutout = real directional light on characters without WebGL.
- Why only EXPERIMENT: SVG lighting primitives are the least-battle-tested corner of SVG filters (perf + rendering differences across engines); may be cheaper to just bake IC-Light variants. Prototype on one close-up first.

### Sprite Lamp / SpriteDLight — [NOT-FOR-US]
- http://www.spritelamp.com , https://www.kickstarter.com/projects/2dee/spritedlight
- The originals of this genre; both commercial, effectively abandoned (~2016), no source, Windows-centric. Laigter is the living successor.

---

## 5. SAM2 video-layer pipelines

### facebookresearch/sam2 — [ADOPT-CANDIDATE]
- https://github.com/facebookresearch/sam2 — Apache-2.0, 19.7k stars, maintained (2026-05)
- Promptable video segmentation with temporal masklets. Already in our stack via Replicate (`meta/sam-2`, `meta/sam-2-video`). Use to cut our Seedance video insets into **character-layer + plate-layer video**: matte the hero out of the video so the inset stops being a rectangle — video composited the same way as stills (cutout over plate), erasing the seam between the two media. Also our matting backbone for still cutouts.

### IDEA-Research/Grounded-SAM-2 — [ADOPT-CANDIDATE]
- https://github.com/IDEA-Research/Grounded-SAM-2 — Apache-2.0, 3.7k stars, maintained (2025-11)
- Text-prompted ("the woman in the grey dress") grounding + SAM2 tracking. Removes the manual click-prompt step so chapter builds stay scriptable: character name → mask sequence, no human in the loop. Local GPU or wire equivalent grounding via Replicate.

### erikalu/omnimatte — [NOT-FOR-US]
- https://github.com/erikalu/omnimatte — Apache-2.0, 2021, dead
- Layered video decomposition *with* associated shadows/reflections — conceptually perfect (it extracts the character AND their shadow as one RGBA layer) but per-video test-time optimization taking hours, 2021-era quality, unmaintained. The generative-omnimatte successors (Google, CVPR 2025) have no released code. Approximate the idea instead: SAM2 matte + GPSDiffusion regenerated shadow.

---

## 6. Video harmonization

### bcmi/Video-Harmonization-Dataset-HYouTube (CO2Net) — [EXPERIMENT]
- https://github.com/bcmi/Video-Harmonization-Dataset-HYouTube — **no license**, 65 stars, small community
- The reference video-harmonization codebase (color-mapping-consistency, IJCAI 2022). Video harmonization as a field is thin; nothing here is drop-in. Cheaper path for our few hero videos: harmonize frame 0 with PCTNet/Harmonizer, then propagate the color transform (a 3D LUT) to all frames — temporally stable by construction. Prototype that before adopting any video-harmonization net. (Harmonizer above also has a video mode — same license blocker.)

---

## 7. ESRGAN-class upscalers for plates

### xinntao/Real-ESRGAN — [ADOPT-CANDIDATE]
- https://github.com/xinntao/Real-ESRGAN — BSD-3-Clause, 36.5k stars, stable/frozen (2024)
- The workhorse. `realesrgan-ncnn-vulkan` binary runs on this Mac's GPU with zero python deps; also on Replicate (`nightmareai/real-esrgan`) for ~$0.002/image. Use the anime/illustration model (`realesr-animevideov3` or `RealESRGAN_x4plus_anime_6B`) for painted plates; upscale 1408x768 plates 2x for close-up crops so zooms don't go soft while cutouts stay sharp — mismatched sharpness is one of the "pasted" tells.

### chaiNNer-org/chaiNNer (+ Spandrel) — [EXPERIMENT]
- https://github.com/chaiNNer-org/chaiNNer — GPL-3.0, 6k stars, active (2026-07)
- Node-graph batch image processing; loads the whole community-model zoo (HAT, DAT, 4x-UltraSharp…) via Spandrel (MIT: https://github.com/chaiNNer-org/spandrel). Good for A/B-ing which upscale model suits painted plates; too GUI-shaped for the automated chapter build — if a community model wins, script it with Spandrel directly.

### Fanghua-Yu/SUPIR — [NOT-FOR-US]
- https://github.com/Fanghua-Yu/SUPIR — non-standard license (**non-commercial restrictions**), heavy (SDXL-scale GPU), hallucinates detail
- Best-in-class photo restoration but license blocks a shipping product and generative detail invention would drift our canonical plate art.

### upscayl/upscayl — [NOT-FOR-US]
- https://github.com/upscayl/upscayl — AGPL-3.0, Electron GUI
- Same ncnn engine as Real-ESRGAN underneath; the GUI adds nothing to a scripted pipeline and AGPL adds friction. Use Real-ESRGAN directly.

---

## Recommended stack (one line)
SAM2/Grounded-SAM-2 (matte, incl. video insets) → IC-Light v1 via Replicate (relight cutout to plate key light) →
libcom PCTNet (palette regrade) + GPSDiffusion (contact/cast shadow) → HarmonyScore as automated "pasted-look" QA gate →
Real-ESRGAN anime model on plates for close-up crops. All offline bakes; runtime stays deterministic DOM/CSS.
