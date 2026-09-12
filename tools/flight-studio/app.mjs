import {PARTS,STEP,clone,clamp,curve,defaultProfile,defaultPattern,makeProject,validateProject,serializeProject,createSimulation,seekSimulation,transportTime} from './core.mjs';
import {StudioRenderer,paintBackground} from './renderer.mjs';
const $=id=>document.getElementById(id),isViewer=new URL(location.href).searchParams.has('viewer');
const STORAGE='acornaut.flight-studio.v1',channel=new BroadcastChannel('acornaut-flight-studio-v1');
const manifest=await fetch('./manifest.json').then(r=>{if(!r.ok)throw Error('Local manifest is missing. Rebuild Flight Studio.');return r.json();});
let library={selected:'cinderforge',presets:{}},storageOK=true;
try{const saved=localStorage.getItem(STORAGE);if(saved)library=JSON.parse(saved);}catch{storageOK=false;}
if(!library||!library.presets)library={selected:'cinderforge',presets:{}};
let model=manifest.models.find(m=>m.id===library.selected)||manifest.models[0];
let project=makeProject(manifest,model),notice='';
try{if(library.presets[model.id]){const checked=validateProject(library.presets[model.id],manifest);project=checked.project;notice=checked.warnings.join('\n');}}catch(e){notice='Saved preset could not be loaded: '+e.message;}
let transport={time:0,anchor:Date.now(),speed:1,playing:true},simulation=createSimulation(model,project);
let panel='motion',part='tailRoot',history=[],future=[],lastEdit='',lastPeer=0,ready=false,loadGeneration=0;
const renderer=new StudioRenderer(manifest),preview=$('preview'),flight=$('flight');
const ctx=preview.getContext('2d'),flightCtx=flight.getContext('2d');
let saveTimer,drawTime=0,identity=crypto.randomUUID();
function message(kind,extra={}){channel.postMessage({kind,from:identity,role:isViewer?'viewer':'editor',...extra});}
function publish(){message('state',{project,transport});}
function save(){
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
    library.selected=model.id;library.presets[model.id]=clone(project);
    try{localStorage.setItem(STORAGE,JSON.stringify(library));$('save-status').textContent='Saved locally · '+new Date().toLocaleTimeString();storageOK=true;}
    catch{$('save-status').textContent='Local storage unavailable. Export a preset to keep your work.';storageOK=false;}
  },250);
}
function alertText(text=''){notice=text;$('notice').textContent=text;}
function resetSimulation(){simulation=createSimulation(model,project);}
async function load(){
  const generation=++loadGeneration;ready=false;
  try{await renderer.loadModel(model,project.view.helmet);if(generation===loadGeneration){ready=true;updateLabels();}}
  catch(e){if(generation===loadGeneration){alertText(e.message+' Use Reload artwork to retry.');$('stage-label').textContent='Artwork unavailable';}}
}
function remember(key){if(key!==lastEdit){history.push(clone(project));if(history.length>60)history.shift();future=[];lastEdit=key;}}
function update(next,{key='',rebuild=false,reset=false}={}){
  try{validateProject(next,manifest);}catch(e){alertText(e.message);return false;}
  if(!isViewer)remember(key||crypto.randomUUID());
  const oldHelmet=project.view.helmet;
  reset=reset||JSON.stringify(project.profile)!==JSON.stringify(next.profile);
  project=next;simulation.project=project;
  if(reset)resetSimulation();if(oldHelmet!==project.view.helmet)load();
  if(rebuild)renderControls();updateLabels();save();publish();return true;
}
function at(obj,path){return path.split('.').reduce((a,k)=>a[k],obj);}
function set(obj,path,value){const keys=path.split('.'),last=keys.pop();keys.reduce((a,k)=>a[k],obj)[last]=value;}
function change(path,value,rebuild=false){const n=clone(project);set(n,path,value);update(n,{key:path,rebuild,reset:path.startsWith('pattern.')});}
function setTransport(changes){const time=transportTime(transport);transport={...transport,time,anchor:Date.now(),...changes};publish();updateLabels();}
function recordTap(){
  const t=Math.min(project.pattern.duration-.01,transportTime(transport)%project.pattern.duration);
  if(project.pattern.events.some(e=>Math.abs(e.at-t)<.02))return;
  const n=clone(project);n.pattern.events.push({at:Number(t.toFixed(3)),type:'tap'});n.pattern.events.sort((a,b)=>a.at-b.at);
  update(n,{reset:true,rebuild:panel==='pattern'});if(!transport.playing)setTransport({time:transport.time+1/60});
  alertText('Tap recorded at '+t.toFixed(2)+' s. It will repeat in the pattern.');
}
function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const html=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function field(label,path,min,max,step=.1,hint=''){
  const value=at(project,path);return `<div class="field"><div class="field-top"><label for="range-${path}">${label}</label><input type="number" aria-label="${label} value" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}"></div><input type="range" id="range-${path}" aria-label="${label}" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}">${hint?`<small>${hint}</small>`:''}</div>`;
}
function select(label,path,options){const value=at(project,path);return `<label>${label}<select data-path="${path}">${options.map(([id,name])=>`<option value="${id}" ${value===id?'selected':''}>${html(name)}</option>`).join('')}</select></label>`;}
function check(label,path){return `<label class="check"><input type="checkbox" data-path="${path}" ${at(project,path)?'checked':''}>${label}</label>`;}
function curveUI(label,path,hint,velocity=false){return `<section class="control-section"><h2>${label}</h2><p class="intro">${hint}</p><canvas class="curve" data-curve="${path}" aria-label="${label} curve"></canvas><div class="knots">${at(project,path).map((v,i)=>`<label>${velocity?['Full rise','Half rise','Apex','Half fall','Full fall'][i]:i*25+'% of tap'}<input type="number" aria-label="${label} ${i*25}%" data-path="${path}.${i}" min="-180" max="180" step="1" value="${v}"></label>`).join('')}</div></section>`;}
function motionPanel(){if(project.profile.poseMode==='velocity')return `<section class="control-section"><h2>Cyber velocity motion</h2><p class="intro">Vertical speed selects the climb and dive paintings immediately. Cyber, Percy, Envoy and Patriot share this profile: nine frames each way, full climb at −260 px/s, full dive at +620 px/s. The tap clock cannot hold back a new climb.</p><div class="fields">${field('Whole-model pitch · °','profile.basePitch',-90,90,1)}${field('Extra climb pitch · °','profile.risePitch',-90,90,1)}${field('Extra descent pitch · °','profile.fallPitch',-90,90,1)}</div><p class="hint">This isolated Studio preview shares the velocity frame mapping. The production review page tests the full game simulation, contact response and lean.</p></section>`;return`<section class="control-section"><h2>Tap & recovery</h2><p class="intro">A tap starts a timed gesture. Pitch curves run from the tap through recovery; negative degrees point upward.</p><div class="fields">${field('Tap cycle · seconds','profile.tapSeconds',.1,5,.05,'Set the time for the complete tap sequence.')}${field('Tap progression','profile.tapEase',.2,4,.05,'Below 1 moves early; above 1 builds later.')}${field('Whole-model pitch · °','profile.basePitch',-90,90,1)}${field('Pitch settling · seconds','profile.pitchResponse',0,2,.01)}</div><div class="select-row" style="margin-top:20px">${select('When another tap arrives','profile.retrigger',[...(model.family==='bank'?[['rewind','Rewind current tap']]:[]),['restart','Restart the tap cycle'],['continue','Finish current cycle'],['queue','Queue one following cycle']])}</div>${check('Finish the tap cycle before entering descent','profile.finishTap')}</section>`+
  curveUI('Whole-model tap pitch','profile.tapPitch','Five smooth control points shape the full tap arc, added to the base pitch.')+
  `<section class="control-section"><h2>Velocity & descent</h2><p class="intro">Only downward velocity opens the descent gate. Entry delay and settling control how quickly free fall takes over.</p><div class="fields">${field('Descent entry · px/s','profile.descentThreshold',0,600,5)}${field('Full descent · px/s','profile.descentFull',50,1600,10)}${field('Downward entry delay · s','profile.descentDelay',0,2,.01)}${field('Descent settling · s','profile.descentSeconds',.05,3,.05)}${field('Descent progression','profile.descentEase',.2,4,.05)}${field('Velocity smoothing · s','profile.velocityFilter',0,1,.01)}${field('Extra climb pitch · °','profile.risePitch',-90,90,1)}${field('Extra descent pitch · °','profile.fallPitch',-90,90,1)}</div></section>`;}
