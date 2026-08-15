#!/usr/bin/env python3
"""Emit the beats II-VII block of units.js.

The TEXT and the PREFIX are lifted out of CONTENT-full.md's own tables, never
retyped -- a transcription typo in Doyle is the one bug this stack cannot see.
The staging fields are authored here from the same tables' staging column plus
the SCENE LEDGER (sec 6).
"""
import json
import re

MD = '/Users/samz/Documents/gaslight-remake/CONTENT-full.md'

ORDER = {'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7}


def rows():
    out = {}
    cur = None
    for line in open(MD):
        m = re.match(r'^### BEAT ([IVX]+)\b', line)
        if m:
            cur = ORDER[m.group(1)]
            out[cur] = []
            continue
        if cur is None:
            continue
        if line.startswith('## '):
            cur = None
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
                         'text': c[5].strip()})
    return out


# --------------------------------------------------------- authored staging
# key -> the fields that are NOT text/speaker. Comments are emitted with them.
S = {
 # ---- BEAT II - SERPENTINE AVENUE - SET street - leaf 2 -------------------
 'ii-00-head': dict(head=True, num='II', text='Serpentine Avenue', verb='auto',
                    dwell=3.4, focus='street', clear=True, bed='street',
                    act='establish',
                    c='arrival on the street SET, wide. The heading leaves the '
                      'page the moment unit 1 arrives.'),
 'ii-01-lodge': dict(verb='click', focus='villa', clear=True, fact='II.1',
                     act='smokeClosed',
                     c='the whole front, the establishing lens. THE HOUSE IS NOT '
                       'ON FIRE - the smoke gate is closed on arrival, which is '
                       'the one thing the reference gets wrong for this book. '
                       'fact II.1: this street and this house are HERS.'),
 'ii-02-following': dict(verb='click', focus='holmes-street', endsBeat=True,
                         clear=True, fact='II.5',
                         c='Watson\'s own voice, no prefix. Its click turns the '
                           'page INTO the told story. fact II.5.'),

 # ---- BEAT III - THE PURSUIT - SET chase - leaf 3 ------------------------
 'iii-00-head': dict(head=True, num='III', text='The Pursuit', verb='auto',
                     dwell=3.4, focus='strip', clear=True, bed='chase',
                     act='establish'),
 'iii-01-hansom': dict(verb='click', focus='door', clear=True, fact='P.1',
                       act='placeCanonOrder', sfx='hoofbeats',
                       c='act placeCanonOrder - HIS HANSOM AT THE LIT DOOR, HER '
                         'LANDAU NOT YET IN THE STREET. Canon has only his cab at '
                         'l.612, and the reference measures the placement rather '
                         'than dodging the shot. fact P.1.'),
 'iii-02-halfhour': dict(verb='click', focus='door'),
 'iii-03-watch': dict(verb='click', focus='door', sfx='watch',
                      c='the gold watch is the prop that reads; it is painted '
                        'into norton-chase.png, so the sfx is what performs it.'),
 'iii-04-devil': dict(verb='click', focus='door', fact='P.2', sfx='whip',
                      c='Doyle\'s nested attribution becomes the prefix (sec 2.1). '
                        'fact P.2.'),
 'iii-05-landau': dict(verb='click', focus='lane', clear=True, seg='chase-intro',
                       segDur=6.0, segHold=True, fact='P.3',
                       c='seg chase-intro (6.0 s): Norton away first; the landau '
                         'up the lane; SHE SHOOTS OUT OF THE HALL DOOR AND BOARDS; '
                         'a cab comes through the street. Canon l.631-632 is CUT - '
                         'the segment performs it (sec 2.4).'),
 'iii-06-shotout': dict(verb='click', focus='her', act='nortonAway',
                        c='act nortonAway - the strip stops dressing him.'),
 'iii-07-stmonica': dict(verb='click', focus='her', fact='P.3'),
 'iii-08-toogood': dict(verb='target', target='cab', gateAct='startPursuit',
                        gateSfx='cab', cue='click the cab · follow her',
                        focus='cab', clear=True, fact='P.4',
                        c='push 1.6 s - DELIBERATELY SHORT: a gate\'s target must '
                          'be reachable the moment its cue asks for it (the '
                          'reference measured the cab off-frame for 16 of the '
                          'first 20 samples at 2.8 s). fact P.4.'),
 'iii-09-shabby': dict(verb='click', focus='cab',
                       c='the pursuit is rolling under this unit.'),
 'iii-10-halfsov': dict(verb='click', focus='cab',
                        c='Doyle\'s own echo of unit 7 - KEEP BOTH (sec 3).'),
 'iii-11-twentyfive': dict(verb='click', focus='away', wait='roll', endsBeat=True,
                           clear=True, fact='P.5',
                           c='wait: roll. Cannot turn before the cab has run the '
                             'strip - the arrival is what turns the page. fact P.5.'),

 # ---- BEAT IV - ST. MONICA'S - SET church - leaf 4 -----------------------
 'iv-00-head': dict(head=True, num='IV', text='St. Monica’s', verb='auto',
                    dwell=3.4, focus='nave', clear=True, bed='church', sfx='bell',
                    act='establish',
                    c='THE HEADING RIDES THE ARRIVAL IN - it carries its own move '
                      'to focus nave, or the page\'s first frame is a church still '
                      'coming out of its own fold.'),
 'iv-01-drovefast': dict(verb='click', focus='nave', clear=True),
 'iv-02-notasoul': dict(verb='click', focus='knot', fact='M.1',
                        c='the three-in-a-knot tableau is the SET\'s rest state. '
                          'fact M.1.'),
 'iv-03-lounged': dict(verb='click', focus='aisle', clear=True, seg='lounge',
                       segDur=6.0, segHold=True, fact='M.2',
                       c='seg lounge (6.0 s) - the witness up the side aisle. '
                         'fact M.2.'),
 'iv-04-facedround': dict(verb='click', focus='aisle', seg='run', segDur=6.0,
                          segHold=True,
                          c='seg run (6.0 s) - Norton runs, then beckons with both '
                            'arms. Doyle NAMES him here.'),
 'iv-05-thankgod': dict(verb='click', focus='aisle', clear=True, cameo='norton',
                        cap='Godfrey Norton',
                        c='cameo norton, first appearance.'),
 'iv-06-whatthen': dict(verb='click', focus='aisle',
                        c='Holmes quoting HIMSELF inside his own account - '
                          'prefixed, not bare (sec 3).'),
 'iv-07-comeman': dict(verb='target', target='norton', gateAct='dragToAltar',
                       cue='click Norton · answer him', focus='aisle', fact='M.3',
                       c='the click ANSWERS him, and being answered is what drags '
                         'Holmes to the altar. fact M.3.'),
 'iv-08-halfdragged': dict(verb='click', focus='knot', clear=True, seg='drag',
                           segDur=6.0, segHold=True, act='glassStart', sfx='glass',
                           c='act glassStart - the three minutes run out on the '
                             'altar\'s own hourglass, scrubbed 0->1 over 11.0 s.'),
 'iv-09-tyingup': dict(verb='click', focus='ring', wait='ring', act='ringScrub',
                       cameo='irene', cap='Irene Norton, née Adler', fact='M.4',
                       c='THE CAMEO CAPTION FLIPS - the King\'s own reveal device, '
                         'used for the chapter\'s one other change of identity. The '
                         'ring lens is MEASURED, not chosen: the church lane reads '
                         'bride 24.0 / clergyman 23.7 / groom 17.3 % of frame '
                         'height at k=1.0, and k=1.13 lands the bride on the '
                         'reference\'s own 27.2. fact M.4.'),
 'iv-10-preposterous': dict(verb='click', focus='ring',
                            c='holds the ring frame.'),
 'iv-11-license': dict(verb='click', focus='knot', clear=True, fact='M.5'),
 'iv-12-sovereigngift': dict(verb='click', focus='coin', wait='sovereign',
                             act='sovereignScrub', fact='M.6',
                             c='bride -> witness -> watch chain, three holders. '
                               'fact M.6.'),
 'iv-13-unexpected': dict(verb='click', focus='nave', clear=True, cameo='off',
                          fact='M.7',
                          c='the told story ends and the reader has his own voice '
                            'back. fact M.7.'),
 'iv-14-menaced': dict(verb='click', focus='nave'),
 'iv-15-separated': dict(verb='click', focus='nave', clear=True),
 'iv-16-parkatfive': dict(verb='click', focus='nave', endsBeat=True, fact='M.8',
                          c='its click turns the page BACK to Serpentine Avenue '
                            'and Beat II resumes. fact M.8.'),

 # ---- BEAT V - (no heading) - SET street - leaf 5 ------------------------
 'v-00-plan1': dict(verb='click', focus='plan', clear=True, bed='street',
                    act='resumeStreet',
                    c='NO CHAPTER HEADING AND NO ESTABLISHING BEAT. The told story '
                      'was an inset; the reader is standing in Serpentine Avenue '
                      'exactly where he left off. Smoke gate still CLOSED.'),
 'v-01-plan2': dict(verb='click', focus='plan',
                    c='names the window the reader will be posted at.'),
 'v-02-watchme': dict(verb='click', focus='plan', fact='II.2'),
 'v-03-signal': dict(verb='click', focus='plan', clear=True, act='signalHand',
                     c='INSET plate-rocket rises (push, then plate; the world dims '
                       'to the painted relight).'),
 'v-04-rocket': dict(verb='click', focus='plan', fact='II.3',
                     c='the inset holds. fact II.3.'),
 'v-05-neutral': dict(verb='target', target='station', gateAct='takeStation',
                      gateSfx='step', focus='station', clear=True,
                      cue='click the chalk ring · take your station at the open window',
                      act='descendToStreet', fact='II.4',
                      c='INSET OFF - the verb happens in the WORLD (Beat I\'s '
                        'noteLift law). act descendToStreet brings the frame down '
                        'to street level and lights the chalk ring. NO PAGE TURN ON '
                        'THIS GATE - Beat VI is the same leaf. fact II.4.'),

 # ---- BEAT VI - THE ALARM OF FIRE - SET street - leaf 5 (SAME LEAF) ------
 'vi-00-head': dict(head=True, num='V', text='The Alarm of Fire', verb='auto',
                    dwell=3.6, focus='window', clear=True,
                    c='NUMERAL V, BEAT 6. Arrives with NO page turn - the heading '
                      'lands on the leaf already mounted.'),
 'vi-01-instinct1': dict(verb='click', focus='window', clear=True, dwell=8.0,
                         fact='III.1a',
                         c='THE GATE DOES NOT ARM HERE - the whole reason must be '
                           'on the page first. fact III.1a.'),
 'vi-02-instinct2': dict(verb='target', target='window', gateAct='fireRuse',
                         gateSfx='rocket', focus='window', fact='III.1b',
                         cue='click the lit window · throw it, and raise the cry of fire — then watch the window',
                         c='facts III.1b + III.2. The throw itself carries NO TEXT '
                           'at all (sec 2.4): Doyle\'s l.880-883 narrates what the '
                           'reader has this instant done with his own hand.'),
 'vi-03-panel': dict(verb='clock', at=3.2, focus='reveal', clear=True,
                     c='arrives as the camera settles on the REVEAL lens.'),
 'vi-04-glimpse': dict(verb='clock', at=5.6, focus='reveal',
                       c='LANDS ON THE PAUSE - she is stopped at the panel with '
                         'her hand up (sec 6.6, +2.45..5.10).'),
 'vi-05-knowwhere': dict(verb='clock', at=8.6, focus='reveal', clear=True,
                         act='disperse', sfx='disperse',
                         c='the crowd loses interest and scatters; the camera eases '
                           'back over 2.4 s.'),
 'vi-06-howfind': dict(verb='clock', at=11.0, focus='reveal'),
 'vi-07-showed': dict(verb='clock', at=13.2, focus='street', endsBeat=True,
                      fact='III.4',
                      c='facts III.3b + III.4. At t+16.6 the camera returns to the '
                        'street\'s composed pose; at t+19.8 THE PAGE TURNS.'),

 # ---- BEAT VII - THE WOMAN - SET room (221B) - leaf 6 --------------------
 'vii-00-head': dict(head=True, num='VI', text='The Woman', verb='auto', dwell=3.4,
                     focus='room', clear=True, bed='hearth', act='establishWoman',
                     c='NUMERAL VI, BEAT 7. Back on the 221B SET - the same plate '
                       'Beat I used, re-dressed. No new room variant (sec 6.2).'),
 'vii-01-letter1': dict(verb='click', focus='two', clear=True, cameo='irene',
                        cap='Irene Norton, née Adler', sfx='paper', seg='woman',
                        segDur=15.0, segHold=False,
                        c='DOCUMENT REGISTER - a thing READ, not a thing said. The '
                          'establishing move belongs to the segment; do not also '
                          'start a camera track or the same move fires twice on one '
                          'frame (sec 5, BEAT VII).'),
 'vii-02-letter2': dict(verb='click', focus='two', fact='IV.1'),
 'vii-03-flight1': dict(verb='click', focus='two', clear=True),
 'vii-04-flight2': dict(verb='click', focus='two', fact='IV.2'),
 'vii-05-indebted': dict(verb='click', focus='client', clear=True, cameo='off',
                         c='THE KING IS ON STAGE in this beat - the unmasked actor, '
                           'reused.'),
 'vii-06-valuemore': dict(verb='click', focus='photo-room', dwell=7.0,
                          act='irenePlateUp',
                          c='INSET plate-irene rises (plateAt 1.4 s, AFTER the '
                            'push). The only time in the book the reader SEES her.'),
 'vii-07-nameit': dict(verb='click', focus='photo-room',
                       c='the inset holds.'),
 'vii-08-thisphoto': dict(verb='click', focus='photo-room', dwell=5.0, fact='IV.3'),
 'vii-09-beaten': dict(verb='click', focus='photo-room', clear=True, drop=True,
                       fact='IV.4',
                       c='drop cap; the inset is still up. fact IV.4.'),
 'vii-10-thewoman': dict(verb='click', focus='photo-room', dwell=9.5, endsBeat=True,
                         endsBook=True, fact='IV.5',
                         c='end card; the inset is still up. Turns to leaf 7, the '
                           'closing card (sec 8.4). fact IV.5.'),
}

