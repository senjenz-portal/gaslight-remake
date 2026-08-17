#!/usr/bin/env python3
"""Placement-audit crop tool: map plate px -> round-7 shot px, cut annotated
evidence crops. Calibrated off b1-01-head1 (k=1): origin (1020,420), S=1.252."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = '/Users/samz/Documents/gaslight-remake'
SHOTS = ROOT + '/shots/ody-round7'
CROPS = ROOT + '/tools/ody/seamless/crops'
PLATE_W, PLATE_H = 1408, 768
OX, OY, S = 1020, 420, 1.252

FOCUS = {  # lens tables, sets/*.js verbatim
 'shore': {'establishing':(704,384,1.0),'smoke':(980,205,1.9),'council':(505,470,2.2),
  'camp-fire':(430,468,2.4),'ship-mid':(560,470,3.0),'skin-close':(560,470,4.5),
  'cavemouth-push-from':(850,345,1.6),'cavemouth-push-to':(1008,290,2.6),
  'crag-tilt':(1050,165,2.4)},
 'cave': {'establishing':(704,384,1.0),'racks-sweep':(700,300,2.0),
  'doorlight-hinge':(480,400,2.2),'mouth':(345,340,2.4),'discovery-low':(900,430,1.8),
  'eye-close':(745,295,3.6),'twoshot':(700,400,2.6),'meal-close':(780,430,2.8),
  'sword':(740,440,3.2),'scheme-push':(640,470,3.0),'club-wide':(880,360,1.6),
  'lots-overhead':(600,490,3.0),'bowl-close':(690,440,3.4),'face-flush':(710,380,4.0),
  'ember-close':(655,450,3.8),'drive-tight':(644,505,3.4),'ram-close':(838,425,3.2),
  'handpass-tight':(370,400,3.6),'doorway-twoshot':(370,380,3.0),
  'freed-overshoulder':(430,430,2.0)},
 'sea': {'establishing':(704,384,1.0),'gate-wide':(610,325,1.29),'stern':(530,430,2.8),
  'ship-deck':(575,450,2.6),'clifftop':(870,195,2.8),'curse':(870,180,2.2),
  'strait':(585,330,2.0),'homeward':(575,380,2.6),'moonpath':(590,340,3.2)},
}

def cam(cx, cy, k):
    X = min(0.0, max(PLATE_W - PLATE_W*k, PLATE_W/2 - cx*k))
    Y = min(0.0, max(PLATE_H - PLATE_H*k, PLATE_H/2 - cy*k))
    return X, Y

def to_shot(px, py, lens, wk=1.0):
    """plate px -> shot px; wk = sea world scale about (575,450)"""
    if wk != 1.0:
        px = 575 + (px-575)*wk; py = 450 + (py-450)*wk
    cx, cy, k = lens
    X, Y = cam(cx, cy, k)
    return OX + (px*k + X)*S, OY + (py*k + Y)*S

def crop_shot(shotfile, lens, box, out, marks=(), boxes=(), lines=(), wk=1.0, mag=1.0, grid=0):
    """box = plate-space (x0,y0,x1,y1); marks=[(x,y,label,color)];
    boxes=[(x0,y0,x1,y1,label,color)]; lines=[((x1,y1),(x2,y2),color)]"""
    im = Image.open(os.path.join(SHOTS, shotfile)).convert('RGB')
    p0 = to_shot(box[0], box[1], lens, wk); p1 = to_shot(box[2], box[3], lens, wk)
    x0, y0 = max(0,int(p0[0])), max(0,int(p0[1]))
    x1, y1 = min(im.width,int(p1[0])), min(im.height,int(p1[1]))
    im = im.crop((x0, y0, x1, y1))
    if mag != 1.0:
        im = im.resize((int(im.width*mag), int(im.height*mag)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    def sp(px, py):
        sx, sy = to_shot(px, py, lens, wk)
        return (sx-x0)*mag, (sy-y0)*mag
    if grid:  # plate-px grid
        gx = box[0] - box[0] % grid
        while gx <= box[2]:
            a = sp(gx, box[1]); b = sp(gx, box[3])
            d.line([a,b], fill=(90,90,90), width=1); gx += grid
        gy = box[1] - box[1] % grid
        while gy <= box[3]:
            a = sp(box[0], gy); b = sp(box[2], gy)
            d.line([a,b], fill=(90,90,90), width=1); gy += grid
    for (lx1,ly1),(lx2,ly2),col in lines:
        d.line([sp(lx1,ly1), sp(lx2,ly2)], fill=col, width=2)
    for bx0,by0,bx1,by1,label,col in boxes:
        d.rectangle([sp(bx0,by0), sp(bx1,by1)], outline=col, width=2)
        if label: d.text((sp(bx0,by0)[0], sp(bx0,by0)[1]-14), label, fill=col)
    for mx,my,label,col in marks:
        cx_,cy_ = sp(mx,my)
        d.line([(cx_-9,cy_),(cx_+9,cy_)], fill=col, width=2)
        d.line([(cx_,cy_-9),(cx_,cy_+9)], fill=col, width=2)
        if label: d.text((cx_+6, cy_+4), label, fill=col)
    im.save(os.path.join(CROPS, out))
    return out

def crop_plate(platefile, box, out, marks=(), boxes=(), lines=(), mag=3.0, grid=10):
    """crop straight from a 1408x768 master with a plate-px grid"""
    im = Image.open(ROOT + '/site-deploy/living-odyssey/assets/' + platefile).convert('RGB')
    im = im.crop(box)
    im = im.resize((int((box[2]-box[0])*mag), int((box[3]-box[1])*mag)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    def sp(px, py): return (px-box[0])*mag, (py-box[1])*mag
    if grid:
        gx = box[0] - box[0] % grid
        while gx <= box[2]:
            a = sp(gx, box[1]); b = sp(gx, box[3])
            col = (200,200,60) if gx % (grid*5) == 0 else (90,90,90)
            d.line([a,b], fill=col, width=1)
            if gx % (grid*5) == 0: d.text((a[0]+2, 2), str(gx), fill=(230,230,120))
            gx += grid
        gy = box[1] - box[1] % grid
        while gy <= box[3]:
            a = sp(box[0], gy); b = sp(box[2], gy)
            col = (200,200,60) if gy % (grid*5) == 0 else (90,90,90)
            d.line([a,b], fill=col, width=1)
            if gy % (grid*5) == 0: d.text((2, a[1]+2), str(gy), fill=(230,230,120))
            gy += grid
    for (lx1,ly1),(lx2,ly2),col in lines:
        d.line([sp(lx1,ly1), sp(lx2,ly2)], fill=col, width=2)
    for bx0,by0,bx1,by1,label,col in boxes:
        d.rectangle([sp(bx0,by0), sp(bx1,by1)], outline=col, width=2)
        if label: d.text((sp(bx0,by0)[0]+2, sp(bx0,by0)[1]+2), label, fill=col)
    for mx,my,label,col in marks:
        cx_,cy_ = sp(mx,my)
        d.line([(cx_-10,cy_),(cx_+10,cy_)], fill=col, width=2)
        d.line([(cx_,cy_-10),(cx_,cy_+10)], fill=col, width=2)
        if label: d.text((cx_+7, cy_+5), label, fill=col)
    im.save(os.path.join(CROPS, out))
    return out
