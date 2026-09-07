#!/usr/bin/env node
/** Actual production loadout renderer, before and after the helmet fitting.
 * Build first; run with ACORNAUT_CANVAS=/path/to/@napi-rs/canvas.
 * Requires ffmpeg/ffprobe. Disposable exports never touch product modules.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {cpSync,mkdtempSync,mkdirSync,readFileSync,readdirSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image,GlobalFonts}=require(process.env.ACORNAUT_CANVAS || '@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const baseline='81fb7e772866959c3bb65ec6cbef937ae9c4c9b7';
const scratch=mkdtempSync(join(tmpdir(),'acornaut-helmet-review-'));
const output=join(root,'illustrated-src/design/helmet-fit');mkdirSync(output,{recursive:true});
const FPS=24,SECONDS=20,WIDTH=1440,HEIGHT=960;
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Helmet Review');
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,
  addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};

function modules(name,old) {
  const directory=join(scratch,name);mkdirSync(directory,{recursive:true});
  writeFileSync(join(directory,'package.json'),'{"type":"module"}');
  if(old) execFileSync('tar',['-x','-C',directory],{input:execFileSync('git',['archive',baseline,'docs/js'],{cwd:root,maxBuffer:32*1024*1024})});
  else cpSync(join(root,'docs/js'),join(directory,'docs/js'),{recursive:true});
  const js=join(directory,'docs/js');
  for(const name of readdirSync(js).filter(n=>n.endsWith('.js'))) {
    const path=join(js,name);let code=readFileSync(path,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1');
    if(name==='art.js') code+='\nexport {asSprite,RIGGED_SUITS,TAP_BANKS,TAIL_TAP_BANKS,BOUNCE_BANKS,ASC_BANKS,DESC_BANKS};\n';
    writeFileSync(path,code);
  }
  return file=>import(pathToFileURL(join(js,file+'.js')).href);
}
try {
  const oldImport=modules('before',true),newImport=modules('after',false);
  const [Before,After,Art,Cat,Control]=await Promise.all([oldImport('draw'),newImport('draw'),newImport('art'),newImport('catalog'),newImport('control-constants')]);
  const suits=Cat.SUITS.filter(s=>!Cat.wearsOwnHead(s));assert.equal(suits.length,16);
  const bank=Art.emptyArt(),cache=new Map();
  async function sprite(path) {
    if(!cache.has(path)) cache.set(path,(async()=>{
      const image=await loadImage(join(root,'docs/art',path));
      Object.defineProperty(image,'src',{get:()=>path});return Art.asSprite(image);
    })());
    return cache.get(path);
  }
  await Promise.all(['Idle','Flap'].map(async kind=>{
    bank['squirrel'+kind]=await Promise.all(Array.from({length:4},(_,i)=>sprite(`squirrel/${kind.toLowerCase()}-${i+1}.png`)));
  }));
  bank.helms.clear=await sprite('helms/clear.png');bank.helms.leviathan=await sprite('helms/leviathan.png');
  for(const suit of suits) {
    const id=suit.id;bank.suits[id]=await sprite(`suits/${id}.png`);
    if(Art.RIGGED_SUITS.includes(id)) {bank.suitTail[id]=await sprite(`suits/${id}-tail.png`);bank.suitBody[id]=await sprite(`suits/${id}-body.png`);}
    for(const [property,table,suffix] of [['suitTap','TAP_BANKS','tap'],['suitTapTail','TAIL_TAP_BANKS','tail-tap'],
      ['suitBounce','BOUNCE_BANKS','bounce'],['suitAsc','ASC_BANKS','asc'],['suitDesc','DESC_BANKS','desc']])
      if(Art[table][id]) bank[property][id]=await Promise.all(Array.from({length:Art[table][id]},(_,i)=>sprite(`suits/${id}-${suffix}-${i+1}.png`)));
  }
  const film=createCanvas(WIDTH,HEIGHT),c=film.getContext('2d');
  function text(ctx,value,x,y,size=16,color='#b8c6d7',weight='400') {
    ctx.font=`${weight} ${size}px "Helmet Review"`;ctx.fillStyle=color;ctx.fillText(value,x,y);
  }
  function background(ctx,width,height) {
    ctx.fillStyle='#09111e';ctx.fillRect(0,0,width,height);
  }
  function pilot(ctx,renderer,suit,x,y,size,time) {
    const helmet=Cat.HELMETS.find(h=>h.id===(suit.id==='leviathan'?'leviathan':'clear'));
    renderer.paintFlightPreview(ctx,bank,suit,helmet,x,y,size,time,Control.SUIT_LEAN_DEFAULT,false,0);
  }
  function page(pageIndex,time) {
    background(c,WIDTH,HEIGHT);
    text(c,'HELMET FIT / PRODUCTION SUITS',28,39,25,'#eef6ff','700');
    text(c,'Actual loadout animation. Body motion and artwork are unchanged.',28,67,16);
    text(c,`${pageIndex+1} / 4`,WIDTH-96,42,20,'#8cc9e8');
    for(let index=0;index<4;index++) {
      const suit=suits[pageIndex*4+index],column=index%2,row=Math.floor(index/2);
      const left=column*720+20,top=92+row*422;
      c.fillStyle='#142131';c.fillRect(left,top,680,398);
      text(c,suit.name,left+20,top+31,23,'#f4f7ff','700');
      text(c,suit.id==='leviathan'?'Matched Leviathan helmet':'Clear helmet',left+20,top+55,13,'#a5b8cb');
      c.strokeStyle='#2c3a4c';c.lineWidth=1;c.beginPath();c.moveTo(left+340,top+67);c.lineTo(left+340,top+362);c.stroke();
      pilot(c,Before,suit,left+178,top+225,275,time);
      pilot(c,After,suit,left+512,top+225,275,time);
      text(c,'BEFORE',left+136,top+378,15,'#c3b1a6','700');
      text(c,`FITTED / BUILD ${Cat.ART_VER}`,left+423,top+378,15,'#86d4c3','700');
    }
    text(c,'Same time, pose, scale and pitch in each pair. Native Canvas review.',28,948,13,'#8b9caf');
  }
  const frames=join(scratch,'frames');mkdirSync(frames);
  for(let frame=0;frame<FPS*SECONDS;frame++) {
    const pageIndex=Math.floor(frame/(FPS*5)),time=(frame%(FPS*5))/FPS;
    page(pageIndex,time);writeFileSync(join(frames,`${String(frame).padStart(4,'0')}.png`),film.toBuffer('image/png'));
    if(frame%(FPS*5)===58) writeFileSync(join(output,`page-${pageIndex+1}.png`),film.toBuffer('image/png'));
  }
  const temporaryVideo=join(output,'helmet-fit-preview.tmp.mp4'),video=join(output,'helmet-fit-preview.mp4');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(FPS),'-i',join(frames,'%04d.png'),
    '-c:v','libx264','-threads','2','-preset','medium','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',temporaryVideo],{timeout:180000});
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=width,height,nb_read_frames:format=duration','-of','json',temporaryVideo],{encoding:'utf8'}));
  assert.equal(+probe.streams[0].nb_read_frames,FPS*SECONDS);assert.equal(+probe.format.duration,SECONDS);
  assert.equal(probe.streams[0].width,WIDTH);assert.equal(probe.streams[0].height,HEIGHT);
  renameSync(temporaryVideo,video);

  // A readable still for the PR: each column is one unchanged pose at the
  // same loadout time, before above and fitted below.
  const still=createCanvas(1600,960),sc=still.getContext('2d');background(sc,1600,960);
  text(sc,'HELMET ALIGNMENT / SAME BODY POSES',24,39,26,'#eef6ff','700');
  text(sc,'Production renderer: previous main above, fitted build below',24,67,16);
  const picks=['flight','ghost','gemmie','eclipse','leviathan'];
  for(let i=0;i<picks.length;i++) {
    const suit=suits.find(s=>s.id===picks[i]),left=i*320;
    sc.fillStyle='#142131';sc.fillRect(left+10,96,300,830);
    text(sc,suit.name,left+28,130,20,'#f4f7ff','700');
    text(sc,'BEFORE',left+28,162,13,'#c3b1a6','700');
    pilot(sc,Before,suit,left+160,334,280,.75);
    sc.strokeStyle='#2c3a4c';sc.beginPath();sc.moveTo(left+25,516);sc.lineTo(left+295,516);sc.stroke();
    text(sc,`FITTED / BUILD ${Cat.ART_VER}`,left+28,550,13,'#86d4c3','700');
    pilot(sc,After,suit,left+160,731,280,.75);
  }
  writeFileSync(join(output,'helmet-fit-comparison.png'),still.toBuffer('image/png'));
  writeFileSync(join(output,'preview-manifest.json'),JSON.stringify({baseline,build:Cat.ART_VER,production:true,
    renderer:'paintFlightPreview',suits:suits.map(s=>s.id),helmets:{default:'clear',leviathan:'leviathan'},
    width:WIDTH,height:HEIGHT,fps:FPS,seconds:SECONDS,frames:FPS*SECONDS,
    view:'Actual default loadout animation, same time/size/pitch in every pair; no imposed body poses.',
    limitation:'Native Canvas playback; not a claim of on-device browser validation.'},null,2)+'\n');
  console.log(JSON.stringify({video,still:join(output,'helmet-fit-comparison.png'),frames:FPS*SECONDS,duration:SECONDS,build:Cat.ART_VER}));
} finally { rmSync(scratch,{recursive:true,force:true}); }
