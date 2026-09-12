// Actual shipping rigs under accepted taps and release, for owner review.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const R=await import('../docs/js/high-orbit.js'),M=await import('../docs/js/high-orbit-motion.js'),C=await import('../docs/js/high-orbit-config.js');
const ids=C.HIGH_ORBIT_IDS,art={highOrbit:{}},states=ids.map(id=>M.createHighOrbitMotion(id));
for(const id of ids)art.highOrbit[id]=await loadImage(root+'docs/art/suits/'+id+'/parts.png');
const out=process.env.ACORNAUT_QA_OUTPUT||root+'illustrated-src/design/flight-input/frames';mkdirSync(out,{recursive:true});
const c=createCanvas(1000,270),g=c.getContext('2d');let vy=0;
for(let tick=0;tick<480;tick++){
  if(tick<240&&tick%24===0){for(const s of states)M.highOrbitTap(s,Math.max(40,vy+450));vy=-450;}else vy=Math.min(610,vy+1100/120);
  states.forEach((s,i)=>M.stepHighOrbit(s,ids[i],1/120,vy));
  if(tick%8)continue;
  g.fillStyle='#10192b';g.fillRect(0,0,c.width,c.height);
  states.forEach((s,i)=>{R.paintHighOrbit(g,art,ids[i],i*200+100,144,150,s,undefined,false);g.fillStyle='#e3edf7';g.font='14px sans-serif';g.fillText(C.HIGH_ORBIT_PROFILES[ids[i]].name,i*200+12,22);});
  g.fillStyle='#b4c7dc';g.font='14px sans-serif';g.fillText(tick<240?'Accepted taps every 200 ms':'Input released - tail follows descent',12,257);
  writeFileSync(out+'/'+String(tick/8).padStart(3,'0')+'.png',c.toBuffer('image/png'));
}
console.log('Rendered 60 frames of actual High Orbit tap/release motion.');
