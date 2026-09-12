// Reproducible before/after from actual game painters and accepted taps.
import {createRequire} from 'node:module';
import {cpSync,mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(import.meta.dirname,'..'),out=process.env.ACORNAUT_QA_OUTPUT;
if(!out||!process.env.ACORNAUT_INPUT_JS)throw Error('Set output and baseline bundle directories');
const scratch=mkdtempSync(join(tmpdir(),'tap-bank-review-'));
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const entries=[];
for(const [row,id] of ['eclipse','iontrim','origamist'].entries())for(const side of [0,1]){
 const dir=join(scratch,id+'-'+side);cpSync(side?join(root,'docs/js'):process.env.ACORNAUT_INPUT_JS,dir,{recursive:true});writeFileSync(join(dir,'package.json'),'{"type":"module"}');
 for(const f of readdirSync(dir).filter(f=>f.endsWith('.js'))){let text=readFileSync(join(dir,f),'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');if(f==='draw.js')text+='\nexport {drawPilot};';if(f==='art.js')text+='\nexport {asSprite};';writeFileSync(join(dir,f),text);}
 const [D,A,Sim,S]=await Promise.all(['draw','art','sim','save'].map(n=>import(pathToFileURL(join(dir,n+'.js')).href))),art=A.emptyArt();
 async function sprite(f){const im=await loadImage(join(root,'docs/art',f));Object.defineProperty(im,'src',{get:()=>f});return A.asSprite(im);}
 art.suits[id]=await sprite('suits/'+id+'.png');art.helms.clear=await sprite('helms/clear.png');
 if(id==='origamist')(art.premiumFlight??={})[id]=await loadImage(join(root,'docs/art/suits/origamist/flight.png'));
 else for(const bank of ['Asc','Desc'])art['suit'+bank][id]=await Promise.all(Array.from({length:8},(_,i)=>sprite('suits/'+id+'-'+bank.toLowerCase()+'-'+(i+1)+'.png')));
 art.squirrelIdle=[await sprite('squirrel/idle-1.png')];art.squirrelFlap=[await sprite('squirrel/flap-1.png')];art.ready=true;
 const save=S.defaultSave();Object.assign(save,{equippedSuit:id,tutorialDone:true,guide:'done'});const w=Sim.makeWorld(390,20000);Sim.resetRun(w,save,'fly',false);w.planets=[];w.debris=[];w.pickups=[];w.lastSpawnX=100000;w.invulnLeft=999;
 entries.push({row,side,id,D,Sim,save,w,art});
}
const canvas=createCanvas(680,640),g=canvas.getContext('2d'),frames=join(out,'tap-review-frames');mkdirSync(frames,{recursive:true});
// One tap, release, then a rapid burst. Review runs at real time.
for(let tick=0;tick<480;tick++){
 const tap=tick===12||(tick>=240&&tick<384&&(tick-240)%18===0);
 for(const e of entries){if(tap)e.Sim.flap(e.w,e.save);e.Sim.updateWorld(e.w,e.save,1/120);}
 if(tick%4)continue;
 g.fillStyle='#111a2c';g.fillRect(0,0,680,640);g.fillStyle='#edf5ff';g.font='bold 18px sans-serif';g.fillText('Before',230,27);g.fillText('Corrected',476,27);
 for(const e of entries){const y=130+e.row*182;e.D.drawPilot(g,e.w,e.save,e.art,e.side?530:278,2.8,y);if(!e.side){g.fillStyle='#d8e6ff';g.font='bold 17px sans-serif';g.fillText(e.id==='iontrim'?'Ion':e.id==='origamist'?'Patriot':'Eclipse',12,y);}}
 const recent=tick>=240&&tick<384?(tick-240)%18<8:tick>=12&&tick<24;
 g.fillStyle=recent?'#63f4bd':'#94a8c1';g.font='bold 18px sans-serif';g.fillText(recent?'TAP':tick<240?'Single tap, then release':tick<384?'Rapid taps every 150 ms':'Released',18,608);
 g.fillStyle='#94a8c1';g.font='14px sans-serif';g.fillText((tick/120).toFixed(2)+' s',598,608);
 writeFileSync(join(frames,String(tick/4).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
}
rmSync(scratch,{recursive:true,force:true});console.log('Rendered 120 before/after frames from real input and painters.');
