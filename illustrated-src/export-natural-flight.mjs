// Whole-character export: remove the production matte, then perform one
// uniform scale/translation measured from the painted skull. Leviathan's
// generated neutral head is also held across frames, with a collar blend,
// to eliminate residual face/fin shimmer. No runtime split rig or rotation.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const source=root+'art-src/natural-flight/';
const output=process.env.NATURAL_FLIGHT_OUTPUT||root+'docs/art/suits/';
mkdirSync(output,{recursive:true});
const tracks=JSON.parse(readFileSync(source+'head-tracks.json','utf8'));
const standards=['iontrim','copper','voidsuit','sammie','gemmie','leviathan','ember','frost','ghost'];
const standard=[206,106,36];
const yPath=[0,-.7,-1.5,-2.4,-3.5,-4.7,-6,-7,0,.8,1.8,3,4.2,5.6,7,8];
const crownRepair=JSON.parse(readFileSync(source+'anatomy-repair/regions.json','utf8'));
const anchors={},report={};
for(const [suit,track] of Object.entries(tracks)) {
  if(!standards.includes(suit))continue;
  assert.equal(track.frames.length,16);
  const im=await loadImage(source+suit+'-master.png');
  const sheet=createCanvas(im.width,im.height),sg=sheet.getContext('2d');sg.drawImage(im,0,0);
  const pixels=sg.getImageData(0,0,im.width,im.height),d=pixels.data;
  const matte=new Uint8Array(im.width*im.height);
  for(let p=0;p<matte.length;p++) {
    const i=p*4;
    if(Math.min(d[i],d[i+2])-d[i+1]>150 && d[i]>180 && d[i+2]>180)matte[p]=1;
  }
  for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++) {
    const p=y*im.width+x,i=p*4;
    if(matte[p]){d[i]=d[i+1]=d[i+2]=d[i+3]=0;continue;}
    // Unmix only a two-pixel silhouette fringe. Violet fabric and pastel
    // opal inside the character are never classified as background.
    let edge=false;
    for(let dy=-2;dy<=2&&!edge;dy++)for(let dx=-2;dx<=2;dx++){
      const xx=x+dx,yy=y+dy;if(xx>=0&&xx<im.width&&yy>=0&&yy<im.height&&matte[yy*im.width+xx]){edge=true;break;}
    }
    if(edge){
      const spill=Math.max(0,Math.min(d[i],d[i+2])-d[i+1]-8)/247;
      if(spill>0){const a=1-spill;d[i+3]=Math.round(255*a);d[i]=Math.max(0,Math.min(255,(d[i]-255*spill)/a));d[i+1]=Math.min(255,d[i+1]/a);d[i+2]=Math.max(0,Math.min(255,(d[i+2]-255*spill)/a));}
    }
  }
  sg.putImageData(pixels,0,0);
  const target=standard,cw=im.width/4,ch=im.height/4;
  report[suit]=[];
  let neutralHead;
  let previousCrown;
  let repairedCrown;
  if(crownRepair[suit]) {
    const repaired=await loadImage(source+'anatomy-repair/'+suit+'-asc-8.png');
    const rc=createCanvas(256,256),rg=rc.getContext('2d');rg.drawImage(repaired,0,0,256,256);
    repairedCrown=rg.getImageData(0,0,256,256).data;
  }
  for(let n=0;n<16;n++) {
    const j=n===8?0:n,t=track.frames[j],s=target[2]/t.head[2];
    const x=target[0],y=target[1]+yPath[n];
    const x0=Math.round(j%4*cw),y0=Math.round(Math.floor(j/4)*ch);
    const w=Math.round((j%4+1)*cw)-x0,h=Math.round((Math.floor(j/4)+1)*ch)-y0;
    const cell=createCanvas(w,h),cg=cell.getContext('2d');cg.drawImage(sheet,x0,y0,w,h,0,0,w,h);
    const cp=cg.getImageData(0,0,w,h),cd=cp.data,visited=new Uint8Array(w*h),components=[];
    // Adjacent sheet cells can contain a detached fingertip from their
    // neighbour. Keep the connected whole character, not that foreign ink.
    for(let p=0;p<w*h;p++)if(!visited[p]&&cd[p*4+3]>8){
      const queue=[p];visited[p]=1;
      for(let qi=0;qi<queue.length;qi++){const a=queue[qi],ax=a%w,ay=Math.floor(a/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=ax+dx,yy=ay+dy,b=yy*w+xx;if(xx<0||xx>=w||yy<0||yy>=h||visited[b]||cd[b*4+3]<=8)continue;visited[b]=1;queue.push(b);}}
      components.push(queue);
    }
    components.sort((a,b)=>b.length-a.length);
    const keep=new Uint8Array(w*h);for(const p of components[0])keep[p]=1;
    for(let p=0;p<w*h;p++)if(!keep[p])cd[p*4]=cd[p*4+1]=cd[p*4+2]=cd[p*4+3]=0;
    cg.putImageData(cp,0,0);
    const c=createCanvas(256,256),g=c.getContext('2d');
    g.drawImage(cell,x-t.head[0]*s,y-t.head[1]*s,w*s,h*s);
    if(suit==='leviathan') {
      if(n===0) {neutralHead=createCanvas(256,256);neutralHead.getContext('2d').drawImage(c,0,0);}
      else {
        const locked=createCanvas(256,256),lg=locked.getContext('2d');lg.drawImage(neutralHead,0,y-standard[1]);
        const current=g.getImageData(0,0,256,256),a=current.data,b=lg.getImageData(0,0,256,256).data;
        for(let py=0;py<256;py++)for(let px=0;px<256;px++) {
          const k=(py*256+px)*4;
          const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
          const mix=smooth((px-(x-66))/12)*smooth((y+40-py)/12);
          if(!mix)continue;
          const aa=a[k+3]*(1-mix),ba=b[k+3]*mix,alpha=aa+ba;
          for(let channel=0;channel<3;channel++)a[k+channel]=alpha?(a[k+channel]*aa+b[k+channel]*ba)/alpha:0;
          a[k+3]=alpha;
        }
        g.putImageData(current,0,0);
      }
    }
    if(n===7&&repairedCrown) {
      const patch=g.getImageData(0,0,256,256),pd=patch.data,[x0,y0,x1,y1]=crownRepair[suit];
      // The generated edit supplies only the missing crown silhouette.
      // Keep every surviving original RGB value and all pixels outside this
      // small region, including the correct tail, face and complete costume.
      for(let py=y0;py<y1;py++)for(let px=x0;px<x1;px++) {
        const p=(py*256+px)*4,spill=Math.min(repairedCrown[p],repairedCrown[p+2])-repairedCrown[p+1];
        const matte=spill>150?1:Math.max(0,Math.min(1,(spill-8)/247));
        pd[p+3]=Math.round(pd[p+3]*(1-matte));
        if(!pd[p+3])pd[p]=pd[p+1]=pd[p+2]=0;
      }
      g.putImageData(patch,0,0);
      if(suit==='copper') {
        // The original plume covered the rear ear. Erasure alone would
        // leave plume-colored fur in that ear. Restore the adjacent pose's
        // actual ear, translated one pixel along the registered head path.
        const a=g.getImageData(0,0,256,256),ad=a.data;
        const shifted=createCanvas(256,256),sc=shifted.getContext('2d');
        sc.drawImage(previousCrown,0,yPath[7]-yPath[6]);
        const bd=sc.getImageData(0,0,256,256).data;
        for(let py=45;py<86;py++)for(let px=193;px<229;px++) {
          const k=(py*256+px)*4;
          const mix=Math.min(1,(px-193)/3,(229-px)/3,(86-py)/3);
          const aa=ad[k+3]*(1-mix),ba=bd[k+3]*mix,alpha=aa+ba;
          for(let ch=0;ch<3;ch++)ad[k+ch]=alpha?(ad[k+ch]*aa+bd[k+ch]*ba)/alpha:0;
          ad[k+3]=alpha;
        }
        g.putImageData(a,0,0);
      }
    }
    if(suit==='copper'&&n===6){previousCrown=createCanvas(256,256);previousCrown.getContext('2d').drawImage(c,0,0);}
    const fd=g.getImageData(0,0,256,256).data;
    let minX=256,minY=256,maxX=-1,maxY=-1,edge=0,ink=0;
    for(let yy=0;yy<256;yy++)for(let xx=0;xx<256;xx++)if(fd[(yy*256+xx)*4+3]>32){minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,yy);maxY=Math.max(maxY,yy);ink++;if(xx<2||xx>253||yy<2||yy>253)edge++;}
    const key=`${suit}-${n<8?'asc':'desc'}-${n%8+1}`;
    writeFileSync(output+key+'.png',c.toBuffer('image/png'));
    anchors[key]=[x,Number(y.toFixed(2)),target[2],suit==='leviathan'?track.frames[0].angle:t.angle];
    if(n===0){writeFileSync(output+suit+'.png',c.toBuffer('image/png'));anchors['suit:'+suit]=anchors[key];}
    report[suit].push({key,head:[x,y,target[2]],source:t.head,scale:Number(s.toFixed(5)),bounds:[minX,minY,maxX,maxY],edge,ink});
  }
}
writeFileSync(process.env.NATURAL_FLIGHT_OUTPUT?output+'natural-export.json':source+'registration.json',JSON.stringify({anchors,report},null,2)+'\n');
console.log('Exported nine standard characters; whole-frame registration, 16 poses and neutral portraits.');
