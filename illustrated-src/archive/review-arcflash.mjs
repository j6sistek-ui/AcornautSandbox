#!/usr/bin/env node
// Native Canvas review of the production Arcflash painter. See REVIEW.md.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
globalThis.window={__ACORNAUT_BETA__:true,location:{search:'',href:'http://local/beta/'},devicePixelRatio:1,matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
const M=await import('../docs/js/arcflash-motion.js'),R=await import('../docs/js/arcflash.js');
const atlas=await loadImage(root+'docs/art/suits/arcflash/parts.png');
const art={suits:{},arcflash:atlas};
const out=root+'illustrated-src/design/arcflash/';mkdirSync(out,{recursive:true});
const states=[M.createArcflashMotion(),M.createArcflashMotion(),M.createArcflashMotion(),M.createArcflashMotion()];
for(let i=0;i<120;i++){M.stepArcflash(states[1],1/120,-450);M.stepArcflash(states[2],1/120,650);M.stepArcflash(states[3],1/120,-450);}
M.arcflashContact(states[3],-1,.9);for(let i=0;i<12;i++)M.stepArcflash(states[3],1/120,-350);
const sheet=createCanvas(1400,640),c=sheet.getContext('2d');
c.fillStyle='#08111e';c.fillRect(0,0,1400,640);
c.font='bold 27px sans-serif';c.fillStyle='#dceeff';c.fillText('ARCFLASH / ARTICULATED FLIGHT',30,43);
c.font='15px sans-serif';c.fillStyle='#829caf';c.fillText('One painting per body part · fixed anatomy · independent joint momentum',30,70);
for(let i=0;i<4;i++){
  const x=i*350;c.fillStyle='#152535';c.fillRect(x+15,95,320,440);
  R.paintArcflash(c,art,x+190,315,250,states[i],undefined,false);
  c.fillStyle='#8ddfff';c.font='bold 17px sans-serif';c.fillText(['CRUISE','CLIMB','DESCENT','CONTACT'][i],x+30,563);
  R.paintArcflash(c,art,x+68,607,52,states[i],undefined,false);
  c.fillStyle='#a9bdcf';c.font='12px sans-serif';c.fillText('52px game scale',x+116,610);
}
writeFileSync(out+'pose-review.png',sheet.toBuffer('image/png'));
// The fallback is rendered from the same rig, never the unrelated assembled
// reference cell. It uses the same padded canvas registration as live play.
const icon=createCanvas(256,256),ic=icon.getContext('2d');
R.paintArcflash(ic,art,128,128,256,undefined,undefined,false);
writeFileSync(root+'docs/art/suits/arcflash/body.png',icon.toBuffer('image/png'));
const pixels=ic.getImageData(0,0,256,256).data;
for(let i=0;i<256;i++)for(const k of [i,255*256+i,i*256,i*256+255])assert(pixels[k*4+3]<16,'portrait stays inside padded canvas');
console.log(JSON.stringify({passed:true,output:out+'pose-review.png'}));
