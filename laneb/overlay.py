"""Scale a lane-B front render onto the portrait using projected landmarks.
usage: overlay.py <prefix>   -> /tmp/<prefix>_overlay.png  (+ prints deltas)"""
import json, sys
from PIL import Image
O='/Users/samz/Documents/gaslight-remake/assets/plates/king-v2/laneb/'
pre=sys.argv[1]
# portrait landmarks in px (436x446)
PORT=dict(chin=(219,332), crown=(219,66), nose_tip=(215,240), brow=(219,170),
          eye_l=(175,190), eye_r=(262,190), cheek_l=(132,200), cheek_r=(310,200),
          jaw_l=(152,286), jaw_r=(297,286), hairline=(219,132),
          nose_base=(216,248), mouth=(218,268))
m=json.load(open(O+pre+'-marks.json'))
s=(PORT['chin'][1]-PORT['crown'][1])/(m['chin'][1]-m['crown'][1])
dx=PORT['chin'][0]-m['chin'][0]*s; dy=PORT['chin'][1]-m['chin'][1]*s
print("scale %.4f  offset %.1f %.1f"%(s,dx,dy))
print("%-10s %7s %7s %7s %7s"%("mark","dx_px","dy_px","port_x","mdl_x"))
for k,(px,py) in PORT.items():
    mx,my=m[k][0]*s+dx, m[k][1]*s+dy
    print("%-10s %7.1f %7.1f %7.1f %7.1f"%(k, mx-px, my-py, px, mx))
port=Image.open('/Users/samz/Downloads/junze.png').convert('RGB')
r=Image.open(O+pre+'-front.png').convert('RGB')
r=r.resize((max(1,int(r.width*s)), max(1,int(r.height*s))), Image.LANCZOS)
canv=Image.new('RGB',port.size,(0,0,0)); canv.paste(r,(int(dx),int(dy)))
out=Image.blend(port,canv,0.5)
# side by side: portrait | overlay | scaled render
sheet=Image.new('RGB',(port.width*3,port.height),(0,0,0))
sheet.paste(port,(0,0)); sheet.paste(out,(port.width,0)); sheet.paste(canv,(port.width*2,0))
sheet=sheet.resize((sheet.width*2,sheet.height*2), Image.LANCZOS)
sheet.save('/tmp/%s_overlay.png'%pre); print('wrote /tmp/%s_overlay.png'%pre)
