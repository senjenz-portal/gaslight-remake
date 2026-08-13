from PIL import Image, ImageDraw, ImageFont
import numpy as np, os
ROOT='/Users/samz/Documents/gaslight-remake'
A=os.path.join(ROOT,'site-deploy/living/assets/actor')
C=os.path.join(ROOT,'site-deploy/living/assets/cameo')
def head(p, cell=0, cells=1, frac=0.30):
    im=Image.open(p).convert('RGBA')
    if cells>1:
        w=im.width//cells; im=im.crop((cell*w,0,(cell+1)*w,im.height))
    a=np.asarray(im)[...,3]
    ys,xs=np.where(a>16)
    if len(ys)==0: return im
    y0,y1,x0,x1=ys.min(),ys.max(),xs.min(),xs.max()
    h=y1-y0
    hy1=y0+int(h*frac)
    sub=im.crop((x0,y0,x1+1,hy1))
    return sub
def cam(p, box):
    return Image.open(p).convert('RGBA').crop(box)
items=[
 ('cameo holmes', cam(os.path.join(C,'holmes.jpg'),(560,60,1000,520))),
 ('street clergy', head(os.path.join(A,'holmes-street.png'))),
 ('chase (unused)', head(os.path.join(A,'holmes-chase.png'))),
 ('church stand', head(os.path.join(A,'holmes-church.png'))),
 ('church altar', head(os.path.join(A,'holmes-church-altar.png'))),
 ('church walk f1', head(os.path.join(A,'holmes-church-walk.png'),0,4)),
 ('cameo irene', cam(os.path.join(C,'irene.jpg'),(600,180,1060,640))),
 ('irene street', head(os.path.join(A,'irene-street.png'))),
 ('irene chase', head(os.path.join(A,'irene-chase.png'))),
 ('irene board', head(os.path.join(A,'irene-board.png'))),
 ('irene walk f1', head(os.path.join(A,'irene-walk.png'),0,4)),
 ('irene bride', head(os.path.join(A,'irene-bride.png'))),
]
CW,CH=300,340
sheet=Image.new('RGB',(CW*6,CH*2),(14,16,24))
d=ImageDraw.Draw(sheet)
try: f=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',20)
except: f=ImageFont.load_default()
for i,(lab,im) in enumerate(items):
    x=(i%6)*CW; y=(i//6)*CH
    im=im.convert('RGB') if im.mode!='RGBA' else Image.alpha_composite(Image.new('RGBA',im.size,(14,16,24,255)),im).convert('RGB')
    im.thumbnail((CW-16,CH-50),Image.LANCZOS)
    sheet.paste(im,(x+(CW-im.width)//2,y+8))
    d.text((x+8,y+CH-30),lab,fill=(255,255,255),font=f)
sheet.save(os.path.join(ROOT,'review/consistency/faces-zoom.png'))
print('ok',sheet.size)
