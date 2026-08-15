#!/usr/bin/env python3
"""ba.py -- the BEFORE / AFTER contact sheet this lane is judged on.

Two rows on the same backing, same scale, labelled, plus a head zoom under each
pair, because the whole defect class is a face seen at 15-30 px on the plate and
a face is the one thing a full-figure sheet is too small to settle.
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
BG=(16,19,30)
def flat(p):
    im=Image.open(p).convert('RGBA'); b=Image.new('RGBA',im.size,BG+(255,)); b.alpha_composite(im); return b.convert('RGB')
def head(p, frac=0.24, cells=1):
    im=Image.open(p).convert('RGBA')
    if cells>1: im=im.crop((0,0,im.width//cells,im.height))
    a=np.asarray(im)[...,3]; ys,xs=np.where(a>12)
    y0,y1=ys.min(),ys.max(); hy=y0+int((y1-y0)*frac)
    band=a[y0:hy]; bx=np.where(band.max(0)>12)[0]
    c=im.crop((max(0,bx.min()-8),max(0,y0-8),min(im.width,bx.max()+8),hy))
    b=Image.new('RGBA',c.size,BG+(255,)); b.alpha_composite(c); return b.convert('RGB')
def font(s):
    try: return ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',s)
    except Exception: return ImageFont.load_default()
def main():
    out=sys.argv[1]; title=sys.argv[2]
    pairs=[]
    for spec in sys.argv[3:]:
        lab,before,after,cells=spec.split('|')
        pairs.append((lab,before,after,int(cells)))
    FH,HH,GAP=620,300,18
    cols=[]
    for lab,b,a,cells in pairs:
        fb,fa=flat(b),flat(a)
        hb,ha=head(b,0.24,cells),head(a,0.24,cells)
        for im in (fb,fa): im.thumbnail((900,FH),Image.LANCZOS)
        for im in (hb,ha): im.thumbnail((900,HH),Image.LANCZOS)
        w=max(fb.width,fa.width,hb.width,ha.width)
        cols.append((lab,fb,fa,hb,ha,w))
    W=sum(c[5]+GAP for c in cols)+GAP
    H=52+FH+8+FH+10+HH+8+HH+40
    s=Image.new('RGB',(W,H),(8,10,16)); d=ImageDraw.Draw(s)
    d.text((GAP,14),title,fill=(255,255,255),font=font(30))
    x=GAP
    for lab,fb,fa,hb,ha,w in cols:
        y=52
        d.text((x,y-2),lab,fill=(180,190,210),font=font(19)); y+=22
        for im,tag in ((fb,'BEFORE'),(fa,'AFTER')):
            s.paste(im,(x+(w-im.width)//2,y))
            d.text((x+4,y+4),tag,fill=(255,120,120) if tag=='BEFORE' else (140,255,170),font=font(20))
            y+=FH+8
        for im in (hb,ha):
            s.paste(im,(x+(w-im.width)//2,y)); y+=HH+8
        x+=w+GAP
    s.save(out); print(out,s.size)
main()
