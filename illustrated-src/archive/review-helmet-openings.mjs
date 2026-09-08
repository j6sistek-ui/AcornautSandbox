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
const beforePath=join(scratch,'js/draw-before.js');
writeFileSync(beforePath,readFileSync(join(scratch,'js/draw.js'),'utf8').replace('clearHelmetRearCollar(cc, id);',''));
const Before=await import(pathToFileURL(beforePath).href);
const {HELMET_COLLAR_OPENINGS}=await mod('helmet-openings');
const ids=[...Object.keys(HELMET_COLLAR_OPENINGS),'gemmie'];
bank.suits.leviathan=await sprite('suits/leviathan.png');
bank.suitBody.leviathan=await sprite('suits/leviathan-body.png');
bank.suitTail.leviathan=await sprite('suits/leviathan-tail.png');
for(const id of ids)bank.helms[id]=await sprite('helms/'+id+'.png');
const outputDir=join(root,'art-src/flight-refresh/helmet-openings');mkdirSync(outputDir,{recursive:true});
for(let page=0;page<Math.ceil(ids.length/5);page++){
 const c=createCanvas(1500,690),g=c.getContext('2d');g.fillStyle='#172231';g.fillRect(0,0,c.width,c.height);
 for(let col=0;col<5;col++){
 const id=ids[page*5+col];if(!id)continue;
 const helm=Cat.HELMETS.find(h=>h.id===id),suit=Cat.SUITS.find(s=>s.id===(helm.suitOnly||'sammie'));
 for(let row=0;row<2;row++){
 (row?Draw:Before).paintFlightPreview(g,bank,suit,helm,col*300+150,row*330+165,270,.52,Control.SUIT_LEAN_DEFAULT,false,0);
 g.fillStyle='white';g.font='17px sans-serif';g.fillText(`${id} / ${row?'Clear inner arc':'Before'}`,col*300+12,row*330+317);
 }
 }
 writeFileSync(join(outputDir,'page-'+(page+1)+'.png'),c.toBuffer('image/png'));
}
// Standalone cutouts reveal residual arc edges more clearly than a face overlay.
const raw=createCanvas(5*256,Math.ceil(ids.length/5)*290),rg=raw.getContext('2d');rg.fillStyle='#314157';rg.fillRect(0,0,raw.width,raw.height);
const {clearHelmetRearCollar}=await mod('helmet-openings');
for(let n=0;n<ids.length;n++){
 const im=await loadImage(join(root,'docs/art/helms',ids[n]+'.png')),c=createCanvas(256,256),g=c.getContext('2d');g.drawImage(im,0,0);clearHelmetRearCollar(g,ids[n]);rg.drawImage(c,n%5*256,Math.floor(n/5)*290);rg.fillStyle='white';rg.font='18px sans-serif';rg.fillText(ids[n],n%5*256+12,Math.floor(n/5)*290+278);
}writeFileSync(join(outputDir,'cutouts.png'),raw.toBuffer('image/png'));
