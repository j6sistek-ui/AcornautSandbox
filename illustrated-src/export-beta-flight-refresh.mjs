// Extract whole generated paintings and register their skulls to one flight arc.
// No independently resized limbs, split tail, or old tap frame is used.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const source=root+'art-src/beta-flight-refresh/';
const spec=JSON.parse(readFileSync(source+'landmarks.json','utf8'));
const output=process.env.BETA_FLIGHT_OUTPUT||root+'docs/art/suits/';
mkdirSync(output,{recursive:true});mkdirSync(source+'review',{recursive:true});
const registration={};
for(const [suit,cfg] of Object.entries(spec)) {
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
  // Generated grid spacing can put a plume tip over an imaginary cell edge.
  // Recover connected whole paintings on the MASTER before cropping, so a
  // neighboring tip cannot leak in and the selected tail is never amputated.
  const labels=new Int32Array(1254*1254),queue=new Int32Array(labels.length),components=[null];
  for(let p=0;p<labels.length;p++) {
    if(labels[p]||d[p*4+3]<8)continue;
    const id=components.length;let start=0,end=1;queue[0]=p;labels[p]=id;
    const box={x:1254,y:1254,r:0,b:0,count:0};
    while(start<end) {
      const q=queue[start++],x=q%1254,y=Math.floor(q/1254);box.count++;
      box.x=Math.min(box.x,x);box.y=Math.min(box.y,y);box.r=Math.max(box.r,x);box.b=Math.max(box.b,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
        const nx=x+dx,ny=y+dy,np=ny*1254+nx;
        if(nx<0||nx>=1254||ny<0||ny>=1254||labels[np]||d[np*4+3]<8)continue;
        labels[np]=id;queue[end++]=np;
      }
    }
    components.push(box);
  }
  assert.equal(components.filter(b=>b&&b.count>2000).length,16,'Expected sixteen isolated whole characters');
  const review=createCanvas(1024,1024),rv=review.getContext('2d');rv.fillStyle='#172231';rv.fillRect(0,0,1024,1024);
  const frames=[];
  for(let n=0;n<16;n++) {
    const sourceIndex=n===8?0:n;
    const [hx,hy,hr,px,py]=cfg.frames[sourceIndex];
    const pitch=n<8?-30-n*4:-30+(n-8)*9;
    const desired=pitch*Math.PI/180;
    const measured=Math.atan2(hy-py,hx-px);
    const angle=desired-measured;
    const scale=.70*cfg.radius/hr;
    const tx=122+65*Math.cos(desired),ty=138+65*Math.sin(desired);
    const sx=sourceIndex%4*313.5,sy=Math.floor(sourceIndex/4)*313.5;
    const component=labels[Math.round(sy+hy)*1254+Math.round(sx+hx)],box=components[component];
    assert.ok(box&&box.count>2000,'Skull must belong to a whole painting');
    const bx=Math.max(0,box.x-2),by=Math.max(0,box.y-2),bw=Math.min(1254,box.r+3)-bx,bh=Math.min(1254,box.b+3)-by;
    const cell=createCanvas(bw,bh),cc=cell.getContext('2d'),crop=g.getImageData(bx,by,bw,bh);
    for(let y=0;y<bh;y++)for(let x=0;x<bw;x++) {
      const gp=(by+y)*1254+bx+x;if(labels[gp]===component)continue;
      let near=false;
      for(let dy=-2;dy<=2&&!near;dy++)for(let dx=-2;dx<=2;dx++) {
        if(labels[gp+dy*1254+dx]===component){near=true;break;}
      }
      if(!near)crop.data[(y*bw+x)*4+3]=0;
    }
    cc.putImageData(crop,0,0);
    const frame=createCanvas(256,256),c=frame.getContext('2d');
    c.translate(tx,ty);c.rotate(angle);c.scale(scale,scale);c.drawImage(cell,bx-sx-hx,by-sy-hy);c.resetTransform();
    const name=`${suit}-${n<8?'asc':'desc'}-${n%8+1}`;
    writeFileSync(output+name+'.png',frame.toBuffer('image/png'));
    frames.push({name,sourceIndex,sourceHead:[hx,hy,hr],sourcePelvis:[px,py],scale,rotation:angle*180/Math.PI,helmetRotation:angle*180/Math.PI-cfg.tracking[sourceIndex].angle,pitch,head:[+tx.toFixed(2),+ty.toFixed(2),+(cfg.radius*.7).toFixed(2)]});
    rv.drawImage(frame,n%4*256,Math.floor(n/4)*256);rv.fillStyle='white';rv.font='13px sans-serif';rv.fillText(name,n%4*256+10,Math.floor(n/4)*256+246);
  }
  registration[suit]=frames;
  writeFileSync(source+'review/'+suit+'-frames.png',review.toBuffer('image/png'));
}
writeFileSync(source+'registration.json',JSON.stringify(registration,null,2)+'\n');
console.log('Exported 80 transparent registered flight frames.');
