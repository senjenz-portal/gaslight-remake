#!/usr/bin/env python3
"""Emit the COMPLETE units.js for living-odyssey (Book IX, "The Cyclops").

COPY of tools/living/emit_units.py with WIRING.md's seven odyssey fixes:
  1. MD -> CONTENT-odyssey.md
  2. beat headers are level-2, mixed case:  ^## Beat ([IVX]+)\\b
  3. ORDER gains 'I': 1 and the emit loop runs beats 1..6 (odyssey's Beat I
     IS in the tables; sherlock's was hand-authored)
  4. columns are | # | id | prefix | text | verb | staging | -> text is c[4]
     (the table's verb column c[5] only SEEDS the authored S; S is law)
  5. 4-segment ids: key = uid.split('-', 3)[3]  ('bard', not '01-bard');
     the two short-name collisions the contract carries (dawn, return) are
     beat-suffixed (dawn1/dawn5, return2/return3) so keys stay unique
  6. a NEW authored S + BEAT_META: pages 1-5, sets shore/cave/cave/cave/sea;
     Beats III+IV SHARE leaf 3; cave state changes are ACTS (master names),
     not extra sets; leaf 6 is the closing card
  7. Beat VI has NO row-0 head unit (its heading rides ody-vi-01-jeer) --
     head emission keys off S, never the row number; ids arrive both
     backticked and bare, strip('`') handles both

The TEXT and the PREFIX are lifted out of CONTENT-odyssey.md's own tables,
never retyped -- Butler is verbatim (VERBATIM AUDIT: 76/76). Unlike the
sherlock original this emits the WHOLE units.js (prologue + UNITS + exports)
to stdout: odyssey has no hand-written Beat I to paste after.

    python3 tools/ody/emit_units_ody.py > site-deploy/living-odyssey/app/units.js
"""
import re

MD = '/Users/samz/Documents/gaslight-remake/CONTENT-odyssey.md'

ORDER = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6}


def rows():
    out = {}
    cur = None
    for line in open(MD):
        m = re.match(r'^## Beat ([IVX]+)\b', line)
        if m:
            cur = ORDER[m.group(1)]
            out[cur] = []
            continue
        if line.startswith('## '):
            cur = None
            continue
        if cur is None:
            continue
        if not line.startswith('|'):
            continue
        c = [s.strip() for s in line.split('|')]
        if len(c) < 7 or not re.match(r'^\d+$', c[1]):
            continue
        uid = c[2].strip('`')
        prefix = c[3].replace('**', '').strip()
        prefix = re.sub(r'\*\(.*?\)\*', '', prefix).strip()
        if prefix == '—':
            prefix = ''
        out[cur].append({'n': int(c[1]), 'id': uid, 'speaker': prefix,
                         'text': c[4].strip()})
    return out


