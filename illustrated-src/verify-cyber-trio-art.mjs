// Reproducible pixel measurements, review sheets, and structural shipping gates.
// Color/feature identity and anatomical plausibility still require visual review.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const {createCanvas,loadImage}=createRequire(import.meta.url)(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),partial=args.includes('--partial');
const selected=args.includes('--suit')?args[args.indexOf('--suit')+1]:null;
const preview=args.includes('--preview')?args[args.indexOf('--preview')+1]:null;
assert(!preview||/^[a-z0-9-]+$/.test(preview),'Preview name must be a simple slug');
const out=join(root,'outputs/cyber-standard-trio',preview?`${preview}/qa`:'qa');
const artPath=(id,name)=>join(root,id==='cyber'||!preview?'docs/art/suits':`outputs/cyber-standard-trio/${preview}`,name);
const ids=['cyber',...(selected?[selected]:['porcelain','nacre','origamist'])];
assert(ids.every(id=>['cyber','porcelain','nacre','origamist'].includes(id)),'Unknown suit');
mkdirSync(out,{recursive:true});
const S=256,ALPHA=24,PIVOT=[101,125],round=n=>Number(n.toFixed(3));
const faults=[],warnings=[],report={alphaThreshold:ALPHA,tailProxy:'Pixels x<101, matching Cyber measurement; this is not a anatomical tail mask.',
  headProxy:'Fixed source region x137..215 y60..145; reports registered skull movement without independent fitting. Ears/antennae may differ by design.',suits:{}};
