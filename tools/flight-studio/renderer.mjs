import {paintHighOrbit,highOrbitLandmarks} from './game/high-orbit.mjs';
import {paintPremiumFlightFrame} from './game/premium-flight.mjs';
import {isPremiumSuit} from './game/high-orbit-config.mjs';
import {paintPremiumBankWake} from './game/premium-bank-wake.mjs';
import {paintArcflash} from './game/arcflash.mjs';
import {paintManeuver} from './game/vanguard-maneuver.mjs';
import {clipHelmetGlass} from './game/helmet-openings.mjs';
import {bindSpriteDetails,spriteImageFor} from './game/sprite-detail.mjs';
const DEG=Math.PI/180;
export class StudioRenderer{
  constructor(manifest,makeImage=()=>new Image(),makeCanvas=()=>document.createElement('canvas')){
    this.manifest=manifest;this.makeImage=makeImage;this.makeCanvas=makeCanvas;this.images=new Map();this.helmets=new Map();this.inflight=new Map();
  }
  image(path){return this.images.get(path);}
  async load(path){
    if(this.images.has(path))return this.images.get(path);
    if(this.inflight.has(path))return this.inflight.get(path);
    const task=new Promise((resolve,reject)=>{const i=this.makeImage();i.onload=()=>{this.images.set(path,i);resolve(i);};i.onerror=()=>reject(new Error('Could not load local art: '+path));i.src='/art/'+path;});
    this.inflight.set(path,task);try{return await task;}finally{this.inflight.delete(path);}
  }
  async loadModel(model,helmet){
    const files=model.family==='bank'?[model.file,...Object.values(model.banks).flat()]:model.family==='premium-flight'?[model.file,model.atlas]:[model.atlas];
    const h=this.manifest.helmets.find(h=>h.id===helmet);
    if(h&&!model.ownHead&&model.family!=='arcflash'&&model.family!=='acornut')files.push(h.file);
    await Promise.all(files.map(p=>this.load(p)));
    if(model.family==='bank'&&isPremiumSuit(model.id)){
      for(const paths of [[model.file],Object.values(model.banks).flat()]){
        const entries=paths.map(path=>({sprite:this.image(path),path:path.replace('suits/','suits/hd/')}));
        if(entries.length&&entries.every(({sprite})=>!sprite.requestDetail))
          bindSpriteDetails(entries,async path=>{
            const image=await this.load(path);
            // The shared binder rejects invalid detail; discard that decoded
            // cache entry so its later retry can load a corrected local file.
            if(image.width!==512||image.height!==512)this.images.delete(path);
            return image;
          });
      }
    }
  }
  helmet(ctx,id,x,y,r,angle){
    const h=this.manifest.helmets.find(h=>h.id===id);if(!h)return;
    let spr=this.helmets.get(id);const raw=this.image(h.file);if(!raw)return;
    if(!spr){
      spr=this.makeCanvas();spr.width=raw.width;spr.height=raw.height;const c=spr.getContext('2d');c.drawImage(raw,0,0);
      if(!h.opaqueVisor){const g=h.glass,strong=this.manifest.lightOpaqueVisors.includes(id),grad=c.createRadialGradient(g[0],g[1],g[2]*.1,g[0],g[1],g[2]*(strong?.88:.82));
        grad.addColorStop(0,`rgba(0,0,0,${strong?.88:.55})`);grad.addColorStop(.7,`rgba(0,0,0,${strong?.62:.3})`);grad.addColorStop(1,'rgba(0,0,0,0)');
        c.save();clipHelmetGlass(c,id);c.globalCompositeOperation='destination-out';c.fillStyle=grad;c.fillRect(0,0,spr.width,spr.height);c.restore();c.globalCompositeOperation='source-over';}
      this.helmets.set(id,spr);
    }
    const g=h.glass,scale=r*1.04/g[2];ctx.save();ctx.translate(x,y);ctx.rotate((angle+(g[3]||0))*DEG);
    ctx.drawImage(spr,-g[0]*scale,-g[1]*scale,spr.width*scale,spr.height*scale);ctx.restore();
  }
  paint(ctx,model,project,simulation,x,y,size){
    const s=simulation.animation,p=project.profile,view=project.view,atlas=this.image(model.atlas),pitch=s.pitch*DEG;
    const h=this.manifest.helmets.find(h=>h.id===view.helmet);
    const helm=h&&(!h.suitOnly||h.suitOnly===model.id)?h.id:'clear';
    if(model.family==='premium-flight'){
      const frame=s.bank==='still'?model.sheet.fallbackFrame:s.frame;
      const extra=(s.bank==='desc'?p.descOffsets:p.tapOffsets)[s.slot]||0,angle=pitch+extra*DEG;
      paintPremiumFlightFrame(ctx,{premiumFlight:{[model.id]:atlas},suits:{[model.id]:this.image(model.file)}},
        model.id,x,y,size,frame,s.output,{x,y,travel:simulation.time*200},view.effects,angle);
      if(view.guides){const registration=model.sheet.frames[atlas?frame:model.sheet.fallbackFrame],half=model.sheet.cellSize/2;
        ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size/192,size/192);ctx.lineWidth=1;ctx.strokeStyle='#74f3cf';
        ctx.strokeRect(-half,-half,model.sheet.cellSize,model.sheet.cellSize);ctx.beginPath();ctx.arc(registration.head[0]-half,registration.head[1]-half,registration.radius,0,Math.PI*2);ctx.stroke();
        for(const [ex,ey] of registration.emitters){ctx.fillStyle='#ffc869';ctx.beginPath();ctx.arc(ex-half,ey-half,2,0,Math.PI*2);ctx.fill();}ctx.restore();}
    }else if(model.family==='high-orbit'){
      if(!atlas)return;
      paintHighOrbit(ctx,{highOrbit:{[model.id]:atlas}},model.id,x,y,size,s.output,
        {x,y,travel:simulation.time*200},view.effects,pitch,view.helmet==='none'?undefined:(...a)=>this.helmet(ctx,helm,...a),
        view.helmet!=='none'&&h?.id===helm&&h.opaqueVisor===true&&!!this.image(h.file));
      if(view.guides){const j=highOrbitLandmarks(model.id,s.output.pose,pitch),u=size/192;
        ctx.save();ctx.translate(x-128*u,y-128*u);ctx.scale(u,u);ctx.strokeStyle='#74f3cf';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...j.head,36,0,Math.PI*2);ctx.stroke();
        for(const q of Object.values(j)){ctx.fillStyle='#ffc869';ctx.beginPath();ctx.arc(...q,2,0,Math.PI*2);ctx.fill();}ctx.restore();}
    }else if(model.family==='arcflash'){
      if(atlas)paintArcflash(ctx,{arcflash:atlas},x,y,size,s.output,{x,y,travel:simulation.time*200},view.effects,pitch);
    }else if(model.family==='acornut'){
      if(atlas){const out=s.output,pressure=out.pressure; if(!view.effects)out.pressure=0;
        paintManeuver(ctx,atlas,x,y,size,out,pitch);out.pressure=pressure;}
    }else{
      const list=model.banks[s.bank]||[],path=list[s.frame]||model.file,img=this.image(path);if(!img)return;
      const extra=(s.bank==='desc'?p.descOffsets:p.tapOffsets)[s.slot]||0;
      ctx.save();ctx.translate(x,y);ctx.rotate(pitch+extra*DEG);
      if(isPremiumSuit(model.id)&&view.effects&&['asc','desc'].includes(s.bank))
        paintPremiumBankWake(ctx,model.id,s.bank,s.frame,{x:32,y:32,w:192,h:192},0,0,size,{state:s.output,travel:simulation.time*200});
      ctx.scale(size/192,size/192);
      // Fixed 256px registration; never fit each frame to its moving bounds.
      ctx.drawImage(spriteImageFor(ctx,img,256,256),-128,-128,256,256);
      const key=path.slice(6,-4),anchor=this.manifest.anchors[key]||model.dome;
      if(!model.ownHead&&!model.bakedDome&&view.helmet!=='none')this.helmet(ctx,helm,anchor[0]-128,anchor[1]-128,anchor[2],anchor[3]||0);
      if(view.guides){ctx.strokeStyle='#74f3cf';ctx.lineWidth=1;ctx.strokeRect(-128,-128,256,256);if(!model.ownHead){ctx.beginPath();ctx.arc(anchor[0]-128,anchor[1]-128,anchor[2],0,Math.PI*2);ctx.stroke();}}
      ctx.restore();
    }
  }
}
export function paintBackground(ctx,w,h,time,style='nebula',scroll=true){
  ctx.fillStyle=style==='light'?'#dee8eb':style==='dark'?'#080d16':'#081324';ctx.fillRect(0,0,w,h);
  if(style==='nebula'){
    const glow=ctx.createRadialGradient(w*.72,h*.42,0,w*.72,h*.42,w*.75);glow.addColorStop(0,'#29365366');glow.addColorStop(1,'#09132100');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  }
  for(let layer=0;layer<3;layer++)for(let n=0;n<45;n++){
    const x=((n*137.57+layer*91-(scroll?time*(18+layer*22):0))%(w+20)+(w+20))%(w+20)-10;
    const y=(n*83.23+layer*39)%h;ctx.fillStyle=style==='light'?'#607087':`rgba(191,218,241,${.16+layer*.14})`;
    ctx.fillRect(x,y,.7+layer*.5,.7+layer*.5);
  }
}