function partsPanel(){if(['bank','premium-flight'].includes(model.family))return `<section class="control-section"><h2>This model uses painted frames</h2><p class="intro">Tune its timing, sequence and pitch in Frame banks. Individual joints require a cut-parts rig.</p><button data-action="frames">Open frame banks</button></section>`;
  const path='profile.parts.'+part;return `<section class="control-section"><h2>One part at a time</h2><p class="intro">The shipping rig supplies its original motion. Keep that motion, reduce it, or replace it with your own tap and velocity curves. Painted parts and head scale stay fixed.</p><div class="select-row"><label>Body part<select id="part">${Object.entries(PARTS).map(([k,v])=>`<option value="${k}" ${part===k?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="fields">${field('Rest offset · '+(part==='heave'?'px':'°'),path+'.offset',-90,90,1)}${field('Original motion amount',path+'.motion',0,2,.05,'0 replaces native movement; 1 preserves it.')}${field('Extra rise response · °',path+'.rise',-90,90,1)}${field('Extra descent response · °',path+'.fall',-90,90,1)}${field('Tap delay · seconds',path+'.lag',0,1,.01)}${field('Part settling · seconds',path+'.response',0,1,.01,'0 adds no extra lag; larger values follow more softly.')}${field('Native motion speed','profile.rigSpeed',.2,3,.05)}</div></section>`+
  curveUI(PARTS[part]+' tap offsets',path+'.tap','Add local movement through the tap. Forearm and shin angles are relative to their parent part. All angles are degrees; body float uses source pixels.')+
  curveUI(PARTS[part]+' flight curve',path+'.velocity','Shape this part across the entire velocity range, including the apex and the transition into free fall. Added to the simple rise/descent dials above.',true)+
  `<button data-action="reset-part">Reset ${PARTS[part].toLowerCase()}</button>`;}
function frameCells(kind){const p=project.profile,order=kind==='tap'?p.tapOrder:p.descOrder,bank=kind==='tap'?p.tapSource:'desc';
  return `<div class="frame-strip">${order.map((index,slot)=>{const path=model.banks[bank]?.[index]||model.file;
    const image=model.sheet&&bank==='loop'?`<span role="img" aria-label="${kind} source frame ${index+1}" style="display:block;width:100%;max-width:84px;aspect-ratio:1;margin:auto;background-image:url('/art/${path}');background-size:400% 400%;background-position:${(index%4)/3*100}% ${Math.floor(index/4)/3*100}%;background-repeat:no-repeat"></span>`:`<img alt="${kind} source frame ${index+1}" src="/art/${path}">`;
    return `<div class="frame-cell" data-slot="${slot}" data-bank="${kind}"><span>${slot+1} / source ${index+1}</span>${image}<div class="row"><button aria-label="Move ${kind} frame ${slot+1} earlier" data-move="${kind}:${slot}:-1" ${slot===0?'disabled':''}>←</button><button aria-label="Move ${kind} frame ${slot+1} later" data-move="${kind}:${slot}:1" ${slot===order.length-1?'disabled':''}>→</button></div>${kind==='tap'&&project.profile.poseMode!=='velocity'?`<label>Hold weight<input type="number" aria-label="Tap frame ${slot+1} hold" data-path="profile.tapWeights.${slot}" min=".1" max="10" step=".1" value="${p.tapWeights[slot]}"></label>`:''}<label>Pitch offset °<input type="number" aria-label="${kind} frame ${slot+1} pitch" data-path="profile.${kind==='tap'?'tapOffsets':'descOffsets'}.${slot}" min="-90" max="90" step="1" value="${p[kind==='tap'?'tapOffsets':'descOffsets'][slot]}"></label></div>`;}).join('')}</div>`;
}
function framesPanel(){if(!['bank','premium-flight'].includes(model.family))return `<section class="control-section"><h2>This model uses a cut-parts rig</h2><p class="intro">There are no painted motion frames to reorder. Tune the articulated body in Body parts.</p><button data-action="parts">Open body parts</button></section>`;
  if(project.profile.poseMode==='velocity')return `<section class="control-section"><h2>Climb sequence</h2><p class="intro">Velocity selects these complete paintings from level to deepest climb. Reordering a frame or adding a pitch offset affects this preview only.</p>${frameCells('tap')}</section><section class="control-section"><h2>Dive sequence</h2><p class="intro">All nine paintings remain reachable as falling speed increases.</p>${frameCells('desc')}</section>`;
  const options=[['tap','Tap bank'],['asc','Ascent paintings, played on tap'],['loop',model.family==='premium-flight'?'Sixteen full-body frames':'Loop paintings'],['still','Still portrait']].filter(([k])=>k==='still'||model.banks[k].length);
  return `<section class="control-section"><h2>Tap sequence</h2><p class="intro">Source images stay unchanged. A higher hold weight gives that frame more of the cycle. Arrow buttons reorder the sequence and keep its hold and pitch together.</p><div class="select-row">${select('Source bank','profile.tapSource',options)}${select('Playback path','profile.tapPath',[['forward','Straight through'],['out-back','Out and back to neutral']])}</div>${field('Turnaround · fraction of cycle','profile.returnAt',.1,.9,.025,'Used by out-and-back playback. 0.625 matches the repaired ascent gesture.')}${project.profile.tapSource==='loop'?check('Run continuously instead of only on taps','profile.loopContinuous'):''}${model.banks.tap.length?'':`<p class="pattern-note">This model uses its registered ${model.banks.asc.length?'ascent paintings':'loop paintings'} as the tap gesture. Source art is unchanged.</p>`}${frameCells('tap')}</section><section class="control-section"><h2>Descent sequence</h2><p class="intro">Ordered from shallow to deep descent. Velocity and settling select the frame only after the descent gate opens.</p>${project.profile.descOrder.length?frameCells('desc'):'<p>No separate descent bank is registered for this suit. The tap or loop source remains visible; descent pitch is still adjustable.</p>'}</section>`;}
function patternPanel(){return `<section class="control-section"><h2>The repeating flight</h2><p class="intro">Events happen at real second marks. Empty gaps are waits, not frozen time. A Dive event starts a quick drop; a long wait lets gravity produce a natural descent.</p><div class="row"><button data-action="default-pattern">Your tap / wait pattern</button><button data-action="game-physics">Use game gravity & lift</button></div><div class="fields" style="margin-top:20px">${field('Loop length · seconds','pattern.duration',2,60,.5)}${field('Tap lift · px/s','pattern.lift',100,800,10)}${field('Gravity · px/s²','pattern.gravity',100,1800,10)}${field('Maximum fall · px/s','pattern.maxFall',100,1000,10)}${field('Quick-dive speed · px/s','pattern.diveSpeed',100,1000,10)}</div><p class="pattern-note">The default uses long, readable arcs for the 1.5-second cadence. Game physics uses lift 450 / gravity 1300. The viewer has soft screen limits, no obstacles or collision events.</p><table class="events"><thead><tr><th>At second</th><th>Action</th><th>Gap since last</th><th></th></tr></thead><tbody>${project.pattern.events.map((e,i)=>`<tr><td><input type="number" aria-label="Event ${i+1} time" data-event="${i}" min="0" max="${project.pattern.duration-.01}" step=".05" value="${e.at}"></td><td><select aria-label="Event ${i+1} action" data-event-type="${i}"><option ${e.type==='tap'?'selected':''}>tap</option><option ${e.type==='dive'?'selected':''}>dive</option></select></td><td>${i?(e.at-project.pattern.events[i-1].at).toFixed(2)+' s':'Start'}</td><td><button data-remove="${i}" aria-label="Remove event ${i+1}" ${project.pattern.events.length===1?'disabled':''}>×</button></td></tr>`).join('')}</tbody></table><button data-action="add-event">Add event</button><p class="hint">Tap now / Space records a tap at the current loop position. Undo removes it.</p></section>`;}
function viewPanel(){const own=model.ownHead||['arcflash','acornut'].includes(model.family);return `<section class="control-section"><h2>See the details</h2><p class="intro">The editor holds the model steady for close inspection. The separate viewer follows the repeating flight over an unobstructed scrolling sky.</p><div class="fields">${field('Model display size','view.scale',60,280,5)}${select('Background','view.background',[['nebula','Midnight sky'],['dark','Dark neutral'],['light','Light neutral']])}</div>${own?'<p class="pattern-note">This character has its own painted helmet or head. Its original painting stays in place.</p>':select('Helmet','view.helmet',[['none','Bare head'],...manifest.helmets.filter(h=>!h.suitOnly||h.suitOnly===model.id).map(h=>[h.id,h.name])])}${check('Show built-in rig effects','view.effects')}${check('Show registration guides','view.guides')}<div class="row"><button data-action="reload-art">Reload artwork</button><button data-action="viewer">Open flight viewer ↗</button></div></section><section><h2>Portable presets</h2><p class="intro">Export includes the selected model, exact asset hashes, motion curves, frame order, per-frame timing, tap pattern and view settings. Import restores the same test. It never writes into the game.</p></section>`;}
function renderControls(){
  if(model.family==='premium-flight'&&panel==='parts')panel='frames';
  $('controls').innerHTML=({motion:motionPanel,parts:partsPanel,frames:framesPanel,pattern:patternPanel,view:viewPanel})[panel]();
  document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('active',b.dataset.panel===panel);b.disabled=model.family==='premium-flight'&&b.dataset.panel==='parts';});drawCurves();
}
function updateLabels(){
  $('model-label').textContent=model.name;$('viewer-model').textContent=model.name;
  $('family-badge').textContent=model.family==='premium-flight'?'FULL-BODY SHEET':model.family==='bank'?'FRAME BANK':'CUT RIG';
  $('preset-name').value=project.name;$('model').value=model.id;$('undo').disabled=!history.length;$('redo').disabled=!future.length;
  $('play').textContent=transport.playing?'Pause':'Play';$('viewer-play').textContent=transport.playing?'Pause':'Play';
  $('speed').value=String(transport.speed);$('scrub').max=project.pattern.duration;
  $('source-label').textContent=`Art ${manifest.artVer} · source ${manifest.sourceCommit.slice(0,7)} · ${manifest.models.length} local models`;
  if(!storageOK)$('save-status').textContent='Local storage unavailable. Export a preset to keep your work.';
  $('notice').textContent=notice;
}
function fit(canvas){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.round(r.width*d),h=Math.round(r.height*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}return {w:r.width,h:r.height,d};}
function drawCurves(){for(const canvas of document.querySelectorAll('[data-curve]')){
  const {w,h,d}=fit(canvas),c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
  const points=at(project,canvas.dataset.curve),max=Math.max(15,...points.map(Math.abs)),x=t=>20+t*(w-40),y=v=>h/2-v/max*(h/2-18);
  c.strokeStyle='#334255';c.lineWidth=1;c.beginPath();c.moveTo(15,h/2);c.lineTo(w-15,h/2);c.stroke();
  c.strokeStyle='#f5c475';c.lineWidth=2;c.beginPath();for(let i=0;i<=120;i++){const t=i/120;i?c.lineTo(x(t),y(curve(points,t))):c.moveTo(x(t),y(curve(points,t)));}c.stroke();
  points.forEach((v,i)=>{c.fillStyle='#8de7d1';c.beginPath();c.arc(x(i/4),y(v),3,0,Math.PI*2);c.fill();});
}}
function timeline(time){const canvas=$('timeline'),{w,h,d}=fit(canvas),c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
  c.strokeStyle='#334255';c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();
  for(const e of project.pattern.events){const x=e.at/project.pattern.duration*w;c.fillStyle=e.type==='tap'?'#f5c475':'#91b5fb';c.fillRect(x-1.5,12,3,25);}
  c.fillStyle='#8de7d1';c.beginPath();c.arc(time/project.pattern.duration*w,h/2,4,0,Math.PI*2);c.fill();
}
function draw(){
  const absolute=transportTime(transport),time=absolute%project.pattern.duration;seekSimulation(simulation,absolute);
  if(isViewer){const {w,h,d}=fit(flight);flightCtx.setTransform(d,0,0,d,0,0);paintBackground(flightCtx,w,h,time,project.view.background,true);
    const x=w*.45,y=h*.17+simulation.y/900*h*.61,size=Math.min(project.view.scale,w*.34,h*.29);
    if(ready)renderer.paint(flightCtx,model,project,simulation,x,y,size);
    $('viewer-phase').textContent=simulation.animation.stage.toUpperCase()+' · '+Math.round(simulation.vy)+' px/s';
    $('viewer-time').textContent=time.toFixed(2)+' / '+project.pattern.duration.toFixed(1)+' s';
    $('viewer-status').textContent=ready?(Date.now()-lastPeer<7000?'Live link to editor · changes appear immediately':'Local playback · open the editor to tune'):'Loading local artwork…';
  }else{
    const {w,h,d}=fit(preview);ctx.setTransform(d,0,0,d,0,0);paintBackground(ctx,w,h,time,project.view.background,false);
    if(ready)renderer.paint(ctx,model,project,simulation,w*.52,h*.52,Math.min(project.view.scale,h*.65,w*.48));
    const a=simulation.animation;$('stage-label').textContent=ready?(['bank','premium-flight'].includes(model.family)?a.stage+' · '+a.bank+' '+(a.frame+1):a.stage+' · fixed part scale'):'Loading artwork…';
    $('time-label').textContent=time.toFixed(2)+' / '+project.pattern.duration.toFixed(1)+' s';$('velocity-label').textContent=Math.round(simulation.vy)+' px/s';
    if(document.activeElement!==$('scrub'))$('scrub').value=time;
    timeline(time);
    if(panel==='frames')document.querySelectorAll('.frame-cell').forEach(c=>c.classList.toggle('current',Number(c.dataset.slot)===a.slot&&c.dataset.bank===(a.bank==='desc'?'desc':'tap')));
  }
  drawTime=time;requestAnimationFrame(draw);
}
async function choose(id){library.presets[model.id]=clone(project);model=manifest.models.find(m=>m.id===id);try{project=validateProject(library.presets[id]||makeProject(manifest,model),manifest).project;}catch{project=makeProject(manifest,model);}
  history=[];future=[];lastEdit='';resetSimulation();alertText('');renderControls();updateLabels();save();publish();await load();}
function restore(from,to){if(!from.length)return;to.push(clone(project));project=from.pop();lastEdit='';resetSimulation();renderControls();updateLabels();save();publish();load();}
function openWindow(viewer){const url=new URL(location.href);viewer?url.searchParams.set('viewer','1'):url.searchParams.delete('viewer');const win=window.open(url,viewer?'acornaut-flight-viewer':'acornaut-flight-editor',`popup,width=${viewer?960:1240},height=900`);if(!win)alertText('The browser blocked the second window. Allow pop-ups for this local tool, or use the separate launcher.');}
$('open-viewer').onclick=()=>openWindow(true);$('open-editor').onclick=()=>openWindow(false);
for(const id of ['play','viewer-play'])$(id).onclick=()=>setTransport({playing:!transport.playing});
for(const id of ['restart','viewer-restart'])$(id).onclick=()=>setTransport({time:0});
$('step').onclick=()=>setTransport({playing:false,time:transportTime(transport)+1/60});
$('tap').onclick=recordTap;$('scrub').oninput=()=>setTransport({playing:false,time:Number($('scrub').value)});
$('speed').onchange=()=>setTransport({speed:Number($('speed').value)});
$('model').innerHTML=manifest.models.map(m=>`<option value="${m.id}">${html(m.name)}${m.family==='premium-flight'?' · 16 frames':m.family!=='bank'?' · Rig':''}</option>`).join('');$('model').onchange=()=>choose($('model').value);
$('preset-name').onchange=()=>change('name',$('preset-name').value);
$('undo').onclick=()=>restore(history,future);$('redo').onclick=()=>restore(future,history);
$('reset').onclick=()=>{const n=clone(project);n.profile=defaultProfile(model);n.source=makeProject(manifest,model).source;n.model.assets=model.hashes;update(n,{rebuild:true,reset:true});alertText('Model tuning reset. Undo restores your previous settings.');};
$('export').onclick=()=>{const n=clone(project);n.model.assets=model.hashes;n.source={commit:manifest.sourceCommit,artVer:manifest.artVer,painters:manifest.painterHashes};const text=serializeProject(n,manifest);$('paste-json').value=text;download(model.id+'-flight-preset.json',new Blob([text],{type:'application/json'}));alertText('Preset exported. A copy is also available under Paste preset JSON.');};
$('snapshot').onclick=()=>{const c=document.createElement('canvas');c.width=1024;c.height=768;const cctx=c.getContext('2d');paintBackground(cctx,1024,768,drawTime,project.view.background,false);renderer.paint(cctx,model,project,simulation,540,380,320);c.toBlob(b=>b&&download(model.id+'-flight-preview.png',b));};
function importText(text){try{if(text.length>500000)throw Error('Preset exceeds 500 KB.');const result=validateProject(JSON.parse(text),manifest);library.presets[model.id]=clone(project);model=result.model;project=result.project;history=[];future=[];resetSimulation();renderControls();updateLabels();save();publish();load();alertText(result.warnings.join('\n')||'Preset restored.');}catch(e){alertText('Import failed: '+e.message);}}
$('import-json').onclick=()=>importText($('paste-json').value);
$('import').onclick=()=>$('import-file').click();$('import-file').onchange=async()=>{const f=$('import-file').files[0];$('import-file').value='';if(!f)return;if(f.size>500000){alertText('Import failed: preset exceeds 500 KB.');return;}try{importText(await f.text());}catch(e){alertText('Import failed: '+e.message);}};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{panel=b.dataset.panel;renderControls();});
$('controls').addEventListener('input',e=>{
  const el=e.target,path=el.dataset.path;if(!path||el.tagName==='SELECT')return;
  const value=el.type==='checkbox'?el.checked:Number(el.value);if(el.value===''&&el.type!=='checkbox')return;
  const n=clone(project);set(n,path,value);
  if(update(n,{key:path,reset:path.startsWith('pattern.')})){
    document.querySelectorAll('[data-path]').forEach(other=>{if(other!==el&&other.dataset.path===path)other.value=String(value);});drawCurves();
  }
});
$('controls').addEventListener('change',e=>{
  const el=e.target,path=el.dataset.path;
  if(path&&el.tagName==='SELECT'){
    if(path==='profile.tapSource'){
      const n=clone(project),source=el.value,count=source==='still'?1:model.banks[source].length;
      Object.assign(n.profile,{tapSource:source,tapPath:source==='asc'?'out-back':'forward',tapOrder:Array.from({length:count},(_,i)=>i),tapWeights:Array(count).fill(1),tapOffsets:Array(count).fill(0)});update(n,{rebuild:true,reset:true});
    }else change(path,el.value);lastEdit='';
  }else if(el.id==='part'){part=el.value;renderControls();}
  else if(el.dataset.event!==undefined||el.dataset.eventType!==undefined){
    const n=clone(project),index=Number(el.dataset.event??el.dataset.eventType);
    if(el.dataset.event!==undefined)n.pattern.events[index].at=Number(el.value);else n.pattern.events[index].type=el.value;
    n.pattern.events.sort((a,b)=>a.at-b.at);update(n,{rebuild:true,reset:true});
  }else lastEdit='';
});
$('controls').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.move){const [kind,index,direction]=b.dataset.move.split(':'),i=Number(index),j=i+Number(direction),n=clone(project);
    for(const field of kind==='tap'?['tapOrder','tapWeights','tapOffsets']:['descOrder','descOffsets'])[n.profile[field][i],n.profile[field][j]]=[n.profile[field][j],n.profile[field][i]];
    update(n,{rebuild:true});
  }else if(b.dataset.remove!==undefined){const n=clone(project);n.pattern.events.splice(Number(b.dataset.remove),1);update(n,{rebuild:true,reset:true});}
  else {const n=clone(project);switch(b.dataset.action){
    case 'frames':case 'parts':panel=b.dataset.action;renderControls();break;
    case 'reset-part':n.profile.parts[part]=defaultProfile(model).parts[part];update(n,{rebuild:true});break;
    case 'default-pattern':n.pattern=defaultPattern();update(n,{rebuild:true,reset:true});setTransport({time:0});break;
    case 'game-physics':Object.assign(n.pattern,{gravity:1300,lift:450,maxFall:620,diveSpeed:380});update(n,{rebuild:true,reset:true});break;
    case 'add-event':{let at=Math.min(n.pattern.duration-.1,n.pattern.events.at(-1).at+.5);while(n.pattern.events.some(e=>Math.abs(e.at-at)<.03)&&at>.05)at-=.1;n.pattern.events.push({at:Number(at.toFixed(2)),type:'tap'});n.pattern.events.sort((a,b)=>a.at-b.at);update(n,{rebuild:true,reset:true});break;}
    case 'reload-art':load();break;case 'viewer':openWindow(true);break;
  }}
});
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;if(e.code==='Space'){e.preventDefault();recordTap();}if(e.code==='KeyP')setTransport({playing:!transport.playing});});
channel.onmessage=async({data})=>{
  if(!data||data.from===identity)return;lastPeer=Date.now();
  if(data.kind==='hello'){publish();return;}if(data.kind!=='state')return;
  try{const checked=validateProject(data.project,manifest),t=data.transport;
    if(!t||!Number.isFinite(t.time)||t.time<0||!Number.isFinite(t.anchor)||![.25,.5,1,2].includes(t.speed)||typeof t.playing!=='boolean')return;
    const changed=checked.model.id!==model.id||checked.project.view.helmet!==project.view.helmet;
    const reset=checked.model.id!==model.id||JSON.stringify(project.pattern)!==JSON.stringify(checked.project.pattern)||JSON.stringify(project.profile)!==JSON.stringify(checked.project.profile);
    model=checked.model;project=checked.project;transport=t;simulation.project=project;if(reset)resetSimulation();
    if(!isViewer){renderControls();save();}updateLabels();if(changed)load();
  }catch(e){alertText('Ignored invalid linked preset: '+e.message);}
};
setInterval(()=>message('heartbeat'),2000);
$('editor').hidden=isViewer;$('viewer').hidden=!isViewer;if(isViewer)document.querySelector('header').hidden=true;
document.title=isViewer?'Flight Studio · Flight Viewer':'Flight Studio · Editor';
renderControls();updateLabels();load();message('hello');requestAnimationFrame(draw);
addEventListener('resize',drawCurves);addEventListener('beforeunload',()=>{if(!isViewer){library.selected=model.id;library.presets[model.id]=project;try{localStorage.setItem(STORAGE,JSON.stringify(library));}catch{}}});
