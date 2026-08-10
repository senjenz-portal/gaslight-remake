# SIGN-OFF — Gaslight Remake, Beat I "THE MASKED CLIENT"

**SIGNED OFF — Fable max, 2026-08-10, after 7 review rounds.**
Reviewed per RUBRIC.md on all three lenses (visual / engaging / user-clarity),
against the CONTENT.md comprehension contract (11 facts, 38 Doyle-verbatim
units), on full-lap Playwright evidence at 1440×900 and 1024×1366.

## What shipped
A complete, deterministic, dependency-free web rebuild of the reference
experience's Beat I: 38 click-paced units, four diegetic gates (press-and-hold
watermark, click-the-mask, click-the-index, click-the-door), pantomime acts,
cameo cards with the unmask flip, earned plates, a real page turn into the
end card, and diegetic audio (2 beds + 9 cues).
- 3D: 8 Scenario image-to-3D GLBs (armchair, fireplace, side table, Holmes,
  Watson, hansom, King masked + unmasked via NB Pro i2i edit → re-mesh).
- Images: 11 NB Pro (gemini-3-pro-image) plates/cameos/textures.
- Audio: 11 Scenario SFX (model_elevenlabs-sound-effects-v2).
- All raws immutable with sha256 manifests under assets/raw/.

## Final gate values (round 7, both ratios, twice, byte-identical)
exit 0 · 38/38 units · 0 wedges/errors/off-origin · clip: 0 px on all 38
settled frames (hottest 247.7) · V1 nearBlack ≤0.40 (worst 0.363) · portrait
deadBand 0.0102 (limit 0.08) · AA: receded 5.12–6.41:1, live 12.8–15.7:1 ·
pane hot 0.00% · lamp-pass swing 14.35–14.46 pp (need 12) · apron below floor
· Watson onFrame 1.0 ×4 · King head-band ≥943 px through his last beat at
every dwell {0.5,2.5,5,10 s} and every 1/60 s frame (standScan, 436 frames);
he exits only behind the page-turn cover · dwell/ring/census gates proved
non-vacuous by deliberate regression · perf p50 ~3 ms @DPR2 (800k tris).

## The loop (what each round closed)
R1: 4 majors — unlit King entrance, portrait two-islands, dead beats,
baked-mask unmask failure. R2: all closed at root cause (incl. a linear-vs-
sRGB backdrop shader bug). R3: Watson staging + 6 residuals; found Holmes
bisected at the unmask. R4: per-camera pan fix + figure life + honesty
instruments (paintProbe). R5: King's headless exit at capture; found the fix
was harness-cadence-coupled. R6: state-driven exit + frame-exact transient
scan + AA + page turn restored + hook hygiene; found the walk-out decapitation.
R7: exit moved fully behind the page turn; comment-truth sweep; cab wedge;
ledger closure. Verified independently every round by a second Opus agent
with its own instruments.

## Standing waivers (reasons in review/round-5.md and round-6.md)
Watermark knot vs letterforms (prose carries the fact) · King GLB hair vs
cameo (stylization) · leader-line crossings (hairline) · plate-run freezes
(held-document grammar) · portrait plate letterboxing (spotlit plate) ·
doorknob 247.7 peak (documented) · i-22→i-24 photo anticipation (canon
pacing) · box-artefact slice entries (reported, not gated) · 4 cosmetic
comment-wording nits from R7 verification (margin.js "34%" header, 0.02 m in
a scene.js comment, one envelope-vs-prose number, one build-report typo —
text-only, zero functional impact).

## Known archive gap
shots/round-0/lap.json was overwritten during round 5 (self-reported); all
round-0 PNGs intact. Rounds 1–7 evidence complete.

## Run it
Serve the bundle root statically and open app/index.html.
The review-lap and asset-regeneration scripts live in the private working
repo and are not shipped with this bundle.
