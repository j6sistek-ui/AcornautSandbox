// Independent QA: production SD/HD sprite contract, portrait, Loadout and Sim.
// No raster interception, art export, source editing or approval-fixture writes.
import {createRequire} from 'node:module';
import {cpSync,mkdirSync,readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
let root=dirname(fileURLToPath(import.meta.url));
while(!existsSync(join(root,'illustrated-src/GOLD_STANDARD.md'))){const p=dirname(root);if(p===root)throw Error('Repository root not found');root=p;}
const out=join(root,'outputs/cyber-standard-trio',process.env.QUALITY_FINAL_OUTPUT||'quality-production-final');
const scratch=join(out,'modules');mkdirSync(scratch,{recursive:true});writeFileSync(join(out,'package.json'),'{"type":"module"}\n');
const fileSha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const captureHarness={path:'illustrated-src/design/premium-pilots/quality-review/capture.mjs',sha256:fileSha(fileURLToPath(import.meta.url))};
const runtimeAtStart=readdirSync(join(root,'docs/js')).filter(n=>n.endsWith('.js')).sort().map(n=>({path:'docs/js/'+n,sha256:fileSha(join(root,'docs/js',n))}));
cpSync(join(root,'docs/js'),scratch,{recursive:true});
for(const file of readdirSync(scratch).filter(n=>n.endsWith('.js'))){let s=readFileSync(join(scratch,file),'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');if(file==='art.js')s+='\nexport {asSprite};\n';if(file==='draw.js')s+='\nexport {drawPilot,paintIllustrated};\n';writeFileSync(join(scratch,file),s);}
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:2,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const mod=(name,query='')=>import(pathToFileURL(join(scratch,name+'.js')).href+query);
const [D,A,S,C,Sim]=await Promise.all(['draw','art','save','catalog','sim'].map(n=>mod(n)));
const ids=process.argv.slice(2).length?process.argv.slice(2):['porcelain','nacre','origamist'];
const sourceFrames=ids.flatMap(id=>['asc','desc'].flatMap(bank=>Array.from({length:9},(_,i)=>{const path=`art-src/cyber-standard-trio/${id}/frames/${bank}-${i+1}.png`;return{path,sha256:fileSha(join(root,path))};})));
const shipping='art-src/cyber-standard-trio/shipping-manifest.json';
const shippingManifest={path:shipping,sha256:fileSha(join(root,shipping))};
const all=['cyber',...ids],art=A.emptyArt(),labels=new WeakMap(),assets=[],captures=[],traces={},selectionCounts={};
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const relative=p=>p.slice(root.length+1).replaceAll('\\','/');
async function imageFile(path){const full=join(root,path),im=await loadImage(full);Object.defineProperty(im,'src',{get:()=>path});labels.set(im,path);assets.push({path,sha256:sha(full)});return im;}
async function sprite(name,id){const sp=A.asSprite(await imageFile('docs/art/'+name));if(id!=='cyber'&&name.startsWith('suits/'))sp.detailImage=await imageFile('docs/art/suits/hd/'+name.slice(6));return sp;}
for(const id of all){art.suits[id]=await sprite(`suits/${id}.png`,id);art.suitBody[id]=await sprite(`suits/${id}-body.png`,id);art.suitTail[id]=await sprite(`suits/${id}-tail.png`,id);for(const [bank,key]of[['asc','suitAsc'],['desc','suitDesc']])art[key][id]=await Promise.all(Array.from({length:9},(_,i)=>sprite(`suits/${id}-${bank}-${i+1}.png`,id)));}
art.helms.clear=await sprite('helms/clear.png','cyber');art.squirrelIdle=[await sprite('squirrel/idle-1.png','cyber')];art.squirrelFlap=[await sprite('squirrel/flap-1.png','cyber')];art.ready=true;
const W=256,H=240,DPR=2,helmet=C.HELMETS.find(h=>h.id==='clear');
function canvas(){const c=createCanvas(W*DPR,H*DPR),g=c.getContext('2d'),draw=g.drawImage.bind(g);let log=[];g.drawImage=(im,...args)=>{const p=labels.get(im);if(p)log.push({path:p,args});return draw(im,...args);};return {c,g,clear(){log=[];g.setTransform(DPR,0,0,DPR,0,0);g.fillStyle='#101c30';g.fillRect(0,0,W,H);},get log(){return log;}};}
function label(v,text){v.g.fillStyle='#f1f4ff';v.g.font='10px sans-serif';v.g.fillText(text,8,15);}
function save(name,c){writeFileSync(join(out,name),c.toBuffer('image/png'));captures.push({path:name,sha256:sha(join(out,name))});}
function selected(v,key){const h=v.log.filter(x=>x.path.includes('/suits/hd/')).length,s=v.log.filter(x=>x.path.includes('/suits/')&&!x.path.includes('/hd/')).length;selectionCounts[key]={hd:h,sd:s};return{h,s};}
// Every frame passes through the actual portrait painter; named stills isolate
// per-frame quality and do not assert a controller-selected instant.
for(const id of ids)for(const bank of ['asc','desc']){const b=createCanvas(W*DPR*3,H*DPR*3),bg=b.getContext('2d');for(let n=0;n<9;n++){const v=canvas();v.clear();const s=art[bank==='asc'?'suitAsc':'suitDesc'][id][n],a={...art,suits:{...art.suits,[id]:s}};D.paintPortrait(v.g,a,helmet,C.SUITS.find(x=>x.id===id),W/2,H/2,158);label(v,`${id} ${bank}-${n+1} |158 CSS DPR2`);const used=selected(v,`${id}/${bank}-${n+1}`);if(!used.h)throw Error('HD frame not sampled');bg.drawImage(v.c,n%3*W*DPR,Math.floor(n/3)*H*DPR);}save(`${id}-${bank}-158-dpr2.png`,b);}
for(const size of [52,158,192]){const b=createCanvas(W*DPR*2,H*DPR*ids.length),bg=b.getContext('2d');for(const [row,id]of ids.entries())for(const [col,kind]of['portrait','loadout'].entries()){const v=canvas(),suit=C.SUITS.find(x=>x.id===id),renderer=await mod('draw',`?quality=${id}-${size}-${kind}`);if(kind==='portrait'){v.clear();renderer.paintPortrait(v.g,art,helmet,suit,W/2,H/2,size);}else for(let tick=0;tick<=24;tick++){v.clear();renderer.paintFlightPreview(v.g,art,suit,helmet,W/2,H/2,size,tick/60,undefined,false,0);}label(v,`${id} ${kind} ${size}CSS DPR2`);selected(v,`${id}/${kind}/${size}`);bg.drawImage(v.c,col*W*DPR,row*H*DPR);}save(`display-${size}-dpr2.png`,b);}
// One continuous Loadout cycle, 60Hz, with twelve sampled visual states.
for(const id of ids){const b=createCanvas(W*DPR*4,H*DPR*3),bg=b.getContext('2d'),v=canvas(),renderer=await mod('draw',`?loadout=${id}`),suit=C.SUITS.find(s=>s.id===id);let cell=0;for(let tick=0;tick<96;tick++){v.clear();renderer.paintFlightPreview(v.g,art,suit,helmet,W/2,H/2,158,tick/60,undefined,false,0);if(tick%8===0){label(v,`${id} Loadout ${(tick/60).toFixed(2)}s DPR2`);bg.drawImage(v.c,cell%4*W*DPR,Math.floor(cell/4)*H*DPR);cell++;}}save(`${id}-loadout-cycle.png`,b);}
function world(id){const save=S.defaultSave();Object.assign(save,{equippedSuit:id,tutorialDone:true,guide:'done',equippedTrail:'none'});const w=Sim.makeWorld(390,20000);Sim.resetRun(w,save,'fly',false);w.planets=[];w.debris=[];w.pickups=[];w.lastSpawnX=100000;w.invulnLeft=999;w.screen='play';w.ready=false;w.warpT=0;return{w,save};}
const scenarios={single:t=>t===0?'tap':null,repeat150:t=>t%9===0?'tap':null,dive:t=>t===0?'tap':t===60?'dive':null,burst:t=>t<30&&t%6===0?'tap':null,reset:t=>t===0?'tap':t===70?'reset':null};
for(const [scenario,script]of Object.entries(scenarios)){traces[scenario]={};for(const id of all){const v=canvas(),renderer=await mod('draw',`?sim=${id}-${scenario}`),b=createCanvas(W*DPR*4,H*DPR*3),bg=b.getContext('2d');let{w,save:sv}=world(id),rows=[],cell=0;for(let tick=0;tick<120;tick++){const act=script(tick);if(act==='reset'){({w,save:sv}=world(id));Sim.flap(w,sv);}if(act==='tap')Sim.flap(w,sv);if(act==='dive')Sim.dive(w,sv);Sim.updateWorld(w,sv,1/60);v.clear();renderer.drawPilot(v.g,w,sv,art,W/2,158/52,H/2,.8,false);const p=window.__acornautPose;rows.push({tick,frame:p.bank+'-'+p.idx,vy:w.squirrel.vy,tailA:w.tailA});if(tick%10===0){label(v,`${id} ${scenario} ${p.bank}-${p.idx} t${tick}`);bg.drawImage(v.c,cell%4*W*DPR,Math.floor(cell/4)*H*DPR);cell++;}}traces[scenario][id]=rows;if(id!=='cyber')save(`${id}-${scenario}-158-dpr2.png`,b);}}
const matching={};for(const scenario of Object.keys(scenarios))for(const id of ids){const a=traces[scenario].cyber,b=traces[scenario][id],n=a.filter((x,i)=>x.frame===b[i].frame&&x.vy===b[i].vy&&x.tailA===b[i].tailA).length;if(n!==120)throw Error(`Controller drift ${scenario}/${id}`);matching[`${scenario}/${id}`]=n;}
for(const id of all)for(const size of [52,158]){const b=createCanvas(W*DPR*5,H*DPR),bg=b.getContext('2d'),a={...art,suitAsc:{},suitDesc:{}},suit=C.SUITS.find(s=>s.id===id);for(const[col,angle]of[-.75,-.35,0,.35,.75].entries()){const v=canvas();v.clear();D.paintIllustrated(v.g,art.squirrelIdle[0],W/2,H/2,size,helmet,suit,0,a,'idle-1',undefined,undefined,0,'dark',angle,-1,-1,0,0,0,0,0,{up:.8,down:.3},NaN,true,'velocity');label(v,`${id} fallback ${angle} ${size}CSS DPR2`);selected(v,`${id}/fallback/${size}/${angle}`);bg.drawImage(v.c,col*W*DPR,0);}save(`${id}-loading-fallback-${size}.png`,b);}
const runtime=runtimeAtStart;for(const r of runtime)if(sha(join(root,r.path))!==r.sha256)throw Error(`Runtime changed during capture:${r.path}`);
for(const r of [...assets,...sourceFrames,shippingManifest])if(sha(join(root,r.path))!==r.sha256)throw Error(`Input changed during capture:${r.path}`);
writeFileSync(join(out,'capture.json'),JSON.stringify({date:new Date().toISOString(),method:'Actual production Sprite.detailImage, paintPortrait, paintFlightPreview, Sim+drawPilot and paintIllustrated. DPR2; native surfaces; no bitmap interception or repaint. SD/HD assets loaded directly into the documented ArtBank contract; network/lazy loader is tested separately. Named-frame portrait grids isolate quality; Sim traces establish tested phase timing. No interactive browser claim.',captureHarness,ids,assets,sourceFrames,runtime,shippingManifest,selectionCounts,matching,traces,captures},null,2)+'\n');
console.log(JSON.stringify({status:'CAPTURED; visual approval still required',ids,assets:assets.length,sourceFrames:sourceFrames.length,runtime:runtime.length,captures:captures.length,out}));
