#!/usr/bin/env python3
"""jobs_r2.py -- REPRISE ACTORS round 2: the derived states.

Round 1 picked one idle per disguise and one photograph. Round 2 derives every
other state FROM THE PICK by i2i, never from the sheet again -- the beat-I
king-unmask precedent (jobs-b3 `king-unmasked-a` edits `king-masked-c`): a
derived state that shares its input pixel-for-pixel is a straight swap or a
crossfade on the plate, and the figure cannot drift between the two.

  holmes-clergyman-hand  <- holmes-clergyman-b   V.3 "when I raise my hand-so"
  holmes-groom-altar     <- holmes-groom-b       IV.9-13, at the altar
  holmes-groom-walk      <- walk-canvas-groom    IV.3 the lounge, IV.8 the drag
  photo-irene-c / -d     <- photo-irene-b        VII.6 the fee (shadow / centre)
"""
import json
import os
import sys

LOCK_TAIL = (
    'same flat low-poly faceted paint - large flat matte facets, no outlines, no '
    'gloss, no texture noise - and the same flat solid MAGENTA (#FF00FF) '
    'background, edge to edge, with the same clear empty margin above his head '
    'and below his feet. No gradient, no vignette, no floor, no ground plane, no '
    'cast shadow, no props, no text.')

CLERGY_HAND = (
    'EDIT THIS IMAGE. Make EXACTLY ONE change: RAISE HIS NEAR HAND INTO A SIGNAL.\n\n'
    'The hand that is at present holding the lapel of his coat comes up and out to '
    'the side of his head: the arm bends at the elbow, the upper arm lifts away '
    'from the body, the open palm faces forward at about the height of the hat '
    'brim, fingers together and straight. The black coat sleeve follows the arm. '
    'It reads as a deliberate, unmistakable RAISED-HAND SIGNAL held still - not a '
    'wave, not a blessing, not a greeting.\n\n'
    'EVERYTHING ELSE IS ABSOLUTELY LOCKED. It is the SAME man in the SAME picture: '
    'same gaunt hawk-nosed face, same mild expression, same broad-brimmed flat '
    'black hat at the same angle, same white clerical bands at the throat, same '
    'long black clerical coat, same baggy black trousers, same black shoes, same '
    'stance with BOTH FEET IN EXACTLY THE SAME PLACE, same other arm hanging at '
    'his side, same proportions, same silhouette from the shoulders down, same '
    'height and size and position in the frame, same warm amber key from the '
    'VIEWER\'S LEFT, same deep navy night shadow, ' + LOCK_TAIL + ' Change nothing '
    'but that one arm.')

GROOM_ALTAR = (
    'EDIT THIS IMAGE. Make EXACTLY ONE change: HE HAS TAKEN HIS CAP OFF.\n\n'
    'The soft cloth cap is no longer on his head - he holds it in BOTH HANDS in '
    'front of his chest, gripped and worried at the brim, elbows in at his sides. '
    'His bare head is now visible: thin, untidy, ill-kempt hair, flattened where '
    'the cap sat. His head is bowed slightly forward and down. He reads as a '
    'shabby stranger standing somewhere he does not belong, mumbling words he does '
    'not know.\n\n'
    'EVERYTHING ELSE IS ABSOLUTELY LOCKED. It is the SAME man in the SAME picture: '
    'same gaunt hawk-nosed face, same bushy sandy side-whiskers, same flushed '
    'inflamed complexion, same worn brown corduroy stable jacket with the frayed '
    'cuffs, same RUST-RED neckerchief, same baggy stained breeches, same scuffed '
    'heavy boots, same stance with BOTH FEET IN EXACTLY THE SAME PLACE, same '
    'height and size and position in the frame, same three-quarter turn toward the '
    'VIEWER\'S RIGHT, same warm candle key from the VIEWER\'S RIGHT and cool blue '
    'fill on the left, ' + LOCK_TAIL + ' Change nothing but the cap, the hands and '
    'the tilt of the head.')

