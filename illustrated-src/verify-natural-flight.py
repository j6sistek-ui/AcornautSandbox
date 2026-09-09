"""Owner's exported-pixel boundaries for the natural-flight replacement.

Tail work is the total count of changed premultiplied RGBA pixels farther
than two head radii divided by that within 1.2 radii. A pixel changes when
any channel changes by >24/255; count both empty/ink and painted detail.
Bank transitions use each bank's consecutive pairs; loops include 16 -> 1.
This is an explicit implementation of the brief, not a claim to reproduce
the unpublished implementation behind its example numbers.
"""
from pathlib import Path
from collections import deque
import json, os, hashlib, re, math
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT/'art-src/natural-flight'
ART = Path(os.environ.get('NATURAL_FLIGHT_OUTPUT', ROOT/'docs/art/suits'))
regfile = ART/'natural-export.json' if os.environ.get('NATURAL_FLIGHT_OUTPUT') else SOURCE/'registration.json'
reg = json.loads(regfile.read_text())
draw = (ROOT/'illustrated-src/game/draw.ts').read_text()
dome = {k: [float(x) for x in v.split(',')] for k,v in re.findall(r'"((?:suit:)?[a-z]+(?:-(?:asc|desc)-\d+)?)":\s*\[([^\]]+)\]',draw)}
loops = {'hedgehog','ferret','raccoon'}
expected = {'iontrim','copper','voidsuit','sammie','gemmie','leviathan','ember','frost','ghost'} | loops
assert set(reg['report']) == expected, 'exact requested twelve-character scope'
hashfile=SOURCE/'frame-hashes.json'
hashes=json.loads(hashfile.read_text()) if hashfile.exists() else {}
yy,xx=np.mgrid[:256,:256]
failures=[];results={}

def eye_center(rgba, head, target=None):
    hx,hy,r=head
    mask=(rgba[:,:,:3].max(axis=2)<65)&(rgba[:,:,3]>200)&(xx>hx-6)&(xx<hx+29)&(yy>hy-15)&(yy<hy+23)
    seen=set();groups=[]
    for y,x in zip(*np.where(mask)):
        if (y,x) in seen: continue
        q=deque([(int(y),int(x))]);seen.add((y,x));pts=[]
        while q:
            a,b=q.popleft();pts.append((b,a))
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    p=(a+dy,b+dx)
                    if 0<=p[0]<256 and 0<=p[1]<256 and p not in seen and mask[p]:seen.add(p);q.append(p)
        if 8<=len(pts)<=160:groups.append(np.mean(pts,axis=0))
    if not groups: return None
    aim=np.array(target if target is not None else [hx+9,hy+5])
    return min(groups,key=lambda p:np.linalg.norm(p-aim))

