import {execFileSync} from 'node:child_process';
// Review the exact production renderer on native Canvas, including helmet layers.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {cpSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=process.env.FLIGHT_REVIEW_SCRATCH||join(root,'../beta-flight-review');
const output=process.env.FLIGHT_REVIEW_OUTPUT||join(root,'art-src/beta-flight-refresh/review');
mkdirSync(scratch,{recursive:true});mkdirSync(output,{recursive:true});
cpSync(join(root,'docs/js'),join(scratch,'js'),{recursive:true});
writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
for(const name of readdirSync(join(scratch,'js')).filter(n=>n.endsWith('.js'))) {
  const path=join(scratch,'js',name);let code=readFileSync(path,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
  if(name==='art.js')code+='\nexport {asSprite};\n';
  if(name==='draw.js')code+='\nexport {paintIllustrated as paintRegisteredPose};\n';
  writeFileSync(path,code);
}
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:true,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const mod=file=>import(pathToFileURL(join(scratch,'js',file+'.js')).href);
const [Draw,Art,Cat,Control]=await Promise.all(['draw','art','catalog','control-constants'].map(mod));
const suits=['cinderforge','groveguard','cosmic','sunforged','abyssal'];const bank=Art.emptyArt();
async function sprite(path){const im=await loadImage(join(root,'docs/art',path));Object.defineProperty(im,'src',{get:()=>path});return Art.asSprite(im);}
bank.helms.clear=await sprite('helms/clear.png');
for(const s of suits){
  bank.suits[s]=await sprite(`suits/${s}.png`);
  // Deliberately omit the retired tap/rig layers: the new bank must stand alone.
  for(const k of ['Asc','Desc'])bank['suit'+k][s]=await Promise.all(Array.from({length:8},(_,i)=>sprite(`suits/${s}-${k.toLowerCase()}-${i+1}.png`)));
  bank.helms[s]=await sprite(`helms/${s}.png`);
}

const ids=['clear','aurora','cherry','chrono','comet','ion','lunar','meteor','solar'];
const oldHelper=execFileSync('git',['show','5acb81cc030480d87dc59ad59758b3c35168ae8a:docs/js/helmet-openings.js'],{cwd:root,encoding:'utf8'});
writeFileSync(join(scratch,'js/helmet-openings-old.js'),oldHelper);
writeFileSync(join(scratch,'js/draw-old.js'),readFileSync(join(scratch,'js/draw.js'),'utf8').replace('./helmet-openings.js','./helmet-openings-old.js'));
const Before=await mod('draw-old'),oldBank={...bank,helms:{...bank.helms}};
for(const id of ids){
 bank.helms[id]=await sprite('helms/'+id+'.png');
 const im=await loadImage(join(root,'art-src/helmet-glass-repair',id+'-reference.png'));Object.defineProperty(im,'src',{get:()=> 'helms/'+id+'.png'});oldBank.helms[id]=Art.asSprite(im);
}
const contact=createCanvas(1536,930),g=contact.getContext('2d');g.fillStyle='#172231';g.fillRect(0,0,1536,930);
for(let n=0;n<ids.length;n++)for(let col=0;col<2;col++){
 const id=ids[n],x=n%3*512+col*256,y=Math.floor(n/3)*310;
 const suit=Cat.SUITS.find(s=>s.id==='cosmic'),helm=Cat.HELMETS.find(h=>h.id===id);
 (col?Draw:Before).paintFlightPreview(g,col?bank:oldBank,suit,helm,x+128,y+143,150,.52,Control.SUIT_LEAN_DEFAULT,false,0);
 g.fillStyle='white';g.font='17px sans-serif';g.fillText(id+' / '+(col?'Continuous glass':'Previous gap'),x+12,y+280);
}
writeFileSync(join(root,'art-src/helmet-glass-repair/runtime-review.png'),contact.toBuffer('image/png'));
console.log('Rendered before/after comparisons for all nine repaired glass windows.');
