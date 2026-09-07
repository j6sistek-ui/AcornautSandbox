// Composite ImageGen's local limb edits over the approved flight paintings.
// Head, tail and torso pixels outside the feathered limb windows stay exact.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {referenceColourTargets,calibrateReferenceColour} from './flight-reference-colour.mjs';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const source=root+'art-src/flight-refresh/';
const spec=JSON.parse(readFileSync(source+'landmarks.json','utf8'));
const reg=JSON.parse(readFileSync(source+'registration.json','utf8'));
const destination=process.env.FLIGHT_LIMB_OUTPUT||root+'docs/art/suits/';
mkdirSync(destination,{recursive:true});
// Reconstruct the approved originals on every run, avoiding cumulative blends.
const baseDirectory=mkdtempSync(join(tmpdir(),'acornaut-flight-'));
execFileSync(process.execPath,[root+'illustrated-src/export-flight-refresh.mjs'],{env:{...process.env,FLIGHT_REFRESH_OUTPUT:baseDirectory+'/'},stdio:'pipe'});
const smooth=(lo,hi,x)=>{const t=Math.max(0,Math.min(1,(x-lo)/(hi-lo)));return t*t*(3-2*t);};
const report=[];
for(const [suit,cfg] of Object.entries(spec)) {
  const image=await loadImage(source+'limb-refinement/'+suit+'-edit.png');
  const sheet=createCanvas(1254,1254),sg=sheet.getContext('2d');sg.drawImage(image,0,0,1254,1254);
  const pixels=sg.getImageData(0,0,1254,1254),d=pixels.data;
  for(let p=0;p<d.length;p+=4) {
    const r=d[p],g=d[p+1],b=d[p+2];
    const excess=cfg.matte==='green'?g-Math.max(r,b):Math.min(r,b)-g;
    if(excess>20){d[p+3]=Math.round(255*Math.max(0,Math.min(1,(100-excess)/80)));if(cfg.matte==='green')d[p+1]=Math.min(g,Math.max(r,b)+5);else {d[p]=Math.min(r,g+Math.max(0,r-b)+5);d[p+2]=Math.min(b,g+Math.max(0,b-r)+5);}}
  }
  sg.putImageData(pixels,0,0);
  const portrait=await loadImage(source+suit+'-reference.png');
  const pc=createCanvas(portrait.width,portrait.height),pg=pc.getContext('2d');pg.drawImage(portrait,0,0);
  const heads={copper:[184,100,50],cryostar:[198,93,45],verdant:[196,92,45],sammie:[193,96,46],gemmie:[198,93,52]};
  const colours=referenceColourTargets(pg.getImageData(0,0,portrait.width,portrait.height),heads[suit]);
  for(const f of reg[suit]) {
    const base=await loadImage(join(baseDirectory,f.name+'.png'));
    const c=createCanvas(256,256),g=c.getContext('2d');g.drawImage(base,0,0);
    const before=g.getImageData(0,0,256,256),out=g.getImageData(0,0,256,256);
    const cell=createCanvas(314,314),cg=cell.getContext('2d');
    cg.drawImage(sheet,f.sourceIndex%4*313.5,Math.floor(f.sourceIndex/4)*313.5,313.5,313.5,0,0,313.5,313.5);
    const edit=createCanvas(256,256),eg=edit.getContext('2d');
    eg.translate(...f.pelvis);eg.rotate(f.rotation*Math.PI/180);eg.scale(f.scale,f.scale);eg.drawImage(cell,-f.sourcePelvis[0],-f.sourcePelvis[1]);
    const after=calibrateReferenceColour(eg.getImageData(0,0,256,256),[...f.head,f.pitch],colours,suit);
    const [hx,hy,hr]=f.head,[px,py]=f.pelvis,a=f.pitch*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a);
    const mask=createCanvas(256,256),mg=mask.getContext('2d'),mi=mg.getImageData(0,0,256,256);
    let changed=0,protectedPixels=0;
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const i=(y*256+x)*4;
      const u=((x-hx)*ux+(y-hy)*uy)/hr,v=(-(x-hx)*uy+(y-hy)*ux)/hr;
      const pu=((x-px)*ux+(y-py)*uy)/hr,pv=(-(x-px)*uy+(y-py)*ux)/hr;
      const arm=smooth(-1.13,-.90,u)*smooth(.45,.64,v)*smooth(.65,.73,Math.hypot(u,v));
      const leg=(1-smooth(-.46,-.18,pu))*smooth(-.10,.10,pv);
      const w=Math.max(arm,leg);
      mi.data[i]=255;mi.data[i+1]=180;mi.data[i+3]=Math.round(150*w);
      if(!w){protectedPixels++;continue;}
      const a0=before.data[i+3]/255,a1=after.data[i+3]/255,oa=a0*(1-w)+a1*w;
      for(let ch=0;ch<3;ch++)out.data[i+ch]=oa?Math.round((before.data[i+ch]*a0*(1-w)+after.data[i+ch]*a1*w)/oa):0;
      out.data[i+3]=Math.round(oa*255);
      if(out.data.slice(i,i+4).some((value,j)=>value!==before.data[i+j]))changed++;
    }
    g.putImageData(out,0,0);writeFileSync(destination+f.name+'.png',c.toBuffer('image/png'));
    if(process.env.FLIGHT_LIMB_MASKS){mg.putImageData(mi,0,0);g.drawImage(mask,0,0);writeFileSync(process.env.FLIGHT_LIMB_MASKS+'/'+f.name+'.png',c.toBuffer('image/png'));}
    report.push({frame:f.name,changedPixels:changed,protectedPixels});
  }
}
writeFileSync(source+'limb-refinement/composite-report.json',JSON.stringify(report,null,2)+'\n');
console.log('Composited 80 limb refinements; protected pixels copied unchanged.');
if(resolve(baseDirectory).startsWith(resolve(tmpdir())+'/')||resolve(baseDirectory).startsWith(resolve(tmpdir())+'\\'))rmSync(baseDirectory,{recursive:true});
