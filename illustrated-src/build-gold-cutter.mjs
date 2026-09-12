// THE GOLD STANDARD CUTTER (owner, 12 Sep 2026: "a cookie cutter saying generate
// the new suit in these frames in this area"). Cookie-cutter sheets from Cyber's shipped frames: silhouette masks, inverse
// hole plates, a labelled contact sheet and a registration guide.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=`${root}/art-src/gold-standard/cyber`;
mkdirSync(`${out}/masks`,{recursive:true});mkdirSync(`${out}/holes`,{recursive:true});
const CELL=256,DOME=[128,128,40],PIVOT=[101,125];
const frames=[...Array.from({length:9},(_,i)=>`asc-${i+1}`),...Array.from({length:9},(_,i)=>`desc-${i+1}`),'body','tail','still'];
const file=n=>n==='still'?'cyber.png':`cyber-${n}.png`;
const report=[];
const grid=createCanvas(CELL*9,CELL*2),gg=grid.getContext('2d');
const contact=createCanvas(CELL*9,CELL*2+CELL),cg=contact.getContext('2d');
cg.fillStyle='#1b1b1b';cg.fillRect(0,0,contact.width,contact.height);
for(const [i,name] of frames.entries()){
  const im=await loadImage(`${root}/docs/art/suits/${file(name)}`);
  const c=createCanvas(CELL,CELL),g=c.getContext('2d');g.drawImage(im,0,0);
  const d=g.getImageData(0,0,CELL,CELL),px=d.data;
  const mask=g.createImageData(CELL,CELL),hole=g.createImageData(CELL,CELL);
  let minx=CELL,miny=CELL,maxx=-1,maxy=-1,n=0,sx=0,sy=0;
  for(let p=0,k=0;p<px.length;p+=4,k++){
    const a=px[p+3]>24;const x=k%CELL,y=(k/CELL)|0;
    mask.data[p]=mask.data[p+1]=mask.data[p+2]=255;mask.data[p+3]=a?255:0;
    hole.data[p]=hole.data[p+1]=hole.data[p+2]=0;hole.data[p+3]=a?0:255;
    if(a){n++;sx+=x;sy+=y;if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;}
  }
  const mc=createCanvas(CELL,CELL);mc.getContext('2d').putImageData(mask,0,0);
  const hc=createCanvas(CELL,CELL);hc.getContext('2d').putImageData(hole,0,0);
  writeFileSync(`${out}/masks/cyber-${name}-mask.png`,mc.toBuffer('image/png'));
  writeFileSync(`${out}/holes/cyber-${name}-hole.png`,hc.toBuffer('image/png'));
  report.push({frame:name,source:`docs/art/suits/${file(name)}`,opaquePixels:n,coverage:+(n/(CELL*CELL)).toFixed(4),
    box:[minx,miny,maxx-minx+1,maxy-miny+1],centroid:[+(sx/n).toFixed(1),+(sy/n).toFixed(1)]});
  if(i<18){
    const col=i%9,row=(i/9)|0;
    gg.drawImage(mc,col*CELL,row*CELL);
    cg.drawImage(im,col*CELL,row*CELL);
    cg.globalAlpha=.35;cg.drawImage(mc,col*CELL,row*CELL);cg.globalAlpha=1;
    cg.strokeStyle='#39ff88';cg.lineWidth=1;cg.strokeRect(col*CELL+minx+.5,row*CELL+miny+.5,maxx-minx,maxy-miny);
    cg.fillStyle='#fff';cg.font='bold 14px sans-serif';cg.fillText(name.toUpperCase(),col*CELL+8,row*CELL+20);
    cg.fillStyle='#39ff88';cg.font='11px sans-serif';cg.fillText(`box ${maxx-minx+1}×${maxy-miny+1}`,col*CELL+8,row*CELL+CELL-10);
  }
}
// registration guide: cell, dome, pivot, rest silhouette
const guide=createCanvas(CELL,CELL),qg=guide.getContext('2d');
qg.fillStyle='#000';qg.fillRect(0,0,CELL,CELL);
const still=await loadImage(`${root}/docs/art/suits/cyber.png`);qg.globalAlpha=.5;qg.drawImage(still,0,0);qg.globalAlpha=1;
qg.strokeStyle='#39ff88';qg.lineWidth=1;qg.strokeRect(.5,.5,CELL-1,CELL-1);
qg.beginPath();qg.arc(DOME[0],DOME[1],DOME[2],0,Math.PI*2);qg.strokeStyle='#ffd23f';qg.lineWidth=2;qg.stroke();
qg.beginPath();qg.arc(PIVOT[0],PIVOT[1],4,0,Math.PI*2);qg.fillStyle='#ff3df0';qg.fill();
qg.beginPath();qg.moveTo(0,CELL/2);qg.lineTo(CELL,CELL/2);qg.moveTo(CELL/2,0);qg.lineTo(CELL/2,CELL);qg.strokeStyle='rgba(255,255,255,.25)';qg.lineWidth=1;qg.stroke();
qg.fillStyle='#ffd23f';qg.font='11px sans-serif';qg.fillText('dome 128,128 r40',132,84);qg.fillStyle='#ff3df0';qg.fillText('tail pivot 101,125',6,140);
// third row of the contact sheet: body, tail, still, guide
for(const [j,name] of ['body','tail','still'].entries()){const im=await loadImage(`${root}/docs/art/suits/${file(name)}`);cg.drawImage(im,j*CELL,2*CELL);cg.fillStyle='#fff';cg.font='bold 14px sans-serif';cg.fillText(name.toUpperCase(),j*CELL+8,2*CELL+20);}
cg.drawImage(guide,3*CELL,2*CELL);cg.fillStyle='#fff';cg.fillText('GUIDE',3*CELL+8,2*CELL+20);
cg.fillStyle='#bbb';cg.font='13px sans-serif';cg.fillText('CYBER · gold standard · 256px cells · row 1 climb asc-1..9 · row 2 dive desc-1..9 · green = silhouette box',4*CELL+12,2*CELL+30);
writeFileSync(`${out}/cyber-cutter-grid.png`,grid.toBuffer('image/png'));
writeFileSync(`${out}/cyber-contact-sheet.png`,contact.toBuffer('image/png'));
writeFileSync(`${out}/cyber-guide.png`,guide.toBuffer('image/png'));
writeFileSync(`${out}/measurements.json`,JSON.stringify({cell:CELL,dome:DOME,tailPivot:PIVOT,alphaThreshold:24,frames:report},null,2)+'\n');
console.log(JSON.stringify(report.map(r=>[r.frame,r.coverage,r.box,r.centroid])));