# --------------------------------------------------------- authored staging
# key -> the fields that are NOT text/speaker. Comments are emitted with them.
# LAW: focus names are ledger LENS names VERBATIM (tools/ody/ledger.json);
# targets are ledger gate targets VERBATIM; acts are ledger mark / master /
# object names wherever a staged thing exists in the ledger.
#
# AMENDMENTS (Butler is verbatim and untouchable; verbs/cues/END_CARD are OUR
# authoring — every authored change is recorded here AND in
# CONTENT-odyssey.md §AMENDMENTS, then units.js re-emitted and the text
# byte-equality re-verified):
#   A1 (2026-08-16) THE SEEDED DEDICATION — two authored strings on END_CARD
#      (emitted in EPILOGUE below): ask='Who read this?' and
#      belonged='This reading belonged to'. No unit row touched; no Butler
#      text changed (76/76 verbatim unaffected).
#   A2 (2026-08-16) HESITATION MEMORY — two authored strings on END_CARD
#      (emitted in EPILOGUE below): subEager/subHeld, the one clause the
#      closing card's sub gains by main.js's 4 s defy-hesitation threshold.
#      No unit row touched; no Butler text changed (76/76 verbatim
#      unaffected).
#   A3 (2026-08-16) RELEASE-AS-VERB — ody-vi-07-myname: verb auto/dwell 6.0 ->
#      release/hold 0.6 + gateAct 'shout' + gateSfx 'shout' + authored cue.
#      The story advances on the reader's own let-go (see the note at the key).
#   A4 (2026-08-16) REST IS ALLOWED — ody-iii-08-lookhere and ody-iv-01-embers
#      gain rest=True (a released hold keeps its progress) and their cues
#      append ' — rest is allowed'. Butler untouched in both.
#   A6 (2026-08-17) FIRST CONTACT IS THE READER'S — ody-i-00-head: verb
#      auto/dwell 3.4 -> click. The opening heading waits for the click its
#      own hint asks for; the 30 s soft-fail (extended to head units in
#      main.js) carries a reader who never clicks. Heads are ours.
#   A7 (2026-08-17) THE POUR IS THE RELEASE — ody-iii-08-lookhere: verb
#      hold -> release + gateAct 'bowl-pour' + amended cue. The fill banks
#      on the hold (rest kept), the pour fires on the pointerup — the
#      contract's "each release drained" made mechanical. Butler untouched.
#   A8 (2026-08-18) THE LOTS ARE THE READER'S — ody-iii-05-lots: verb
#      click -> pick (picks=4, pickOf='lots', gateAct 'lots-draw') + authored
#      cue. The reader clicks four of the eight men in the circle; THE CHOSEN
#      FOUR ARE THE STAKE BEARERS THEREAFTER (cave.js bearers — the drive
#      tableau seats them at the stake-five marks in pick order, and the
#      third meal takes the two highest-numbered men the lot did NOT
#      protect). Auto-draw at the 30 s soft-fail (the four lowest alive —
#      "the very four whom I should have chosen"). Butler untouched.
#   A9 (2026-08-18) THE SWEEP AND THE GAP — ody-v-04-greatram: the G5 click
#      only lands IN THE GAP of the blinded giant's telegraphed hand-sweep
#      (cave.js sweep clock, period 3.2 s, gap from phase 0.55). A hit under
#      the crossing hand is a MISS: the sweep PAUSES a beat (0.9 s), a bleat
#      rings, the reader retries; after 3 misses the gap stands open (soft
#      pass) and the 30 s soft-fail law is unchanged. Amended cue. Butler
#      untouched — the verb/target/gateAct rows did not move.
#   A10 (2026-08-18) TAUNT DIAL — ody-vi-07-myname gains dial='jeer': a
#      press let go UNDER the 0.6 s threshold (the stray click) is now an
#      EXTRA JEER, max 3 — each one swells the taunt and brings ROCK 2 in
#      NEARER (sea.js: splash point toward the hull, bigger rock, deeper
#      hull pitch, taller plume — all scaled by jeers/3). The closing card's
#      sub gains ONE clause by a 3-TIER threshold (0 / 1-2 / 3 jeers):
#      END_CARD.taunt0/taunt1/taunt3 (emitted in EPILOGUE below). Butler
#      untouched.
#
# THE CLOSE-UP LAW (staging, 2026-08-17 — owner: "scene large, character
# small = worse, hard to see"): every unit whose CONTRACT staging subject is
# a character's act or speech now carries a lens that draws its principal
# >= 30% of panel height (two-shots >= 22%); only headings/arrivals/
# establishing go wide, max 2 wide per beat after its heading. 12 focus
# fields changed below (i-02/06/07, iii-13, iv-08, v-01/02/03, vi-05/06/07/
# 10); the new lens names are ledger lenses (ledger.json re-recorded), the
# values live in the sets' FOCUS tables. No verb, cue or Butler byte moved.
S = {
 # ---- BEAT I - THE TALE BEGUN - SET shore - leaf 1 ------------------------
 # AMENDMENT A6 2026-08-17 (first contact is the reader's): verb auto/dwell
 # 3.4 -> click. The shipped heading advanced ITSELF at 3.4 s while the first
 # hint said 'click anywhere to read on' — the book's first exchange
 # contradicted its own cue. Headings are ours; the opening head now WAITS
 # for the click it asks for, and main.js extends the 30 s soft-fail to head
 # units so a reader who never clicks is still carried.
 'ody-i-00-head': dict(head=True, num='I', text='The Tale Begun', verb='click',
                       focus='establishing', clear=True,
                       bed='shore', act='establish',
                       c='night-shore establishing, night-mist state; the '
                         'heading WAITS for the reader\'s first click (A6 — '
                         'the hint asks for it), then chains into the '
                         'voiceover — the court is heard, never seen.'),
 'ody-i-01-bard': dict(verb='click', focus='establishing', clear=True,
                       drop=True, seg='landfall', segDur=8.0, segHold=False,
                       sfx='keel',
                       c='voiceover over the dark landfall — fog layer, ship '
                         'silhouettes ghosting in (cut c-night performs '
                         'beneath).'),
 'ody-i-02-iamulysses': dict(verb='click', focus='camp-fire', clear=True,
                             act='fire-ulysses', cameo='ulysses',
                             cap='Ulysses · Son of Laertes · of Ithaca',
                             c='cameo card, first appearance — the caption '
                               'plants Beat VI\'s O.12 echo (cut c-firstly); '
                               'the CARD is this unit\'s close (the staging '
                               'column stages the cameo + the landfall '
                               'tail, and the man is still WADING IN — an '
                               'in-scene close here framed empty sand and '
                               'broke the anti-skate law at k 11.6); '
                               'landfall pantomime tail.'),
 'ody-i-03-troy': dict(verb='click', focus='camp-fire',
                       c='camp embers; bridges the chapter-level '
                         'Cicons/Lotus-eaters cut.'),
 'ody-i-04-lawless': dict(verb='click', focus='smoke', clear=True, fact='O.1',
                          c='O.1 text half — the smoke-across-the-strait '
                            'lift to the mainland lobe; the one-eye half '
                            'stays VISUAL and lands in Beat II.'),
 'ody-i-05-dawn': dict(verb='click', focus='establishing', clear=True,
                       act='shore-day', bed='shore-day', sfx='goats',
                       seg='hunt', segDur=5.0, segHold=False,
                       c='shore day state — goats scattering; the hunt is '
                         'pantomime after the line (cut c-hunt); the bed '
                         'crosses to the daytime shore WITH the visual.'),
 'ody-i-06-smoke': dict(verb='click', focus='council', clear=True,
                        act='council-ulysses', sfx='bleats',
                        c='beach feast, all eyes to the strait — stubble-fire '
                          'smoke plainly seen (O.1 reinforcement); sun-down '
                          'time-lapse; the crew gathers to the council marks '
                          '(the ledger\'s own council lens — the wide budget '
                          'is spent on bard + dawn, the close-up law).'),
 # [shot] SHOTGEN 2026-08-17: shot-council — the G1 speech as a NATIVE
 # dialogue close (SHOTS.md §2a row 1); the shot's own targets.ship carries
 # the hull ring in shot space; the world settles at the capped lens beneath.
 'ody-i-07-council': dict(verb='target', target='ship', gateAct='crossing',
                          gateSfx='oars', shot='shot-council',
                          cue='click the ship · cross to the mainland',
                          focus='council-close', clear=True,
                          c='GATE G1 — the beached ship (ship-2 hull centre '
                            'per the ledger); the speech is a two-shot CLOSE '
                            'over the huddle, the hull dot kept in frame '
                            '(the close-up law); gateAct crossing performs '
                            'the embarkation and the strait (cut c-board).'),
 'ody-i-08-cave': dict(verb='click', focus='cavemouth-push-to', clear=True,
                       act='entry-mainland', sfx='wind',
                       c='mainland approach — slow push onto the laurel '
                         'mouth (lens cavemouth-push-from animates to -to).'),
 'ody-i-09-monster': dict(verb='click', focus='crag-tilt',
                          c='the mouth holds EMPTY (he is away); on the crag '
                            'simile the lens tilts to the bare cliff-top — '
                            'Beat VI pre-echo.'),
 # [shot] SHOTGEN lane 2, 2026-08-17: shot-wineskin (SHOTS.md §2a row 2).
 'ody-i-10-wineskin': dict(verb='click', focus='ship-mid', clear=True,
                           act='twelve-at-ship', sfx='slosh',
                           shot='shot-wineskin',
                           c='the twelve chosen, the rest stay; Ulysses '
                             'shoulders the dark goatskin.'),
 'ody-i-11-twentyone': dict(verb='click', focus='skin-close',
                            c='O.2 strength detail — the skin close '
                              'IN-WORLD, not the inset yet.'),
 'ody-i-12-misgave': dict(verb='click', focus='cavemouth-push-to', clear=True,
                          act='plate-wineskin', fact='O.2', endsBeat=True,
                          c='O.2 LANDS — the chapter\'s ONLY inset rises; '
                            'the party climbs behind the plate (mark '
                            'climb-path); the completing click drops the '
                            'plate and turns leaf 1 to 2.'),

 # ---- BEAT II - THE CAVE - SET cave - leaf 2 ------------------------------
 'ody-ii-00-head': dict(head=True, num='II', text='The Cave', verb='click',
                        focus='establishing', clear=True, bed='cave',
                        act='cave-dawn', seg='entry', segDur=5.0, segHold=True,
                        c='boulder-open day state (cave-dawn master); the '
                          'men slip in past the empty pens under the heading '
                          '(K1).'),
 'ody-ii-01-beg': dict(verb='click', focus='racks-sweep', clear=True,
                       act='cheese-rack', sfx='bleats', fact='O.3a',
                       c='lens sweeps racks + ranked pens (K2); the '
                         'laden-men tableau, heads jerked seaward (K3).'),
 'ody-ii-02-present': dict(verb='click', focus='doorlight-hinge',
                           fact='O.3b',
                           c='the chapter\'s tragic hinge — the waiting '
                             'segment plays on advance (K4).'),
 'ody-ii-03-return': dict(verb='click', focus='discovery-low', clear=True,
                          seg='return', segDur=7.0, segHold=True,
                          act='huddle-far', sfx='crash', cameo='polyphemus',
                          cap='Polyphemus · the Cyclops',
                          c='POLYPHEMUS enters under the firewood load; '
                            'single-eye cameo art carries O.1\'s visual '
                            'half; the men scatter to the far dark (K5).'),
 'ody-ii-04-boulder': dict(verb='click', focus='mouth', clear=True,
                           act='cave-shut', sfx='boulder', fact='O.4',
                           c='the boulder-shut pantomime precedes the text '
                             '(K6) — a state swap under the grind-boom; the '
                             'waggons measure lands while the stone settles.'),
 'ody-ii-05-strangers': dict(verb='click', focus='eye-close', clear=True,
                             seg='milking', segDur=4.0, segHold=True,
                             act='giant-seat', bed='cave-fire', sfx='boom',
                             c='milking/curdling compresses on entry (K7/K8, '
                               'the supper bowl planted); the fire flares — '
                               'the bed gains its crackle (cave-fire) — '
                               'the head turns; FIRST close lens on the '
                               'single eye (O.1 visual).'),
 'ody-ii-06-plea': dict(verb='click', focus='twoshot', clear=True,
                        act='suppliant',
                        c='arms wide, firelight between the small figure and '
                          'the seated bulk; no cue.'),
 'ody-ii-07-pitiless': dict(verb='click', focus='twoshot',
                            c='the pitiless answer, delivered flat — he '
                              'never stops working.'),
 'ody-ii-08-shipfast': dict(verb='click', focus='twoshot',
                            c='the probe made visible (K12a): the giant '
                              'leans in toward the mouth.'),
 'ody-ii-09-shiplie': dict(verb='click', focus='twoshot', clear=True,
                           c='the lie performed as theatre (K12b) — the '
                             'reader beached that ship in Beat I\'s own '
                             'crossing.'),
 'ody-ii-10-firstmeal': dict(verb='click', focus='meal-close', clear=True,
                             seg='seize', segDur=6.0, segHold=True,
                             act='cave-embers', sfx='seize', fact='O.6',
                             c='the two-at-a-clutch seize IN SHADOW (K13) — '
                               'seg seize restages IDENTICALLY at Beat '
                               'III\'s two meals (O.6\'s carrier); then the '
                               'sprawl among the sheep, snore-bed, fire to '
                               'low glow (K14).'),
 'ody-ii-11-sword': dict(verb='target', target='sword', gateAct='swordDraw',
                         gateSfx='sword',
                         cue='click the sword · do what instinct asks',
                         focus='sword', clear=True, act='sword-ulysses',
                         bed='snore',
                         c='GATE G2 — the glint at the hip; the reader '
                           'performs the fatal instinct so the text can '
                           'refuse it (O.5 setup); the promised snore-bed '
                           '(K14) is UNDER the gate — the instinct is '
                           'weighed against the sleeping breath.'),
 'ody-ii-12-shiftstone': dict(verb='click', focus='sword', fact='O.5',
                              c='the blade STOPS mid-air; the pan lands on '
                                'the boulder filling the mouth; steel '
                                'sheathed unheard — O.5 lands.'),
 'ody-ii-13-tillmorning': dict(verb='click', focus='establishing', clear=True,
                               sfx='sob', endsBeat=True,
                               c='widest lens of the beat: twelve small '
                                 'shapes against the stone; the click turns '
                                 'the page to leaf 3.'),

 # ---- BEAT III - NOBODY - SET cave - leaf 3 (SHARED with Beat IV) ---------
 'ody-iii-00-head': dict(head=True, num='III', text='Nobody', verb='click',
                         focus='establishing', clear=True, bed='cave',
                         act='cave-predawn',
                         c='leaf 3 mounts on the 2-to-3 turn; dawn light '
                           'through the mouth-chinks, embers grey, the giant '
                           'asleep among the flock.'),
 'ody-iii-01-morningmeal': dict(verb='click', focus='meal-close', clear=True,
                                act='milking', seg='seize', segDur=6.0,
                                segHold=True, sfx='seize', fact='O.6',
                                c='dawn routine in pantomime under the '
                                  'ellipsis (c1); seg seize restaged '
                                  'IDENTICALLY — men now eight.'),
 'ody-iii-02-quiverlid': dict(verb='click', focus='mouth', clear=True,
                              seg='flock-out', segDur=5.0, segHold=True,
                              sfx='boulder',
                              c='stone-lift + flock-stream precede the text '
                                '(c2); the simile lands AS the stone claps '
                                'to and the light dies.'),
 # [shot] SHOTGEN lane 2, 2026-08-17: shot-scheme (SHOTS.md §2a row 4).
 'ody-iii-03-scheme': dict(verb='click', focus='scheme-push', clear=True,
                           act='scheme', sfx='shoo', shot='shot-scheme',
                           c='sealed dim; the muffled Shoo, shoo and fading '
                             'flock-bells through the stone (c3); push-in on '
                             'Ulysses alone among the pens.'),
 'ody-iii-04-club': dict(verb='click', focus='club-wide', clear=True,
                         seg='stake-make', segDur=6.0, segHold=True,
                         sfx='chop',
                         c='the searching pan finds the club; mast-scale '
                           'delivered VISUALLY — figures tiny beside it; '
                           'cut/fine/point/char montage under the ellipses.'),
 # AMENDMENT A8 2026-08-18 (the lots are the reader's): verb click -> pick.
 # The eight men stand the drawn circle (FORM.lots); the reader clicks FOUR
 # and the chosen four ARE the stake bearers thereafter (cave.js bearers).
 # 30 s soft-fail auto-draws the four lowest alive. Butler untouched.
 'ody-iii-05-lots': dict(verb='pick', picks=4, pickOf='lots',
                         gateAct='lots-draw',
                         cue='the helmet shakes · click four of the men — '
                             'the lot falls on them',
                         focus='lots-overhead', act='stake-hide',
                         sfx='lots',
                         c='the stake slides under the painted dung-litter '
                           '(c8); shaken helmet, four step forward, Ulysses '
                           'the fifth — SINCE A8 the four are the reader\'s '
                           'own picks, and the world remembers them.'),
 'ody-iii-06-return': dict(verb='click', focus='establishing', clear=True,
                           seg='flock-in', segDur=6.0, segHold=True,
                           sfx='flock',
                           c='evening return — the WHOLE flock pours in, '
                             'pens visibly overfull; the anomaly pays off in '
                             'Beat V.'),
 'ody-iii-07-suppertwo': dict(verb='click', focus='meal-close', clear=True,
                              act='cave-shut', bed='cave-fire', seg='seize',
                              segDur=6.0, segHold=True, sfx='seize',
                              fact='O.6',
                              c='boulder re-seated + milking repeated (c9); '
                                'seg seize IDENTICAL a third time — men now '
                                'six; the supper fire is lit (cave-fire bed) '
                                'and the ivy bowl becomes the hot object.'),
 # AMENDMENT 2026-08-16 (rest is allowed): rest=True — a released hold KEEPS
 # its fill (no decay, no reset) and resumes on re-press; cue amended to say so.
 # AMENDMENT A7 2026-08-17 (the pour is the release): verb hold -> release.
 # The contract's own carrier line (O.7) is "each RELEASE drained in
 # pantomime", and the shipped hold poured WHILE PRESSED (setHold armed the
 # pour clock the instant k hit 1). Now the fill BANKS on the hold (rest
 # kept), and the LET-GO past the 1.6 s threshold fires gateAct 'bowl-pour'
 # from pressUp itself — pour 1 starts ON the release frame, like myname's
 # shout. Cues are OUR authoring; Butler's text is untouched.
 # [shot] SHOTGEN 2026-08-17: shot-bowl — G3's offer as a NATIVE object close
 # (SHOTS.md §2a rows 5/6, shared with thrice); holds.bowl carries the ring.
 'ody-iii-08-lookhere': dict(verb='release', hold=1.6, rest=True,
                             gateAct='bowl-pour', shot='shot-bowl',
                             cue='hold the bowl · fill it — let go to pour'
                                 ' — rest is allowed',
                             focus='bowl-close', clear=True, act='bowl-offer',
                             sfx='pour',
                             c='GATE G3 — the bowl FILLS with the hold and '
                               'POURS on the release (A7: gateAct bowl-pour '
                               'fires on the let-go; the set pantomimes '
                               'pours 2-3 under the two autos that follow, '
                               'ledger holds:3); his drain-and-thrust-back '
                               'IS the begging (c10).'),
 'ody-iii-09-besokind': dict(verb='auto', dwell=9.0, focus='face-flush',
                             c='lands on pour-1 release; the flushed face '
                               'leans down, the one eye glittering; "tell me '
                               'your name" baits O.8\'s trap.'),
 'ody-iii-10-thrice': dict(verb='auto', dwell=8.0, focus='bowl-close',
                           clear=True, fact='O.7', shot='shot-bowl',
                           c='lands with pour-3 — O.7: three fills, three '
                             'heedless drains; the giant sways, the fire '
                             'sinks toward embers.'),
 'ody-iii-11-noman': dict(verb='click', focus='twoshot', clear=True,
                          shot='shot-noman', fact='O.8a',
                          c='the pun — half-bow at "plausibly"; near-silence '
                            'under the line. [shot] THE FIRST PAINTED SHOT '
                            '(SHOTS.md, owner pick A-noman-cand1): a native '
                            'dialogue close crossfades over the capped '
                            'twoshot lens; the world steps beneath.'),
 'ody-iii-12-nomanlast': dict(verb='click', focus='twoshot', fact='O.8b',
                              c='the price, adjacent to the pun; the empty '
                                'bowl loose in his fingers; this click fires '
                                'the collapse.'),
 'ody-iii-13-neck': dict(verb='auto', dwell=6.5, focus='collapse',
                         clear=True, seg='collapse', segDur=6.0, segHold=True,
                         act='cave-embers', bed='snore', sfx='fall',
                         c='rides the collapse segment (~6 s) on its OWN '
                           'composed lens (the close-up law: the wide budget '
                           'is club + return); the sick-turn in shadow, '
                           'sound-led — the wine takes him and the snore-bed '
                           'comes up under the stake; Beat IV\'s heading '
                           'lands on this SAME leaf — NO page turn.'),

 # ---- BEAT IV - THE STAKE - SET cave - leaf 3 (SHARED with Beat III) ------
 'ody-iv-00-head': dict(head=True, num='IV', text='The Stake', verb='auto',
                        dwell=3.4, focus='establishing', clear=True,
                        c='NO page turn — the heading lands on leaf 3 '
                          'already mounted, dark-embers state, the giant '
                          'sprawled by the pens.'),
 # AMENDMENT 2026-08-16 (rest is allowed): rest=True — the glow earned so far
 # PERSISTS through a release and resumes on re-press; cue amended to say so.
 # [shot] SHOTGEN 2026-08-17: shot-embers — G4's hold as a NATIVE action
 # close, a CLIP (ember pulse + breathing sleepers, deflicker-gated); the
 # hold ring stands on holds.stake in shot space (SHOTS.md §2a rows 7/8).
 'ody-iv-01-embers': dict(verb='hold', hold=3.0, rest=True,
                          cue='hold the stake in the embers · until it glows'
                              ' — rest is allowed', shot='shot-embers',
                          focus='ember-close', clear=True, sfx='embers',
                          c='GATE G4 — glow rides the hold (watermark law); '
                            'at full heat the drive fires itself; the '
                            'blinding clock (~14 s) zeroes on resolve.'),
 'ody-iv-02-glowing': dict(verb='auto', dwell=3.6, focus='ember-close',
                           clear=True, shot='shot-embers',
                           c='fires on gate completion and starts the '
                             'blinding clock; the drawn point lights five '
                             'faces from below; margin cleared for the '
                             'twist.'),
 # [shot] SHOTGEN 2026-08-17: shot-drive — the drive as a NATIVE action
 # close, a CLIP off the clip-twist inset's own staged seed (SHOTS.md §1.4:
 # the full-frame shot SUPERSEDES the inset — its grants retired in main.js);
 # shotAt 1.2 keeps the heroclip raise tick (after the settled frame).
 # DIRECTOR'S CUT r2: the blinding's four leaves were starved. Measured on
 # the r1 scene recording the AUGER — the decisive event of the chapter — held
 # the screen for 0.58 s, because the beat clock is armed by the ember hold and
 # `glowing` (auto, 3.4 s) had already spent most of the way to 4.2 before the
 # leaf was even entered. The offsets are re-cut so each leaf owns real time:
 # auger 3.0 s, bore 3.1, hiss 2.8, fright 2.2. The pantomime is act-driven and
 # rides the unit, so nothing in the staging moves with them.
 'ody-iv-03-auger': dict(verb='clock', at=6.6, focus='drive-tight',
                         shot='shot-drive', shotAt=1.2,
                         clear=True, sfx='grind', fact='O.9',
                         c='the drive itself is PANTOMIME (cut #6); the '
                           'auger simile lands ON the twist — O.9.'),
 'ody-iv-04-bore': dict(verb='clock', at=9.7, focus='drive-tight',
                        shot='shot-drive', sfx='sputter',
                        c='steam plumes up the firelight shaft; horror '
                          'staged in shadow, not lingered.'),
 'ody-iv-05-hiss': dict(verb='clock', at=12.5, focus='drive-tight',
                        shot='shot-drive', bed='cave', sfx='hiss',
                        c='the HISS then the YELL — camera shake, roof-dust, '
                          'the flocks surging in the pens; the snore-bed '
                          'dies with the sleep it belonged to.'),
 'ody-iv-06-fright': dict(verb='clock', at=14.7, focus='mouth', clear=True,
                          sfx='clatter',
                          c='pluck-and-hurl pantomime inside the ellipsis '
                            '(cut #7); lamplight gathers through the boulder '
                            'seams; click pacing resumes next unit.'),
 'ody-iv-07-whatails': dict(verb='click', focus='mouth', clear=True,
                            cameo='a-cyclops', cap='A Cyclops · the Neighbours',
                            c='voices from BEYOND the stone — voice-only '
                              'card, first appearance; O.10 opens.'),
 'ody-iv-08-nomankilling': dict(verb='click', focus='sprawl-groan',
                                fact='O.10a',
                                c='the pun lands — the shout is HIS, so the '
                                  'lens leaves the seams for the groaning '
                                  'bulk against his own fire-glow (the '
                                  'close-up law; the mouth lens had cropped '
                                  'the shouter); a held beat of silence '
                                  'outside.'),
 'ody-iv-09-mustbeill': dict(verb='click', focus='mouth', fact='O.13a',
                             c='O.13a PLANTED — "pray to your father '
                               'Neptune", said plainly through the stone.'),
 'ody-iv-10-wentaway': dict(verb='click', focus='mouth', clear=True,
                            cameo='off', sfx='footfalls', fact='O.10b',
                            c='the lamps RECEDE — the seams dim one by one; '
                              'O.10 completes: they GO.'),
 'ody-iv-11-stone': dict(verb='click', focus='mouth', act='boulderOpen',
                         sfx='boulder',
                         c='the blind grope along the wall; the stone drawn '
                           'aside — night air spills in (the Beat II '
                           'shut-sfx reversed).'),
 'ody-iv-12-doorway': dict(verb='click', focus='mouth', clear=True,
                           act='doorway-seat', endsBeat=True,
                           c='the closing tableau — seated in the mouth, '
                             'hands spread; the door open and utterly '
                             'barred; the click turns leaf 3 to 4.'),

 # ---- BEAT V - THE RAMS - SET cave (dawn state) - leaf 4 ------------------
 'ody-v-00-head': dict(head=True, num='V', text='The Rams', verb='auto',
                       dwell=3.4, focus='establishing', clear=True,
                       bed='cave', act='cave-predawn',
                       c='leaf 4 mounts, pre-dawn dark; the giant seated '
                         'filling the doorway (mark doorway-seat); six crew '
                         'huddled by the pens.'),
 'ody-v-01-puzzling': dict(verb='click', focus='puzzling', clear=True,
                           c='slow pull from the blocked mouth to Ulysses\' '
                             'face; the seated giant stays in frame — the '
                             'problem IS the doorway (own composed lens, the '
                             'close-up law: the wide read Ulysses at 9.8%).'),
 'ody-v-02-withies': dict(verb='click', focus='lash-close', clear=True,
                          seg='lash-trios', segDur=5.0, segHold=False,
                          sfx='withies',
                          c='withies from the sleeping-litter; ram-trios '
                            'lashed noiselessly UNDER the giant\'s '
                            'breathing; the lens is ON the working hands '
                            '(the close-up law — meal-close aimed at the '
                            'hearth, not the trios).'),
 'ody-v-03-threetoaman': dict(verb='click', focus='lash-close',
                              c='first man slides under the middle ram; the '
                                'flanks close over him; five more trios '
                                'stagger in, lens low at sheep height.'),
 # [shot] SHOTGEN lane 2, 2026-08-17: shot-ram (SHOTS.md §2a row 14); the
 # G5 ring rides the shot's own targets['ram-great'] in shot space.
 # AMENDMENT A9 2026-08-18 (the sweep and the gap): the G5 click only lands
 # in the GAP of the blinded giant's telegraphed hand-sweep; a hit under the
 # crossing hand pauses the sweep, bleats, and the reader retries (soft pass
 # after 3 misses; the 30 s soft-fail law unchanged). Amended cue only —
 # verb/target/gateAct rows untouched.
 'ody-v-04-greatram': dict(verb='target', target='ram-great',
                           gateAct='slingUnder', gateSfx='wool',
                           cue='the blind hand sweeps the door · click the '
                               'great ram in the gap',
                           shot='shot-ram',
                           focus='ram-close', clear=True, act='ram-stand',
                           c='GATE G5 — the great ram apart at the rail; the '
                             'click IS the sling-under, the chapter\'s '
                             'no-text moment (cut C1) — SINCE A9 it must '
                             'land in the sweep\'s gap.'),
 'ody-v-05-dawn': dict(verb='click', focus='establishing', clear=True,
                       act='cave-dawn', sfx='flock',
                       c='dawn-shaft breaks past the seated giant; the flock '
                         'streams toward the light; the ewes stay bleating.'),
 'ody-v-06-feltbacks': dict(verb='click', focus='handpass-tight', clear=True,
                            sfx='wool', fact='O.11',
                            c='the hand-pass — O.11\'s core image: the huge '
                              'palm strokes the very fleece that hides a '
                              'man.'),
 'ody-v-07-lastofall': dict(verb='click', focus='doorway-twoshot', clear=True,
                            act='ram-at-mouth',
                            c='the great ram HALTED under the palm in the '
                              'doorway; the stage empties around the held '
                              'pair.'),
 'ody-v-08-ramspeech1': dict(verb='click', focus='doorway-twoshot', clear=True,
                             c='gentle for the first time in the chapter; '
                               'Ulysses\' fists in the fleece in the lower '
                               'frame.'),
 'ody-v-09-ramspeech2': dict(verb='click', focus='doorway-twoshot',
                             c='the hand tightens at "I will have his life '
                               'yet" — the life he wants hangs an arm\'s '
                               'length under it.'),
 'ody-v-10-ramspeech3': dict(verb='click', focus='doorway-twoshot',
                             c='the blind head turns back into the cave; '
                               'then the palm lifts.'),
 'ody-v-11-freed': dict(verb='click', focus='freed-overshoulder', clear=True,
                        seg='free-men', segDur=6.0, segHold=False,
                        sfx='withies',
                        c='the ram trots clear; Ulysses drops from beneath '
                          'and cuts each man free; the giant still seated, '
                          'small now.'),
 'ody-v-12-aboard': dict(verb='click', focus='freed-overshoulder', clear=True,
                         sfx='oars', endsBeat=True,
                         c='the completing click turns leaf 4 to 5; seg '
                           'run-to-ship plays across the turn (cut C2) — the '
                           'nod-and-frown hush is its face beat.'),

 # ---- BEAT VI - THE TAUNT - SET sea - leaf 5 (NO head unit) ---------------
 # (S-dict drift fix 2026-08-16: the shipped units.js carried focus 'gate-wide'
 # here and at rock1 while this dict still said 'establishing' — the dict is
 # law, so it now records what ships.)
 'ody-vi-01-jeer': dict(verb='target', target='cyclops', gateAct='jeer',
                        gateSfx='shout', cue='click the Cyclops · jeer at him',
                        focus='gate-wide', clear=True, bed='sea',
                        act='establish',
                        c='GATE G6, first resolution; the sea SET mounts '
                          'under heading VI · THE TAUNT — NO head unit, the '
                          'heading rides this unit; two-plane wide.'),
 # [shot] SHOTGEN 2026-08-17: shot-taunt — the taunt as a NATIVE dialogue
 # close (SHOTS.md §2a row 15; stern k 10.6 was the digital zoom working
 # hardest); leader head from the shot's own heads table.
 'ody-vi-02-taunt': dict(verb='auto', dwell=6.0, focus='stern', clear=True,
                         act='stern-ulysses', shot='shot-taunt',
                         c='fires on gate 1 — whip to the stern, arm flung '
                           'at the cliff; the blinded head turns toward the '
                           'sound.'),
 # DIRECTOR'S CUT r2: the throw held 2.58 s on the r1 recording — no room for
 # a wind-up, a reaction and a splash. The leaf is re-cut to ~6 s so the rock
 # can be a sentence instead of an event that has already happened.
 'ody-vi-03-rock1': dict(verb='clock', at=12.0, wait='rock1',
                         focus='gate-wide', clear=True, sfx='rock-tear',
                         c='ROCK 1\'s clock (~12 s): tear, arc, splash ahead '
                           'of the rudder, the wash drives the ship BACK, '
                           'pole-push, oars bite; margin cleared for the '
                           'arc; wait rock1 holds the page.'),
 'ody-vi-04-twiceasfar': dict(verb='click', focus='ship-deck', clear=True,
                              c='double distance — headland layer scaled '
                                'back; THE MEN turn from their oars.'),
 'ody-vi-05-menbeg': dict(verb='click', focus='menbeg-close',
                          cameo='the-men',
                          cap='The Men · six at the oars',
                          c='the plea — the rowers\' faces UP at Ulysses, '
                            'one gripping his arm (the close-up law: at '
                            'ship-deck they were a 4% speck); it stays LIT '
                            'while gate 2 waits; the next click on the '
                            'Cyclops is a click OVER these words (O.12 '
                            'mechanism).'),
 'ody-vi-06-defy': dict(verb='target', target='cyclops', gateAct='defy',
                        gateSfx='shout',
                        cue='click the Cyclops · name yourself',
                        focus='defy-strait',
                        c='GATE G6, second resolution — NO clear: the men\'s '
                          'plea still stands in the margin; defy-strait '
                          'keeps pleaders and target in one frame BOTH '
                          'orientations with the giant at the two-shot '
                          'floor (split off `strait`, which rock 2\'s '
                          'splash pins — the close-up law), composed inside '
                          'the painting at the doubled distance (F2).'),
 # AMENDMENT 2026-08-16 (release-as-verb): was auto/dwell 6.0 — the self-naming
 # is now the reader's own RELEASE. Press-and-hold draws the breath at the
 # stern (the taunt cut swells on the held k); LETTING GO past the 0.6 s
 # threshold fires the shout (gateAct 'shout' snaps the pose, gateSfx 'shout'
 # rings the name — the giant-roar clip, the same cue both cyclops gates
 # already shout with) and the story advances ON the release frame. A shorter
 # press is a stray click: it reads as a beat and holds the page. Soft-fail
 # auto-releases at 30 s (sec 2.6). Verbs are OUR authoring; Butler untouched.
 # [shot] SHOTGEN 2026-08-17: shot-myname — the name on the rail as a NATIVE
 # dialogue close (SHOTS.md §2a row 17, k 12.3 retired); holds.breath
 # carries the press ring in shot space.
 # AMENDMENT A10 2026-08-18 (taunt dial): dial='jeer' — a press let go UNDER
 # the threshold (the stray click) is an EXTRA JEER, max 3; each one brings
 # rock 2 in nearer and the closing card remembers in three tiers.
 'ody-vi-07-myname': dict(verb='release', hold=0.6, gateAct='shout',
                          dial='jeer',
                          shot='shot-myname',
                          gateSfx='shout', focus='stern-rail', clear=True,
                          cue='press and hold · draw breath — release the name '
                              '· a quick shout jeers him again',
                          act='stern-rail', fact='O.12',
                          c='O.12 lands — he shakes off the gripping hand '
                            'and steps onto the stern rail; a TRUE close on '
                            'the man at the rail (the close-up law — the '
                            'story\'s peak at 30%, not 7%); the reader\'s own '
                            'RELEASE fires the shout; echo off the cliff.'),
 'ody-vi-08-prophecy': dict(verb='click', focus='clifftop', clear=True,
                            cameo='off', sfx='groan',
                            c='push past the ship to the cliff-top close; '
                              'the groan and half-stagger open the unit '
                              '(c2); the ruined eye toward the sea.'),
 'ody-vi-09-fatherson': dict(verb='click', focus='clifftop', fact='O.13b',
                             c='O.13b — "Neptune and I are father and son" '
                               'confirms Beat IV\'s plant; the tone turns '
                               'wheedling.'),
 'ody-vi-10-hades': dict(verb='click', focus='hades-twoshot', clear=True,
                         act='stern-ulysses',
                         c='flat and cold over dead-calm water; the '
                           'contract\'s own two-shot on its own lens (the '
                           'close-up law: `stern` is a solo close now) — '
                           'stern foreground, cliff figure small and dark '
                           'behind at the two-shot floor.'),
 'ody-vi-11-curse': dict(verb='click', focus='curse', clear=True, act='curse',
                         fact='O.14a',
                         c='O.14a — both hands to the firmament (cut c3); '
                           'document-weight frame, sky darkened a stop, bed '
                           'to near-silence.'),
 'ody-vi-12-heard': dict(verb='clock', at=1.2, wait='rock2',
                         focus='strait', sfx='rock-tear', fact='O.14b',
                         c='O.14b — ROCK 2 rides this clock as the line\'s '
                           'punctuation (c4+c5): the near-miss astern and '
                           'the wash drive them ONWARD; receding-shore '
                           'engages; wait rock2 holds the page.'),
 'ody-vi-13-ram': dict(verb='click', focus='homeward', clear=True,
                       seg='return-beach', segDur=8.0, segHold=True,
                       sfx='keel',
                       c='return segment precedes the unit (c6+c7: beach '
                         'layer, comrades, flock ashore); the great ram at a '
                         'driftwood altar, smoke straight up — and NO sign; '
                         'dusk time-dip follows (c8).'),
 'ody-vi-14-sailedon': dict(verb='click', dwell=8.0, focus='moonpath',
                            clear=True, act='sea-dawn', sfx='oars',
                            endsBeat=True, endsBook=True,
                            c='dawn; departure pantomime under the ellipsis '
                              '(c9); the click turns the page to the closing '
                              'card (leaf 6). The moonpath lens follows the '
                              'ship toward the painted moonpath — the frame '
                              'the closing cover rises over.'),
}

