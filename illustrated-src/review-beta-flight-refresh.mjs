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
const captures=[];
for(const s of suits){
  const strip=createCanvas(256*12,520),g=strip.getContext('2d');g.fillStyle='#172231';g.fillRect(0,0,strip.width,strip.height);
  const suit=Cat.SUITS.find(x=>x.id===s);
  for(let n=0;n<12;n++)for(let row=0;row<2;row++){
    const helmet=Cat.HELMETS.find(h=>h.id===(row?s:'clear'));
    const t=n*.13;
    Draw.paintFlightPreview(g,bank,suit,helmet,n*256+128,row*260+125,150,t,Control.SUIT_LEAN_DEFAULT,false,0);
    g.fillStyle='white';g.font='13px sans-serif';g.fillText(`${s} / ${helmet.id} / ${t.toFixed(2)}s`,n*256+12,row*260+244);
    captures.push({suit:s,helmet:helmet.id,time:t,pose:window.__acornautPose});
  }
  writeFileSync(join(output,s+'-runtime.png'),strip.toBuffer('image/png'));
}
writeFileSync(join(output,'runtime-poses.json'),JSON.stringify({build:Cat.ART_VER,captures},null,2));
let verified=0;
for(const s of suits)for(const size of [54,190])for(const helmId of ['clear',s])for(let n=0;n<16;n++) {
  const canvas=createCanvas(384,384),ctx=canvas.getContext('2d');
  const suit=Cat.SUITS.find(x=>x.id===s),helmet=Cat.HELMETS.find(x=>x.id===helmId);
  const v=n<8?-n/7:(n-8)/7;
  Draw.paintRegisteredPose(ctx,bank.suits[s],192,192,size,helmet,suit,0,bank,'idle-1',undefined,undefined,0,'dark',0,-1,-1,0,0,0,0,0,Control.SUIT_LEAN_DEFAULT,v);
  assert.equal(window.__acornautPose.suit,s);
  assert.equal(window.__acornautPose.bank,n>8?'desc':'asc');
  assert.equal(window.__acornautPose.idx,n%8+1);
  const data=ctx.getImageData(0,0,384,384).data;assert.ok(data.some((x,i)=>i%4===3&&x>0));verified++;
}
writeFileSync(join(output,'runtime-checks.json'),JSON.stringify({build:Cat.ART_VER,verified,posesPerSuit:16,sizes:[54,190],helmets:'Clear and matching',retiredLayersLoaded:false},null,2)+'\n');
console.log(`Rendered 120 beta loadout samples and verified ${verified} full-bank renders without retired rig/tap layers.`);
if(process.env.BETA_FLIGHT_FILM) {
  const filmDir=process.env.BETA_FLIGHT_FILM;mkdirSync(filmDir,{recursive:true});
  for(let n=0;n<64;n++) {
    const frame=createCanvas(1200,660),g=frame.getContext('2d');g.fillStyle='#111d2b';g.fillRect(0,0,1200,660);
    g.fillStyle='white';g.font='23px sans-serif';g.fillText('New flight sheets • Cinderforge / Groveguard / Cosmic / Sunforged / Abyssal',24,36);
    g.font='16px sans-serif';g.fillStyle='#b9cbdd';g.fillText('Clear helmets',24,66);g.fillText('Matching helmets',24,363);
    for(let row=0;row<2;row++)for(let j=0;j<5;j++) {
      const s=suits[j],suit=Cat.SUITS.find(x=>x.id===s),helm=Cat.HELMETS.find(h=>h.id===(row?s:'clear'));
      Draw.paintFlightPreview(g,bank,suit,helm,j*240+120,193+row*297,145,n*.05,Control.SUIT_LEAN_DEFAULT,false,0);
      g.fillStyle='white';g.font='17px sans-serif';g.fillText(suit.name,j*240+60,315+row*297);
    }
    writeFileSync(join(filmDir,String(n).padStart(3,'0')+'.png'),frame.toBuffer('image/png'));
  }
}