const data=async path=>{const im=await loadImage(path);assert.equal(im.width,S,path);assert.equal(im.height,S,path);const c=createCanvas(S,S),g=c.getContext('2d');g.drawImage(im,0,0);return {image:im,pixels:g.getImageData(0,0,S,S).data};};
function stat(px,region=()=>true){
  let count=0,x0=S,y0=S,x1=-1,y1=-1,sx=0,sy=0,r=0,g=0,b=0,margin=S;
  for(let k=0;k<S*S;k++){const x=k%S,y=k/S|0,p=k*4;if(px[p+3]<=ALPHA||!region(x,y))continue;
    count++;sx+=x;sy+=y;r+=px[p];g+=px[p+1];b+=px[p+2];x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);margin=Math.min(margin,x,y,255-x,255-y);}
  return {pixels:count,coverage:round(count/65536),box:[x0,y0,x1-x0+1,y1-y0+1],centroid:count?[round(sx/count),round(sy/count)]:null,
    meanRGB:count?[round(r/count),round(g/count),round(b/count)]:null,margin};
}
function diff(a,b,region=()=>true){let rgba=0,silhouette=0,intersection=0,union=0;
  for(let k=0;k<S*S;k++){const x=k%S,y=k/S|0,p=k*4;if(!region(x,y))continue;const aa=a[p+3]>ALPHA,bb=b[p+3]>ALPHA;
    if(aa||bb)union++;if(aa&&bb)intersection++;if(aa!==bb)silhouette++;
    if(Math.abs(a[p]-b[p])+Math.abs(a[p+1]-b[p+1])+Math.abs(a[p+2]-b[p+2])+Math.abs(a[p+3]-b[p+3])>40)rgba++;}
  return {rgbaPixels:rgba,silhouettePixels:silhouette,iou:round(intersection/Math.max(1,union))};
}
function islands(px){const seen=new Uint8Array(S*S),q=new Int32Array(S*S),counts=[];
  for(let p=0;p<S*S;p++){if(seen[p]||px[p*4+3]<=ALPHA)continue;let r=0,w=1;q[0]=p;seen[p]=1;
    while(r<w){const k=q[r++],x=k%S,y=k/S|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy||x+dx<0||x+dx>=S||y+dy<0||y+dy>=S)continue;const n=(y+dy)*S+x+dx;if(!seen[n]&&px[n*4+3]>ALPHA){seen[n]=1;q[w++]=n;}}}
    counts.push(w);}
  return counts.sort((a,b)=>b-a);
}
const raw={};
for(const id of ids){
  report.suits[id]={};raw[id]={};
  const contact=createCanvas(9*S,3*S),cg=contact.getContext('2d');cg.fillStyle='#171825';cg.fillRect(0,0,contact.width,contact.height);
  // Fixed source crops preserve relative scale/registration while making suit
  // ornaments large enough to audit for feature and visibility changes.
  const detailSpecs={head:[137,55,80,95],body:[98,120,110,86]};
  const details=Object.fromEntries(Object.entries(detailSpecs).map(([key,box])=>{
    const canvas=createCanvas(box[2]*3*3,box[3]*3*6),g=canvas.getContext('2d');g.fillStyle='#171825';g.fillRect(0,0,canvas.width,canvas.height);return [key,canvas];}));
  for(const [row,bank] of ['asc','desc'].entries()){
    const frames=[],stats=[];
    for(let i=1;i<=9;i++){
      const path=artPath(id,`${id}-${bank}-${i}.png`);
      if(!existsSync(path)){if(partial)continue;faults.push(`${id}/${bank}-${i}: missing`);continue;}
      const f=await data(path),s=stat(f.pixels),tail=stat(f.pixels,x=>x<PIVOT[0]),head=stat(f.pixels,(x,y)=>x>=137&&x<=215&&y>=60&&y<=145);
      const components=islands(f.pixels),angle=tail.centroid?round(Math.atan2(PIVOT[1]-tail.centroid[1],PIVOT[0]-tail.centroid[0])*180/Math.PI):null;
      f.frameNumber=i;frames.push(f);stats.push({frameNumber:i,...s,headProxy:head,tailProxy:{...tail,angleDeg:angle},components:components.slice(0,10)});
      if(s.margin<8)faults.push(`${id}/${bank}-${i}: only${s.margin}px transparent margin`);
      if(s.pixels<2000||s.pixels>24000)faults.push(`${id}/${bank}-${i}: opaque coverage outside sprite range`);
      if(components.slice(1).some(v=>v>12))warnings.push(`${id}/${bank}-${i}: detached alpha components ${components.slice(1).filter(v=>v>12)}`);
      cg.drawImage(f.image,(i-1)*S,row*S);cg.fillStyle='#fff';cg.font='14px sans-serif';cg.fillText(`${id} ${bank}-${i}`,(i-1)*S+8,row*S+22);
      for(const [key,[x,y,w,h]] of Object.entries(detailSpecs)){
        const g=details[key].getContext('2d'),dx=(i-1)%3*w*3,dy=(Math.floor((i-1)/3)+row*3)*h*3;
        g.drawImage(f.image,x,y,w,h,dx,dy,w*3,h*3);g.fillStyle='#fff';g.font='14px sans-serif';g.fillText(`${bank}-${i}`,dx+6,dy+18);
      }
      cg.fillStyle='#aaa';cg.font='11px sans-serif';cg.fillText(`${s.box[2]}x${s.box[3]} ${(s.coverage*100).toFixed(1)}% angle${angle}°`,(i-1)*S+8,(row+1)*S-10);
    }
    raw[id][bank]=frames;
    const pairs=frames.slice(1).map((f,i)=>[frames[i],f]).filter(([a,b])=>b.frameNumber===a.frameNumber+1);
    const steps=pairs.map(([a,b])=>diff(a.pixels,b.pixels));
    const tailSteps=pairs.map(([a,b])=>diff(a.pixels,b.pixels,x=>x<101));
    const headSteps=pairs.map(([a,b])=>diff(a.pixels,b.pixels,(x,y)=>x>=137&&x<=215&&y>=60&&y<=145));
    const bodySteps=pairs.map(([a,b])=>diff(a.pixels,b.pixels,(x,y)=>x>=112&&y>=125));
    const max=Math.max(1,...steps.map(v=>v.rgbaPixels)),ratios=steps.map(v=>round(v.rgbaPixels/max));
    const maxTail=Math.max(1,...tailSteps.map(v=>v.rgbaPixels)),tailRatios=tailSteps.map(v=>round(v.rgbaPixels/maxTail));
    if(frames.length&&Math.min(...ratios)<.6)warnings.push(`${id}/${bank}: neighbor pixel step min${Math.min(...ratios)} <0.6 Cyber target`);
    report.suits[id][bank]={frames:stats,stepFramePairs:pairs.map(([a,b])=>[a.frameNumber,b.frameNumber]),steps,stepRatios:ratios,tailSteps,tailStepRatios:tailRatios,headSteps,bodySteps};
  }
  for(const [col,part] of ['','-body','-tail'].entries()){
    const path=artPath(id,`${id}${part}.png`);if(existsSync(path)){cg.drawImage((await data(path)).image,col*S,2*S);cg.fillStyle='#fff';cg.fillText(part||'still',col*S+8,2*S+22);}}
  writeFileSync(join(out,`${id}-contact.png`),contact.toBuffer('image/png'));
  for(const [key,canvas] of Object.entries(details))writeFileSync(join(out,`${id}-${key}-details.png`),canvas.toBuffer('image/png'));
}
for(const id of ids.filter(v=>v!=='cyber')){
  for(const bank of ['asc','desc']){
    const fs=raw[id][bank],cyber=raw.cyber[bank],bankReport=report.suits[id][bank];
    bankReport.versusCyber=fs.map((f,i)=>({frameNumber:f.frameNumber,...diff(cyber[f.frameNumber-1].pixels,f.pixels),
      coverageRatio:round(bankReport.frames[i].pixels/report.suits.cyber[bank].frames[f.frameNumber-1].pixels),
      headCentroidDelta:bankReport.frames[i].headProxy.centroid?.map((v,k)=>round(v-report.suits.cyber[bank].frames[f.frameNumber-1].headProxy.centroid[k]))}));
    if(fs.length===9){
      const baseline=report.suits.cyber[bank],bodyMotion=bankReport.bodySteps.reduce((n,s)=>n+s.silhouettePixels,0),goldBodyMotion=baseline.bodySteps.reduce((n,s)=>n+s.silhouettePixels,0);
      bankReport.bodySilhouetteMotionRatio=round(bodyMotion/goldBodyMotion);
      if(bodyMotion/goldBodyMotion<.65)warnings.push(`${id}/${bank}: body silhouette movement only${Math.round(100*bodyMotion/goldBodyMotion)}% of Cyber; inspect frozen limbs/body`);
      const angles=bankReport.frames.map(f=>f.tailProxy.angleDeg);
      bankReport.tailAngleDeltaVsCyber=angles.map((v,i)=>round(v-baseline.frames[i].tailProxy.angleDeg));
      if(bank==='desc'&&angles.some((v,i)=>i&&v-angles[i-1]>3))warnings.push(`${id}/desc: tail proxy rises >3degrees between dive cells instead of settling; inspect tail path`);
      if(bank==='asc'&&angles[6]>angles[2]+45)warnings.push(`${id}/asc: tail already overshoots by cell7; compare delayed Cyber follow-through`);
      if(bank==='asc'&&Math.abs(angles[8]-angles[6])<8)warnings.push(`${id}/asc: final3 tail angles plateau instead of overshooting; inspect cells7..9`);
      const headX=bankReport.frames.map(f=>f.headProxy.centroid[0]),goldHeadX=baseline.frames.map(f=>f.headProxy.centroid[0]);
      bankReport.headXTravel=[round(Math.max(...headX)-Math.min(...headX)),round(Math.max(...goldHeadX)-Math.min(...goldHeadX))];
      if(bank==='asc'&&bankReport.headXTravel[0]<bankReport.headXTravel[1]*.5)warnings.push(`${id}/asc: skull horizontal movement belowhalf Cyber's; inspect missing body gather`);
    }
    const board=createCanvas(9*S,2*S),g=board.getContext('2d');g.fillStyle='#171825';g.fillRect(0,0,board.width,board.height);
    for(let i=0;i<fs.length;i++){
      const slot=fs[i].frameNumber-1;g.globalAlpha=.6;g.drawImage(cyber[slot].image,slot*S,0);g.drawImage(fs[i].image,slot*S,0);g.globalAlpha=1;
      const c=createCanvas(S,S),cg=c.getContext('2d'),d=cg.createImageData(S,S);
      for(let k=0;k<S*S;k++){const ca=cyber[slot].pixels[k*4+3]>ALPHA,na=fs[i].pixels[k*4+3]>ALPHA;
        if(ca||na){d.data[k*4]=na?255:20;d.data[k*4+1]=ca?200:35;d.data[k*4+2]=ca&&na?255:80;d.data[k*4+3]=255;}}
      cg.putImageData(d,0,0);g.drawImage(c,slot*S,S);g.fillStyle='#fff';g.font='13px sans-serif';g.fillText(`${bank}-${slot+1} IoU${bankReport.versusCyber[i].iou}`,slot*S+8,20);
    }
    writeFileSync(join(out,`${id}-${bank}-versus-cyber.png`),board.toBuffer('image/png'));
  }
  const stillPath=artPath(id,`${id}.png`),bodyPath=artPath(id,`${id}-body.png`),tailPath=artPath(id,`${id}-tail.png`);
  if(!partial){
    if(!existsSync(bodyPath)||!existsSync(tailPath))faults.push(`${id}: missing still rig layers`);
    else{const still=await data(stillPath),body=await data(bodyPath),tail=await data(tailPath);let overlap=0,mismatch=0;
      for(let k=0;k<S*S;k++){const p=k*4;if(body.pixels[p+3]&&tail.pixels[p+3])overlap++;
        const part=body.pixels[p+3]?body.pixels:tail.pixels;for(let c=0;c<4;c++)if(part[p+c]!==still.pixels[p+c]&&(part[p+3]||still.pixels[p+3])){mismatch++;break;}}
      report.suits[id].rig={overlapPixels:overlap,mismatchedUnionPixels:mismatch};if(overlap||mismatch)faults.push(`${id}: still rig union fails overlap${overlap},mismatch${mismatch}`);}
  }
}
report.faults=faults;report.reviewWarnings=warnings;
report.verdict=faults.length?'STRUCTURAL FAIL':warnings.length?'REVIEW FLAGS; structural checks pass but drift is not cleared':'STRUCTURAL PASS; geometry/feature/motion review still required';
writeFileSync(join(out,'measurements.json'),JSON.stringify(report,null,2)+'\n');
for(const [id,banks] of Object.entries(report.suits))for(const bank of ['asc','desc']){
  const r=banks[bank];if(!r.frames.length)continue;console.log(id,bank,'boxes',r.frames.map(f=>f.box.slice(2).join('x')).join(' '),'step%',r.stepRatios.map(v=>Math.round(v*100)).join(' '),'tail°',r.frames.map(f=>f.tailProxy.angleDeg).join(' '));}
console.log(JSON.stringify({verdict:report.verdict,faults,reviewWarnings:warnings,out},null,2));
if(faults.length)process.exitCode=1;