BEAT_META = {
    1: dict(page=1, set='shore'), 2: dict(page=2, set='cave'),
    3: dict(page=3, set='cave'),  4: dict(page=3, set='cave'),
    5: dict(page=4, set='cave'),  6: dict(page=5, set='sea'),
}

BEAT_BANNER = {
    1: 'BEAT I · THE TALE BEGUN — SET shore · leaf 1',
    2: 'BEAT II · THE CAVE — SET cave · leaf 2',
    3: 'BEAT III · NOBODY — SET cave · leaf 3 (SHARED with Beat IV)',
    4: 'BEAT IV · THE STAKE — SET cave · leaf 3 (no turn in; turns out 3→4)',
    5: 'BEAT V · THE RAMS — SET cave, dawn state · leaf 4',
    6: 'BEAT VI · THE TAUNT — SET sea · leaf 5 (NO head unit; → closing card)',
}

ORDER_KEYS = ['id', 'key', 'head', 'num', 'text', 'speaker', 'verb', 'target',
              'gateAct', 'gateSfx', 'cue', 'hold', 'rest', 'reveal', 'dwell', 'at',
              'picks', 'pickOf', 'dial',
              'wait', 'seg', 'segDur', 'segHold', 'endsBeat', 'endsBook',
              'focus', 'shot', 'shotAt', 'page', 'beat', 'set', 'clear',
              'drop', 'sfx', 'bed', 'act', 'cameo', 'cap', 'fact']


