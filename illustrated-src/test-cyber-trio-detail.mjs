// Exercise the shipping loaders and painters after export-sandbox/build-flight-studio.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'outputs/cyber-standard-trio/detail-tests');mkdirSync(out,{recursive:true});
const scratch=mkdtempSync(join(out,'run-'));
cpSync(process.env.ACORNAUT_DETAIL_JS||join(root,'docs/js'),join(scratch,'js'),{recursive:true});
writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
for(const file of readdirSync(join(scratch,'js')).filter(name=>name.endsWith('.js'))){
  const path=join(scratch,'js',file);let code=readFileSync(path,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
  if(file==='art.js')code+='\nexport {asSprite};\n';
  if(file==='draw.js')code+='\nexport {drawPilot};\n';
  writeFileSync(path,code);
}
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
let clock=0;Object.defineProperty(globalThis,'performance',{value:{now:()=>clock},configurable:true});
const mod=name=>import(pathToFileURL(join(scratch,'js',name+'.js')).href);
const [A,D,C,Sim,S,Detail]=await Promise.all(['art','draw','catalog','sim','save','sprite-detail'].map(mod));
const requests=[];
class DeferredImage{
  set src(value){this._src=value;requests.push(this);}
  get src(){return this._src;}
  ok(size=256){this.width=this.height=this.naturalWidth=this.naturalHeight=size;this.onload?.();}
  fail(){this.onerror?.(new Error('intentional missing optional file'));}
}
globalThis.Image=DeferredImage;
// Measurement fixture belongs only to the fake network images. All painter
// assertions below use real PNGs and a real canvas transform.
document.createElement=()=>{
  const canvas={width:1,height:1};
  canvas.getContext=()=>({drawImage(){},getImageData(){
    const data=new Uint8ClampedArray(canvas.width*canvas.height*4);
    for(let y=32;y<canvas.height-32;y++)for(let x=32;x<canvas.width-32;x++)data[(y*canvas.width+x)*4+3]=255;
    return {data};
  }});return canvas;
};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function requested(count){for(let i=0;i<20&&requests.length<count;i++)await tick();assert.equal(requests.length,count);}
// Patriot, Percy and then Envoy (owner, 27 Oct 2026) left the painted trio's 9/9 frames for
// rendered 3D banks, so no pilot ships the trio's split hover layers any more; their loader and
// painter checks retired with them. The shared detail threshold below still guards every sprite.
// Demand threshold includes canvas density, rotation and independent axis scale.
let demanded=0;const probe={width:256,height:256,requestDetail:()=>{demanded++;return Promise.resolve();}};
const ctx=createCanvas(1,1).getContext('2d');ctx.scale(2,2);ctx.rotate(.8);
assert.equal(Detail.spriteImageFor(ctx,probe,128,128),probe);assert.equal(demanded,0,'exact native density does not download');
Detail.spriteImageFor(ctx,probe,129,129);assert.equal(demanded,1,'rotated DPR2 enlargement requests detail');
ctx.resetTransform();ctx.scale(.5,3);Detail.spriteImageFor(ctx,probe,100,100);assert.equal(demanded,2,'tall physical axis requires detail');
console.log('Sprite detail threshold: native density, rotated DPR2 and tall axis PASS (painted trio retired)');
