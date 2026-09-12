// Exact registered copies of the shipped Cyber cells for image-edit references.
// This script only scales/packs pixels and derives alpha masks; it paints no art.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const {createCanvas,loadImage}=createRequire(import.meta.url)(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'art-src/cyber-standard-trio/references');
mkdirSync(out,{recursive:true});
const report={sourceCell:256,boardCell:512,boardSize:1536,scale:2,order:'row-major',alphaThreshold:24,
  registration:'Exact shipped pixels scaled 2x. The nominal dome 128,128 r40 is a rig convention, not the actual own-head location. Do not relocate artwork to that dome.',banks:{}};
for(const bank of ['asc','desc']){
  const board=createCanvas(1536,1536),g=board.getContext('2d');
  const cutter=createCanvas(1536,1536),m=cutter.getContext('2d');
  const holes=createCanvas(1536,1536),h=holes.getContext('2d');
  g.imageSmoothingEnabled=false;m.imageSmoothingEnabled=false;h.imageSmoothingEnabled=false;
  const entries=[];
  const segments=Array.from({length:3},()=>createCanvas(1536,512));
  for(let i=0;i<9;i++){
    const source=`docs/art/suits/cyber-${bank}-${i+1}.png`,im=await loadImage(join(root,source));
    const cell=createCanvas(256,256),cg=cell.getContext('2d');cg.drawImage(im,0,0);
    const px=cg.getImageData(0,0,256,256),mask=cg.createImageData(256,256),hole=cg.createImageData(256,256);
    let x0=256,y0=256,x1=-1,y1=-1,n=0;
    for(let p=0;p<256*256;p++){
      const on=px.data[p*4+3]>24,x=p%256,y=p/256|0;
      mask.data[p*4]=mask.data[p*4+1]=mask.data[p*4+2]=255;mask.data[p*4+3]=on?255:0;
      hole.data[p*4+3]=on?0:255;
      if(on){n++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    }
    const mc=createCanvas(256,256);mc.getContext('2d').putImageData(mask,0,0);
    const hc=createCanvas(256,256);hc.getContext('2d').putImageData(hole,0,0);
    const x=i%3*512,y=Math.floor(i/3)*512;
    g.drawImage(cell,x,y,512,512);m.drawImage(mc,x,y,512,512);h.drawImage(hc,x,y,512,512);
    const single=createCanvas(512,512),singleG=single.getContext('2d');singleG.imageSmoothingEnabled=false;singleG.drawImage(cell,0,0,512,512);
    writeFileSync(join(out,`cyber-${bank}-${i+1}-reference.png`),single.toBuffer('image/png'));
    const segmentG=segments[Math.floor(i/3)].getContext('2d');segmentG.imageSmoothingEnabled=false;segmentG.drawImage(cell,(i%3)*512,0,512,512);
    entries.push({source,cell:i,sourceBox:[x0,y0,x1-x0+1,y1-y0+1],coverage:n/65536});
  }
  writeFileSync(join(out,`cyber-${bank}-reference.png`),board.toBuffer('image/png'));
  writeFileSync(join(out,`cyber-${bank}-cutter.png`),cutter.toBuffer('image/png'));
  writeFileSync(join(out,`cyber-${bank}-holes.png`),holes.toBuffer('image/png'));
  for(let i=0;i<3;i++)writeFileSync(join(out,`cyber-${bank}-${i*3+1}-${i*3+3}-reference.png`),segments[i].toBuffer('image/png'));
  report.banks[bank]=entries;
}
writeFileSync(join(out,'registration.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Cyber 3x3 references: ${out}`);
