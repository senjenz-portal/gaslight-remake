# EXPLORER B — deterministic relight/grade (regrade.py)

Hypothesis under test: most of "pasted" is color — a deterministic grade of
the actor cut toward the plate's local palette should close most of the gap,
no models, no RNG.

Tool: `tools/ody/seamless/regrade.py` — sample the plate in an annulus at the
ledger mark (5–95% luminance-trimmed mean/std in Reinhard lαβ), Reinhard
transfer onto the cut with a vertical ramp (100% at the feet → 60% at the
head), accent-hue chroma preserved (dominant saturated hue keeps 85% of its
chroma, takes luminance in full), warm rim on the light-facing silhouette
edge using the ledger/layer light anchors with rim color sampled off the
plate at the anchor. Everything measured, nothing sampled from noise —
two runs produce byte-identical numbers.

Sheet: `tools/ody/seamless/explore-regrade-sheet.jpg` — 4 settles,
before | after at true plate scale.

## Settles tested

| settle | plate | cut | mark | hPx | light anchor |
|---|---|---|---|---|---|
| cave bowl-offer (iii-08) | cave-shut.jpg | ulysses-offer | 700,468 | 75 | fire 638,427 r238 |
| cave meal (ii-05) | cave-shut.jpg | polyphemus-seated | 760,452 | 165 | fire 638,427 r238 |
| shore council (i-06) | shore.jpg | ulysses-stand (flip) | 510,492 | 20 | fire 438,466 r160 |
| sea stern (vi-02) | sea.jpg | ulysses-taunt (flip) | 518,426 | 22 | cave glow 818,457 r60 |

## Numbers

CCT = correlated color temperature (McCamy) of the alpha-weighted mean color.
dCCT = |cut CCT − ring CCT|. dE = CIE Lab distance of the mean colors
(cut vs ring) — the better "pasted" thermometer, since CCT of a mean color
is blind to luminance and saturation offsets.

| settle | ring CCT | cut CCT before → after | dCCT before → after | dE before → after |
|---|---|---|---|---|
| cave bowl-offer | 3328 K | 3389 → 3465 K | 61 → 137 K | 23.3 → **5.9** |
| cave meal | 3018 K | 4209 → 3765 K | 1192 → **748 K** | 14.7 → **6.7** |
| shore council | 3624 K | 2574 → 3644 K | 1050 → **20 K** | 20.6 → **4.9** |
| sea stern | 5264 K | 2631 → 3444 K | 2633 → **1820 K** | 22.6 → **9.1** |

Means: dCCT 1234 → 681 K (−45%); dE 20.3 → 6.7 (−67%).

## Reading the numbers

- **Temperature alone was never the whole story.** Cave bowl-offer starts at
  dCCT 61 K — the cut's crimson cloak makes its *mean* read warm already —
  yet it is the most obviously pasted pair on the sheet (dE 23.3): the cut is
  ~45 luminance points too dark for a firelit apron. The grade closes that to
  dE 5.9 and the figure sits in the blaze. So "pasted" is color, but it is
  **palette + luminance**, not temperature by itself; dE is the honest metric.
- **Shore council is the clean win**: dCCT 1050 → 20 K, dE 20.6 → 4.9. The
  cool-magenta cut lands on the firelit sand.
- **Sea stern keeps a residual** (dCCT 1820 K, dE 9.1) that is mostly the
  *protected accent* — the crimson cloak (hue 345°, 52k px) deliberately
  keeps its chroma while the night ring at the stern is near-grey. The figure
  reads dimmed-to-night but still reads as Ulysses; pushing further would
  eat the accent.
- **Accent preservation held everywhere** — cloak/tunic hue survives in all
  four afters (visible on the sheet), which is the difference between
  "relit" and "repainted". On the giant the accent net is wide (hue 55°,
  237k px ≈ skin+tunic), so he takes mostly a luminance match — which is
  what the meal settle needed (he was 1192 K too cool/green for the blaze).
- **The warm rim fired on all four** (falloff by anchor distance vs measured
  reach: full on both cave settles and shore, ~10% at the sea stern 301 px
  from the cave glow). It is subtle at these actor sizes; it helps the two
  cave settles most, where the fire is inside the ring.

## Verdict

**Hypothesis largely confirmed.** A deterministic ring-sample + ramped
Reinhard transfer removes roughly two-thirds of the measured mismatch
(mean dE 20.3 → 6.7) and visually converts "sticker" into "stands there"
on all four settles at true scale, with zero model cost, zero nondeterminism,
and the accent identity intact. Residuals (sea stern dE 9.1) are the
*protected* accent plus true relighting effects a color transfer cannot
synthesize (cast shadow on the deck, occlusion of the rail) — that is the
part of "pasted" that is not color. Recommend: adopt the regrade as a cheap
always-on pass (it is per-cut-per-mark, cacheable at mount time), and let a
separate shadow/contact pass carry the rest.
