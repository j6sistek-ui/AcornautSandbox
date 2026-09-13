#!/usr/bin/env node
// Exercise the shipping exporter, not a duplicate resampling implementation.
// Synthetic detail has a known area average; aliasing invents pixels and tones.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url));
const canvasModule=require.resolve(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const {createCanvas,loadImage}=require(canvasModule);
const exporter=process.env.ACORNAUT_RESAMPLING_EXPORTER||join(root,'illustrated-src/export-cyber-trio.mjs');
const helper=join(root,'illustrated-src/resize-cyber-trio.py');
const outputRoot=join(root,'outputs/cyber-standard-trio/resampling-tests');mkdirSync(outputRoot,{recursive:true});
const fixtureRoot=mkdtempSync(join(outputRoot,'run-'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const cases=[
  {size:1024,background:'alpha',scale:1,offset:[-7,3]},
  {size:1254,background:'green-matte',scale:1,offset:[-7,3]},
  {size:1024,background:'green-matte',scale:.875,offset:[5,7]},
  {size:1254,background:'alpha',scale:.875,offset:[5,7]},
];
const regions=[
  {name:'one-pixel checker',box:[64,72,114,116],expected:[127.5,127.5,127.5,255],maxStd:2},
  {name:'one-pixel red-blue stripes',box:[126,72,182,116],expected:[127.5,0,127.5,255],maxStd:2},
  {name:'four-pixel waves',box:[64,130,114,170],expected:[127.5,127.5,127.5,255],maxStd:3},
  {name:'translucent color',box:[130,130,182,170],expected:[208,72,176,128],maxStd:1},
];
function masterFor({size,background}){
  const canvas=createCanvas(size,size),g=canvas.getContext('2d'),image=g.createImageData(size,size),d=image.data;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const at=(y*size+x)*4,lx=x/size*256,ly=y/size*256;
    if(background==='green-matte'){d[at+1]=255;d[at+3]=255;}
    const region=regions.findIndex(({box:[x0,y0,x1,y1]})=>lx>=x0&&lx<x1&&ly>=y0&&ly<y1);
    if(region<0)continue;
    let rgba;
    if(region===0){const v=(x+y)%2?255:0;rgba=[v,v,v,255];}
    else if(region===1)rgba=x%2?[255,0,0,255]:[0,0,255,255];
    else if(region===2){const v=Math.round(127.5+127.5*Math.cos(2*Math.PI*x/4));rgba=[v,v,v,255];}
    else rgba=[208,72,176,128];
    d.set(rgba,at);
  }
  g.putImageData(image,0,0);return canvas.toBuffer('image/png');
}
function stats(pixels,box,cell){
  const values=[[],[],[],[]];
  for(let y=box[1];y<box[3];y++)for(let x=box[0];x<box[2];x++)
    for(let c=0;c<4;c++)values[c].push(pixels[(y*cell+x)*4+c]);
  return values.map(v=>{const mean=v.reduce((a,b)=>a+b,0)/v.length;return{mean,std:Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/v.length)};});
}
const receipts=[];
for(const spec of cases){
  const name=spec.size+'-'+spec.background+'-'+spec.scale,fixture=join(fixtureRoot,name),src=join(fixture,'art-src/cyber-standard-trio/nacre');
  mkdirSync(join(fixture,'illustrated-src'),{recursive:true});mkdirSync(join(src,'frames'),{recursive:true});
  copyFileSync(exporter,join(fixture,'illustrated-src/export-cyber-trio.mjs'));
  copyFileSync(helper,join(fixture,'illustrated-src/resize-cyber-trio.py'));
  const master=masterFor(spec);
  for(let i=1;i<=9;i++)writeFileSync(join(src,'frames/asc-'+i+'.png'),master);
  writeFileSync(join(src,'export.json'),JSON.stringify({sourceLayout:'individual',background:spec.background,scale:spec.scale,offset:[0,0],
    poseOffsets:{asc:Array.from({length:9},()=>spec.offset),desc:Array.from({length:9},()=>[0,0])},registrationEvidence:'registration.json'}));
  writeFileSync(join(src,'registration.json'),JSON.stringify({kind:'synthetic known-coordinate fixture'}));
  execFileSync(process.execPath,[join(fixture,'illustrated-src/export-cyber-trio.mjs'),'--suit','nacre','--bank','asc','--frames-only'],{
    cwd:fixture,env:{...process.env,ACORNAUT_CANVAS:canvasModule},stdio:'pipe',
  });
  for(const cell of [256,512]){
    const factor=cell/256,directory=join(fixture,'docs/art/suits',factor===2?'hd':''),label=name+'@'+cell;
    const output=join(directory,'nacre-asc-1.png'),img=await loadImage(output);
    assert.equal(img.width,cell,label+' output width');assert.equal(img.height,cell,label+' output height');
    for(let i=2;i<=9;i++)assert.equal(hash(join(directory,'nacre-asc-'+i+'.png')),hash(output),label+' identical source cells keep the same framing and pixels');
    assert.equal(hash(join(directory,'nacre.png')),hash(output),label+' still equals ascent one');
    const canvas=createCanvas(cell,cell),g=canvas.getContext('2d');g.drawImage(img,0,0);const pixels=g.getImageData(0,0,cell,cell).data;
    const samples=[];
    for(const region of regions){
      const box=region.box.map((v,i)=>(v*spec.scale+spec.offset[i%2])*factor);
      const interior=[Math.ceil(box[0]+5*factor),Math.ceil(box[1]+5*factor),Math.floor(box[2]-5*factor),Math.floor(box[3]-5*factor)],channels=stats(pixels,interior,cell);
      for(let c=0;c<4;c++){
        assert(Math.abs(channels[c].mean-region.expected[c])<=2,label+' '+region.name+' channel'+c+' area average: '+channels[c].mean);
        // Four-pixel source waves can carry real detail at 512px. Their
        // area average stays correct, while subpixel checker/stripes must not alias.
        if(cell===256||region.name!=='four-pixel waves')assert(channels[c].std<=region.maxStd,label+' '+region.name+' channel'+c+' aliases: std='+channels[c].std);
      }
      if(cell===512&&spec.size===1024&&spec.scale===1&&region.name==='four-pixel waves')
        assert(channels[0].std>10,label+' must retain source detail absent from the 256px painting');
      samples.push({region:region.name,channels});
    }
    const occupied=[];for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){
      const a=pixels[(y*cell+x)*4+3];if(a>24)occupied.push([x,y]);
      if(x<8*factor||x>=cell-8*factor||y<8*factor||y>=cell-8*factor)assert.equal(a,0,label+' transparent canvas margins');
    }
    const bounds=[Math.min(...occupied.map(p=>p[0])),Math.min(...occupied.map(p=>p[1])),Math.max(...occupied.map(p=>p[0])),Math.max(...occupied.map(p=>p[1]))];
    const expected=[(64*spec.scale+spec.offset[0])*factor,(72*spec.scale+spec.offset[1])*factor,(182*spec.scale+spec.offset[0])*factor-1,(170*spec.scale+spec.offset[1])*factor-1];
    bounds.forEach((v,i)=>assert(Math.abs(v-expected[i])<=2*factor,label+' whole-canvas scale/translation bounds '+bounds));
    receipts.push({name:label,sourceSha256:createHash('sha256').update(master).digest('hex'),outputSha256:hash(output),bounds,samples});
  }
}
writeFileSync(join(fixtureRoot,'receipts.json'),JSON.stringify({exporterSha256:hash(exporter),helperSha256:hash(helper),cases:receipts},null,2)+'\n');
console.log('PASS Cyber trio real-exporter resampling:4 fixtures,72 paintings at256/512, source detail, color/alpha and registered margins. Receipts: '+fixtureRoot);
