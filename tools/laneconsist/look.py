import sys, os
from PIL import Image
outp=sys.argv[1]; specs=sys.argv[2:]
ims=[]
for s in specs:
    p=s; 
    im=Image.open(p).convert('RGBA')
    bg=Image.new('RGBA',im.size,(20,24,40,255)); bg.alpha_composite(im); ims.append((os.path.basename(p),bg.convert('RGB')))
H=900
scaled=[(n,im.resize((max(1,int(im.width*H/im.height)),H),Image.LANCZOS)) for n,im in ims]
W=sum(i.width+20 for _,i in scaled)
sheet=Image.new('RGB',(W,H+30),(10,12,18))
from PIL import ImageDraw,ImageFont
d=ImageDraw.Draw(sheet)
try: f=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',18)
except: f=ImageFont.load_default()
x=0
for n,i in scaled:
    sheet.paste(i,(x,0)); d.text((x+4,H+5),n,fill=(230,230,230),font=f); x+=i.width+20
sheet.save(outp); print(outp, sheet.size)
