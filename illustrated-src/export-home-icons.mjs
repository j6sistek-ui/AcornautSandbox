#!/usr/bin/env node
// Scale the owner-requested Home icons for the existing screen-blended icon slots.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt=[];
mkdirSync(root+'docs/art/ui',{recursive:true});
for(const id of ['star-chart-holo','modes-orbit','launch-holo']){
  const source=`art-src/home-icons/${id}.png`;
  const output=`docs/art/ui/${id}.png`;
  const bytes=readFileSync(root+source),img=await loadImage(root+source);
  assert.equal(img.width,img.height,`${id}: square source required`);
  const canvas=createCanvas(256,256),g=canvas.getContext('2d');
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.drawImage(img,0,0,256,256);
  const pixels=g.getImageData(0,0,256,256).data;
  const corners=[0,255,255*256,256*256-1].map(p=>Math.max(...pixels.slice(p*4,p*4+3)));
  assert(corners.every(v=>v<=8),`${id}: black icon corners required for screen blending`);
  const png=canvas.toBuffer('image/png');
  writeFileSync(root+output,png);
  receipt.push({id,source,sourceSize:[img.width,img.height],sourceSha256:sha(bytes),output,outputSize:[256,256],outputSha256:sha(png),background:'black',displayBlend:'screen',cornerMaxRGB:corners,bytes:png.length});
}
writeFileSync(root+'art-src/home-icons/export-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log('Home icons: three 256px exports for screen blending; original currency and game art untouched');
