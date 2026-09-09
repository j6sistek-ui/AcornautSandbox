#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),addEventListener(){},documentElement:{style:{}}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const R=await import('../docs/js/high-orbit.js'),M=await import('../docs/js/high-orbit-motion.js'),C=await import('../docs/js/high-orbit-config.js');
const E=await import('../docs/js/high-orbit-effects.js'),P=await import('../docs/js/high-orbit-parts.js');
const Cat=await import('../docs/js/catalog.js'),S=await import('../docs/js/save.js'),Sim=await import('../docs/js/sim.js'),Race=await import('../docs/js/race.js');
const D=await import('../docs/js/draw.js');
const ids=['cinderforge','groveguard','cosmic','sunforged','abyssal'];
assert.deepEqual(C.HIGH_ORBIT_IDS,ids);
const art={suits:{},highOrbit:{},helms:{},squirrelIdle:[],squirrelFlap:[]},results=[];
for(const id of ids){
 art.highOrbit[id]=await loadImage(root+'docs/art/suits/'+id+'/parts.png');
 art.suits[id]=await loadImage(root+'docs/art/suits/'+id+'.png');
}
for(const h of Cat.HELMETS){try{art.helms[h.id]=await loadImage(root+'docs/art/helms/'+h.id+'.png');}catch{}}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const rgba=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
function connected(data,W,H){
 const seen=new Uint8Array(W*H),q=new Int32Array(W*H),areas=[];
 for(let start=0;start<W*H;start++){
   if(seen[start]||data[start*4+3]<100)continue;let count=1,rd=0;q[0]=start;seen[start]=1;
   const add=i=>{if(!seen[i]&&data[i*4+3]>=100){seen[i]=1;q[count++]=i;}};
   while(rd<count){const i=q[rd++],x=i%W,y=Math.floor(i/W);if(x)add(i-1);if(x<W-1)add(i+1);if(y)add(i-W);if(y<H-1)add(i+W);}
   areas.push(count);
 }return areas.sort((a,b)=>b-a);
}
const contact=createCanvas(256*ids.length,256*3),cc=contact.getContext('2d');cc.fillStyle='#101a2e';cc.fillRect(0,0,contact.width,contact.height);
for(const [column,id] of ids.entries()){
 const atlas=art.highOrbit[id],parts=P.HIGH_ORBIT_PARTS[id];
 assert.equal(atlas.width,1024);assert.equal(atlas.height,768);assert.equal(parts.length,11);
 const source=createCanvas(1024,768),sc=source.getContext('2d');sc.drawImage(atlas,0,0);
 const px=rgba(source);
 const skull=parts[0].skull;
 for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(px[(y*1024+x)*4+3]>=128)
   assert(distance([x,y],skull)<skull[2]*1.02,id+' full head including ears fits the standard glass circle');
 for(let cell=0;cell<12;cell++)for(let i=0;i<256;i++)for(const [x,y] of [[i,0],[i,255],[0,i],[255,i]]){
   assert(px[((Math.floor(cell/4)*256+y)*1024+cell%4*256+x)*4+3]<16,id+' transparent cell padding');
 }
 for(const cell of [0,10])for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const i=((Math.floor(cell/4)*256+y)*1024+cell%4*256+x)*4;
   assert(!(px[i+3]>160&&px[i+2]>px[i+1]+25),id+' no magenta matte on head/tail');
 }
 const fallback=createCanvas(256,256),fg=fallback.getContext('2d');
 R.paintHighOrbit(fg,art,id,128,128,192,undefined,undefined,false);
 const still=createCanvas(256,256);still.getContext('2d').drawImage(art.suits[id],0,0);
 assert.deepEqual(rgba(fallback),rgba(still),id+' fallback equals rig pixels at canonical size');
 const state=M.createHighOrbitMotion(id),canvas=createCanvas(256,256),ctx=canvas.getContext('2d'),tail=createCanvas(256,256),tg=tail.getContext('2d');
 let maxStep=0,maxStray=0,minHeadGap=Infinity,minJoint=1,minAreaRatio=Infinity,maxAreaRatio=0,minBody=Infinity,maxBody=-Infinity,minTail=Infinity,maxTail=-Infinity;
 let before=structuredClone(state.pose),vy=0;
 for(let tick=0;tick<960;tick++){
   const time=tick/120;
   if(time<4&&tick%22===0)vy=-450;else if(tick===700)vy=610;else vy=Math.min(610,vy+1100/120);
   M.stepHighOrbit(state,id,1/120,vy);
   for(const [key,value] of Object.entries(state.pose)){assert(Number.isFinite(value));maxStep=Math.max(maxStep,Math.abs(value-before[key]));}
   assert(Math.abs(state.pose.head)<4,id+' stabilized head attitude');
   minBody=Math.min(minBody,state.pose.body);maxBody=Math.max(maxBody,state.pose.body);
   minTail=Math.min(minTail,state.pose.tailTip);maxTail=Math.max(maxTail,state.pose.tailTip);
   const j=R.highOrbitLandmarks(id,state.pose),mesh=R.highOrbitTailMesh(id,state.pose),spec=parts[10];
   const scale=79/distance(spec.a,spec.b);
   for(const [a,b,c] of R.HIGH_ORBIT_TAIL_TRIANGLES){
     const ratio=area(mesh.points[a],mesh.points[b],mesh.points[c])/(area(mesh.source[a],mesh.source[b],mesh.source[c])*scale*scale);
     minAreaRatio=Math.min(minAreaRatio,ratio);maxAreaRatio=Math.max(maxAreaRatio,ratio);
     assert(Math.abs(ratio-1)<1e-9,id+' tail strips preserve signed area; no fold or volume drift');
   }
   for(const [a,b,len] of [['neck','hip',62],['nearShoulder','nearElbow',25],['nearElbow','nearWrist',23],['nearHip','nearKnee',28],['nearKnee','nearBoot',29]])
     assert(Math.abs(distance(j[a],j[b])-len)<1e-9,id+' fixed '+a+' bone');
   if(tick%12===0){
     ctx.clearRect(0,0,256,256);R.paintHighOrbit(ctx,art,id,128,128,192,state,undefined,false);
     const pixels=rgba(canvas),areas=connected(pixels,256,256);maxStray=Math.max(maxStray,areas[1]||0);
     assert(areas[0]>8500,id+' complete body is painted');
     assert((areas[1]||0)<32,id+' no detached limb or stray anatomy');
     for(const key of ['neck','nearElbow','farElbow','nearKnee','farKnee','nearShoulder']){
       const [x,y]=j[key];let ink=0;
       for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++)if(pixels[((Math.round(y)+oy)*256+Math.round(x)+ox)*4+3]>=100)ink++;
       minJoint=Math.min(minJoint,ink/25);assert(ink>=18,id+' covered joint '+key+' '+ink+'/25');
     }
     tg.clearRect(0,0,256,256);R.paintHighOrbitTail(tg,atlas,id,state.pose);const tp=rgba(tail);
     for(let y=0;y<256;y+=2)for(let x=0;x<256;x+=2)if(tp[(y*256+x)*4+3]>128){
       const gap=distance([x,y],j.head)-36;minHeadGap=Math.min(minHeadGap,gap);
       assert(gap>3,id+' actual tail ink stays outside skull');
     }
     for(let i=0;i<256;i++)for(const [x,y] of [[0,i],[255,i],[i,0],[i,255]])assert(pixels[(y*256+x)*4+3]<25,id+' unclipped body at canonical 256px');
   }
   before={...state.pose};
 }
 assert(maxStep<2.5,id+' no joint snap under repeated taps');
 assert(maxBody-minBody>20,id+' meaningful climb/dive body response');
 assert(maxTail-minTail>30,id+' expressive tail motion');
 const saved=structuredClone(state);for(const [dt,v] of [[0,0],[-1,0],[NaN,0],[.01,NaN]])M.stepHighOrbit(state,id,dt,v);
 assert.deepEqual(state,saved,id+' invalid input/pause does not advance');
 const rates=[];
 for(const fps of [30,60,120]){
   const s=M.createHighOrbitMotion(id);
   for(let tick=0;tick<fps*6;tick++)M.stepHighOrbit(s,id,1/fps,tick<fps*2?-420:tick<fps*4?0:610);
   rates.push(s);
 }
 for(const other of rates.slice(1))for(const key of Object.keys(other.pose))assert(Math.abs(other.pose[key]-rates[0].pose[key])<.7,id+' consistent 30/60/120 fps '+key);
 // Every compatible helmet is actually composited by the shipping preview.
 const suit=Cat.SUITS.find(s=>s.id===id);
 for(const h of Cat.HELMETS.filter(h=>!h.suitOnly||h.suitOnly===id)){
   ctx.clearRect(0,0,256,256);D.paintFlightPreview(ctx,art,suit,h,128,128,192,0);
   assert(connected(rgba(canvas),256,256)[0]>8000,id+' rendered with '+h.id);
 }
 for(let row=0;row<3;row++){
   const h=Cat.HELMETS.find(h=>h.id===(row===0?'clear':row===1?id:'ion'));
   D.paintFlightPreview(cc,art,suit,h,column*256+128,row*256+133,184,row*1.2);
   cc.fillStyle='#dae7f4';cc.font='13px sans-serif';cc.fillText(id+' / '+h.name,column*256+10,row*256+18);
 }
 // Exclusive effect availability follows the suit; selector never steals it.
 const trail=C.HIGH_ORBIT_PROFILES[id].trail,save=S.defaultSave();
 assert.equal(Cat.trailWornBy('ion',id),trail);
 for(const other of Cat.SUITS)assert.equal(Cat.canWearTrail(trail,other.id),other.id===id);
 assert(!Cat.IAP_ITEMS.includes(trail),'built-in wake has no shop price');
 save.unlockedSuits.push(id);assert(S.trailUnlocked(save,trail));save.equippedSuit=id;save.tutorialDone=true;save.guide='done';
 const world=Sim.makeWorld(390,5000);Sim.resetRun(world,save,'fly',false);Sim.updateWorld(world,save,1/60);
 assert(world.highOrbit.time>0,id+' live READY pose advances');
 const random=Math.random;let rng=0;Math.random=()=>{rng++;return .5;};
 try{Sim.spawnTrail(world,save,.5);}finally{Math.random=random;}
 assert.equal(rng,0);assert.equal(world.particles.length,0);
 assert.equal(Sim.flap(world,save),'flap');for(let i=0;i<18;i++)Sim.updateWorld(world,save,1/60);
 assert(world.highOrbit.time>.25,id+' real flight consumes accepted velocity');
 for(const hold of ['pause','shield','warp','stuck']){
   const old=JSON.stringify(world.highOrbit);
   if(hold==='pause')world.screen='pause';if(hold==='shield')world.shieldFreeze=.3;if(hold==='warp')world.warpT=.3;if(hold==='stuck')world.stuck=true;
   Sim.updateWorld(world,save,1/60);assert.equal(JSON.stringify(world.highOrbit),old,id+' '+hold+' freezes pose');
   world.screen='play';world.shieldFreeze=0;world.warpT=0;world.stuck=false;
 }
 const small=Sim.makeWorld(390,844),large=Sim.makeWorld(900,900),authority=Race.createRaceState();
 for(const w of [small,large]){Sim.resetRun(w,save,'fly',false);w.race=Race.createRaceState();Sim.setRaceInput(w,{held:true,boost:false});}
 Race.queueRaceInput(authority,{held:true,boost:false});
 for(let i=0;i<20;i++){Sim.updateWorld(small,save,1/120);Sim.updateWorld(large,save,1/30);Race.stepRace(authority);}
 assert.deepEqual(small.race,authority,id+' no race authority changes');
 assert.deepEqual(small.highOrbit,large.highOrbit,id+' canonical race motion independent of viewport');
 assert(small.highOrbit.time>0);
 const trailImage=createCanvas(80,40),tc=trailImage.getContext('2d');E.paintHighOrbitWake(tc,id,40,20,0);
 assert(rgba(trailImage).some((n,i)=>i%4===3&&n>100),id+' first-paint trail preview is visible');
 results.push({id,maxJointStep:maxStep,minHeadGap,minJointCoverage:minJoint,maxDetachedPixels:maxStray,minTailAreaRatio:minAreaRatio,maxTailAreaRatio:maxAreaRatio,bodyRange:maxBody-minBody,tailRange:maxTail-minTail});
}
mkdirSync(root+'illustrated-src/design/high-orbit',{recursive:true});
writeFileSync(root+'illustrated-src/design/high-orbit/helmet-review.png',contact.toBuffer('image/png'));
writeFileSync(root+'illustrated-src/design/high-orbit/regression.json',JSON.stringify({passed:true,results},null,2)+'\n');
const expected=JSON.parse(readFileSync(root+'art-src/high-orbit/shipping-hashes.json','utf8'));
for(const [path,hash] of Object.entries(expected))assert.equal(createHash('sha256').update(readFileSync(root+path)).digest('hex'),hash,path+' shipping receipt');
console.log(JSON.stringify({passed:true,results},null,2));
