# Research Lane: one-image (the No-Composite School)

Researched 2026-08-17. Question: instead of compositing RGBA character cutouts onto painted
plates (which reads as "layers pasted on an image" at close-up), generate the WHOLE SHOT per
beat — character IN scene — with character consistency held by references, and recover layers
only when interactivity demands it.

Our constraints for tagging: deterministic runtime (generation is offline, so any model is
runtime-safe), no WebGL (irrelevant here — this lane is a content-pipeline change), ~$25/chapter
generation budget, python+node tooling, models on hand: Gemini image (NB Pro), Seedance via
Scenario, Replicate, ElevenLabs.

---

## A. Whole-shot IMAGE generation with character references

### A1. NB Pro multi-reference: character sheet → character-in-scene shot  [ADOPT-CANDIDATE]
Nano Banana Pro (Gemini 3 Pro Image) accepts up to **14 reference images** and holds up to
**5 people** consistent in one generation; practitioner consensus is 2–4 clean refs per
character beat the max, with stable per-character labels reused verbatim across prompts.
This is exactly "canonical sheet → any scene" with no training step.
- https://www.atlascloud.ai/blog/guides/nanobanana-14-reference-images-consistency
- https://www.aifreeapi.com/en/posts/nano-banana-pro-reference-images
- https://prompting.systems/blog/nano-banana-pro-character-consistency-guide
- https://selfielabstudio.com/blog/nano-banana-pro-reference-sheet-tutorials-for-consistent-characters-20260226
Why for us: we already have canonical sheets and NB Pro access; zero new vendors; whole shot
means lighting/shadow/palette integration is the model's job, not our compositor's.

### A2. Plate-preserving variant: EDIT the existing painted plate  [ADOPT-CANDIDATE]
Google's own positioning of Nano Banana editing: "place your subject in a new environment...
then relight to match" — pass our existing 1408x768 plate + character sheet refs and instruct
"place CHARACTER here, match the plate's gaslight grading, cast contact shadow." Keeps our
authored backgrounds pixel-stable (determinism of the book's look) while the character is
painted INTO them rather than composited ON them. This is the lowest-risk entry: same plates,
same layout math, only the close-up beats get a fused image.
- https://blog.google/products/gemini/updated-image-editing-model/
- https://blog.google/products/gemini/nano-banana-tips/
- https://www.picsman.ai/blog/nano-banana-tutorial-how-to-use-google-gemini-image-editor/
Why for us: preserves plate palette/layout we already QA'd; the "pasted" tell (edge lighting,
shadow mismatch, palette drift) is removed at generation time.

### A3. Budget check: NB Pro cost per authored shot  [ADOPT-CANDIDATE]
Official Google API: **$0.134 per 1K/2K image**, $0.24 per 4K; Batch API −50%. Third-party
(kie.ai) $0.09/1K–2K. At official rates, $25/chapter ≈ 186 images (≈ 372 batched) — enough
for ~30–60 beats at 3–6 candidates each. Whole-shot-per-beat fits the budget.
- https://openrouter.ai/google/gemini-3-pro-image
- https://kie.ai/nano-banana-pro
- https://www.aifreeapi.com/en/posts/nano-banana-pro-api-pricing
Why for us: kills the "too expensive to author every beat" objection with arithmetic.

### A4. Qwen-Image-Edit-2509: open-weights "person + scene" fusion  [EXPERIMENT]
Apache-2.0 open model explicitly trained (via image concatenation) for multi-image editing
combos: "person + person", "person + product", **"person + scene"**; optimal at 1–3 inputs;
strong face-identity preservation claims. Runs on Replicate/local.
- https://huggingface.co/Qwen/Qwen-Image-Edit-2509
- https://github.com/QwenLM/Qwen-Image
- https://qwq32.com/blog/qwen-image-edit-2509
Why for us: cheap fallback/AB-test vs NB Pro; open weights = reproducible pins (determinism of
the asset pipeline); unknown if it holds our painted Victorian style — needs a bake-off.

### A5. Flux Kontext class (reference-conditioned edit, no fine-tune)  [EXPERIMENT]
BFL's Kontext keeps a subject while changing the setting from a single reference; benchmarks
cite 85–95% identity fidelity, but **>90° head turns break consistency ~14%** of the time and
**extreme relights (day→night) drop match to ~71%** — a real risk for our gaslight-graded
plates.
- https://www.together.ai/blog/flux-1-kontext
- https://www.flixly.ai/blog/flux-kontext-review-character-consistency-2026
- https://queststudio.io/blog/best-ai-models-for-character-consistency
Why for us: available via Replicate; worth one bake-off column, but the relight weakness is
exactly our hardest case, so not first choice.

