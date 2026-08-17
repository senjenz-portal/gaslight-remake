# INTEGRATION AUDIT — why the odyssey cutouts read as pasted

Audited 2026-08-16 against `shots/ody-round7/` (2880x1800 retina grabs; stage plate
occupies roughly x1020..2780, y420..1380) and the shipped apps:
`site-deploy/living-odyssey/app/` (ours) vs `site-deploy/living/app/` (sherlock).
Sample boxes were placed by eye on verification crops, tight on body mass; all
coordinates below are original-pixel. Metrics: L = Rec.709 luminance (0–255),
WARM = mean(R) − mean(B). "Plate ring" = floor/prop paint immediately around the
actor's feet (contact zone), excluding the actor.

NO FIXES in this document — measurement only.

---

## (a) CONTACT SHADOW — zero, book-wide. Binary and universal.

**Does ANY odyssey actor cast one? No.**

- `grep shadow site-deploy/living-odyssey/app/sets/{cave,sea,shore}.js` → **0 shadow
  layers in all three sets** (only comments: "the clutch IN SHADOW", etc.). No set
  ever creates a `lyr shadow` node.
- `site-deploy/living-odyssey/assets/actor/` does **not ship contact-shadow.png at
  all** (52 actor cuts, no shadow asset). Sherlock ships it at
  `site-deploy/living/assets/actor/contact-shadow.png`.
- The CSS rule for it was carried over and left dangling:
  `living-odyssey/index.html:68 → #stage .shadow{opacity:.7;}` — shipped, never
  instantiated. The rig expected shadows; the sets never drew any.

