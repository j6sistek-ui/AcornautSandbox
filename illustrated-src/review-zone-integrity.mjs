#!/usr/bin/env node
// Preserve evidence for the art-only boundaries and the inherited render failure.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const base='85f30e60b8b7568cdd911a9cf888122b47833d83';
const out=resolve(root,'illustrated-src/design/zone-identity-implementation');
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=git('ls-tree','-r','--name-only',base,'docs/art','illustrated-src/game').toString().trim().split('\n');
const retained=files.filter(f=>f.startsWith('docs/art/')||/\/(?:sky-gen|campaign|campaign-manifest|beta-campaign-manifest|campaign-progress|save)\.ts$/.test(f));
for(const f of retained){
 const old=git('show',`${base}:${f}`),current=readFileSync(resolve(root,f));
 assert.equal(hash(current),hash(old),`protected original changed: ${f}`);
}
const source=resolve(root,'node_modules/.zone-integrity-baseline');
for(const f of ['docs/js/arcflash.js','docs/js/arcflash-parts.js','docs/js/arcflash-motion.js','docs/js/control-constants.js','docs/art/suits/arcflash/parts.png','docs/art/suits/arcflash/body.png']){
 const target=resolve(source,f);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,git('show',`${base}:${f}`));
}
const {createCanvas,loadImage}=createRequire(import.meta.url)(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const arcflash=[];
for(const [name,dir] of [['base',source],['zone-implementation',root]]){
 const R=await import(pathToFileURL(resolve(dir,'docs/js/arcflash.js')).href);
 const atlas=await loadImage(resolve(dir,'docs/art/suits/arcflash/parts.png'));
 const icon=await loadImage(resolve(dir,'docs/art/suits/arcflash/body.png'));
 const a=createCanvas(256,256),b=createCanvas(256,256);
 R.paintArcflash(a.getContext('2d'),{suits:{arcflash:icon},arcflash:atlas},128,128,256,undefined,undefined,false);
 R.paintArcflash(b.getContext('2d'),{suits:{arcflash:icon}},128,128,256,undefined,undefined,false);
 const actual=a.getContext('2d').getImageData(0,0,256,256).data,expected=b.getContext('2d').getImageData(0,0,256,256).data;
 let pixels=0,bytes=0,maxDelta=0;
 for(let i=0;i<actual.length;i+=4){let changed=false;for(let k=0;k<4;k++)if(actual[i+k]!==expected[i+k]){changed=true;bytes++;maxDelta=Math.max(maxDelta,Math.abs(actual[i+k]-expected[i+k]));}if(changed)pixels++;}
 arcflash.push({name,pixels,bytes,maxDelta,rigRgbaSha256:hash(actual),fallbackRgbaSha256:hash(expected)});
}
for(const key of ['pixels','bytes','maxDelta','rigRgbaSha256','fallbackRgbaSha256'])assert.equal(arcflash[0][key],arcflash[1][key]);
const result={base,protectedFiles:retained.length,originalArtFiles:retained.filter(f=>f.startsWith('docs/art/')).length,protectedSource:retained.filter(f=>!f.startsWith('docs/art/')),allByteIdentical:true,arcflash};
writeFileSync(resolve(out,'integrity-verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