### A6. Scenario in-platform reference tools (Ideogram character, IP-Adapter+ControlNet)  [ADOPT-CANDIDATE]
Scenario (already in our stack) ships single-image character consistency (Ideogram Character),
Character Reference, and Dual Reference (ControlNet structure + IP-Adapter style) — i.e., we
can do reference-conditioned whole shots AND lock composition to a layout sketch of the beat
(pose/depth from ControlNet) without new accounts.
- https://help.scenario.com/articles/5838320337-single-image-character-consistency-ideogram
- https://help.scenario.com/articles/1395284635-use-reference-images-for-enhanced-control
- https://www.scenario.com/blog/reskin-game-assets-ai-isometric-art
Why for us: ControlNet layout-lock preserves our deterministic hotspot/layout coordinates even
when the whole shot is regenerated.

### A7. Per-character LoRA training (comics-style)  [NOT-FOR-US]
AI comics tooling (ComicsMaker.ai etc.) trains a LoRA on 15–30 images per character and
generates every panel against it. But the 2026 filmmaking/comics field is moving to
reference-sheets-over-LoRA ("held characters consistent with reference sheets rather than
LoRA"), and NB Pro multi-ref beats the train/host/version overhead for our small cast.
- https://blog.mage.space/article/best-ai-comic-generators-2026/bf9d1669-438a-49ee-8a60-68f2e7710601
- https://dev.to/qcrao/character-consistency-in-ai-comics-3-tricks-that-beat-lora-training-for-me-3ad7
- https://invideo.io/blog/ai-filmmaking/
Why not: training cost + iteration friction against $25/chapter; multi-ref conditioning now
matches LoRA quality for stills without the MLOps.

---

## B. Whole-shot VIDEO with character reference (hero moments / video insets)

### B1. Authored still → I2V first-frame: the standard 2026 keyframe pipeline  [ADOPT-CANDIDATE]
The dominant production pattern: generate the consistent character-in-scene still (NB Pro,
refs locked), then feed it as **first frame** (optionally +last frame) to Seedance/Kling/Veo.
First-frame upload is documented as "the strongest consistency tool Seedance offers." For us:
our video insets should start from the fused authored shot — the inset then can't disagree
with the page around it.
- https://seedance2pro.io/blog/seedance-2-same-character-guide
- https://www.atlascloud.ai/blog/case-studies/from-nano-banana-image-to-video-ai-a-professional-workflow-using-atlas-cloud-and-veo-3-1
- https://nanoprompts.org/advanced-techniques/ai-video-generation
Why for us: Seedance is already in our stack via Scenario; this is a prompt-discipline change,
not a new dependency.

### B2. Seedance 2.x reference-to-video (multimodal anchors)  [ADOPT-CANDIDATE]
Seedance 2.0 treats character identity as a controllable input: image refs lock appearance,
video refs copy camera/pacing. Seedance 2.5 accepts up to 50 multimodal refs (caps: 9 images /
3 videos / 3 audio) across 30s clips. Character sheet + plate crop as refs = video that matches
both the person and the room.
- https://www.mindstudio.ai/blog/seedance-2-5-50-reference-multimodal-input-consistency
- https://www.devx.com/artificial-intelligence-ai/seedance-2-0-character-consistency/
- https://magichour.ai/blog/seedance-20-reference-guide
Why for us: our video vendor already; verify which Seedance version Scenario exposes.

### B3. Kling 3.0 "Elements 3.0" (video-as-reference) / Veo 3.1 "ingredients"  [NOT-FOR-US]
Kling 3.0 lets you upload a video reference and replicates the subject's 3D structure/motion
across scenes (4 ref slots); Veo 3.1 has 1 ref slot, weaker cross-shot hold. Best-in-class,
but neither is in our vendor set, and the vendor-neutral finding is that all models still fail
the same ways (fast motion, occlusion, rotation, multi-character contact) — reuse of identical
reference packages matters more than model choice.
- https://oakgen.ai/blog/kling-3-character-consistency-multishot
- https://www.elser.ai/blog/kling-3-vs-seedance-2-vs-veo-3-1-character-consistency
- https://www.3daistudio.com/blog/best-ai-video-generator-2026
Why not: adds a vendor for a marginal gain; adopt their DISCIPLINE (frozen ref package, score
"cost per accepted shot") on Seedance instead.

---

## C. Layer recovery — when the fused shot still needs interactivity

### C1. Qwen-Image-Layered: decompose one image into RGBA layers  [EXPERIMENT]
Dec 2025, QwenLM: takes a single RGB image, outputs a **variable number of semantically
disentangled RGBA layers**, each independently editable; code + weights released. This is the
missing bridge: author the fused shot (no paste-look), then recover character/prop layers for
hover states, parallax, or strip animation — the recovered layer inherits the shot's baked
lighting, so re-compositing it in place is seam-free by construction.
- https://arxiv.org/pdf/2512.15603
- https://github.com/QwenLM/Qwen-Image
Why experiment: open weights fit our tooling, but decomposition quality on painted 1408x768
plates is unproven; needs GPU or a Replicate port.

### C2. SAM 2 (+ matting head) cutout recovery from the authored shot  [ADOPT-CANDIDATE]
Simpler, available-today version of C1: SAM 2 (on Replicate, already our vendor) segments the
character out of the fused shot; matting refiners (BiRefNet, SAM2-Matte research line) clean
the alpha. The Spiritus layered-character paper (UIST 2025) validates the generate→matte→
segment→rig order for production character layers.
- https://ai.meta.com/research/sam2/
- https://www.emergentmind.com/topics/sam2-matte
- https://dl.acm.org/doi/full/10.1145/3746059.3747707
- https://arxiv.org/html/2601.12147v1
Why for us: pennies per image on Replicate; the recovered cutout + the character-free plate
(inpaint the hole once) gives us BOTH the integrated look and the interactive layer.

### C3. Harmonized multi-layer GENERATION (PSDiffusion, LayerDiffuse, ART)  [EXPERIMENT]
Research direction that keeps a layered runtime but generates the layers JOINTLY so they're
born matched: PSDiffusion's "global layer interaction" generates multi-layer images with
layout+appearance alignment; LayerDiffuse generates native-transparency RGBA; ART does
variable multi-layer transparent generation. Directly aimed at our "layers look pasted"
disease, from the layer side.
- https://www.semanticscholar.org/paper/28d865e61cce4d4df93f88c2f1447203f36d9388
- https://dl.acm.org/doi/10.1145/3658150
- https://runware.ai/blog/introducing-layerdiffuse-generate-images-with-built-in-transparency-in-one-step
Why experiment: SD-family base quality is below NB Pro for our painterly look; research-grade
code; but the concept (jointly-generated layers) could rescue the existing runtime if the
one-image route stalls.

---

## D. Who ships "authored shots per beat" at production scale — and how it looks

### D1. AI manga at #1 on Comic C'moA (Jan 2026)  [EXPERIMENT — as evidence]
"My Dear Wife, Will You Be My Lover?" (author mamaya, Studio Zoon/CyberAgent), 100% AI art,
topped Japan's largest e-book platform's daily seinen ranking — proof whole-panel generation
scales to 4 volumes. Caveat that matters to us: reader criticism called out characters that
"appear copy-pasted" and "drab backgrounds" — i.e., over-locked character refs recreate the
paste-look INSIDE a one-image pipeline. Integration prompting (light direction, contact,
palette) still has to be explicit per shot.
- https://kotaku.com/one-of-the-best-selling-manga-in-japan-right-now-was-made-by-ai-2000657158
- https://unseen-japan.com/ai-manga-japan-bestseller/
- https://www.cbr.com/manga-top-ranking-2026-ai-generated/

### D2. Neural Viz: one-person AI TV universe (YouTube)  [EXPERIMENT — as evidence]
Solo creator runs an entire episodic universe: write → storyboard → generate → perform →
voice → cut; ~12 hours + ~$100/mo of subscriptions per 2–3 minute episode; consistency held by
canonical character imagery + performance-driven animation. Demonstrates authored-shots-per-beat
is one-person sustainable at costs in our ballpark.
- https://takehomehub.com/creator-money/channel-breakdowns/neural-viz
- https://www.thedaringcreatives.com/creator-stories/neural-viz-ai-tv-universe/

### D3. 2026 AI-filmmaking norms: reference sheets over LoRA, agents route shots  [EXPERIMENT — as evidence]
Documented shorts hold 2 characters consistent across every scene using multi-angle reference
sheets in persistent context (no LoRA); costs $315–750/finished minute; Seedance 2.0 cited as
the reference-driven workhorse. The transferable practice: one frozen "reference package"
(turnaround, expressions, costume detail) reused verbatim per character per shot, and blind
scoring of face/hair/proportions/continuity per accepted shot.
- https://invideo.io/blog/ai-filmmaking/
- https://www.mindstudio.ai/blog/ai-filmmaking-cost-breakdown-2026
- https://aiworkflows.tools/workflows/short-film

### D4. MultiBanana benchmark (multi-reference T2I)  [EXPERIMENT]
Academic benchmark for multi-reference text-to-image — useful as a scoring rubric source when
we bake-off NB Pro vs Qwen-Edit vs Kontext on our own sheets.
- https://arxiv.org/pdf/2511.22989

---

## Recommended shape (synthesis, not a finding)

1. **Close-up beats first**: NB Pro EDIT mode — plate + character refs → one fused image per
   beat (A2). Keep wide/ambient beats on the existing composite runtime.
2. **Interactivity**: SAM2+matting recovers the cutout from the fused shot; inpaint the hole
   once for a character-free plate; DOM runtime composites the shot's OWN layers back —
   seam-free because lighting was baked together (C2). Try Qwen-Image-Layered as the
   higher-fidelity decomposer (C1).
3. **Video insets**: fused still becomes Seedance first frame + sheet refs (B1/B2).
4. **Discipline**: frozen per-character reference package, verbatim labels, explicit
   integration language (light direction, contact shadow, palette) in every prompt; score
   cost-per-accepted-shot (D1/D3 lessons).
5. Budget: ~$0.134/image official (batch $0.067) → whole-shot-per-beat fits $25/chapter (A3).