def js(v):
    if v is True:
        return 'true'
    if v is False:
        return 'false'
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace('\\', '\\\\').replace("'", "\\'") + "'"


def wrap(s, indent, width=78):
    words, lines, cur = s.split(' '), [], ''
    for w in words:
        if len(cur) + len(w) + 1 > width - len(indent):
            lines.append(cur)
            cur = w
        else:
            cur = (cur + ' ' + w).strip()
    if cur:
        lines.append(cur)
    return lines


PROLOGUE = """\
/**
 * units.js — the reader's script for the WHOLE of Book IX, "The Cyclops":
 * 81 units (76 text + 5 heads), six beats, six leaves (leaf 6 is the closing
 * card), three SETS (shore / cave / sea).
 *
 * GENERATED by tools/ody/emit_units_ody.py from CONTENT-odyssey.md — do not
 * hand-edit the UNITS array; re-emit. Butler's text is verbatim (Gutenberg
 * #1727, public domain), trimmed only with ellipses; CONTENT-odyssey.md is
 * the law (VERBATIM AUDIT 76/76). The reader IS Ulysses telling the tale at
 * Alcinous' court: narration carries no prefix.
 *
 * NAMES ARE THE LEDGER'S (tools/ody/ledger.json):
 *   focus   — ledger LENS names verbatim, per set.
 *   target  — ledger gate targets verbatim (ship / sword / ram-great /
 *             cyclops). G4 (embers) is the book's `hold` verb; G3 (bowl)
 *             is a `release` since A7 — it banks on the hold, pours on
 *             the let-go.
 *   act     — ledger mark names (fire-ulysses, giant-seat, doorway-seat…),
 *             master/state names (shore-day, cave-dawn, cave-shut,
 *             cave-embers, cave-predawn, sea-dawn), object names
 *             (boulderOpen), gateActs from the ledger (crossing, swordDraw,
 *             slingUnder) + authored verbs the set lane implements
 *             (establish, plate-wineskin, jeer, defy, curse).
 *
 * THE BOOK'S THREE TRAPS:
 *   1. Beats III and IV SHARE LEAF 3 — the collapse chains straight into
 *      THE STAKE with no page turn.
 *   2. Beat VI has NO head unit — heading VI · THE TAUNT rides
 *      ody-vi-01-jeer (BEATS[5] still carries num + title).
 *   3. `cave` is mounted on three leaves (2, 3, 4) in STATE variants —
 *      states are acts (cave-dawn / cave-shut / cave-embers / cave-predawn),
 *      exactly as sherlock units drove room-dim via acts.
 *
 * AMENDMENTS (verbs/cues are OUR authoring — Butler untouched;
 * recorded in CONTENT-odyssey.md §Amendments):
 *   release — ody-vi-07-myname (2026-08-16): press-and-hold draws the breath
 *             (>= 0.6 s), LETTING GO fires the shout and the story advances
 *             on the release frame; soft-fail at 30 s. A7 (2026-08-17) makes
 *             ody-iii-08-lookhere the second release: the fill BANKS on the
 *             hold (rest kept) and gateAct 'bowl-pour' fires pour 1 on the
 *             let-go — the contract's "each release drained".
 *   rest    — the two big holds (lookhere 1.6 s, embers 3.0 s) carry
 *             rest: true — a released hold KEEPS its progress (no decay, no
 *             reset) and resumes on re-press; their cues say so.
 *   memory  — the defy gate's hesitation (gate-armed -> resolving click) is
 *             remembered by main.js and the closing card's sub gains ONE
 *             clause by the 4 s threshold: END_CARD.subEager / .subHeld.
 *   first   — A6 (2026-08-17): ody-i-00-head is click-paced now, not a 3.4 s
 *             auto — the heading waits for the click its own hint asks for;
 *             main.js extends the 30 s soft-fail to head units.
 *
 * Schema: site-deploy/living/app/units.js (the sherlock original) — same
 * fields, same field order, same exports.
 */

export const UNITS = [
"""

