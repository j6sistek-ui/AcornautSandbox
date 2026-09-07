#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const R=await import('../docs/js/arcflash.js'),M=await import('../docs/js/arcflash-motion.js');
const atlas=await loadImage(root+'docs/art/suits/arcflash/parts.png');
const icon=await loadImage(root+'docs/art/suits/arcflash/body.png');
assert.equal(atlas.width,1024);assert.equal(atlas.height,768);
assert.equal(icon.width,256);assert.equal(icon.height,256);
const art={suits:{arcflash:icon},arcflash:atlas};
const a=createCanvas(256,256),b=createCanvas(256,256),ac=a.getContext('2d'),bc=b.getContext('2d');
R.paintArcflash(ac,art,128,128,256,undefined,undefined,false);
R.paintArcflash(bc,{suits:{arcflash:icon}},128,128,256,undefined,undefined,false);
assert.deepEqual(ac.getImageData(0,0,256,256).data,bc.getImageData(0,0,256,256).data,'loading fallback matches live rig registration pixel for pixel');
const source=createCanvas(1024,768),sc=source.getContext('2d');sc.drawImage(atlas,0,0);
const pixels=sc.getImageData(0,0,1024,768).data;
let matte=0,opaque=0;
// Blue glow blending with orange fur can form a muted green edge pixel;
// the production matte is strongly green-dominant, not that interpolation.
for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>128){opaque++;if(pixels[i+1]-Math.max(pixels[i],pixels[i+2])>65)matte++;}
assert.equal(matte,0,'green production matte does not ship on opaque artwork');
for(let n=0;n<12;n++)for(let i=0;i<256;i++)for(const [x,y] of [[i,0],[i,255],[0,i],[255,i]]){
  assert(pixels[((Math.floor(n/4)*256+y)*1024+n%4*256+x)*4+3]<16,'atlas cells retain transparent padding');
}
const canvas=createCanvas(640,640),c=canvas.getContext('2d');
function components(data,W,H){
  const seen=new Uint8Array(W*H),q=new Int32Array(W*H),areas=[];
  for(let start=0;start<W*H;start++){
    if(seen[start]||data[start*4+3]<100)continue;
    let read=0,count=1;q[0]=start;seen[start]=1;
    const add=p=>{if(!seen[p]&&data[p*4+3]>=100){seen[p]=1;q[count++]=p;}};
    while(read<count){const p=q[read++],x=p%W,y=Math.floor(p/W);if(x)add(p-1);if(x+1<W)add(p+1);if(y)add(p-W);if(y+1<H)add(p+W);}
    areas.push(count);
  }
  return areas.sort((a,b)=>b-a);
}
let minArea=Infinity,maxStray=0,maxVertexStep=0,previous;
const state=M.createArcflashMotion();let vy=0;
// A pitch adjustment moves the complete articulated pilot and each nozzle
// together. Prior wake samples are deliberately outside this rotation.
const baseNozzles=R.arcflashNozzles(state);
for(const pitch of [-20,12,45].map(deg=>deg*Math.PI/180)){
  const turned=R.arcflashNozzles(state,pitch),cs=Math.cos(pitch),sn=Math.sin(pitch);
  for(let i=0;i<turned.length;i++)for(const key of ['point','direction']){
    const [x,y]=baseNozzles[i][key],actual=turned[i][key];
    assert(Math.abs(actual[0]-(x*cs-y*sn))<1e-9&&Math.abs(actual[1]-(x*sn+y*cs))<1e-9,
      'pitch dial rotates nozzle positions and jet directions with the body');
  }
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
for(let tick=0;tick<960;tick++){
  if((tick<120&&tick%12===0)||(tick>=300&&tick<450&&tick%22===0)||(tick>=600&&tick<750&&tick%36===0)){
    M.arcflashTap(state,Math.max(1,vy+450));vy=-450;
  }
  if(tick===500){M.arcflashDive(state);vy=420;}
  if(tick===800){M.arcflashContact(state,-1,.9);vy=-350;}
  vy+=1300/120;M.stepArcflash(state,1/120,vy);
  const mesh=R.arcflashTailMesh(state);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    const i=y*5+x;minArea=Math.min(minArea,cross(mesh[i],mesh[i+1],mesh[i+6]),cross(mesh[i],mesh[i+6],mesh[i+5]));
  }
  if(previous)maxVertexStep=Math.max(maxVertexStep,...mesh.map((p,i)=>Math.hypot(p[0]-previous[i][0],p[1]-previous[i][1])));
  previous=mesh;
  if(tick%40===0){
    c.clearRect(0,0,640,640);R.paintArcflash(c,art,320,320,480,state,undefined,false);
    const areas=components(c.getImageData(0,0,640,640).data,640,640);maxStray=Math.max(maxStray,areas[1]||0);
    assert(areas[0]>15000,'complete character is rendered at each attitude');
    assert((areas[1]||0)<100,'head, paws, limbs and tail remain attached; only fine fur fragments may be separate');
  }
}
assert(minArea>100,'tail never inverts or folds a texture triangle');
assert(maxVertexStep<16,'tail curvature guard does not introduce a visible snap');
console.log(JSON.stringify({passed:true,fallbackExact:true,opaqueAtlasPixels:opaque,greenMattePixels:matte,
  poses:24,largestDetachedFurFragment:maxStray,minTailTriangleArea:+minArea.toFixed(3),maxTailVertexStep120Hz:+maxVertexStep.toFixed(3)}));
