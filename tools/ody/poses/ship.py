#!/usr/bin/env python3
"""ship.py -- copy the keyed CREW + RAMS poses into the curated actors dir.
(The manifest merge lives in register2.py -- it conforms to MANIFEST-poses.json's
merge-write law and the sibling lanes' shapes; the original combined script's
merge assumed a list schema and is retired.)"""
import shutil
IDS = ['crew-a-stand','crew-b-stand','crew-row','crew-carry','crew-plead',
       'crew-slung','ram-great','ram-great-slung','ram-walk','ram-pair-slung']
for i in IDS:
    shutil.copy('/tmp/ody-poses/%s.key.png' % i,
                '/Users/samz/Documents/gaslight-remake/assets/plates/odyssey/actors/%s.png' % i)
    print('shipped', i)