EPILOGUE = """\
];

/* ------------------------------------------------------------------ *
 * THE BOOK: six beats, five head units, six leaves, three SETS.
 *   - beat 6 has no head UNIT; its heading rides ody-vi-01-jeer.
 *   - leaves 3 is shared by beats 3 and 4 (no turn between them).
 *   - `cave` is mounted on leaves 2, 3 and 4 in state variants.
 * ------------------------------------------------------------------ */
export const BEATS = [
  { n: 1, num: 'I',   title: 'The Tale Begun', set: 'shore', leaf: 1, units: 13 },
  { n: 2, num: 'II',  title: 'The Cave',       set: 'cave',  leaf: 2, units: 14 },
  { n: 3, num: 'III', title: 'Nobody',         set: 'cave',  leaf: 3, units: 14 },
  { n: 4, num: 'IV',  title: 'The Stake',      set: 'cave',  leaf: 3, units: 13 },
  { n: 5, num: 'V',   title: 'The Rams',       set: 'cave',  leaf: 4, units: 13 },
  { n: 6, num: 'VI',  title: 'The Taunt',      set: 'sea',   leaf: 5, units: 14 },
];

export const beatOf = (u) => BEATS[((u && u.beat) || 1) - 1];

/** The closing card the LAST unit turns the page into. A PAGE, not an
 *  overlay: ody-vi-14-sailedon's completing click runs the same cover turn
 *  a page change always ran, and the cover lifts on a page with no picture. */
export const END_PAGE = 6;
export const END_CARD = {
  page: END_PAGE,
  kicker: 'END OF BOOK IX',
  title: 'The Cyclops',
  sub: 'told by Ulysses at the court of Alcinous',
  /* AMENDMENT A1 — THE SEEDED DEDICATION (authored, non-Butler): the ask
   * that rises on the settled card, and the line under the seeded sigil
   * (app/sigil.js draws it; main.js appends the reader's name). */
  ask: 'Who read this?',
  belonged: 'This reading belonged to',
  /* AMENDMENT A2 — HESITATION MEMORY (authored, non-Butler): at `defy`, the
   * reader's second click on the Cyclops, main.js times the pause from the
   * gate arming to the resolving click and the sub gains ONE clause by the
   * 4 s threshold. The base sub above is untouched. */
  subEager: ' — he gave the monster his name at once',
  subHeld: ' — he held his name as long as he could',
};

/** Verb default affordance labels (a unit's own `cue` wins). */
export const CUE_DEFAULT = {
  click:  'click to read on',
  hold:   'press and hold',
  release: 'press and hold · release',
  auto:   '',
  target: 'click the highlighted thing',
  clock:  '',
};

/** The first-visit affordance hint, faded out after the reader's first click. */
export const FIRST_HINT = 'click anywhere to read on';

/** Every leaf the book turns through — the units' pages, then the card's. */
export const PAGES = [...new Set([...UNITS.map(u => u.page), END_PAGE])];

/** The SET a leaf is mounted on. Cave carries leaves 2, 3 and 4. */
export const SET_OF_PAGE = (() => {
  const m = {};
  for (const u of UNITS) m[u.page] = u.set || 'shore';
  m[END_PAGE] = m[END_PAGE] || null;          // the closing card has no picture
  return m;
})();

/** Resolve a unit by CONTENT-odyssey.md key or by full id. */
export function unitByKey(k) {
  return UNITS.find(u => u.key === k || u.id === k) || null;
}

/** The ledger's gate targets, per SET (G1 ship · G2 sword · G5 ram-great ·
 *  G6 cyclops ×2; G3 and G4 are hold gates, not targets). */
export const TARGETS_BY_SET = {
  shore: ['ship'],
  cave:  ['sword', 'ram-great'],
  sea:   ['cyclops'],
};

/** Cheap shape check — the harness asserts this returns [].
 *  [shot] `shotsBySet` (set name -> the SET class's `static shots` registry)
 *  is optional and main.js passes the real one: a `shot:` a unit declares
 *  must be a plate its SET declares (the lazy-load law needs the bytes to
 *  decode with the set), and a target/hold on a shot unit must be carried
 *  by the shot's own anchor tables — a ring must never point into the
 *  covered world. */
export function validateUnits(units = UNITS, shotsBySet = null) {
  const bad = [];
  const seen = new Set();
  const seenKeys = new Set();
  const VERBS = new Set(['click', 'hold', 'release', 'auto', 'target', 'clock']);
  const ALL_TARGETS = new Set(Object.values(TARGETS_BY_SET).flat());
  const SETS = new Set(Object.keys(TARGETS_BY_SET));
  units.forEach((u, i) => {
    const at = `#${i} ${u.id || '(no id)'}`;
    const set = u.set || 'shore';
    if (!u.id) bad.push(`${at}: missing id`);
    if (seen.has(u.id)) bad.push(`${at}: duplicate id`);
    seen.add(u.id);
    if (!u.key) bad.push(`${at}: missing key (CONTENT-odyssey.md id)`);
    if (seenKeys.has(u.key)) bad.push(`${at}: duplicate key`);
    seenKeys.add(u.key);
    if (typeof u.text !== 'string') bad.push(`${at}: text must be a string`);
    if (!VERBS.has(u.verb)) bad.push(`${at}: verb must be one of ${[...VERBS].join('|')}`);
    if (!u.focus) bad.push(`${at}: missing focus`);
    if (!(u.page >= 1)) bad.push(`${at}: page must be >= 1`);
    if (!SETS.has(set)) bad.push(`${at}: unknown set '${set}'`);
    if (u.verb === 'auto' && !(u.dwell > 0)) bad.push(`${at}: auto needs dwell`);
    if (u.verb === 'hold' && !(u.hold > 0)) bad.push(`${at}: hold needs hold seconds`);
    if (u.verb === 'release' && !(u.hold > 0)) {
      bad.push(`${at}: release needs its hold threshold seconds`);
    }
    if (u.rest && u.verb !== 'hold' && u.verb !== 'release') {
      bad.push(`${at}: rest rides the hold/release verbs only`);   // A7: G3 rests
    }
    if (u.verb === 'clock' && !(u.at > 0)) bad.push(`${at}: clock needs its t+ offset`);
    if (u.verb === 'target' && !ALL_TARGETS.has(u.target)) {
      bad.push(`${at}: target verb needs target in {${[...ALL_TARGETS].join(',')}}`);
    }
    /* A gate must be reachable ON THE SET IT IS PLAYED ON. */
    if (u.verb === 'target' && u.target &&
        !(TARGETS_BY_SET[set] || []).includes(u.target)) {
      bad.push(`${at}: gate '${u.target}' is not a target of SET '${set}'`);
    }
    if (u.verb === 'target' && !u.cue) bad.push(`${at}: target gate needs an explicit cue`);
    /* [shot] SHOTS_BY_SET: a shot is a byte of its SET */
    if (u.shot && shotsBySet) {
      const spec = (shotsBySet[set] || {})[u.shot];
      if (!spec) {
        bad.push(`${at}: shot '${u.shot}' is not declared by SET '${set}'`);
      } else {
        if (u.target && !(spec.targets && spec.targets[u.target])) {
          bad.push(`${at}: target '${u.target}' is not in shot '${u.shot}'s anchor tables`);
        }
        if ((u.verb === 'hold' || u.verb === 'release') &&
            !(spec.holds && Object.keys(spec.holds).length)) {
          bad.push(`${at}: hold verb on shot '${u.shot}' with no hold anchor in the shot`);
        }
      }
    }
    if (u.shotAt !== undefined && !u.shot) bad.push(`${at}: shotAt without a shot`);
    if (u.cameo && !u.cap) bad.push(`${at}: cameo needs a caption`);
    if (i > 0 && u.page < units[i - 1].page) bad.push(`${at}: page went backwards`);
    if (i > 0 && u.page !== units[i - 1].page && (u.set || 'shore') === units[i - 1].set &&
        u.beat === units[i - 1].beat) {
      bad.push(`${at}: a page turn inside one beat`);
    }
    // a leaf carries exactly one SET, or the turn has nothing to swap
    const first = units.find((v) => v.page === u.page);
    if ((first.set || 'shore') !== set) {
      bad.push(`${at}: leaf ${u.page} carries two SETs (${first.set} and ${set})`);
    }
  });
  const WANT = 81;
  if (units.length !== WANT) {
    bad.push(`unit count is ${units.length}, the book is ${WANT} ` +
             `(CONTENT-odyssey.md: 76 text units + 5 heads)`);
  }
  for (const b of BEATS) {
    const n = units.filter((u) => ((u.beat || 1) === b.n)).length;
    if (n !== b.units) bad.push(`beat ${b.n} has ${n} units, the ledger says ${b.units}`);
  }
  return bad;
}
"""


