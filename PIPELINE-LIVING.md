# The Living Book pipeline

How a chapter becomes a living-plates experience (the /living/ build).
Each stage names its tool; all tools live in tools/ on this branch.

0. STORY CONTRACT (authoring): source text -> unit script (CONTENT.md):
   verbatim prose + speaker + verb (click/hold/gate) + facts-with-carriers.
   This file is law; stage 6 verifies against it byte-for-byte.
1. THE PLATE (tools/nbpro.py, ~$0.20): one NB Pro generation with the locked
   style prompt -> the painted master set. Owner picks between candidates.
2. LIVING LAYERS (tools/lanea/slice_plate.py, $0): deterministic depth
   slicing — fitted void gradient, measured/subtracted lamp bloom (ships as
   its own layer), silhouette diff cuts, harmonic inpaint headroom, ~700KB
   packed. Code-only life: feTurbulence fog, breathing emissives, parallax.
3. STATE VARIANTS (nbpro_edit.py + tools/laneassets/platediff.py, ~$0.50):
   script-demanded changes (door, dim) as i2i edits accepted ONLY if the
   diff mask is confined to the intended cells; drift auto-rejected.
4. ACTORS (~$1-2/character): in-plate figures -> hinged puppet parts cut
   from the plate's own paint (idle/gesture <=3deg; hole inpainted, diff-
   confined). New characters -> refsheet-locked i2i standing actor +
   pixel-aligned pose variants + 4-frame walk strips (matte.py spill
   ceiling, palettepull.py, stageproof.py composites onto the real plate
   before acceptance). Puppet on the mark; sprite only for crossings.
5. GRAMMAR (reuse): units.js is byte-identical across all product versions;
   living/app/{main,stage}.js re-host the same state machine — margin
   typography, cameos, the four gate verbs, Scenario SFX.
6. VERIFICATION (tools/living/lap.mjs): full reader lap ON THE DEPLOYED
   URL — every unit by its real verb, verbatim vs the contract, each gate
   proven by missing it first, zero console errors, per-beat screenshots.
7. DEPLOY: self-contained static folder (~6MB), any host, no build step.

Economics: ~$3-5 generation + an afternoon of agent time per chapter.
Every generated artifact is raw-first with sha256 manifests (assets/raw/).
New work = new contract + new plates; tools, grammar, harness carry over.
