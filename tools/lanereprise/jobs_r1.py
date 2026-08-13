#!/usr/bin/env python3
"""jobs_r1.py -- emit the REPRISE ACTORS round-1 job file for tools/laneassets/gen.py.

Round 1 asks for four figures and two photograph edits, two candidates each,
because a lane that generates one of anything has no pick.

THE LAW THIS FILE IMPLEMENTS
  CONTENT-full.md 7.2 GAP #8  -- actor Holmes, street cut + church/witness cut
  CONTENT-full.md 7.2 GAP #10 -- inset `plate-irene`, a portrait of her ALONE,
                                 edited from the SAME object as `both-photo`
  canon (sources/pg1661_2026-08-04.txt)
    l.539-541  the groom  : "a drunken-looking groom, ill-kempt and
                             side-whiskered, with an inflamed face and
                             disreputable clothes"
    l.562      "in the character of a groom out of work"
    l.652-653  "I lounged up the side aisle like any other idler"
    l.764-767  the priest : "an amiable and simple-minded Nonconformist
                             clergyman. His broad black hat, his baggy trousers,
                             his white tie, his sympathetic smile, and general
                             look of peering and benevolent curiosity"

WHY TWO DISGUISES AND NOT A "STREET COAT". CONTENT-full.md 6.3 lists the two
missing Holmes cuts as "street coat" and "witness". Canon is more specific and
the lane brief asks for the disguises the beats demand: Holmes is in the GROOM
for the whole told story (beats III-IV -- he is the shabby fare at l.641 and the
witness at l.663) and in the CLERGYMAN for the whole Serpentine Avenue scene
(beats II, V, VI -- he changes at l.763 and is carried into the house in it at
l.866). Two disguises cover four beats; a plain street coat covers none of them
and is the one costume the chapter never puts him in.
"""
import json
import os
import sys

STYLE = (
    'STYLE LAW, copy panels C and D exactly: flat-shaded chunky LOW-POLY faceted '
    'painting - large clean flat triangular facets, matte paint, NO outlines, NO '
    'texture noise, NO photographic detail, NO cel-shade rim, NO gloss, NO '
    'engraved hatching. Facet size and edge quality identical to the standing '
    'figure in panel D. A faceted Victorian figure with a SINGLE accent colour. '
    'Camera: a slightly ELEVATED three-quarter view looking gently DOWN at him, '
    'the same angle the diorama in panel C is seen from.')

BG = (
    'BACKGROUND: completely flat solid MAGENTA (#FF00FF), one uniform colour from '
    'edge to edge. No gradient, no vignette, no floor, no ground plane, no cast '
    'shadow, no props, no text, no border. Leave clear empty margin above the head '
    'and below the feet - the figure must not touch the image border.')

HEAD = (
    'This is a four-panel REFERENCE SHEET, not a picture to edit. Read the panels, '
    'then OUTPUT ONE SINGLE NEW IMAGE, tall portrait format, containing ONLY the '
    'one character described below, isolated on a plain flat background. Do NOT '
    'output this sheet, its panels, its captions, its dioramas, or any other person.\n\n')

FACE = (
    'WHO HE REALLY IS - panel B is the identity lock and it governs the face '
    'absolutely: a tall, very lean, GAUNT man; a long hawk-like aquiline nose; a '
    'sharp prominent chin; heavy dark brows over deep-set eyes; dark hair swept '
    'straight back off a high forehead. He is the same man as panel B and must be '
    'recognisable as him.')

CLERGY_LIGHT = (
    'LIGHT, copy panel C exactly: a Victorian street at night. ONE warm amber '
    'gas-lamp key from the VIEWER\'S LEFT, catching the left brim of the hat, the '
    'left cheek, the left shoulder and the left edge of the coat. Everything else '
    'falls away into deep, cool, PRUSSIAN-BLUE night shadow. He is dark and moody '
    '- a man standing in an unlit street, not a figure in a studio.')

CHURCH_LIGHT = (
    'LIGHT, copy panel C exactly: the inside of a small church at night lit by '
    'altar candles. A warm amber candle key from the VIEWER\'S RIGHT, catching the '
    'right cheek, the right shoulder, the right sleeve and the right edge of the '
    'jacket; a weak cool blue window fill on the far left edge of the figure; the '
    'rest of him in deep warm-brown shadow. He is dim and unremarkable - a man '
    'loitering at the back of a church, not a figure in a studio.')