for suit,frames in reg['report'].items():
    arrays=[];heads=np.array([f['head'] for f in frames]);eyes=[];areas=[]
    for i,f in enumerate(frames):
        path=ART/(f['key']+'.png');image=Image.open(path)
        assert image.size==(256,256) and image.mode=='RGBA',str(path)
        data=path.read_bytes();key='suits/'+path.name
        if hashes and hashes.get(key)!=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest():failures.append(key+': reviewed pixel hash changed')
        rgba=np.asarray(image).astype(float);a=rgba[:,:,3]/255
        premult=np.concatenate([rgba[:,:,:3]*a[:,:,None],rgba[:,:,3:]],axis=2)
        arrays.append(premult)
        if (rgba[:2,:,3]>32).any() or (rgba[-2:,:,3]>32).any() or (rgba[:,:2,3]>32).any() or (rgba[:,-2:,3]>32).any():failures.append(f['key']+': clipped ink')
        hx,hy,r=f['head'];inside=(xx-hx)**2+(yy-hy)**2<r*r
        areas.append(float(np.sqrt(((rgba[:,:,3]>32)&inside).sum()/math.pi)))
        if suit not in loops:
            p=eye_center(rgba,f['head'])
            if p is None:failures.append(f['key']+': pupil not found')
            else:eyes.append(p)
            if not os.environ.get('NATURAL_FLIGHT_OUTPUT') and dome.get(f['key'])!=reg['anchors'][f['key']]:failures.append(f['key']+': DOME differs from measured export')
    pairs=[(i,i+1) for i in range(15) if suit in loops or i!=7]
    if suit in loops:pairs.append((15,0))
    near=far=0
    for i,j in pairs:
        center=(heads[i]+heads[j])/2;dist=np.hypot(xx-center[0],yy-center[1]);r=center[2]
        changed=(np.abs(arrays[i]-arrays[j]).max(axis=2)>24)
        near+=int((changed&(dist<=1.2*r)).sum());far+=int((changed&(dist>=2*r)).sum())
    ratio=far/max(1,near)
    # The owner subsequently approved the companion sheet's exact motion.
    # Report its motion measurements, but gate those loops by source locality
    # instead of applying the standard squirrel choreography to other species.
    if suit not in loops and ratio<2.9:failures.append(f'{suit}: tail work {ratio:.2f} < 2.9')
    metrics={'tailWork':round(ratio,3),'nearChangedInk':near,'farChangedInk':far,'paintedHeadRadiusRange':[round(min(areas),2),round(max(areas),2)]}
    if suit not in loops:
        assert np.ptp(heads[:,2])==0 and heads[0,2]==36
        steps=[float(np.linalg.norm(heads[i,:2]-heads[j,:2])) for i,j in pairs]
        drift=[np.linalg.norm(heads[i,:2]-(heads[i-1,:2]+heads[i+1,:2])/2) for i in range(1,15) if i not in (7,8)]
        metrics.update(headXSpan=float(np.ptp(heads[:,0])),maxHeadStep=max(steps),headDrift=float(np.median(drift)))
        if metrics['headXSpan']>15 or metrics['maxHeadStep']>16 or metrics['headDrift']>6:failures.append(suit+': head anchor boundaries exceeded')
        if len(eyes)==16:
            e=np.array(eyes);residual=e-heads[:,:2];span=np.ptp(residual,axis=0)
            metrics['pupilOffsetSpan']=span.round(3).tolist()
            if max(span)>8:failures.append(f'{suit}: painted pupil leaves its registered skull {span}')
        if max(areas)/min(areas)>1.12:failures.append(f'{suit}: painted head area changes by more than 12% in the fitted circle')
        if not np.array_equal(arrays[0],arrays[8]):failures.append(suit+': neutral bank crossing differs')
    results[suit]=metrics
    portrait=ART/(suit+'.png');neutral=ART/(frames[0]['key']+'.png')
    if portrait.read_bytes()!=neutral.read_bytes():failures.append(suit+': portrait differs from neutral pose')
    data=portrait.read_bytes()
    if hashes.get('suits/'+portrait.name)!=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest():failures.append(suit+': portrait hash changed')
    print(suit,json.dumps(metrics),flush=True)
receipt=json.loads((SOURCE/'companion-export-receipt.json').read_text())
assert receipt['excluded']=='panda' and set(receipt['characters'])==loops
for suit,frames in receipt['characters'].items():
    assert len(frames)==16
    for f in frames:
        assert f['outsideRepairChanges']==0
        if suit!='hedgehog':assert f['changedSourceAlphaPixels']==0 and f['tailRegion'] is None
out={'method':__doc__.strip(),'suits':results,'failures':failures}
if os.environ.get('NATURAL_FLIGHT_REPORT'):Path(os.environ['NATURAL_FLIGHT_REPORT']).write_text(json.dumps(out,indent=2)+'\n')
if failures:
    print('FAIL: '+'; '.join(failures));raise SystemExit(1)
print('Natural-flight pixels passed: 192 poses, nine fixed skulls and tail-work boundaries, plus three owner-approved companion loops with localized Quill repair.')
