#!/usr/bin/env node
// Production canvas functions with real art. No simulated browser screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image,GlobalFonts}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Vanguard Sans');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.ACORNAUT_QA_OUTPUT||join(tmpdir(),'acornaut-switchback-render');mkdirSync(output,{recursive:true});
const pending=[];let failFrame=true;
class LocalImage extends Image {
  set src(value){
    this.sourceFile=value;
    if(failFrame && /switchback-8\.png/.test(value)){queueMicrotask(()=>this.onerror?.());return;}
    const ready=this.onload,failed=this.onerror;
    pending.push(new Promise(done=>{
      this.onload=()=>{ready?.();done();};this.onerror=e=>{failed?.(e);done();};
      // A file URL also prevents native-canvas's buffer sniff from treating
      // the embedded C2PA manifest as SVG. Keep the original PNG untouched.
      try{super.src=value.split('?')[0];}catch(e){this.onerror(e);}
    }));
  }
  get src(){return super.src;}
}
globalThis.Image=LocalImage;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:true,__ACORNAUT_ART__:join(root,'docs/art'),location:{href:'http://local/beta/',search:'?star-map=sample'},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),addEventListener(){},documentElement:{style:{}}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const A=await import('../docs/js/art.js'),D=await import('../docs/js/draw.js'),S=await import('../docs/js/save.js'),Sim=await import('../docs/js/sim.js'),C=await import('../docs/js/campaign.js'),V=await import('../docs/js/zone-visuals.js');

const art=A.emptyArt();
art.pals.switchback=await loadImage(join(root,'docs/art/solo/switchback.png'));
await A.loadPalBank(art,'switchback');
assert.equal(art.palAnim.switchback,undefined,'partial bank keeps still fallback');
failFrame=false;await A.loadPalBank(art,'switchback');
assert.equal(art.palAnim.switchback.length,16,'failed bank retries all frames');
const c=createCanvas(1024,512),g=c.getContext('2d');
let now=0;globalThis.performance={now:()=>now};
const draws=[];const draw=g.drawImage.bind(g);g.drawImage=(im,...args)=>{draws.push([im,...args]);return draw(im,...args);};
for(let i=0;i<16;i++){
 const x=(i%8)*128,y=Math.floor(i/8)*256;
 g.fillStyle=i%2?'#f0e9dc':'#08162b';g.fillRect(x,y,128,256);
 now=(i+.01)/12*1000;
 D.paintPalPreview(g,art,'switchback',x+64,y+75,100);
 assert.equal(draws.at(-1)[0],art.palAnim.switchback[i]);
 assert.equal(draws.at(-1)[3],100*256/208);
 D.paintPalPreview(g,art,'switchback',x+64,y+174,30);
 g.fillStyle=i%2?'#17304a':'#ddd';g.font='14px sans-serif';g.fillText(String(i+1),x+10,y+240);
 const im=art.palAnim.switchback[i];assert.equal(im.width,256);assert.equal(im.height,256);
}
writeFileSync(join(output,'switchback-review.png'),c.toBuffer('image/png'));
const fallback={...art,palAnim:{}};D.paintPalPreview(g,fallback,'switchback',50,50,30);
assert.equal(draws.at(-1)[0],art.pals.switchback);
console.log('Switchback renderer: 16 lazy frames, partial failure/retry, exact frame sequence, fixed scale and still fallback passed');
