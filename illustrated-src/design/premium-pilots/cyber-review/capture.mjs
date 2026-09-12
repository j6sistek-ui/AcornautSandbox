// Independent QA. Uses exported production Sim + drawPilot, not a pose player.
import {createRequire} from 'node:module';
import {cpSync,mkdirSync,readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
let root=dirname(fileURLToPath(import.meta.url));
while(!existsSync(join(root,'illustrated-src/GOLD_STANDARD.md'))){const parent=dirname(root);if(parent===root)throw new Error('Repository root not found');root=parent;}
const out=join(root,'outputs/cyber-standard-trio',process.env.CYBER_REVIEW_OUTPUT||'independent-runtime');
mkdirSync(out,{recursive:true});const scratch=join(out,'modules');mkdirSync(scratch,{recursive:true});
cpSync(join(root,'docs/js'),scratch,{recursive:true});writeFileSync(join(out,'package.json'),'{"type":"module"}');
for(const file of readdirSync(scratch).filter(x=>x.endsWith('.js'))){
 const p=join(scratch,file);let code=readFileSync(p,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
 if(file==='draw.js')code+='\nexport {drawPilot,paintIllustrated};\n';
 if(file==='art.js')code+='\nexport {asSprite};\n';writeFileSync(p,code);
}
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const mod=f=>import(pathToFileURL(join(scratch,f+'.js')).href);
const [D,A,Sim,S,C]=await Promise.all(['draw','art','sim','save','catalog'].map(mod));
const ids=process.argv.slice(2).length?process.argv.slice(2):['cyber','porcelain'];const labels=new WeakMap(),art=A.emptyArt(),provenance=[];
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
async function sprite(file){const path=join(root,'docs/art',file),im=await loadImage(path);Object.defineProperty(im,'src',{get:()=>file});labels.set(im,file);provenance.push({path:'docs/art/'+file,sha256:hash(path)});return A.asSprite(im);}
for(const id of ids){
 art.suits[id]=await sprite(`suits/${id}.png`);
 for(const [bank,key] of [['asc','suitAsc'],['desc','suitDesc']])art[key][id]=await Promise.all(Array.from({length:9},(_,i)=>sprite(`suits/${id}-${bank}-${i+1}.png`)));
 art.suitBody[id]=await sprite(`suits/${id}-body.png`);art.suitTail[id]=await sprite(`suits/${id}-tail.png`);
}
art.helms.clear=await sprite('helms/clear.png');art.squirrelIdle=[await sprite('squirrel/idle-1.png')];art.squirrelFlap=[await sprite('squirrel/flap-1.png')];art.ready=true;
const scenarios={single:t=>t===0?'tap':null,repeat150:t=>t%9===0?'tap':null,dive:t=>t===0?'tap':t===60?'dive':null,burst:t=>t<30&&t%6===0?'tap':null,reset:t=>t===0?'tap':t===70?'reset':null};
const results={};
function world(id){const save=S.defaultSave();Object.assign(save,{equippedSuit:id,tutorialDone:true,guide:'done',equippedTrail:'none'});const w=Sim.makeWorld(390,20000);Sim.resetRun(w,save,'fly',false);w.planets=[];w.debris=[];w.pickups=[];w.lastSpawnX=100000;w.invulnLeft=999;w.screen='play';w.ready=false;w.warpT=0;return{w,save};}
// Mirror the lab's synchronized rows using one renderer module instance.
const synchronized=[];
for(const [scenario,script] of Object.entries(scenarios)){
 const DC=await import(pathToFileURL(join(scratch,'draw.js')).href+`?synchronized=${scenario}`);
 const states=Object.fromEntries(ids.map(id=>[id,world(id)])),g=createCanvas(300,300).getContext('2d');
 for(let tick=0;tick<120;tick++){
  const rows=[];
  for(const id of ids){let {w,save}=states[id];const act=script(tick);
   if(act==='reset'){states[id]=world(id);({w,save}=states[id]);Sim.flap(w,save);}
   if(act==='tap')Sim.flap(w,save);if(act==='dive')Sim.dive(w,save);
   Sim.updateWorld(w,save,1/60);DC.drawPilot(g,w,save,art,150,1,150,.8,false);
   rows.push({id,frame:window.__acornautPose.bank+'-'+window.__acornautPose.idx,vy:w.squirrel.vy,tailA:w.tailA});
  }
  synchronized.push({scenario,tick,rows,equal:rows.every(r=>r.frame===rows[0].frame&&r.vy===rows[0].vy&&r.tailA===rows[0].tailA)});
 }
}
writeFileSync(join(out,'synchronized-rows.json'),JSON.stringify({method:`One production draw module, ${ids.length} synchronized Sim worlds, all rows rendered at each60Hz tick. Checks shared velocity smoother behavior in lab-like ordering.`,rows:synchronized},null,2)+'\n');
for(const size of [52,192])for(const [scenario,script] of Object.entries(scenarios)){
 const count=120,tileSize=300,captures=[],traces={};
 for(const id of ids){const DC=await import(pathToFileURL(join(scratch,'draw.js')).href+`?independent=${id}-${scenario}-${size}`);let {w,save}=world(id),prior='';const trace=[];const canvas=createCanvas(tileSize,tileSize),g=canvas.getContext('2d');let drawn=[];const original=g.drawImage.bind(g);
  g.drawImage=(im,...args)=>{const file=labels.get(im);if(file?.startsWith('suits/')){const m=g.getTransform();drawn.push({file,angle:Math.atan2(m.b,m.a),args});}return original(im,...args);};
  const snapshots=new Map();
  for(let tick=0;tick<count;tick++){
   const act=script(tick);if(act==='reset'){({w,save}=world(id));Sim.flap(w,save);}if(act==='tap')Sim.flap(w,save);if(act==='dive')Sim.dive(w,save);
   Sim.updateWorld(w,save,1/60);if(w.squirrel.y>19000)w.squirrel.y=19000;
   drawn=[];g.setTransform(1,0,0,1,0,0);g.fillStyle='#101c30';g.fillRect(0,0,tileSize,tileSize);
   DC.drawPilot(g,w,save,art,tileSize/2,size/52,tileSize/2,.8,false);
   const pose=window.__acornautPose,frame=pose.bank+'-'+pose.idx;
   trace.push({tick,frame,vy:w.squirrel.vy,tailA:w.tailA,layers:drawn});
   if(frame!==prior||tick%9===0||act){g.fillStyle='#edf5ff';g.font='13px sans-serif';g.fillText(`${id} ${frame} tick ${tick} ${Math.round(tick/60*1000)}ms`,7,20);snapshots.set(tick,canvas.toBuffer('image/png'));}
   prior=frame;
  }
  traces[id]=trace;captures.push({id,snapshots});
 }
 results[`${scenario}-${size}`]=traces;
 const ticks=scenario==='single'?[0,1,9,10,11,12,14,17,19,22,27,32,36,39,42,45,47,49]:scenario==='repeat150'?[0,1,8,9,10,17,18,27,45,63]:scenario==='dive'?[49,60,61,63,66,69,72,78,90]:scenario==='reset'?[0,1,19,49,69,70,71,79,82,90]:[0,1,6,12,18,24,30,33,39,45,60];
 const chosen=ticks.map(t=>captures[0].snapshots.has(t)?t:[...captures[0].snapshots.keys()].sort((a,b)=>Math.abs(a-t)-Math.abs(b-t))[0]);
 const board=createCanvas(6*tileSize,Math.ceil(chosen.length/6)*ids.length*tileSize),bg=board.getContext('2d');bg.fillStyle='#101c30';bg.fillRect(0,0,board.width,board.height);
 for(let n=0;n<chosen.length;n++)for(let i=0;i<captures.length;i++){const c=captures[i],tick=chosen[n],selected=c.snapshots.has(tick)?tick:[...c.snapshots.keys()].sort((a,b)=>Math.abs(a-tick)-Math.abs(b-tick))[0];bg.drawImage(await loadImage(c.snapshots.get(selected)),n%6*tileSize,(Math.floor(n/6)*ids.length+i)*tileSize);}
 writeFileSync(join(out,`${scenario}-${size}.png`),board.toBuffer('image/png'));
}
// Actual production painter's loading fallback, all banks deliberately absent.
for(const id of ids){const board=createCanvas(5*320,320),g=board.getContext('2d'),fallback={...art,suitAsc:{},suitDesc:{}};const suit=C.SUITS.find(s=>s.id===id);
 for(const [i,angle] of [-.75,-.35,0,.35,.75].entries()){
  g.setTransform(1,0,0,1,0,0);g.fillStyle='#101c30';g.fillRect(i*320,0,320,320);
  D.paintIllustrated(g,art.squirrelIdle[0],i*320+160,170,192,C.HELMETS[0],suit,0,fallback,'idle-1',undefined,undefined,0,'dark',angle,-1,-1,0,0,0,0,0,{up:.8,down:.3},NaN,true,'velocity');
  g.fillStyle='#edf5ff';g.font='15px sans-serif';g.fillText(`${id} fallback tail ${angle}rad`,i*320+8,22);
 }
 writeFileSync(join(out,`${id}-loading-fallback.png`),board.toBuffer('image/png'));
}
const report={date:new Date().toISOString(),method:'Exported production Sim+drawPilot independently executed with native canvas, fixed60Hz. Renderer captures are not an interactive browser UI test. No effects in motion strips. Loading fallback deliberately omits banks and samples maximum normal tail range.',runtime:['draw','sim','art','catalog','premium-bank-wake'].map(n=>({path:`docs/js/${n}.js`,sha256:hash(join(root,`docs/js/${n}.js`))})),art:provenance,traces:results};
report.method=report.method.replace('No effects in motion strips.','Signature wake effects disabled; intrinsic tap accents remain.');
report.sourceModuleSnapshot=readdirSync(join(root,'docs/js')).filter(n=>n.endsWith('.js')).sort().map(n=>({path:`docs/js/${n}`,sha256:hash(join(root,'docs/js',n))}));
report.sourceFrames=ids.filter(id=>id!=='cyber').flatMap(id=>['asc','desc'].flatMap(bank=>Array.from({length:9},(_,i)=>{const p=`art-src/cyber-standard-trio/${id}/frames/${bank}-${i+1}.png`;return {path:p,sha256:hash(join(root,p))};})));
for(const record of report.art)if(hash(join(root,record.path))!==record.sha256)throw new Error(`Art changed during capture: ${record.path}`);
writeFileSync(join(out,'capture-evidence.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:'CAPTURED - independent visual judgment still required',ids,scenarios:Object.keys(scenarios),sizes:[52,192],output:out,boxes:Object.fromEntries(ids.map(id=>[id,art.suitAsc[id][0].box]))}));
