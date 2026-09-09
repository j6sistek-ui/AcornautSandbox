// Extract the two owner-requested whole-character banks in Eclipse cell order.
// One uniform resample per cell; local material hue is calibrated to the same
// plate in the original portrait. No cropping, pitch, deformation or part swaps.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const source=root+'art-src/eclipse-motion-transfer/';
const output=process.env.ECLIPSE_TRANSFER_OUTPUT||root+'docs/art/suits/';
mkdirSync(output,{recursive:true});
const features=JSON.parse(readFileSync(source+'features.json','utf8'));
function hsv(r,g,b){r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;let h=0;if(d)h=hi===r?((g-b)/d+6)%6:hi===g?(b-r)/d+2:(r-g)/d+4;return [h/6,hi?d/hi:0,hi];}
function rgb(h,s,v){h=(h+1)%1;const k=h*6,i=Math.floor(k),f=k-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6].map(x=>Math.round(x*255));}
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
function material(d,cx,cy,suit,radius=16){
 const out=[],lo=suit==='cryostar'?.48:.23,hi=suit==='cryostar'?.66:.46;
 for(let y=Math.max(0,cy-radius);y<=Math.min(255,cy+radius);y++)for(let x=Math.max(0,cx-radius);x<=Math.min(255,cx+radius);x++){
  const p=(y*256+x)*4,dist=Math.hypot(x-cx,y-cy);if(dist>radius||d[p+3]<=200)continue;
  const v=hsv(d[p],d[p+1],d[p+2]);if(v[0]>=lo&&v[0]<=hi&&v[1]>.28&&v[2]>.12&&v[2]<.98)out.push({p,v,dist});
 }
 return out;
}
for(const suit of ['cryostar','verdant']) {
  const portrait=await loadImage(source+suit+'-reference.png'),pc=createCanvas(256,256),pg=pc.getContext('2d');pg.drawImage(portrait,0,0);
  const pd=pg.getImageData(0,0,256,256).data;
  const targets=Object.fromEntries([['shoulder',173,143],['hip',123,173]].map(([key,x,y])=>[key,median(material(pd,x,y,suit).map(x=>x.v[0]))]));
  const im=await loadImage(source+suit+'-master.png');
  assert.equal(im.width,1254);assert.equal(im.height,1254);
  const sheet=createCanvas(im.width,im.height),g=sheet.getContext('2d');g.drawImage(im,0,0);
  const pixels=g.getImageData(0,0,im.width,im.height),d=pixels.data;
  for(let p=0;p<d.length;p+=4) {
    // Neither costume contains magenta. Key only the deliberately contrasting
    // production plate, including antialias coverage at the silhouette.
    const excess=Math.min(d[p],d[p+2])-d[p+1];
    if(excess>12) {
      const alpha=Math.max(0,Math.min(1,(110-excess)/98));
      d[p+3]=Math.round(d[p+3]*alpha);
      if(alpha===0)d[p]=d[p+1]=d[p+2]=0;
      else {
        const red=d[p],blue=d[p+2],green=d[p+1];
        d[p]=Math.min(red,green+Math.max(0,red-blue)+12);
        d[p+2]=Math.min(blue,green+Math.max(0,blue-red)+12);
      }
    }
  }
  g.putImageData(pixels,0,0);
  for(let n=0;n<16;n++) {
    const c=createCanvas(256,256),ctx=c.getContext('2d');
    ctx.drawImage(sheet,n%4*313.5,Math.floor(n/4)*313.5,313.5,313.5,0,0,256,256);
    const frame=ctx.getImageData(0,0,256,256),fd=frame.data;
    // Remove magenta resampling fringe (neither reference costume has magenta).
    for(let p=0;p<fd.length;p+=4)if(Math.min(fd[p],fd[p+2])-fd[p+1]>12){
      const r=fd[p],b=fd[p+2],g=fd[p+1];fd[p]=Math.min(r,g+Math.max(0,r-b)+12);fd[p+2]=Math.min(b,g+Math.max(0,b-r)+12);
    }
    // The reference's shoulder and hip retain their own hue. Keep value,
    // saturation, details and alpha; feather to zero outside each plate.
    for(let pass=0;pass<3;pass++)for(const key of ['shoulder','hip']){
      const [x,y]=features[key][n],sample=material(fd,x,y,suit);
      assert(sample.length>=60,`${suit} ${n} ${key}: source plate missing`);
      const delta=targets[key]-median(sample.map(x=>x.v[0]));
      for(const {p,v,dist} of material(fd,x,y,suit,30)){
        const weight=dist<=16?1:Math.max(0,(30-dist)/14);
        const colour=rgb(v[0]+delta*weight,v[1],v[2]);for(let k=0;k<3;k++)fd[p+k]=colour[k];
      }
    }
    ctx.putImageData(frame,0,0);
    writeFileSync(output+`${suit}-${n<8?'asc':'desc'}-${n%8+1}.png`,c.toBuffer('image/png'));
  }
}
console.log('Exported Cryostar and Verdant: 32 whole-character RGBA frames.');
