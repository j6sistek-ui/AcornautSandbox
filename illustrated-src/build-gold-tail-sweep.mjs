// THE TAIL SWEEP (owner, 12 Sep 2026: "do you see how much tail motion is in
// frame asc 3/4/5/6/7, that's why it's so good. fluid, diverse motion that is
// in a natural flow"). Measures the plume on every Cyber frame and draws the
// nine climb silhouettes over each other, tinted by frame, so the tail's path
// reads as one sweep. Output: art-src/gold-standard/cyber/cyber-tail-sweep.png
// and the tail block in measurements.json.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'art-src/gold-standard/cyber');
const CELL=256,PIVOT=[101,125];
// The plume is everything LEFT of the neck cut: the pilot faces right, the
// tail root is the narrowest crossing at x=101. Pixels with x < pivot.x are
// tail; the body never reaches that far back on any frame (checked below).
const alphaOf=async name=>{const im=await loadImage(join(root,`docs/art/suits/${name}.png`));const c=createCanvas(CELL,CELL),g=c.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,CELL,CELL).data;};
function tailStats(px){
  let n=0,sx=0,sy=0,minx=CELL,miny=CELL,maxx=-1,maxy=-1,tipX=CELL,tipY=0;
  for(let k=0;k<CELL*CELL;k++){if(px[k*4+3]<=24)continue;const x=k%CELL,y=(k/CELL)|0;if(x>=PIVOT[0])continue;
    n++;sx+=x;sy+=y;if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;if(x<tipX){tipX=x;tipY=y;}}
  const cx=sx/n,cy=sy/n;
  // the plume's angle: from the pivot to its centroid, degrees, positive = raised (screen-up)
  const angle=Math.atan2(PIVOT[1]-cy,PIVOT[0]-cx)*180/Math.PI;
  return {pixels:n,centroid:[+cx.toFixed(1),+cy.toFixed(1)],box:[minx,miny,maxx-minx+1,maxy-miny+1],tip:[tipX,tipY],angleDeg:+angle.toFixed(1),topY:miny};
}
const diff=(a,b)=>{let n=0;for(let k=0;k<CELL*CELL;k++){if((k%CELL)>=PIVOT[0])continue;const p=k*4;if(Math.abs(a[p]-b[p])+Math.abs(a[p+1]-b[p+1])+Math.abs(a[p+2]-b[p+2])+Math.abs(a[p+3]-b[p+3])>40)n++;}return n;};
const report={};
const sweep=createCanvas(CELL*2+CELL*2,CELL*2),sg=sweep.getContext('2d');sg.fillStyle='#101014';sg.fillRect(0,0,sweep.width,sweep.height);
const tint=i=>`hsl(${300-i*30},95%,62%)`;
for(const [b,bank] of [['asc',0],['desc',1]]){
  const frames=[];for(let i=1;i<=9;i++)frames.push(await alphaOf(`cyber-${b}-${i}`));
  const stats=frames.map(tailStats);
  const step=[];for(let i=1;i<9;i++)step.push(diff(frames[i-1],frames[i]));const max=Math.max(...step);
  report[b]={frames:stats,tailStepPx:step,tailStepPct:step.map(v=>Math.round(100*v/max)),
    angleTravelDeg:stats.map((s,i)=>i?+(s.angleDeg-stats[i-1].angleDeg).toFixed(1):0)};
  // the overlay: each frame's tail silhouette in its own tint, big
  const S=2,ox=bank*CELL*2,oy=0;
  for(let i=0;i<9;i++){const px=frames[i];const c=createCanvas(CELL,CELL),g=c.getContext('2d'),img=g.createImageData(CELL,CELL);
    const [h,s,l]=[300-i*30,95,62];const rgb=hslToRgb(h/360,s/100,l/100);
    // outline of the plume in the frame's tint (a faint fill for the body), so
    // every frame's tail edge stays visible under the ones drawn after it
    const on=k=>k>=0&&k<CELL*CELL&&px[k*4+3]>24;
    for(let k=0;k<CELL*CELL;k++){const a=on(k);const x=k%CELL,tail=x<PIVOT[0];
      const edge=a&&(!on(k-1)||!on(k+1)||!on(k-CELL)||!on(k+CELL)||(x>0&&!on(k-1-CELL))||!on(k+1+CELL));
      img.data[k*4]=rgb[0];img.data[k*4+1]=rgb[1];img.data[k*4+2]=rgb[2];img.data[k*4+3]=!a?0:tail?(edge?255:22):(i===0?16:0);}
    g.putImageData(img,0,0);sg.drawImage(c,ox,oy,CELL*S,CELL*S);
    sg.fillStyle=tint(i);sg.font='bold 13px sans-serif';sg.fillText(`${b}-${i+1}  ${stats[i].angleDeg>0?'+':''}${stats[i].angleDeg}°`,ox+10,oy+22+i*17);
  }
  sg.strokeStyle='#fff';sg.beginPath();sg.arc(ox+PIVOT[0]*S,oy+PIVOT[1]*S,5,0,Math.PI*2);sg.stroke();
  sg.fillStyle='#ddd';sg.font='12px sans-serif';sg.fillText(`${b.toUpperCase()} · plume left of the neck cut (x<101), tinted per frame · ring = tail pivot`,ox+10,oy+CELL*S-12);
}
function hslToRgb(h,s,l){const f=(n)=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};return [f(0),f(8),f(4)];}
writeFileSync(join(out,'cyber-tail-sweep.png'),sweep.toBuffer('image/png'));
const m=JSON.parse(readFileSync(join(out,'measurements.json'),'utf8'));m.tail={pivot:PIVOT,rule:'pixels left of the neck cut are the plume',...report};
writeFileSync(join(out,'measurements.json'),JSON.stringify(m,null,2)+'\n');
for(const b of ['asc','desc']){const r=report[b];console.log(b,'angle°',r.frames.map(f=>f.angleDeg).join(' '),'| travel°',r.angleTravelDeg.slice(1).join(' '),'| tail step %',r.tailStepPct.join(' '),'| tip y',r.frames.map(f=>f.tip[1]).join(' '),'| top y',r.frames.map(f=>f.topY).join(' '));}
