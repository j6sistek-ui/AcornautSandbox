// The replacement trio accepts input through Cyber's standard controller.
// Actual frame/timing equality is checked against the immutable Cyber trace
// by test-premium-pilots; this exercises accepted input and all beta dials.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
globalThis.window={__ACORNAUT_BETA__:true};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const [Sim,S]=await Promise.all(['sim','save'].map(n=>import('../docs/js/'+n+'.js')));
const ids=['origamist','porcelain','nacre'],results=[];
function setup(id,repeat){
  const save=S.defaultSave();Object.assign(save,{equippedSuit:id,tutorialDone:true,guide:'done'});
  if(repeat)save.tapRepeat={[id]:repeat};
  const w=Sim.makeWorld(390,20000);Sim.resetRun(w,save,'fly',false);
  w.planets=[];w.debris=[];w.pickups=[];w.lastSpawnX=100000;w.invulnLeft=999;
  return {w,save};
}
function controlState(w){return {squirrel:w.squirrel,tailA:w.tailA,tailV:w.tailV,tapAnimT:w.tapAnimT,tapAnimDir:w.tapAnimDir,tapAnimQueued:w.tapAnimQueued,flapBoost:w.flapBoost};}
for(const id of ids)for(const fps of [30,60,120])for(const repeat of [undefined,'finish','rewind','restart']){
  const target=setup(id,repeat),cyber=setup('cyber',repeat);
  assert.equal(Sim.repeatTapMode(id,target.save),repeat??'rewind');
  for(let tick=0;tick<fps*3;tick++){
    if([0,Math.round(fps*.3),Math.round(fps*.45),fps].includes(tick)){
      for(const item of [target,cyber])assert.equal(Sim.flap(item.w,item.save),'flap');
    }
    if(tick===fps*2)for(const item of [target,cyber])Sim.dive(item.w,item.save);
    for(const item of [target,cyber])Sim.updateWorld(item.w,item.save,1/fps);
    assert.deepEqual(controlState(target.w),controlState(cyber.w),id+' Cyber control parity '+fps+'fps '+(repeat??'default')+' tick '+tick);
    assert.equal(target.w.highOrbit.frames,undefined,id+' cannot activate legacy sixteen-frame playback');
  }
  const before=controlState(target.w);target.w.screen='pause';Sim.updateWorld(target.w,target.save,1/fps);
  assert.deepEqual(controlState(target.w),before,id+' pause preserves standard control state');
  Sim.resetRun(target.w,target.save,'fly',false);assert.equal(target.w.tapAnimQueued,false);assert.equal(target.w.highOrbit.frames,undefined);
  results.push({id,fps,repeat:repeat??'default rewind',ticks:fps*3});
}
const report={verified:true,suite:'premium trio standard input',reference:'Cyber',results};
if(process.env.ACORNAUT_QA_OUTPUT)writeFileSync(process.env.ACORNAUT_QA_OUTPUT+'/patriot-input.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