BEAT_META = {
    2: dict(page=2, set='street'), 3: dict(page=3, set='chase'),
    4: dict(page=4, set='church'), 5: dict(page=5, set='street'),
    6: dict(page=5, set='street'), 7: dict(page=6, set='room'),
}

ORDER_KEYS = ['id', 'key', 'head', 'num', 'text', 'speaker', 'verb', 'target',
              'gateAct', 'gateSfx', 'cue', 'hold', 'reveal', 'dwell', 'at',
              'wait', 'seg', 'segDur', 'segHold', 'endsBeat', 'endsBook',
              'focus', 'page', 'beat', 'set', 'clear', 'drop', 'sfx', 'bed',
              'act', 'cameo', 'cap', 'fact']


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


def main():
    R = rows()
    out = []
    for beat in (2, 3, 4, 5, 6, 7):
        meta = BEAT_META[beat]
        for r in R[beat]:
            uid = r['id']
            st = dict(S[uid])
            comment = st.pop('c', None)
            short = uid.split('-', 2)[2]
            # 'head' is Beat I's key; a book with six more headings needs six
            # more keys, so a heading is keyed by its own beat.
            u = {'id': uid, 'key': short if short != 'head' else f'head{beat}'}
            if st.get('head'):
                u['head'] = True
                u['num'] = st.pop('num')
                u['text'] = st.pop('text')
                st.pop('head')
            else:
                u['text'] = r['text']
            u['speaker'] = r['speaker']
            for k in ('verb', 'target', 'gateAct', 'gateSfx', 'cue', 'dwell', 'at',
                      'wait', 'seg', 'segDur', 'segHold', 'endsBeat', 'endsBook'):
                if k in st:
                    u[k] = st.pop(k)
            u['focus'] = st.pop('focus')
            u['page'] = meta['page']
            u['beat'] = beat
            u['set'] = meta['set']
            for k in ('clear', 'drop', 'sfx', 'bed', 'act', 'cameo', 'cap', 'fact'):
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
            # pack the fields onto lines
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
    print('\n'.join(out))


main()