CLERGY_WHO = (
    'THE DISGUISE HE IS WEARING - an amiable and simple-minded NONCONFORMIST '
    'CLERGYMAN (canon: "his broad black hat, his baggy trousers, his white tie, his '
    'sympathetic smile, and general look of peering and benevolent curiosity"). A '
    'BROAD-BRIMMED FLAT BLACK SHOVEL HAT on his head; a plain long black clerical '
    'frock coat buttoned high; a WHITE CLERICAL TIE and white bands at the throat, '
    'which are his ONE bright accent; loose BAGGY black trousers; plain black '
    'shoes. He carries himself soft, stooping and harmless: shoulders rounded, head '
    'tilted a little forward, a mild sympathetic half-smile, an expression of '
    'peering benevolent curiosity. Nothing sharp and nothing predatory - the whole '
    'point of the disguise is that he does NOT look like a detective.')

GROOM_WHO = (
    'THE DISGUISE HE IS WEARING - a DRUNKEN-LOOKING GROOM OUT OF WORK (canon: '
    '"a drunken-looking groom, ill-kempt and side-whiskered, with an inflamed face '
    'and disreputable clothes"). Bushy sandy SIDE-WHISKERS down both cheeks with '
    'the chin and upper lip bare; a shabby battered soft cloth cap pulled down; a '
    'worn brown corduroy stable jacket, frayed at the cuffs and too big in the '
    'shoulders; a RUST-RED neckerchief knotted at his throat, which is his ONE '
    'accent colour; baggy stained breeches; scuffed heavy boots. His face is '
    'flushed and inflamed and slack. He is ill-kempt, idle and harmless - a horsey '
    'man who has drifted in off the street.')

JOBS = [
    # ---------------------------------------------------------------- clergyman
    ('holmes-clergyman-a', 'refsheet-street.png', HEAD + FACE + '\n\n' + CLERGY_WHO + '\n\n' +
     'POSE: standing at full height on both feet, FULL BODY from the crown of the '
     'hat down to the soles of both shoes. Body turned three-quarters toward the '
     'VIEWER\'S LEFT, head the same way, as though speaking quietly to a companion '
     'standing beside him in the street. Hands lightly clasped in front of him, '
     'arms down and relaxed. Still, mild, unremarkable.\n\n' + CLERGY_LIGHT + '\n\n' + STYLE +
     '\n\n' + BG),
    ('holmes-clergyman-b', 'refsheet-street.png', HEAD + FACE + '\n\n' + CLERGY_WHO + '\n\n' +
     'POSE: he stands upright and quite still on both feet, seen FULL LENGTH from '
     'the top of the black hat to the soles of both shoes with clear empty space '
     'above and below. Three-quarter turn to the VIEWER\'S LEFT. One hand rests on '
     'the lapel of the coat, the other hangs at his side. The stoop is in the neck '
     'and shoulders, not the spine. Read: a harmless country parson waiting on a '
     'pavement.\n\n' + CLERGY_LIGHT + '\n\n' + STYLE + '\n\n' + BG),
    # -------------------------------------------------------------------- groom
    ('holmes-groom-a', 'refsheet-church.png', HEAD + FACE + '\n\n' + GROOM_WHO + '\n\n' +
     'POSE: LOUNGING - canon, "I lounged up the side aisle like any other idler who '
     'has dropped into a church". He stands slack with his weight thrown on one '
     'hip, both hands pushed into his jacket pockets, shoulders loose, chin down, '
     'looking idly off to the VIEWER\'S RIGHT. FULL BODY from the top of the cap to '
     'the soles of both boots, clear empty space above and below. Body turned '
     'three-quarters toward the VIEWER\'S RIGHT.\n\n' + CHURCH_LIGHT + '\n\n' + STYLE +
     '\n\n' + BG),
    ('holmes-groom-b', 'refsheet-church.png', HEAD + FACE + '\n\n' + GROOM_WHO + '\n\n' +
     'POSE: standing at full height, weight settled on both feet, FULL BODY from '
     'the top of the cloth cap to the soles of both boots with clear empty space '
     'above the cap and below the boots. Body and head turned three-quarters toward '
     'the VIEWER\'S RIGHT. Arms hanging down and slightly away from the body, hands '
     'open and empty. Slack, shabby, unhurried.\n\n' + CHURCH_LIGHT + '\n\n' + STYLE +
     '\n\n' + BG),
]

