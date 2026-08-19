# Image analysis — the KING (king2-look.png full body, king2-unmasked.png bust)
Protocol: grimoire/intake/image_analysis.md layers 1-8. Observation vs inference marked.

## L1 Identification
Adult male human, full body, stylized LOW-POLY PAINTERLY render (faceted flat-shaded planes).
Regency/victorian nobleman ("the King"). primaryDomain: character. Confidence 0.95.
Style axis: stylized, NOT maximum-likeness photo.

## L2 Form & silhouette
Upright standing, symmetric weight, arms at sides, head turned slightly to his right
(three-quarter front camera). Greatcoat worn cape-style flares shoulders→ankles: triangular
lower silhouette behind the legs. Bilateral near-symmetry. Geometric facets over organic volumes.

## L3 Macro→meso→micro
macro: head (face/hair/ears/neck), torso (waistcoat over shirt + cravat), greatcoat
(over shoulders, arms NOT in sleeves — cream shirt-sleeve arms emerge under coat front edges),
armL/armR (sleeve, cuff, hand), pelvis+legs (trousers), boots (knee shaft + foot).
meso: standing collar (orange inner face), orange piping along both coat front edges,
double-breasted rows (2 cols x 3 visible gold button pairs), cravat knot, shirt cuffs, boot top edge.
micro: brow/eye/nose/mouth facets, hair fringe facets + side part, button discs.

## L4 Spatial relationships
<coat, attached-to, shoulders (overlap)>; <collar, surrounds, neck (socket)>;
<cravat, inside, vest neckline (embed)>; <vest, overlaps, trouser waist>;
<trousers, embedded-in, boot shafts>; <arms, attached-to, torso at shoulders under coat>;
<hands, emerge-from, coat front opening>. No mid-air parts.

## L5 Materials (PBR)
All matte painterly flat facets (observation). metalness 0 everywhere except buttons
(inference: brass, metalness ~0.8, roughness ~0.4). skin rough ~0.75; hair ~0.85;
coat outer ~0.9; lining ~0.85; vest ~0.8; trousers ~0.9; boots ~0.6 (slight sheen facets).

## L6 Color (sampled)
coat outer desat navy base ~#3d4a6b (facets #2c3552..#55618a); lining orange gradient
#f08033→#c8511f; vest ivory ~#e9dcc0 (shadow #c9b896); cravat ~#2a3453; sleeve/cuff ~#f0e6cf;
skin ~#efc49b (shadow #c99b72); hair ~#20202a; trousers ~#252c45; boots ~#181a22; buttons ~#c9a24b.
Finish matte throughout; buttons satin. Background #151621 (not part of model).

## L7 Identity-defining features
1 high standing collar w/ orange inner face; 2 orange piping both coat front edges crown→hem;
3 ivory double-breasted waistcoat, two gold button columns; 4 navy cravat filling neckline;
5 cape-style full-length coat, arms outside sleeves; 6 East-Asian male face, short black
side-swept hair, strong straight brows; 7 knee-high black boots + slim dark trousers;
8 low-poly faceting as the register itself.

## L8 Uncertainty
occluded: coat back panel (inferred simple drape), left arm partly behind coat.
hidden: boot soles, hair crown/back. uncertain: trouser/vest boundary behind coat front.
Bust view confirms face landmarks + collar/lining/cravat/vest. No profile view: head depth
INFERRED from canon (~0.9 of head height).

## Suitability verdict (validation_rubric routing)
PASS — clean background, full-body + bust views, subject fully visible, stylized-low-poly
route (stylized character track, not face-copy). Register: single accent colours per part.
