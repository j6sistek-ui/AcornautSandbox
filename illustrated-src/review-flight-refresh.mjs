// Review the exact production renderer on native Canvas, including helmet layers.
import {createRequire} from 'node:module';
import {cpSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=process.env.FLIGHT_REVIEW_SCRATCH||join(root,'../flight-review');
const output=process.env.FLIGHT_REVIEW_OUTPUT||join(root,'art-src/flight-refresh/review');
mkdirSync(scratch,{recursive:true});mkdirSync(output,{recursive:true});
cpSync(join(root,'docs/js'),join(scratch,'js'),{recursive:true});
writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
for(const name of readdirSync(join(scratch,'js')).filter(n=>n.endsWith('.js'))) {
  const path=join(scratch,'js',name);let code=readFileSync(path,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
  if(name==='art.js')code+='\nexport {asSprite};\n';
  writeFileSync(path,code);
}
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const mod=file=>import(pathToFileURL(join(scratch,'js',file+'.js')).href);
const [Draw,Art,Cat,Control]=await Promise.all(['draw','art','catalog','control-constants'].map(mod));
const suits=['copper','cryostar','verdant','sammie','gemmie'];const bank=Art.emptyArt();
async function sprite(path){const im=await loadImage(join(root,'docs/art',path));Object.defineProperty(im,'src',{get:()=>path});return Art.asSprite(im);}
bank.helms.clear=await sprite('helms/clear.png');
for(const s of suits){
  bank.suits[s]=await sprite(`suits/${s}.png`);
  bank.suitBody[s]=await sprite(`suits/${s}-body.png`);bank.suitTail[s]=await sprite(`suits/${s}-tail.png`);
  for(const k of ['Asc','Desc'])bank['suit'+k][s]=await Promise.all(Array.from({length:8},(_,i)=>sprite(`suits/${s}-${k.toLowerCase()}-${i+1}.png`)));
  if(s!=='copper')bank.helms[s]=await sprite(`helms/${s}.png`);
}
const captures=[];
for(const s of suits){
  const strip=createCanvas(256*12,520),g=strip.getContext('2d');g.fillStyle='#172231';g.fillRect(0,0,strip.width,strip.height);
  const suit=Cat.SUITS.find(x=>x.id===s);
  for(let n=0;n<12;n++)for(let row=0;row<2;row++){
    const helmet=Cat.HELMETS.find(h=>h.id===(row&&s!=='copper'?s:'clear'));
    const t=n*.13;
    Draw.paintFlightPreview(g,bank,suit,helmet,n*256+128,row*260+125,190,t,Control.SUIT_LEAN_DEFAULT,false,0);
    g.fillStyle='white';g.font='13px sans-serif';g.fillText(`${s} / ${helmet.id} / ${t.toFixed(2)}s`,n*256+12,row*260+244);
    captures.push({suit:s,helmet:helmet.id,time:t,pose:window.__acornautPose});
  }
  writeFileSync(join(output,s+'-runtime.png'),strip.toBuffer('image/png'));
}
writeFileSync(join(output,'runtime-poses.json'),JSON.stringify({build:Cat.ART_VER,captures},null,2));
console.log('Rendered 120 production loadout samples with Clear and matching helmets.');
