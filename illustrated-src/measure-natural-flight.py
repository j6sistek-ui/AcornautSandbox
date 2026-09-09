"""Measure whole painted heads, independently of DOME. Analysis only.

Match the neutral skull/ears/face patch at multiple scales and angles. Review
the resulting circle contacts before export; a socket alone cannot prove fit.
Requires Pillow, NumPy, SciPy; does not modify raster artwork.
"""
from pathlib import Path
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage, signal

SOURCE = Path(__file__).resolve().parent.parent / 'art-src/natural-flight'
seeds = json.loads((SOURCE / 'head-seeds.json').read_text())
selected = set(sys.argv[1:])
result = json.loads((SOURCE/'head-tracks.json').read_text()) if selected and (SOURCE/'head-tracks.json').exists() else {}
for suit, (hx, hy, radius) in seeds.items():
    if selected and suit not in selected:
        continue
    file = SOURCE / f'{suit}-master.png'
    if not file.exists():
        continue
    im = np.asarray(Image.open(file).convert('RGB')).astype(float)
    # Magenta has low luminance here, keeping it distinct from pale fur.
    lum = im[:, :, 0] * .2126 + im[:, :, 1] * .7152 + im[:, :, 2] * .0722
    cw, ch = im.shape[1] / 4, im.shape[0] / 4
    half = int(radius * .87)
    template = lum[hy-half:hy+half+1, hx-half:hx+half+1]
    variants = []
    for angle in range(-20, 26, 5):
        for scale in np.arange(.85, 1.176, .025):
            t = ndimage.zoom(ndimage.rotate(template, angle, reshape=False, mode='nearest'), scale)
            # Odd windows align uniform_filter with fftconvolve's same centre.
            t = t[:t.shape[0]-(t.shape[0]%2==0), :t.shape[1]-(t.shape[1]%2==0)]
            t -= t.mean()
            variants.append((angle, float(scale), t, np.sqrt((t*t).sum())))
    frames = []
    for n in range(16):
        x0, y0 = round(n % 4*cw), round(n//4*ch)
        cell = lum[y0:round((n//4+1)*ch), x0:round((n%4+1)*cw)]
        # Pad with the actual matte, not FFT zeros. Otherwise a partial patch
        # near the right cell border can produce a false correlation above 1.
        cell = np.pad(cell, 64, constant_values=float(lum[0,0]))
        yy, xx = np.mgrid[:cell.shape[0], :cell.shape[1]]
        xx, yy = xx-64, yy-64
        allowed = (xx > cw*.58) & (xx < cw-20) & (yy > 45) & (yy < ch-45)
        best = (-1, None)
        for angle, scale, t, norm in variants:
            area=t.size
            sm=ndimage.uniform_filter(cell,size=t.shape)*area
            ss=ndimage.uniform_filter(cell*cell,size=t.shape)*area
            denom=np.sqrt(np.maximum(1,ss-sm*sm/area))*norm
            score=signal.fftconvolve(cell,t[::-1,::-1],mode='same')/denom
            score[(~allowed)|(score>1.01)]=-1
            y,x=np.unravel_index(score.argmax(),score.shape)
            if score[y,x]>best[0]:
                best=(float(score[y,x]), (int(x)-64,int(y)-64,angle,scale))
        score,(x,y,angle,scale)=best
        frames.append({'head':[x,y,round(radius*scale,3)],'angle':-angle,'scale':round(scale,3),'score':round(score,4)})
    result[suit]={'cell':[cw,ch],'seed':[hx,hy,radius],'frames':frames}
    print(suit, 'min score', min(f['score'] for f in frames), 'scale range', min(f['scale'] for f in frames), max(f['scale'] for f in frames), flush=True)
(SOURCE/'head-tracks.json').write_text(json.dumps(result,indent=2)+'\n')