GROOM_WALK = (
    'EDIT THIS IMAGE. It is one wide strip holding FOUR identical copies of the '
    'same shabby man, evenly spaced left to right. KEEP the wide strip, KEEP the '
    'four evenly spaced positions, KEEP every figure at the SAME HEIGHT standing '
    'on the SAME ground line, KEEP the flat solid MAGENTA (#FF00FF) background '
    'edge to edge, KEEP the clear empty margin above every head and below every '
    'boot.\n\n'
    'THE ONE CHANGE: turn the four standing figures into THE FOUR FRAMES OF ONE '
    'WALK CYCLE, every figure turned to a STRICT SIDE PROFILE facing the VIEWER\'S '
    'RIGHT - we see his right side, his nose and his side-whiskers point right, he '
    'is walking rightwards across the strip at an idle, slouching, unhurried pace.\n\n'
    'Frame 1 (leftmost): CONTACT. Legs scissored apart, his FAR leg reaching '
    'forward with the heel down, his NEAR leg extended back with the toe down.\n'
    'Frame 2: PASSING. Legs together and overlapping, the back leg lifted and '
    'swinging under the body with the knee bent, the body at its highest.\n'
    'Frame 3: CONTACT, OPPOSITE LEGS. Scissored apart the OTHER WAY - the NEAR leg '
    'now reaching forward heel down, the FAR leg extended back toe down. This frame '
    'must clearly use the opposite leg to frame 1, or the walk will limp.\n'
    'Frame 4: PASSING, OPPOSITE. Legs together again, the other leg lifted and '
    'swinging under the body.\n'
    'The arms swing loosely opposite the legs, hands empty. The head stays level '
    'and steady at the SAME height in all four frames - it must not bob out of '
    'line.\n\n'
    'HE IS THE SAME MAN IN ALL FOUR, unchanged from the input: same lean build, '
    'same soft cloth cap, same bushy sandy side-whiskers, same flushed face, same '
    'worn brown corduroy stable jacket, same RUST-RED neckerchief, same baggy '
    'breeches, same scuffed boots, same size.\n\n'
    'STYLE AND LIGHT ARE LOCKED to the input figures: flat low-poly faceted paint, '
    'large flat matte facets, no outlines, no texture noise; a warm amber candle '
    'key from the VIEWER\'S RIGHT and a cool blue fill on the left; a dim church '
    'interior at night, not a bright studio.\n\n'
    'No panel borders, no frames, no dividing lines, no numbers, no text, no ground '
    'shadow, no floor, no props. Four figures on flat solid magenta, nothing else.')

PHOTO_LOCK = (
    'EVERYTHING ELSE IS ABSOLUTELY LOCKED - it is the SAME photograph of the SAME '
    'woman: the same face, the same dark upswept hair and headdress, the same '
    'expression, the same full-length standing pose, the same hands, the same pale '
    'gown with its dark sash and pointed bodice, the same size in the frame, the '
    'same ornate cream corner-bracket frame on all four corners, the same border, '
    'the same warm sepia tone, the same aged photographic paper, the same flat '
    'low-poly faceted painting, the same lighting, the same image shape. Do not '
    'redraw her, do not resize her, do not re-pose her, do not turn her. No text, '
    'no letters, no writing, no signature, no date, no studio mark, no caption.')

SHADOW = (
    'DELETE THE ORPHAN SHADOW. A large dark shadow lies across the studio floor to '
    'the LEFT of the woman, cast by a man who is no longer in the picture. Nothing '
    'stands there, so nothing can cast it. Remove it completely and paint that part '
    'of the floor as plain, even, empty dark studio floor in exactly the same '
    'sepia, the same faceted paint and the same soft gradient as the floor at the '
    'far left of the card. She keeps her OWN small shadow at her hem.')

PHOTO_C = ('EDIT THIS IMAGE. It is a Victorian sepia cabinet photograph of ONE woman '
           'standing full length inside an ornate cream corner-bracket frame.\n\n'
           'THE ONE CHANGE: ' + SHADOW + '\n\n' + PHOTO_LOCK)

PHOTO_D = ('EDIT THIS IMAGE. It is a Victorian sepia cabinet photograph of ONE woman '
           'standing full length inside an ornate cream corner-bracket frame. She is '
           'off to the right of the card because a second figure has been taken out '
           'of it.\n\nTWO CHANGES AND NOTHING ELSE:\n\n'
           '1) ' + SHADOW + '\n\n'
           '2) CENTRE HER. Slide the woman sideways to the exact horizontal middle '
           'of the card, so that she stands dead centre as the single subject of a '
           'formal cabinet portrait. Move her SIDEWAYS ONLY - do not raise her, do '
           'not lower her, do not resize her, do not turn her, do not re-pose her, '
           'do not redraw her face. Her feet stay on the same floor line and her own '
           'small hem shadow travels with her. The floor and backdrop she leaves '
           'behind on the right become the same plain dark studio backdrop and floor '
           'as the rest of the card, with nothing standing in them.\n\n' + PHOTO_LOCK)


def main():
    raw = sys.argv[1].rstrip('/')
    j = lambda i, src, p: {'id': i, 'image': os.path.join(raw, src),
                           'out': os.path.join(raw, i + '.png'), 'prompt': p,
                           'manifest': os.path.join(raw, 'manifest.json')}
    jobs = [
        j('holmes-clergyman-hand', 'holmes-clergyman-b.png', CLERGY_HAND),
        j('holmes-groom-altar', 'holmes-groom-b.png', GROOM_ALTAR),
        j('holmes-groom-walk', 'walk-canvas-groom.png', GROOM_WALK),
        j('photo-irene-c', 'photo-irene-b.png', PHOTO_C),
        j('photo-irene-d', 'photo-irene-b.png', PHOTO_D),
    ]
    out = os.path.join(raw, 'jobs-r2.json')
    with open(out, 'w') as f:
        json.dump(jobs, f, indent=1)
    print(out)


if __name__ == '__main__':
    main()
