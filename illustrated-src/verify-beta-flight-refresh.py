"""Pixel measurements for the five newly generated flight banks; no image edits."""
from pathlib import Path
import json, hashlib, re
from PIL import Image
import numpy as np
from scipy import ndimage
ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'art-src/beta-flight-refresh'
reg=json.loads((source/'registration.json').read_text())
draw=(ROOT/'illustrated-src/game/draw.ts').read_text()
report={};problems=[]
def hsv(a):
    rgb=a[:,:,:3].astype(float)/255;hi=rgb.max(2);lo=rgb.min(2);delta=hi-lo
    h=np.zeros_like(hi);nz=delta>0
    for c in range(3):
        m=(hi==rgb[:,:,c])&nz
        h[m]=((rgb[:,:,(c+1)%3][m]-rgb[:,:,(c+2)%3][m])/delta[m]+2*c)%6/6
    return np.stack([h,delta/np.maximum(hi,1e-6),hi],axis=2)
for suit,frames in reg.items():
    images=[];rows=[]
    for f in frames:
        path=ROOT/'docs/art/suits'/f"{f['name']}.png"
        im=Image.open(path);assert im.mode=='RGBA' and im.size==(256,256)
        a=np.array(im);images.append(path.read_bytes());solid=a[:,:,3]>=16
        yy,xx=np.nonzero(solid);margin=int(min(xx.min(),yy.min(),255-xx.max(),255-yy.max()))
        if margin<12:problems.append(f"{f['name']}: {margin}px margin")
        labels,count=ndimage.label(solid,np.ones((3,3)));sizes=np.bincount(labels.ravel());sizes[0]=0
        if sum(sizes>=32)!=1:problems.append(f"{f['name']}: disconnected painting")
        hx,hy,hr=f['head'];Y,X=np.mgrid[:256,:256];col=hsv(a)
        warm=(col[:,:,0]>.035)&(col[:,:,0]<.145)&(col[:,:,1]>.4)&(col[:,:,2]>.2)&solid
        face=warm&((X-hx)**2+(Y-hy)**2<(hr*.75)**2)
        angle=np.deg2rad(f['pitch']);along=(X-hx)*np.cos(angle)+(Y-hy)*np.sin(angle)
        # Isolate the connected plume, rather than mixing warm armor/boots
        # into its median when the limbs straighten behind the skull.
        candidates=warm&(along<-hr*1.05)&(col[:,:,0]<.095)
        tail_labels,_=ndimage.label(candidates,np.ones((3,3)))
        tail_sizes=np.bincount(tail_labels.ravel());tail_sizes[0]=0
        tail=tail_labels==tail_sizes.argmax()
        med=lambda mask:np.median(col[mask],axis=0).round(4).tolist()
        rows.append({'name':f['name'],'margin':margin,'solidPixels':int(solid.sum()),'faceHSV':med(face),'tailHSV':med(tail),'sha256':hashlib.sha256(images[-1]).hexdigest()})
        m=re.search('"'+f['name']+r'":\s*\[([^\]]+)\]',draw)
        expected=[*f['head'],round(f['helmetRotation'],2)]
        if not m or [float(x) for x in m.group(1).split(',')]!=expected:problems.append(f"{f['name']}: fitted helmet anchor mismatch")
    assert images[0]==images[8],f'{suit}: neutral crossing must be byte-identical'
    assert len(set(images))==15,f'{suit}: expected 15 distinct paintings and shared neutral'
    for key in ['faceHSV','tailHSV']:
        values=np.array([r[key] for r in rows]);spread=np.ptp(values,axis=0)
        if spread[0]>.025 or spread[1]>.15 or spread[2]>.18:problems.append(f'{suit}: {key} spread {spread.round(3).tolist()}')
    report[suit]={'minimumMargin':min(r['margin'] for r in rows),'faceHSVSpread':np.ptp([r['faceHSV'] for r in rows],axis=0).round(4).tolist(),'tailHSVSpread':np.ptp([r['tailHSV'] for r in rows],axis=0).round(4).tolist(),'frames':rows}
(source/'review/pixel-measurements.json').write_text(json.dumps({'suits':report,'problems':problems},indent=2)+'\n')
for s,v in report.items():print(s,'margin',v['minimumMargin'],'face',v['faceHSVSpread'],'tail',v['tailHSVSpread'])
assert not problems,'\n'.join(problems)
print('PASS: 80 RGBA frames, complete silhouettes, 5 exact neutral crossings, fitted anchors, stable fur hue.')
