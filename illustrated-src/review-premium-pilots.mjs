#!/usr/bin/env node
// Review complete shipped frames through the actual painter, without writing art.
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const P=await import('../docs/js/premium-flight.js'),M=await import('../docs/js/high-orbit-motion.js'),C=await import('../docs/js/high-orbit-config.js');
const art={suits:{},premiumFlight:{}};
for(const id of C.PREMIUM_SUIT_IDS){art.premiumFlight[id]=await loadImage(root+'docs/art/suits/'+id+'/flight.png');art.suits[id]=await loadImage(root+'docs/art/suits/'+id+'.png');}
const contact=createCanvas(1280,900),g=contact.getContext('2d');
for(const [row,id] of C.PREMIUM_SUIT_IDS.entries())for(let col=0;col<4;col++){
 const x=col*320,y=row*300,size=col===3?52:192,index=[0,7,12,7][col],s=M.createHighOrbitMotion(id);
 g.fillStyle=col%2?'#eee9df':'#101c30';g.fillRect(x,y,320,300);
 M.highOrbitTap(s);
 // Retain a representative wake history without repainting previous bodies.
 for(let tick=0;tick<120;tick++){
  M.stepHighOrbit(s,id,1/120,-400);
  const scratch=createCanvas(1,1);
  P.paintPremiumFlightFrame(scratch.getContext('2d'),art,id,x+180,y+150,size,index,s,{x:x+180,y:y+150,travel:tick*3},true);
 }
 P.paintPremiumFlightFrame(g,art,id,x+180,y+150,size,index,s,{x:x+180,y:y+150,travel:360},true);
 g.fillStyle=col%2?'#25344a':'#e4edf6';g.font='15px sans-serif';g.fillText(C.HIGH_ORBIT_PROFILES[id].name,x+12,y+25);
 g.font='13px sans-serif';g.fillText('Frame '+(index+1)+' / reference size '+size,x+12,y+284);
}
mkdirSync(root+'illustrated-src/design/premium-pilots',{recursive:true});
writeFileSync(root+'illustrated-src/design/premium-pilots/wake-review.png',contact.toBuffer('image/png'));
console.log('Three full-frame pilots reviewed with their retained custom wakes.');
