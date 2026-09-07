// Extract whole generated paintings; no split rig or synthetic limb deformation.
// Coordinates are measured on the 1254px masters in art-src/flight-refresh.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {referenceColourTargets,calibrateReferenceColour} from './flight-reference-colour.mjs';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const source=root+'art-src/flight-refresh/';
const spec=JSON.parse(readFileSync(source+'landmarks.json','utf8'));
const output=process.env.FLIGHT_REFRESH_OUTPUT||root+'docs/art/suits/';
mkdirSync(output,{recursive:true});
const registration={};
for(const [suit,cfg] of Object.entries(spec)) {
  const portrait=await loadImage(source+suit+'-reference.png');
  const pc=createCanvas(portrait.width,portrait.height),pg=pc.getContext('2d');pg.drawImage(portrait,0,0);
  const referenceHeads={copper:[184,100,50],cryostar:[198,93,45],verdant:[196,92,45],sammie:[193,96,46],gemmie:[198,93,52]};
  const colours=referenceColourTargets(pg.getImageData(0,0,portrait.width,portrait.height),referenceHeads[suit]);
  const master=await loadImage(source+suit+'-master.png');
  assert.equal(master.width,1254);assert.equal(master.height,1254);
  const sheet=createCanvas(1254,1254),g=sheet.getContext('2d');g.drawImage(master,0,0);
  const pixels=g.getImageData(0,0,1254,1254),d=pixels.data;
  for(let p=0;p<d.length;p+=4) {
    const r=d[p],green=d[p+1],b=d[p+2];
    const excess=cfg.matte==='green'?green-Math.max(r,b):Math.min(r,b)-green;
    const a=Math.max(0,Math.min(1,(100-excess)/80));
    if(excess>20) {
      d[p+3]=Math.round(255*a);
      if(cfg.matte==='green')d[p+1]=Math.min(green,Math.max(r,b)+5);
      else {d[p]=Math.min(r,green+Math.max(0,r-b)+5);d[p+2]=Math.min(b,green+Math.max(0,b-r)+5);}
    }
  }
  g.putImageData(pixels,0,0);
  const frames=[];
  // Anatomical registration uses the pelvis and skull, never an independently
  // cropped content box (the tail is not a valid scale measurement).
  for(let n=0;n<16;n++) {
    const sourceIndex=n===8?0:n;
    const [hx,hy,hr,px,py]=cfg.frames[sourceIndex];
    const pitch=n<8?-30-n*4:-30+(n-8)*9;
    const desired=pitch*Math.PI/180;
    const measured=Math.atan2(hy-py,hx-px);
    const angle=desired-measured;
    const scale=0.70*cfg.radius/hr;
    const cell=createCanvas(314,314),cc=cell.getContext('2d');
    const sx=sourceIndex%4*313.5,sy=Math.floor(sourceIndex/4)*313.5;
    cc.drawImage(sheet,sx,sy,313.5,313.5,0,0,313.5,313.5);
    const frame=createCanvas(256,256),c=frame.getContext('2d');
    c.translate(122,138);c.rotate(angle);c.scale(scale,scale);c.drawImage(cell,-px,-py);
    const tx=122+scale*((hx-px)*Math.cos(angle)-(hy-py)*Math.sin(angle));
    const ty=138+scale*((hx-px)*Math.sin(angle)+(hy-py)*Math.cos(angle));
    const name=`${suit}-${n<8?'asc':'desc'}-${n%8+1}`;
    c.resetTransform();
    c.putImageData(calibrateReferenceColour(c.getImageData(0,0,256,256),[tx,ty,cfg.radius*.7,pitch],colours,suit),0,0);
    writeFileSync(output+name+'.png',frame.toBuffer('image/png'));
    frames.push({name,sourceIndex,sourceHead:[hx,hy,hr],sourcePelvis:[px,py],scale,rotation:angle*180/Math.PI,pitch,head:[+tx.toFixed(2),+ty.toFixed(2),+(cfg.radius*0.70).toFixed(2)],pelvis:[122,138]});
  }
  registration[suit]=frames;
}
writeFileSync(source+'registration.json',JSON.stringify(registration,null,2)+'\n');
console.log('Exported 80 transparent whole-character frames.');
