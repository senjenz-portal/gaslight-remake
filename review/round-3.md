# Round 3 review — Fable max — NOT SIGNED OFF (1 blocking + 5 small)

All R3 items independently verified CLOSED (builder + verifier + my eye).
No round-1/2 regressions. Determinism byte-identical across 5 laps. The
establishing frame now reads as a real diorama (seated Watson by the fire is
exactly right). Brightness WATCH judged BY EYE: acceptable — do not darken
anything further this round; comes2 has only 0.037 nearBlack headroom.

## Round 4 (surgical; no re-staging beyond what is named)
- **[R4-1 BLOCKING] Holmes bisected at i-15-condescend / i-16-iamking**
  (inset fraction 0.49/0.44; he was whole in round 2). Fix PER-CAMERA: adjust
  the mask/unmask framing (target/fov/azim-offset within the locked-azimuth
  family) or give Holmes a per-unit mark for 15–17 only — do NOT move his
  global desk mark (the i-12/13 three-shot fix must hold, gates stay green).
  While there: his baked letter reads as a card held to his cheek at this
  camera — turn his yaw so the letter faces the desk/profile if that kills
  the read, else report it as acceptable with the frame.
- [R4-2 engaging] Post-swap GLB figures lost all idle/walk life (slot.replace
  removed the placeholder parts step() animated — now dead code). Restore at
  SLOT level, deterministic: walk bob + slight roll during Mover moves (the
  King's entrance must not glide), micro breath (≤0.5% scale or ≤0.01 rad
  sway) on idle figures. Remove the dead placeholder-part animation code.
- [R4-3 visual] Hearth ember is the frame's only clipped element and reads as
  a cream card: bring under luma 250 with ambers preserved (fire must stay
  the warm anchor of the room).
- [R4-4 visual] King's tunic chest blows out at i-11-hadnote (2035 px >250):
  tone the rim/hall light response or material so the chest models below 250
  without losing the lit-doorway read (V1 gates must stay ≤0.40).
- [R4-5 nit] The discarded mask on the rug reads as a black scribble at wide
  framings: face it up, scale for read, keep it near the King's feet.
- [R4-6 hygiene] Slice list records fully-occluded figures (holmes at
  i-35-briony, 0 visible pixels): measure visibility (sampled depth/occlusion
  or a rendered-pixel check), or annotate occluded entries so the report
  stays honest.

## Sign-off condition (round 4)
R4-1..R4-4 closed with frames + numbers; R4-5/6 fixed or waived with reason;
all enforced gates green; determinism intact; no new findings on my pass.
