#!/usr/bin/env node
// Run review-vanguard-flight.mjs first. This diagnostic replays its recorded
// production states; only display copies lock body tilt, tail and exhaust.
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as M from '../docs/js/vanguard-maneuver.js';
import {paintVanguard} from '../docs/js/vanguard.js';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,GlobalFonts}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Vanguard Sans');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.ACORNAUT_QA_OUTPUT||join(tmpdir(),'acornaut-vanguard-review');
const frames=join(output,'limb-frames');mkdirSync(frames,{recursive:true});
const atlas=await loadImage(join(root,'docs/art/suits/vanguard/maneuver-parts.png'));
const art={vanguardParts:atlas},trace=JSON.parse(readFileSync(join(output,'phone-trace.json'))).trace;
const film=createCanvas(1200,760),g=film.getContext('2d');
function text(ctx,value,x,y,size=16,color='#a9bdd0'){
  ctx.fillStyle=color;ctx.font=`${size}px "Vanguard Sans"`;ctx.fillText(value,x,y);
}
for(const frame of trace){
  if(frame.tick%2)continue;
  g.fillStyle='#071320';g.fillRect(0,0,1200,760);
  text(g,'VANGUARD / LIMB MOTION',30,40,26,'#f3d4a1');
  text(g,'Production replay • display copies hold body, head, tail and exhaust fixed',30,70,16);
  text(g,'FLIGHT',35,112,23,'#9de6ef');text(g,'UPRIGHT',635,112,23,'#f2cd89');
  for(const [i,mode] of ['cruise','jetpack'].entries()){
    const live=frame[mode],state=structuredClone(live),s=state.maneuver;
    s.pose.body=0;s.pose.head=0;s.pose.heave=0;
    s.tailBase=0;s.tailTip=8;s.tailBend=0;s.pressure=0;
    const x=i*600+325;
    paintVanguard(g,art,x,345,320,state);
    paintVanguard(g,art,x,652,52,state);
    text(g,'SAME POSE / GAME SIZE 52',i*600+30,690,12);
    text(g,`${s.bank.toUpperCase()}  •  ${Math.round(frame.vy)} vertical speed`,i*600+30,720,14);
  }
  text(g,`${frame.time.toFixed(2)}s  /  10.00s`,970,40,18);
  g.strokeStyle='#263d51';g.beginPath();g.moveTo(600,96);g.lineTo(600,732);g.stroke();
  writeFileSync(join(frames,`${String(frame.tick/2).padStart(4,'0')}.png`),film.toBuffer('image/png'));
}

// A separate, explicitly authored-pose sheet exposes the anatomy of each bank.
// These are key poses; the actual game springs into them on short gravity arcs.
const sheet=createCanvas(1800,1080),ctx=sheet.getContext('2d');
ctx.fillStyle='#071320';ctx.fillRect(0,0,1800,1080);
text(ctx,'VANGUARD / AUTHORED POSE BANKS',30,37,24,'#f3d4a1');
text(ctx,'Key-pose study • gameplay transitions and timing are shown in the accompanying replay',30,63,15);
const poses=[['FLOAT','float',.4,0,8],['RISING REACH','rise',.15,-98,-73],
  ['RISING GATHER','rise',.58,-108,-100],['APEX','apex',.25,-56,-78],
  ['FALLING BRACE','fall',.3,12,-8],['CONTROLLED DIVE','dive',.5,-18,0],
  ['CONTACT / COMPRESS','land',.08,3,8],['CONTACT / EXTEND','land',.29,-83,-13]];
for(const [i,[title,bank,age,tailBase,tailTip]] of poses.entries()){
  const x=i%4*450+270,y=Math.floor(i/4)*480+297,s=M.createManeuverMotion();
  s.pose=M.sampleManeuver(bank,age);s.tailBase=tailBase;s.tailTip=tailTip;
  text(ctx,title,i%4*450+28,Math.floor(i/4)*480+117,17,'#e6cfa9');
  M.paintManeuver(ctx,atlas,x,y,255,s);M.paintManeuver(ctx,atlas,x,y+208,52,s);
}
writeFileSync(join(output,'Vanguard-Maneuver-Poses.png'),sheet.toBuffer('image/png'));
console.log(`Maneuver review: ${trace.length/2} diagnostic frames and eight authored key poses`);
