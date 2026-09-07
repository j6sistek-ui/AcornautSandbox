// Export-time colour calibration to the sole approved loadout reference.
// Whole generated paintings remain the source; no old flight frame is sampled.
function hsv(r,g,b) {
  r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo;
  let h=0;if(delta)h=hi===r?((g-b)/delta+6)%6:hi===g?(b-r)/delta+2:(r-g)/delta+4;
  return [h/6,hi?delta/hi:0,hi];
}
function rgb(h,s,v) {
  h=(h%1+1)%1;s=Math.max(0,Math.min(1,s));v=Math.max(0,Math.min(1,v));
  const k=h*6,i=Math.floor(k),f=k-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
  return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6].map(x=>Math.round(255*x));
}
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
function select(d,width,head,kind) {
  const out=[];
  for(let p=0;p<d.length;p+=4) {
    if(d[p+3]<32)continue;const v=hsv(d[p],d[p+1],d[p+2]);
    const x=(p/4)%width,y=Math.floor(p/4/width),distance=(x-head[0])**2+(y-head[1])**2;
    const warm=v[0]<.16&&v[1]>.35&&v[2]>.08;
    const angle=(head[3]||0)*Math.PI/180;
    const behind=(x-head[0])*Math.cos(angle)+(y-head[1])*Math.sin(angle)<-.65*head[2];
    let use=kind==='tail'?warm&&behind&&distance>(1.05*head[2])**2:
      kind==='face'?warm&&distance<head[2]**2:
      kind==='green'?v[0]>=.23&&v[0]<=.46&&v[1]>.28&&v[2]>.06&&v[2]<.85:
      false;
    if(use)out.push([p,v]);
  }
  return out;
}
export function referenceColourTargets(image,head) {
  return Object.fromEntries(['tail','face','green'].map(kind=>{
    const sample=select(image.data,image.width,head,kind);
    return [kind,sample.length>128?[0,1,2].map(c=>median(sample.map(x=>x[1][c]))):null];
  }));
}
export function calibrateReferenceColour(image,head,targets,suit) {
  const kinds=suit==='verdant'?['tail','face','green']:['tail','face'];
  for(let pass=0;pass<3;pass++)for(const kind of kinds) {
    const target=targets[kind];if(!target)continue;
    const sample=select(image.data,image.width,head,kind);if(sample.length<128)continue;
    const current=[0,1,2].map(c=>median(sample.map(x=>x[1][c])));
    const delta=target.map((v,i)=>v-current[i]);
    for(const [p,v] of sample) {
      const colour=rgb(...v.map((c,i)=>c+delta[i]));
      for(let i=0;i<3;i++)image.data[p+i]=colour[i];
    }
  }
  return image;
}
