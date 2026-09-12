"""Read-only candidate registration. Output images are QA overlays, never art."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np, json, hashlib, argparse
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--suit',default='porcelain');parser.add_argument('--preview',default='singles');parser.add_argument('--output',default='independent-registration');args=parser.parse_args()
assert args.suit in ['porcelain','nacre','origamist']
OUT=ROOT/'outputs/cyber-standard-trio'/args.output;OUT.mkdir(parents=True,exist_ok=True)
Y,X=np.mgrid[:256,:256]
# Downweight identity-specific ear/tail regions. This is a geometric overlap
# proposal only; score is not an acceptance threshold or anatomical landmark.
body=(X>=112)&(X<210)&(Y>=133)&(Y<210)
head=(X>=145)&(X<215)&(Y>=96)&(Y<145)
W=body.astype(float)+2*head.astype(float)
def shift(a,dx,dy):
    z=np.zeros_like(a);xs=max(0,-dx);xe=min(256,256-dx);ys=max(0,-dy);ye=min(256,256-dy)
    z[ys+dy:ye+dy,xs+dx:xe+dx]=a[ys:ye,xs:xe];return z
def score(a,b,w=W):return float(2*(a*b*w).sum()/max(1,((a+b)*w).sum()))
def outline(a):
    inner=a.copy()
    for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:inner &= shift(a,dx,dy)
    return a&~inner
rows=[];boards={k:Image.new('RGB',(6*384,3*384),'#101224') for k in ['before','after']}
for j,(bank,n) in enumerate((b,i) for b in ['asc','desc'] for i in range(1,10)):
    p=ROOT/f'outputs/cyber-standard-trio/{args.preview}/{args.suit}-{bank}-{n}.png'
    q=ROOT/f'docs/art/suits/cyber-{bank}-{n}.png'
    im=Image.open(p).convert('RGBA');a=np.array(im);m=(a[:,:,3]>127).astype(float)
    gold=np.array(Image.open(q).convert('RGBA'));g=(gold[:,:,3]>127).astype(float)
    trials=[]
    for dy in range(-16,17):
        for dx in range(-16,17):trials.append((score(shift(m,dx,dy),g),-abs(dx)-abs(dy),dx,dy))
    best=max(trials);v,_,dx,dy=best
    row={'frame':f'{bank}-{n}','offset':[dx,dy],'before':round(score(m,g),4),'after':round(v,4),'source':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    rows.append(row)
    for mode in boards:
        arr=shift(a,dx,dy) if mode=='after' else a
        sprite=Image.fromarray(arr);tile=Image.new('RGBA',(256,256),'#101224');tile.alpha_composite(sprite)
        rgba=np.array(tile);e=outline(g.astype(bool));rgba[e]=[60,255,220,255]
        tile=Image.fromarray(rgba).resize((384,384),Image.Resampling.NEAREST)
        d=ImageDraw.Draw(tile);d.text((6,5),f'{bank}-{n} {dx:+d},{dy:+d}  {row["before"]:.3f} -> {v:.3f}',fill='white')
        boards[mode].paste(tile,(j%6*384,j//6*384))
for key,board in boards.items():board.save(OUT/f'{args.suit}-{key}-overlay.png')
report={'status':'CANDIDATE - visual overlay review required, no acceptance from score','method':'Single uniform scale1, integer whole-image translation maximizing weighted silhouette Dice. Body ROI x112..209,y133..209 weight1; head ROI x145..214,y96..144 weight2. Tail and most ears/antennae excluded. Does not measure a skull center/radius.','records':rows}
(OUT/'registration.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(rows,indent=2))