def main():
    R = rows()
    expect = {1: 13, 2: 14, 3: 14, 4: 13, 5: 13, 6: 14}
    for b, n in expect.items():
        if len(R.get(b, [])) != n:
            raise SystemExit(f'beat {b}: parsed {len(R.get(b, []))} rows, expected {n}')

    # short-key collisions (the contract reuses 'dawn' and 'return') get a
    # beat suffix so unitByKey stays unambiguous; heads are keyed head<beat>.
    shorts = {}
    for b in range(1, 7):
        for r in R[b]:
            shorts.setdefault(r['id'].split('-', 3)[3], []).append(b)
    dup = {s for s, v in shorts.items() if len(v) > 1 and s != 'head'}

    out = []
    for beat in (1, 2, 3, 4, 5, 6):
        meta = BEAT_META[beat]
        out.append('  /* ================= %s ================= */' % BEAT_BANNER[beat])
        out.append('')
        for r in R[beat]:
            uid = r['id']
            st = dict(S[uid])
            comment = st.pop('c', None)
            short = uid.split('-', 3)[3]
            if short == 'head':
                key = f'head{beat}'
            elif short in dup:
                key = f'{short}{beat}'
            else:
                key = short
            u = {'id': uid, 'key': key}
            if st.get('head'):
                u['head'] = True
                u['num'] = st.pop('num')
                u['text'] = st.pop('text')
                st.pop('head')
            else:
                u['text'] = r['text']
            u['speaker'] = r['speaker']
            for k in ('verb', 'target', 'gateAct', 'gateSfx', 'cue', 'hold',
                      'rest', 'dwell', 'at', 'picks', 'pickOf', 'dial',
                      'wait', 'seg', 'segDur', 'segHold',
                      'endsBeat', 'endsBook'):
                if k in st:
                    u[k] = st.pop(k)
            u['focus'] = st.pop('focus')
            u['page'] = meta['page']
            u['beat'] = beat
            u['set'] = meta['set']
            for k in ('shot', 'shotAt', 'clear', 'drop', 'sfx', 'bed', 'act',
                      'cameo', 'cap', 'fact'):
                if k in st:
                    u[k] = st.pop(k)
            if st:
                raise SystemExit(f'unconsumed staging on {uid}: {st}')
            if u.get('cameo') == 'off':
                u['cameo'] = None
                u.pop('cap', None)

            body = []
            for k in ORDER_KEYS:
                if k in u and u[k] is not None:
                    body.append(f'{k}: {js(u[k])}')
                elif k == 'cameo' and 'cameo' in u:
                    body.append('cameo: null')
            lines, cur = [], ''
            for f in body:
                if len(cur) + len(f) + 2 > 74:
                    lines.append(cur + ',')
                    cur = f
                else:
                    cur = (cur + ', ' + f) if cur else f
            if cur:
                lines.append(cur)
            if comment:
                out.append('  /* %d.%d — %s' % (beat, r['n'], wrap(comment, '')[0]))
                for extra in wrap(comment, '')[1:]:
                    out.append('     ' + extra)
                out.append('   */')
            else:
                out.append('  /* %d.%d */' % (beat, r['n']))
            out.append('  { ' + lines[0])
            for ln in lines[1:]:
                out.append('    ' + ln)
            out[-1] += ' },'
            out.append('')
    print(PROLOGUE + '\n'.join(out) + EPILOGUE)


main()
