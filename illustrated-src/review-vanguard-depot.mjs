// Render the actual production painter + docking authority at phone dimensions.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image,GlobalFonts}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
// A local sans face substitutes for the browser's remotely supplied Figtree.
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Figtree');
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={location:{href:'http://local/'},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),addEventListener(){},documentElement:{style:{}}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.ACORNAUT_QA_OUTPUT||'/tmp/acornaut-vanguard-depot';mkdirSync(output,{recursive:true});
const Art=await import(root+'docs/js/art.js'),Draw=await import(root+'docs/js/draw.js'),Save=await import(root+'docs/js/save.js'),Sim=await import(root+'docs/js/sim.js'),S=await import(root+'docs/js/spill.js');
const {prepareDepotBear}=await import(root+'docs/js/spill-depot-bear.js');
async function sprite(path){
  const img=await loadImage(root+'docs/art/'+path),c=createCanvas(img.width,img.height),g=c.getContext('2d');g.drawImage(img,0,0);
  const d=g.getImageData(0,0,img.width,img.height).data;let x=img.width,y=img.height,r=0,b=0;
  for(let j=0;j<img.height;j++)for(let i=0;i<img.width;i++)if(d[(j*img.width+i)*4+3]>12){x=Math.min(x,i);y=Math.min(y,j);r=Math.max(r,i);b=Math.max(b,j);}
  img.box={x,y,w:r-x+1,h:b-y+1};img.core=Math.max(img.box.w,img.box.h);img.coreX=x+img.box.w/2;img.coreY=y+img.box.h/2;return img;
}
const bank=Art.emptyArt();bank.ready=true;
for(const id of Art.SPILL_SHIP_IDS)bank.spillShip[id]=await sprite('spill-ship/'+id+'.png');
bank.spillShipFit=JSON.parse(readFileSync(root+'docs/art/spill-ship/transforms.json'));
bank.suits.vanguard=await sprite('suits/vanguard.png');bank.helms.clear=await sprite('helms/clear.png');bank.squirrelIdle=[await sprite('squirrel/idle-1.png')];
bank.ore=await sprite('pickups/acorn-coin.svg');bank.golden=[await sprite('golden/1.png')];
bank.spillScene={depot:await loadImage(root+'docs/art/spill-scene/depot.png'),panorama:await loadImage(root+'docs/art/spill-scene/panorama.png'),
  bear:prepareDepotBear(await loadImage(root+'docs/art/spill-scene/depot-bear.jpg')),
  vanguardDepot:await loadImage(root+'docs/art/spill-scene/vanguard-depot.png')};
const save=Save.defaultSave();save.tutorialDone=true;save.guide='done';save.equippedSuit='vanguard';save.helpOff=true;
const world=Sim.makeWorld(390,760);Sim.resetRun(world,save,'spill',false);world.ready=false;
const state=world.spill;state.depotGagReady=true;S.spillHold(state,true);state.hints=false;state.hintT=0;
const canvas=createCanvas(780,1520),ctx=canvas.getContext('2d');ctx.scale(2,2);
const sequence=createCanvas(5*390,760),sg=sequence.getContext('2d');const sampleFrames=[72,101,126,159,183];
const opens=[];
for(let frame=0;frame<210;frame++){
  if(frame>0)for(let tick=0;tick<2;tick++){
    const before=state.phase;S.stepSpill(state,1/60);world.time+=1/60;
    if(before!=='depot'&&state.phase==='depot')opens.push(world.time);
  }
  world.squirrel.y=state.pilot.y;ctx.clearRect(0,0,390,760);Draw.drawWorld(ctx,world,save,bank);Draw.drawHud(ctx,world,bank,save);
  writeFileSync(join(output,'frame-'+String(frame).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
  if(sampleFrames.includes(frame))sg.drawImage(canvas,sampleFrames.indexOf(frame)*390,0,390,760);
  if(frame===126)writeFileSync(join(output,'vanguard-depot-preview.png'),canvas.toBuffer('image/png'));
}
assert.equal(opens.length,1);assert(Math.abs(opens[0]-6.2)<.035);
writeFileSync(join(output,'vanguard-depot-beats.png'),sequence.toBuffer('image/png'));
// Compare framing at the narrowest supported phone width and on desktop.
for(const width of [320,1280]){
  const w=Sim.makeWorld(width,760);Sim.resetRun(w,save,'spill',false);w.ready=false;w.spill.phase='docking';w.spill.welcome=true;w.spill.phaseT=4.2;w.spill.depotGag=true;w.spill.hints=false;
  const c=createCanvas(width,760);Draw.drawWorld(c.getContext('2d'),w,save,bank);Draw.drawHud(c.getContext('2d'),w,bank,save);
  writeFileSync(join(output,`vanguard-depot-${width}.png`),c.toBuffer('image/png'));
}
console.log(JSON.stringify({frames:210,fps:30,viewport:[390,760],depotOpenedAt:opens[0],output}));
