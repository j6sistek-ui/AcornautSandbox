from pathlib import Path
import json
from PIL import Image
import numpy as np
from scipy import ndimage, signal
p=Path(__file__).resolve().parent.parent/'art-src/beta-flight-refresh'
cfg=json.loads((p/'landmarks-seed.json').read_text())
for suit,v in cfg.items():
    im=np.asarray(Image.open(p/f'{suit}-master.png').convert('RGB')).astype(float)
    lum=im[:,:,0]*.299+im[:,:,1]*.587+im[:,:,2]*.114
    ex,ey=v['eye'];head=v['head']
    template=lum[ey-14:ey+15,ex-11:ex+12]
    variants=[]
    for angle in range(-30,46,5):
        for scale in [.9,.925,.95,.975,1,1.025,1.05,1.075,1.1]:
            t=ndimage.zoom(ndimage.rotate(template,angle,reshape=False,mode='nearest'),scale)
            t-=t.mean();variants.append((angle,float(scale),t,np.sqrt((t*t).sum())))
    v['frames']=[];v['tracking']=[]
    for n,pelvis in enumerate(v['pelvis']):
        x0,y0=round(n%4*313.5),round(n//4*313.5)
        cell=lum[y0:y0+313,x0:x0+313]
        yy,xx=np.mgrid[:cell.shape[0],:cell.shape[1]]
        allowed=(xx>180)&(xx<285)&(yy>75)&(yy<250)
        best=(-1,None)
        for angle,scale,t,norm in variants:
            area=t.size;sm=ndimage.uniform_filter(cell,size=t.shape)*area;ss=ndimage.uniform_filter(cell*cell,size=t.shape)*area
            denom=np.sqrt(np.maximum(1,ss-sm*sm/area))*norm
            score=signal.fftconvolve(cell,t[::-1,::-1],mode='same')/denom
            score[(~allowed)|(score>1.01)]=-1
            y,x=np.unravel_index(score.argmax(),score.shape)
            if score[y,x]>best[0]:best=(float(score[y,x]),(int(x),int(y),angle,scale))
        score,(x,y,angle,scale)=best
        a=-np.deg2rad(angle);dx,dy=head[0]-ex,head[1]-ey
        hx=x+scale*(dx*np.cos(a)-dy*np.sin(a));hy=y+scale*(dx*np.sin(a)+dy*np.cos(a))
        v['frames'].append([round(float(hx),2),round(float(hy),2),round(head[2]*scale,2),*pelvis])
        v['tracking'].append({'score':round(score,3),'eye':[x,y],'angle':angle,'scale':scale})
        print(suit,n+1,round(score,3),v['frames'][-1],flush=True)
(p/'landmarks.json').write_text(json.dumps(cfg,indent=2)+'\n')