# ------------------------------------------------------------ the fee, IV.3
PHOTO_LOCK = (
    'EVERYTHING ELSE IS ABSOLUTELY LOCKED - it is the SAME photograph of the SAME '
    'woman: the same ornate cream corner-bracket frame on all four corners, the '
    'same border, the same warm sepia tone, the same aged photographic paper, the '
    'same flat low-poly faceted painting, the same lighting, the same image shape '
    'and size. No text, no letters, no writing, no signature, no date, no studio '
    'mark, no caption.')

PHOTO_A = (
    'EDIT THIS IMAGE. It is a Victorian sepia cabinet photograph of TWO people '
    'standing full length inside an ornate cream corner-bracket frame.\n\n'
    'THE ONE CHANGE: REMOVE THE MAN COMPLETELY. The tall bearded man in the dark '
    'suit on the left is gone - and so is his cast shadow on the floor - as though '
    'he had never been photographed. This becomes a cabinet photograph of the '
    'WOMAN ALONE.\n\n'
    'She is now the single subject, so move her to the CENTRE of the card, and keep '
    'her EXACTLY as she is in every other way: the same face, the same dark upswept '
    'hair and headdress, the same level expression, the same full-length standing '
    'pose, the same hands, the same pale Victorian gown with its dark sash and '
    'pointed bodice, the same height in the frame, the same faceted low-poly paint, '
    'the same edges. Do not redraw her, do not restyle her, do not change her gown, '
    'do not change her age.\n\n'
    'The space the man occupied becomes more of the SAME dark studio backdrop and '
    'the SAME dark studio floor, in the same sepia, with the same soft faceted '
    'mottling. Add NOTHING: no chair, no column, no drape, no plinth, no table, no '
    'second figure, no props.\n\n' + PHOTO_LOCK)

PHOTO_B = (
    'EDIT THIS IMAGE. It is a Victorian sepia cabinet photograph of a man and a '
    'woman standing full length inside an ornate cream corner-bracket frame.\n\n'
    'THE ONE CHANGE: this must become a portrait of the WOMAN ALONE. Delete the '
    'bearded man on the left entirely, together with the shadow he casts, and paint '
    'the empty dark studio backdrop and studio floor back in behind where he stood, '
    'in the same sepia and the same faceted paint. Then place HER in the middle of '
    'the card, standing full length, facing the camera in the same stiff formal '
    'studio pose she already holds.\n\n'
    'SHE MUST BE THE SAME WOMAN, unchanged: same face, same brows, same eyes, same '
    'mouth, same dark hair swept up with the same headdress, same shoulders, same '
    'arms, same hands at her sides, same pale gown with the dark sash and pointed '
    'bodice and the long full skirt, same shoes hidden by the hem, same proportions, '
    'same height in the frame. Do not re-pose her, do not turn her, do not redraw '
    'her face.\n\n'
    'Add NOTHING to the empty half of the picture - no furniture, no drape, no '
    'pillar, no plant, no lettering.\n\n' + PHOTO_LOCK)


def main():
    raw = sys.argv[1].rstrip('/')
    jobs = []
    for jid, sheet, prompt in JOBS:
        jobs.append({'id': jid, 'image': os.path.join(raw, sheet),
                     'out': os.path.join(raw, jid + '.png'),
                     'prompt': prompt,
                     'manifest': os.path.join(raw, 'manifest.json')})
    src = '/Users/samz/Documents/gaslight-remake/assets/plates/both-photo.png'
    for jid, prompt in (('photo-irene-a', PHOTO_A), ('photo-irene-b', PHOTO_B)):
        jobs.append({'id': jid, 'image': src,
                     'out': os.path.join(raw, jid + '.png'),
                     'prompt': prompt,
                     'manifest': os.path.join(raw, 'manifest.json')})
    out = os.path.join(raw, 'jobs-r1.json')
    with open(out, 'w') as f:
        json.dump(jobs, f, indent=1)
    print(out)


if __name__ == '__main__':
    main()
