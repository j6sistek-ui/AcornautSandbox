#!/usr/bin/env node
// The fallback portrait is a derived render, not a separately painted asset.
// Run after TypeScript export so it uses the exact rig shipped by this build.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const {createCanvas,loadImage}=createRequire(import.meta.url)(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const {paintArcflash}=await import('../docs/js/arcflash.js');
const atlas=await loadImage(root+'docs/art/suits/arcflash/parts.png');
const canvas=createCanvas(256,256),ctx=canvas.getContext('2d');
paintArcflash(ctx,{arcflash:atlas},128,128,256,undefined,undefined,false);
const pixels=ctx.getImageData(0,0,256,256).data;
for(let i=0;i<256;i++)for(const p of [i,255*256+i,i*256,i*256+255])
  assert(pixels[p*4+3]<16,'Arcflash portrait retains transparent padding');
const file=root+'docs/art/suits/arcflash/body.png',png=canvas.toBuffer('image/png');
if(!existsSync(file)||!png.equals(readFileSync(file)))writeFileSync(file,png);
console.log('Arcflash fallback portrait exported from the shipping rig');
