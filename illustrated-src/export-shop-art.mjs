#!/usr/bin/env node
// Resize the approved marketing masters; gameplay artwork is never an input/output.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
// Catalog imports the browser bridge; exporting never reads player storage.
globalThis.window={location:{href:'http://local/'},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>null}),addEventListener(){}};
const {BUNDLES,bundleQuote}=await import('../docs/js/catalog.js');
const names=new Set();
const specs=[
 ...BUNDLES.map(b=>{
   assert.equal(b.kit.banner,`shop/${b.id}.png`,b.id+': kit requires its own banner');
   assert(!names.has(b.kit.banner),b.id+': duplicate banner');names.add(b.kit.banner);
   bundleQuote(b,()=>false); // validates the editable discount before shipping.
   return [b.id,b.id==='bundle-premium-trio'?'trio':`bundles/${b.id}`,b.kit.banner,1024,512];
 }),
 ['stardust-emblem','stardust-emblem','shop/stardust-emblem.png',256,256],
 ['shop-nebula','shop-nebula','shop/shop-nebula.png',1200,800],
];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt=[];
mkdirSync(root+'docs/art/shop',{recursive:true});
for(const [id,master,target,w,h] of specs){
 const source='art-src/premium-marketing/'+master+'.png';
 const output='docs/art/'+target;
 const bytes=readFileSync(root+source),img=await loadImage(root+source);
 assert(Math.abs(img.width/img.height-w/h)<.015,id+': source aspect ratio would distort marketing art');
 const canvas=createCanvas(w,h),g=canvas.getContext('2d');
 g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 g.drawImage(img,0,0,w,h);
 const png=canvas.toBuffer('image/png');
 writeFileSync(root+output,png);
 receipt.push({id,source,sourceSize:[img.width,img.height],sourceSha256:sha(bytes),output,outputSize:[w,h],outputSha256:sha(png),bytes:png.length});
}
// These were unpublished Shop drafts. Individual cards now use game artwork.
for(const name of ['premium-porcelain','premium-nacre','premium-origamist','premium-trio']){
 const retired=root+'docs/art/shop/'+name+'.png';if(existsSync(retired))unlinkSync(retired);
}
writeFileSync(root+'art-src/premium-marketing/export-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log('Shop marketing: '+receipt.length+' images, '+(receipt.reduce((n,r)=>n+r.bytes,0)/1048576).toFixed(2)+' MiB; gameplay art untouched');
