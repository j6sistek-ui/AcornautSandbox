import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {makeProject,validateProject,serializeProject,createAnimation,acceptTap,stepAnimation,createSimulation,seekSimulation,transportTime,STEP,clone} from '../tools/flight-studio/core.mjs';
import {StudioRenderer} from '../tools/flight-studio/renderer.mjs';
import {paintPremiumFlightFrame,premiumFlightFrame,premiumFlightOrder} from '../tools/flight-studio/game/premium-flight.mjs';
import {createStudioServer} from '../tools/flight-studio/launch.mjs';
const require=createRequire(import.meta.url),{createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dir=join(root,'tools/flight-studio');
const manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex');
for(const [name,hash] of Object.entries(manifest.painterHashes))assert.equal(sha(readFileSync(join(root,'illustrated-src/game',name+'.ts'),'utf8').replaceAll('\r\n','\n')),hash,'rebuild stale painter '+name);
for(const name of ['core.mjs','app.mjs','renderer.mjs','index.html','styles.css'])assert.equal(readFileSync(join(dir,name),'utf8'),readFileSync(join(root,'illustrated-src/flight-studio',name),'utf8'),'stale studio build');
let assetCount=0;
for(const model of manifest.models){const project=makeProject(manifest,model);assert.equal(validateProject(project,manifest).model.id,model.id);
  for(const [path,hash] of Object.entries(model.hashes)){assert.equal(sha(readFileSync(join(root,'docs/art',path))),hash,path);assetCount++;}
  const exported=serializeProject(project,manifest),restored=validateProject(JSON.parse(exported),manifest).project;
  const a=createSimulation(model,project),b=createSimulation(model,restored);
  seekSimulation(a,8.25);seekSimulation(b,8.25);assert.deepEqual(a.animation,b.animation,'exported motion must replay exactly: '+model.id);
  // Window cadence and resuming a background window cannot change the result.
  for(const hz of [30,60,144]){const c=createSimulation(model,project);for(let i=1;i<=hz*4;i++)seekSimulation(c,i/hz);const d=createSimulation(model,project);seekSimulation(d,4);assert.deepEqual(c.animation,d.animation,model.id+' '+hz+' Hz');}
  const at=clone(a.animation);seekSimulation(a,8.25);assert.deepEqual(a.animation,at,'pause changes a pose');
  seekSimulation(a,project.pattern.duration+8.25);assert.deepEqual(a.animation,at,'repeat differs from first pass');
}
assert.equal(manifest.models.length,34);const rigs=manifest.models.filter(m=>!['bank','premium-flight'].includes(m.family));assert.equal(rigs.length,7);
assert.deepEqual(rigs.map(m=>m.id).sort(),['abyssal','arcflash','cinderforge','cosmic','groveguard','sunforged','vanguard'],'all seven original cut rigs remain available');
const premium=manifest.models.filter(m=>m.family==='premium-flight');assert.deepEqual(premium.map(m=>m.id).sort(),['nacre','origamist','porcelain']);
for(const model of premium){
  assert.equal(model.atlas,`suits/${model.id}/flight.png`);assert.equal(model.sheet.frameCount,16);assert.equal(model.sheet.frames.length,16);assert.equal(model.sheet.cellSize,256);assert.equal(model.sheet.fallbackFrame,0);
  assert.equal(model.banks.loop.length,16);assert(model.banks.loop.every(path=>path===model.atlas));
  assert(Object.keys(model.hashes).every(path=>!path.endsWith('/parts.png')),'full-body model cannot load the discarded cut-parts atlas');
  const project=makeProject(manifest,model),s=createAnimation(model),seen=new Set();assert.deepEqual(project.profile.parts,{});
  assert.equal(project.profile.retrigger,'queue','rapid taps finish the supplied paintings');assert.equal(project.profile.loopContinuous,false);
  acceptTap(s,project.profile);
  for(let i=0;i<240;i++){
    if(i===30)acceptTap(s,project.profile);
    stepAnimation(s,project.profile,STEP,-300);seen.add(s.frame);
    assert.equal(s.frame,premiumFlightFrame(model.id,s.native),model.id+' default Studio frame matches shipping tap lifecycle');
  }
  assert.deepEqual([...seen].sort((a,b)=>a-b),[...premiumFlightOrder(model.id)],model.id+' plays the shipping tap sequence');
  assert.equal(s.frame,model.sheet.fallbackFrame,model.id+' returns to fallback after queued playback');
  const pattern=createSimulation(model,project);
  for(let tick=1;tick<=project.pattern.duration/STEP;tick++){
    seekSimulation(pattern,tick*STEP);
    assert.equal(pattern.animation.frame,premiumFlightFrame(model.id,pattern.animation.native),model.id+' matches shipping frame at pattern tick '+tick);
  }
  const invalid=clone(project);invalid.profile.parts.head={offset:10};assert.throws(()=>validateProject(invalid,manifest),/do not have editable body parts/);
  const obsolete=clone(project);obsolete.model.family='high-orbit';assert.throws(()=>validateProject(obsolete,manifest),/different rig family/,'obsolete cut-rig presets cannot deform the new paintings');
  const reordered=clone(project);reordered.profile.tapOrder.reverse();const tuned=createAnimation(model);acceptTap(tuned,reordered.profile);stepAnimation(tuned,reordered.profile,STEP,-300);assert.equal(tuned.frame,15,'sheet frames can be reordered without altering artwork');
}
const ion=manifest.models.find(m=>m.id==='iontrim'),p=makeProject(manifest,ion).profile;
assert.equal(p.tapSource,'asc');
assert.equal(p.tapPath,'out-back');
const returning=createAnimation(ion);acceptTap(returning,p);for(let i=0;i<120;i++)stepAnimation(returning,p,STEP,-300);assert.equal(returning.frame,0,'out-and-back must finish at neutral');
p.tapPath='forward';
p.tapEase=1; // The following fixtures isolate linear timing and custom duration.
const a=createAnimation(ion),b=createAnimation(ion);acceptTap(a,p);acceptTap(b,p);
const visited=[];
for(let i=0;i<120;i++){stepAnimation(a,p,STEP,-450);stepAnimation(b,p,STEP,-60);assert.equal(a.frame,b.frame,'tap frame must not follow rise velocity');assert.notEqual(a.bank,'desc');visited.push(a.frame);}
assert.deepEqual([...new Set(visited)],[0,1,2,3,4,5,6,7]);
const long=clone(p);long.tapSeconds=1.5;const c=createAnimation(ion);acceptTap(c,long);for(let i=0;i<60;i++)stepAnimation(c,long,STEP,-300);assert.equal(c.frame,2,'1.5s cycle should be one-third complete at .5s');
const gate=createAnimation(ion);acceptTap(gate,p);for(let i=0;i<60;i++)stepAnimation(gate,p,STEP,400);assert.notEqual(gate.bank,'desc','finish-tap gate lost');
for(let i=0;i<120;i++)stepAnimation(gate,p,STEP,500);assert.equal(gate.bank,'desc');assert.ok(gate.fall>.8);
acceptTap(gate,p);stepAnimation(gate,p,STEP,-300);assert.equal(gate.bank,'asc');assert.equal(gate.frame,0);
for(const behavior of ['restart','continue','queue']){const q={...p,retrigger:behavior},s=createAnimation(ion);acceptTap(s,q);for(let i=0;i<60;i++)stepAnimation(s,q,STEP,-300);acceptTap(s,q);
  if(behavior==='restart')assert.equal(s.tapAge,0);else assert.ok(s.tapAge>.49);
  if(behavior==='queue'){assert.equal(s.queued,true);for(let i=0;i<61;i++)stepAnimation(s,q,STEP,-300);assert.ok(s.tapAge<.1);assert.equal(s.queued,false);}
}
const weighted=clone(p);weighted.tapWeights[0]=8;const w=createAnimation(ion);acceptTap(w,weighted);for(let i=0;i<50;i++)stepAnimation(w,weighted,STEP,-300);assert.equal(w.frame,0,'per-frame holds ignored');
const orbit=manifest.models.find(m=>m.id==='cosmic'),base=makeProject(manifest,orbit),tuned=clone(base);tuned.profile.parts.nearArm.offset=30;tuned.profile.parts.tailTip.tap=[0,15,-20,10,0];
const x=createSimulation(orbit,base),y=createSimulation(orbit,tuned);seekSimulation(x,.5);seekSimulation(y,.5);
assert.ok(Math.abs(y.animation.output.pose.nearArm-x.animation.output.pose.nearArm-30)<1e-6);
assert.ok(Math.abs(y.animation.output.pose.tailTip-x.animation.output.pose.tailTip)>10);
assert.equal(y.animation.output.pose.head,x.animation.output.pose.head,'arm edit changes head');
assert.equal(y.y,x.y,'visual tuning changes flight path');assert.equal(y.vy,x.vy);
const companion=manifest.models.find(m=>m.id==='hedgehog'),cp=makeProject(manifest,companion).profile,cs=createAnimation(companion);acceptTap(cs,cp);
for(let i=0;i<150;i++)stepAnimation(cs,cp,STEP,300);assert.equal(cs.frame,0,'companion must rest after its tap clip');
cp.loopContinuous=true;stepAnimation(cs,cp,STEP,300);assert.ok(cs.frame>0,'continuous option not honored');
const t={time:3,anchor:1000,speed:.5,playing:true};assert.equal(transportTime(t,3000),4);assert.equal(transportTime({...t,playing:false},9000),3);
for(const edit of [v=>v.version=99,v=>v.profile.tapSeconds=0,v=>v.profile.parts.head.offset=Infinity,v=>v.profile.tapOrder=[99],v=>v.pattern.events=[{at:5,type:'tap'},{at:2,type:'tap'}],v=>v.profile.descentFull=20,v=>v.view.scale=10000]){const bad=clone(base);edit(bad);assert.throws(()=>validateProject(bad,manifest));}
const changed=clone(base);changed.model.assets={};assert.equal(validateProject(changed,manifest).warnings.length,1);
// Render every model from actual local art: no missing-bank filters or stand-ins.
const renderer=new StudioRenderer(manifest,undefined,()=>createCanvas(1,1));
const contact=createCanvas(4*320,Math.ceil(manifest.models.length/4)*290),cc=contact.getContext('2d');cc.fillStyle='#101b2a';cc.fillRect(0,0,contact.width,contact.height);
for(const [i,model] of manifest.models.entries()){
  for(const path of new Set([model.file,model.atlas,...Object.values(model.banks).flat()].filter(Boolean)))renderer.images.set(path,await loadImage(join(root,'docs/art',path)));
  const helm=manifest.helmets.find(h=>h.id==='clear');if(!renderer.images.has(helm.file))renderer.images.set(helm.file,await loadImage(join(root,'docs/art',helm.file)));
  const project=makeProject(manifest,model);project.view.effects=false;const sim=createSimulation(model,project);seekSimulation(sim,.6);
  const tile=createCanvas(320,260),ctx=tile.getContext('2d');renderer.paint(ctx,model,project,sim,160,125,160);
  const pixels=ctx.getImageData(0,0,320,260).data;let ink=0;for(let j=3;j<pixels.length;j+=4)if(pixels[j]>10)ink++;
  assert.ok(ink>1000,model.id+' rendered no usable image');cc.drawImage(tile,i%4*320,Math.floor(i/4)*290);cc.fillStyle='#dae8f2';cc.font='14px sans-serif';cc.fillText(model.name+' · '+model.family,i%4*320+20,Math.floor(i/4)*290+275);
  if(model.family==='premium-flight'){
    const sheet=renderer.image(model.atlas);assert.equal(sheet.width,1024);assert.equal(sheet.height,1024);
    for(let frame=0;frame<16;frame++)for(const effects of [false,true]){
      const display=clone(sim);display.animation.bank='loop';display.animation.frame=frame;display.animation.slot=frame;
      const config=clone(project);config.view.effects=effects;config.view.helmet='cosmic';config.profile.tapOffsets[frame]=frame%2?13:0;
      const actual=createCanvas(320,320),expected=createCanvas(320,320),g=actual.getContext('2d'),draws=[],draw=g.drawImage;
      g.drawImage=function(image,...args){draws.push({image,args});return draw.call(this,image,...args);};
      renderer.paint(g,model,config,display,160,160,192);
      paintPremiumFlightFrame(expected.getContext('2d'),{premiumFlight:{[model.id]:sheet},suits:{[model.id]:renderer.image(model.file)}},model.id,160,160,192,frame,clone(sim.animation.output),{x:160,y:160,travel:sim.time*200},effects,(display.animation.pitch+config.profile.tapOffsets[frame])*Math.PI/180);
      assert.deepEqual(g.getImageData(0,0,320,320).data,expected.getContext('2d').getImageData(0,0,320,320).data,model.id+' frame '+frame+' matches shared shipping painter, effects='+effects);
      assert.equal(draws.length,1,'one complete painting, no assembled limbs or extra helmet');assert.equal(draws[0].image,sheet);
      assert.deepEqual(draws[0].args.slice(0,4),[frame%4*256,Math.floor(frame/4)*256,256,256]);
    }
  }
}
if(process.argv.includes('--write-review')){const review=join(root,'illustrated-src/design/flight-studio');mkdirSync(review,{recursive:true});writeFileSync(join(review,'model-review.png'),contact.toBuffer('image/png'));}
const server=await createStudioServer(0),url='http://127.0.0.1:'+server.address().port;
try{
  for(const path of ['/','/?viewer=1','/manifest.json','/core.mjs','/game/high-orbit.mjs','/game/premium-flight.mjs','/art/suits/cosmic/parts.png',...premium.map(m=>'/art/'+m.atlas)]){const res=await fetch(url+path);assert.equal(res.status,200,path);assert.ok((await res.arrayBuffer()).byteLength>0);}
  for(const path of ['/launch.mjs','/../../.git/config','/art/suits/../../../package.json','/art/suits/%5c..%5c..%5cpackage.json'])assert.equal((await fetch(url+path)).status,404,path);
  assert.equal((await fetch(url+'/manifest.json',{method:'POST',body:'blocked'})).status,405);
  assert.equal((await fetch(url+'/')).headers.get('content-security-policy').includes("connect-src 'self'"),true);
  const again=await promisify(execFile)(process.execPath,[join(dir,'launch.mjs'),'--port',String(server.address().port),'--no-open']);
  assert.match(again.stdout,/already running/,'second launch should reopen the existing tool');
}finally{await new Promise(r=>server.close(r));}
console.log(`PASS Flight Studio: ${manifest.models.length} models, ${assetCount} asset hashes, ${rigs.length} rigs, ${premium.length} full-body sheet banks, deterministic replay, tap-clock playback, descent gate, retriggers, weighted holds, export/import, invalid presets, all renderers, shared premium frame/wake pixel equality, read-only offline host.`);