What sherlock drew under actors (living/app/sets/*.js):

| set | shadow node | behaviour |
|---|---|---|
| street.js:261,447-448 | `holmesShadow = img('actor/contact-shadow.png','lyr shadow', this.actors)` | sized to foot span (`sw`), re-boxed every frame at the feet, opacity .55 when visible |
| room.js:248,700-701 | `kingShadow` | sized to feet (`sw × 160/512 × 1.6`), opacity **.55 walking / .70 settled** |
| chase.js:223 | per-rig `st.img('actor/contact-shadow.png','lyr shadow', g)` | "its lamp and its shadow travel together" — the shadow rides the rail rig |
| church.js | none | the one set without a blob; it compensated with the FEET/`floorAt` baseline law + ring plate |

Every plate prop in the odyssey paintings (logs, barrels, cheese racks, rocks, the
plate goats in b1-11) has painted ambient occlusion at its ground line; the nine
audited settles put **zero** occlusion under any actor. In `b3-36-lookhere` the
seated Polyphemus additionally hovers ~20–60 px above the floor paint with clean
floor visible under his whole seat, and in `b2-24` both his feet float clear of the
flagstones — with no shadow there is nothing to negotiate the contact at all.

---

## (b) TEMPERATURE / LUMINANCE DELTA — actor lower half vs plate ring at the feet

Per settled principal (dW = actorWARM − plateWARM; dL = actorL − plateL):

| settle (shot / principal) | actor R/G/B | plate-ring R/G/B | aL | pL | **dL** | aW | pW | **dW** |
|---|---|---|---|---|---|---|---|---|
| b2-24 firstmeal / Ulysses at fire | 83/51/49 | 47/31/27 | 57.4 | 34.1 | **+23.3** | +34.2 | +20.5 | +13.7 |
| b2-24 firstmeal / Polyphemus legs | 64/48/42 | 74/56/58 | 50.9 | 60.0 | −9.1 | +21.7 | +15.8 | +5.9 |
| b2-19 strangers / Polyphemus seated | 135/117/73 | 144/94/55 | 117.6 | 102.1 | +15.5 | +61.4 | +88.5 | **−27.2** |
| b3-36 lookhere / Ulysses w/ bowl | 207/168/120 | 209/167/118 | 172.4 | 172.7 | −0.3 | +86.7 | +90.9 | −4.2 |
| b3-36 lookhere / Polyphemus seated | 149/119/92 | 189/146/123 | 123.2 | 153.2 | **−29.9** | +56.3 | +66.0 | −9.7 |
| b5-61 feltbacks / ram (middle) | 195/174/133 | 221/178/122 | 175.9 | 183.2 | −7.3 | +61.6 | +98.9 | **−37.4** |
| b1-11 wineskin / Ulysses in line | 135/104/95 | 157/129/115 | 110.2 | 133.6 | −23.4 | +39.8 | +42.3 | −2.5 |
| b1-11 wineskin / crew (blue tunic) | 122/105/101 | 162/130/114 | 108.3 | 135.9 | **−27.6** | +20.3 | +47.6 | **−27.3** |
| b1-09 cave-mouth / Ulysses | 94/69/45 | 83/70/35 | 72.9 | 69.8 | +3.1 | +49.5 | +48.0 | +1.5 |

Reading:

- **In the firelit amber cave the actors measure cool, exactly as predicted.** The
  seated giant is 27 warm-points cooler than the racks around him (b2-19); the rams
  are **37 points cooler** than the amber path they walk (b5-61); the lookhere giant
  is 10 cooler AND 30 L darker than the blazing floor he hovers over. The shore crew
  in blue are −27 warm / −28 L against the sand.
- The failure is two-directional: in the dark cave state (b2-24) Ulysses is **+23 L
  brighter** than the ground at his feet — the plate went dark (painted state) and
  the cutout kept its studio exposure. The actor never takes the plate's light,
  whichever way the plate goes.
- Source is baked in: the raw cuts are keyed off a flat `#1a2038` navy studio field
  (`tools/ody/matte_navy.py` — "key an odyssey actor off the flat #1a2038 NAVY
  backing") and carry a near-neutral grade: `polyphemus-seated.png` asset mean warm
  +40.8, `ram-walk.png` **+22.1**, vs cave ring warms of +66…+99. No runtime warm
  grade is ever applied (see d).
- The two near-matches are instructive: b1-09 (dusk exterior, both neutral) and
  b3-36 Ulysses (dW −4.2, dL −0.3) — the latter only because he stands inside the
  `bloomFire` screen wash, which cave.js draws OVER the actors. Even with perfect
  temperature he still reads pasted there (floating giant beside him, no shadow,
  hard rim) — the control case for the ranking below.

---

## (c) EDGE REGISTER — actor rim vs the plate's own edges at the same lens k

Rim scans (luminance step across the boundary; width = px above 25% of peak
gradient; peakGrad in L/px at 2880-wide scale):

| scan pair (same shot, comparable radius from focus) | width px | peakGrad | step L |
|---|---|---|---|
| b2-24 ACTOR rim (Ulysses left edge) | 5 | **16.3** | 63.7 |
| b2-24 PLATE edge (log boundary at his feet) | 9 | 9.2 | 57.4 |
| b2-19 ACTOR rim (giant arm) | 3 | **32.7** | 50.7 |
| b2-19 PLATE edge (rack post) | 3 | 21.4 | 32.1 |
| b3-36 ACTOR rim (Ulysses leg) | 2 | **45.8** | 68.2 |
| b3-36 PLATE edge (plank top / stone bench) | 2 / 2 | 36.8 / 43.4 | 55.1 / 63.9 |
| b5-61 ACTOR rim (ram back) | 2 | **34.5** | 51.2 |
| b5-61 PLATE edge (rock top) | 2 | 15.0 | 21.6 |
| b1-11 ACTOR rim (Ulysses) | 2 | **31.5** | 44.7 |
| b1-11 PLATE edge (hull vs sand) | 2 | 17.2 | 12.5 |

Actor rims run **~1.5–2.3× steeper** than the plate's own edges in the same shot
(avg ratio ≈ 1.8×); in the dim state the plate edge is nearly twice as wide (9 px
vs 5). Where the AI-upscaled zoom plate is itself crisp (b3-36) the rim gap narrows.

The stronger register mismatch is INTERIOR, not just the rim — flat poly facets in
an airbrushed painting:

| settle | actor med\|∇\| / p99 / hard-px% | plate med\|∇\| / p99 / hard-px% |
|---|---|---|
| b2-24 Ulysses | 1.88 / **28.2** / 21.2% | 1.47 / 17.7 / 8.7% |
| b2-19 giant | 0.68 / **21.0** / 5.9% | 0.50 / 9.2 / 1.1% |
| b3-36 Ulysses | 1.43 / **42.6** / 25.8% | 2.81 / 22.2 / 20.9% |
| b3-36 giant | 0.79 / **31.5** / 10.7% | 0.41 / 11.0 / 2.8% |
| b5-61 ram | 0.90 / **45.5** / 14.5% | 0.89 / 21.0 / 10.6% |

Actor p99 gradient (hard facet lines) is **2–3× the plate's** everywhere, on a low
median (flat fills) — a bimodal vector register inside a continuous painterly one.

---

## (d) WHAT SHERLOCK DID THAT WE SKIPPED (living/app/sets/*.js)

There is no "DDIM" anywhere in either app; the rig is DIM_MATRIX (SVG
feColorMatrix, `stage.applyDimMatrix()`) plus painted `*-dim` relight masters.
Inventory:

| device (sherlock) | sherlock shipped | odyssey shipped |
|---|---|---|
| **contact-shadow.png under principals** (street:261, room:248, chase:223; sized to feet, .55–.7) | 3 of 4 sets + asset + CSS | **none of 3 sets; asset absent; CSS rule 68 dangling** |
| **MEASURED DIM_MATRIX relights** — room `[0.448,0.588,0.754]` "measured: blur(room-dim)/blur(room)"; street `[0.725,0.868,0.962]` "shipped relight, measured"; chase `[0.4367,0.5739,0.7414]` "measured relight"; church `[0.435,0.746,1.0]` "Blue MEASURES 1.035… clamped" | 4/4 measured from painted pairs | shore/cave matrices "**AUTHORED, NOT MEASURED**" (shore.js:141, cave.js:243); cave & sea "**never exercised**" — no inset ever dims those states |
| **painted relight masters** (`room-dim.jpg`, `street-dim.jpg`, `chase-dim.jpg`, `church-dim.jpg`) crossfaded under insets | 4/4 lanes | none — shore uses a neutral `#03050a`/`#04060c` **scrim** ("AN HONEST DEVIATION", shore.js:35) |
| **patch dims** — plate-space dim patches over props that overlap actors (`holmes-patch-dim.png`, `chair-dim.png`, room.js:204,303) so occluders dim with the world | yes | none |
| **rim/backlight integration** — `ireneRim` street.js:242-257: her own alpha as a mask over a crimson fill, 3.5% larger about the feet, `blur(1.6px)`, so the silhouette gets a hot edge from the room light behind her; reveal-back screen pane clipped to the measured glass polygon | yes | none — the b3-36 Ulysses stands between reader and a blazing fire with **zero rim light**; only the broad `bloomFire` screen wash (cave.js:616+) passes over actors |
| **emissive discipline** — church.js:429 "gold on a dim plate is a sticker": emissives scale with the dim | yes | partially (emis opacities × `(1−0.55·dim)`) — but dim never rises in cave/sea, so it never acts |
| **state-matched actor light** — sherlock's dim law: "A dimmed painting and an undimmed actor standing in it" is exactly the collage case stage.js:28 warns about | enforced via measured matrix whenever the plate darkens | cave swaps **five painted plate states** (master/dawn/shut/embers/predawn) with **no corresponding actor grade** — the b2-24 +23 L mismatch is this gap verbatim |
| actor group `isolation:isolate` + baseline-y depth sort | yes | yes (kept) — the one integration device fully ported |

---

## VERDICT — which factor dominates

**1. (a) Missing contact shadow / ground occlusion — dominant.** It is the only
defect present in 100% of the nine settles, it is binary (0 shipped vs sherlock's
book-wide blob), and the control case proves it: in b3-36 Ulysses the temperature
and luminance match the plate to within measurement noise (dL −0.3, dW −4.2) and
the figure STILL reads pasted — feet on bare paint, no AO, while every painted prop
around him has its ground line shaded. Unshadowed feet (and the hovering giant) are
the single loudest paste tell.

**2. (b) Temperature/exposure delta — dominant in the cave, the marquee set.**
Median dW ≈ −27 for the firelit settles (giant −27, rams −37, blue crew −27) and
the mismatch inverts in dark states (+23 L). It is baked into the navy-studio cuts
and never corrected at runtime because the one grading rig that exists
(DIM_MATRIX) is authored-not-measured and never exercised. Magnitude-wise this is
the biggest number in the audit, but it is state-dependent (two settles measure
near-zero), so it ranks under the universal shadow gap.

**3. (c) Edge/texture register — constant background hum.** Rims ~1.8× steeper
than plate edges, interior hard-line density 2–3× the plate's. Real, measurable,
and never compensated (no rim treatment, no 1–2 px softening), but at reading
scale it is the tell you notice AFTER the feet and the temperature have already
said "sticker".

Sherlock's answer to all three was cheap and shipped: a soft blob under the feet,
a measured relight so the actor takes the plate's light, and one alpha-masked rim
when the light demanded it. The odyssey ported the rig (isolation, dim plumbing,
even the `.shadow` CSS) and shipped none of the three devices that used it.
