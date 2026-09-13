// Export generated full-pilot masters with one scale per suit.
// Measured pose translations may register the skull to its Cyber counterpart;
// no frame is independently fitted, rotated, retimed, warped, or repainted.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const {createCanvas,loadImage}=createRequire(import.meta.url)(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sourceRoot=join(root,'art-src/cyber-standard-trio');
const allIds=['porcelain','nacre','origamist'],args=process.argv.slice(2);
const selected=args.includes('--suit')?args[args.indexOf('--suit')+1]:null;
assert(!selected||allIds.includes(selected),'--suit must be porcelain,nacre,or origamist');
const ids=selected?[selected]:allIds,framesOnly=args.includes('--frames-only'),manifest=[],registration={};
const selectedBank=args.includes('--bank')?args[args.indexOf('--bank')+1]:null;
assert(!selectedBank||(framesOnly&&['asc','desc'].includes(selectedBank)),'--bank requires --frames-only and asc or desc');
const previewOutput=args.includes('--preview-output')?args[args.indexOf('--preview-output')+1]:null;
assert(!previewOutput||framesOnly,'--preview-output requires --frames-only');
const unregistered=args.includes('--unregistered');
assert(!unregistered||previewOutput,'--unregistered requires a local preview output');
const out=previewOutput?resolve(root,'outputs/cyber-standard-trio',previewOutput):join(root,'docs/art/suits');
assert(!previewOutput||out.startsWith(resolve(root,'outputs/cyber-standard-trio')+sep),'Preview output must stay in workspace outputs');
const previewMaster=args.includes('--preview-master')?args[args.indexOf('--preview-master')+1]:null;
assert(!previewMaster||(selected&&selectedBank&&framesOnly),'--preview-master requires one preview suit/bank');
const allowMissing=args.includes('--allow-missing');assert(!allowMissing||framesOnly,'--allow-missing requires --frames-only');
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const resamplerPath=join(root,'illustrated-src/resize-cyber-trio.py');
const resamplerSha256=sha(readFileSync(resamplerPath,'utf8').replaceAll('\r\n','\n'));
const exporterSha256=sha(readFileSync(fileURLToPath(import.meta.url),'utf8').replaceAll('\r\n','\n')+'\n'+resamplerSha256);
const manifestPath=join(sourceRoot,'shipping-manifest.json');
const prior=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath,'utf8')):null;
const CELL=256;
mkdirSync(out,{recursive:true});
mkdirSync(join(out,'hd'),{recursive:true});
for(const id of ids){
  const source=join(sourceRoot,id),configPath=join(source,'export.json');
  const config=existsSync(configPath)?JSON.parse(readFileSync(configPath,'utf8')):{};
  // Keep one scale for the complete suit. Optional measured translations align
  // each whole painting, preserving all relative body/tail/feature coordinates.
  const scale=config.scale??1,offset=config.offset??[0,0];
  assert(Number.isFinite(scale)&&scale>0&&scale<=2,`${id}: invalid global scale`);
  assert.equal(offset.length,2,`${id}: offset must be x/y`);
  assert(offset.every(Number.isFinite),`${id}: nonfinite offset`);
  if(config.poseOffsets){
    assert(config.registrationEvidence,`${id}: pose offsets require measurement provenance`);
    const evidence=resolve(source,config.registrationEvidence);
    assert(evidence.startsWith(source+sep)&&existsSync(evidence),`${id}: registration evidence must exist inside its source directory`);
    for(const bank of ['asc','desc']){
      assert.equal(config.poseOffsets[bank]?.length,9,`${id}: nine ${bank} offsets required`);
      config.poseOffsets[bank].forEach((p,i)=>assert(Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=24),`${id}/${bank}-${i+1}: invalid measured translation`));
    }
  }
  const mode=config.background??'alpha';
  assert(['alpha','green-matte'].includes(mode),`${id}: unsupported background`);
  // Both resolutions use the same keyed master and 256px logical coordinates.
  // HD is sampled from source, never enlarged from the canonical PNG.
  const priorSuit=prior?.suits?.find(suit=>suit.id===id);
  const targets=[
    {cell:CELL,factor:1,directory:out,prefix:'docs/art/suits',frames:[],prior:priorSuit},
    {cell:CELL*2,factor:2,directory:join(out,'hd'),prefix:'docs/art/suits/hd',frames:[],prior:priorSuit?.hd},
  ];
  for(const bank of selectedBank?[selectedBank]:['asc','desc']){
    const individual=!previewMaster&&(config.sourceLayout==='individual'||Array.from({length:9},(_,i)=>existsSync(join(source,`frames/${bank}-${i+1}.png`))).some(Boolean));
    for(let index=0;index<9;index++){
      const sourceRelative=individual?`frames/${bank}-${index+1}.png`:`${bank}-master.png`;
      const file=previewMaster||join(source,sourceRelative);
      if(allowMissing&&!existsSync(file))continue;
      const buffer=readFileSync(file),sourceSha256=sha(buffer);
      const poseOffset=unregistered?[0,0]:config.poseOffsets?.[bank][index]??[0,0];
      const registeredOffset=unregistered?[0,0]:[offset[0]+poseOffset[0],offset[1]+poseOffset[1]];
      const name=`${id}-${bank}-${index+1}.png`,pending=[];
      // A verified unchanged painting stays byte-identical across build hosts.
      // Native canvas versions can round a few edge channels differently.
      // Any changed input, transform, exporter or output invalidates this reuse.
      for(const target of targets){
        const outputPath=join(target.directory,name),outputOffset=registeredOffset.map(v=>v*target.factor);
        const priorFrame=target.prior?.frames?.find(frame=>frame.file===`${target.prefix}/${name}`);
        if(!selected&&!framesOnly&&prior?.exporterSha256===exporterSha256&&priorFrame
          &&(target.factor===1?prior.cell:target.prior.cell)===target.cell
          &&priorFrame.sourceSha256===sourceSha256&&priorFrame.scale===scale&&priorFrame.background===mode
          &&priorFrame.sourceLayout===(individual?'individual':'3x3')
          &&(!config.masterSize||priorFrame.sourceSize===config.masterSize)
          &&JSON.stringify(priorFrame.offset)===JSON.stringify(outputOffset)
          &&existsSync(outputPath)&&sha(readFileSync(outputPath))===priorFrame.sha256){
          target.frames.push(priorFrame);
        }else pending.push({target,outputPath,outputOffset});
      }
      if(!pending.length)continue;
      const master=await loadImage(file);
      assert.equal(master.width,master.height,`${id}/${bank}: source must be square`);
      assert(master.width>=(individual?256:768),`${id}/${bank}: source resolution too small`);
      if(config.masterSize)assert.equal(master.width,config.masterSize,`${id}/${bank}: wrong source size`);
      const masterCanvas=createCanvas(master.width,master.height),mg=masterCanvas.getContext('2d');mg.drawImage(master,0,0);
      if(mode==='green-matte'){
        // Existing project green-screen convention; alpha/despill only, no repaint.
        const image=mg.getImageData(0,0,master.width,master.height),d=image.data;
        for(let i=0;i<d.length;i+=4){const max=Math.max(d[i],d[i+2]),excess=d[i+1]-max;
          if(excess>18){d[i+3]=Math.round(d[i+3]*Math.max(0,Math.min(1,1-(excess-18)/145)));d[i+1]=Math.min(d[i+1],max+8);}}
        mg.putImageData(image,0,0);
      }
      // Canvas "high" aliases fine detail during large reductions in the
      // shipping canvas library. Filter the keyed, premultiplied pixels once
      // with Lanczos; canvas then only places the resulting whole painting.
      const keyed=masterCanvas.toBuffer('image/png');
      for(const {target,outputPath,outputOffset} of pending){
        const {cell,factor}=target,sampleSize=Math.max(1,Math.round(cell*scale*(individual?1:3)));
        const sampled=await loadImage(execFileSync(process.env.ACORNAUT_PYTHON||'python3',
          [resamplerPath,String(sampleSize)],{input:keyed,maxBuffer:64*1024*1024}));
        const span=sampled.width/(individual?1:3);
        const canvas=createCanvas(cell,cell),g=canvas.getContext('2d');
        g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
        // Fractional source boundaries preserve one transform for every cell.
        g.drawImage(sampled,individual?0:index%3*span,individual?0:Math.floor(index/3)*span,span,span,
          outputOffset[0],outputOffset[1],cell*scale,cell*scale);
        const pixels=g.getImageData(0,0,cell,cell).data;let edge=0,opaque=0;
        for(let k=0;k<cell*cell;k++){if(pixels[k*4+3]<=24)continue;opaque++;const x=k%cell,y=k/cell|0;if(x<8*factor||x>=cell-8*factor||y<8*factor||y>=cell-8*factor)edge++;}
        assert(opaque>2000*factor*factor&&opaque<24000*factor*factor,`${id}/${bank}-${index+1}@${cell}: implausible alpha coverage`);
        assert.equal(edge,0,`${id}/${bank}-${index+1}@${cell}: opaque art within scaled8px margin`);
        const png=canvas.toBuffer('image/png');writeFileSync(outputPath,png);
        target.frames.push({file:`${target.prefix}/${name}`,sha256:sha(png),source:`art-src/cyber-standard-trio/${id}/${sourceRelative}`,
          sourceSha256,sourceSize:master.width,sourceCell:individual?0:index,sourceLayout:individual?'individual':'3x3',scale,offset:outputOffset,background:mode,opaquePixels:opaque});
      }
    }
  }
  // The still is exactly the level climb painting. Body/tail separation is an
  // explicitly reviewed source mask, never a guessed whole-character rectangle.
  if(selectedBank==='desc'){console.log(`${id}: preview dive frames only; still rig and final manifest NOT exported`);continue;}
  if(allowMissing&&!existsSync(join(out,`${id}-asc-1.png`)))continue;
  for(const target of targets){
    const still=readFileSync(join(target.directory,`${id}-asc-1.png`));writeFileSync(join(target.directory,`${id}.png`),still);
    target.still={file:`${target.prefix}/${id}.png`,source:`${target.prefix}/${id}-asc-1.png`,sha256:sha(still)};
  }
  if(framesOnly){console.log(`${id}: preview frames only; still rig and final manifest NOT exported`);continue;}
  const maskPath=join(source,'still-tail-mask.png');
  assert(existsSync(maskPath),`${id}: missing reviewed256px still-tail-mask.png`);
  const mask=await loadImage(maskPath);assert.equal(mask.width,CELL);assert.equal(mask.height,CELL);
  const mc=createCanvas(CELL,CELL),mg=mc.getContext('2d');mg.drawImage(mask,0,0);const maskPixels=mg.getImageData(0,0,CELL,CELL).data;
  for(const target of targets){
    const {cell,factor}=target,sc=createCanvas(cell,cell),sg=sc.getContext('2d');
    sg.drawImage(await loadImage(join(target.directory,`${id}-asc-1.png`)),0,0);const sourcePixels=sg.getImageData(0,0,cell,cell).data;
    const partEntries=[];
    for(const part of ['body','tail']){
      const canvas=createCanvas(cell,cell),g=canvas.getContext('2d'),image=g.createImageData(cell,cell);let n=0;
      for(let k=0;k<cell*cell;k++){
        // Nearest-neighbor 2x mask lookup; each original pixel belongs to
        // exactly one part, so body + tail is the unchanged HD still.
        const maskIndex=(Math.floor((k/cell|0)/factor)*CELL+Math.floor((k%cell)/factor))*4;
        const tail=maskPixels[maskIndex+3]>127;
        if(tail===(part==='tail')){image.data.set(sourcePixels.subarray(k*4,k*4+4),k*4);if(sourcePixels[k*4+3]>24)n++;}
      }
      assert(n>100*factor*factor,`${id}@${cell}: empty ${part} layer`);g.putImageData(image,0,0);
      const png=canvas.toBuffer('image/png'),name=`${id}-${part}.png`;writeFileSync(join(target.directory,name),png);
      partEntries.push({file:`${target.prefix}/${name}`,sha256:sha(png),opaquePixels:n});
    }
    target.split={mask:`art-src/cyber-standard-trio/${id}/still-tail-mask.png`,maskSha256:sha(readFileSync(maskPath)),parts:partEntries};
  }
  const [canonical,hd]=targets;
  manifest.push({id,registration:{scale,offset,poseOffsets:config.poseOffsets,registrationEvidence:config.registrationEvidence,background:mode},frames:canonical.frames,
    still:canonical.still,split:canonical.split,
    hd:{cell:hd.cell,logicalCell:CELL,frames:hd.frames,still:hd.still,split:{...hd.split,maskSampling:'nearest 2x'}}});
  const geometryBytes=readFileSync(join(source,'geometry.json'));
  const geometry=JSON.parse(geometryBytes.toString('utf8'));
  manifest.at(-1).geometry={file:`art-src/cyber-standard-trio/${id}/geometry.json`,sha256:sha(geometryBytes)};
  const point=(p,label,size=2)=>{assert(Array.isArray(p)&&p.length===size&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=256),`${id}: invalid ${label}`);};
  point(geometry.head,'head',3);
  point(geometry.tailPivot,'still tail pivot');
  const pose=(f,label)=>{assert(f&&Array.isArray(f.emitters)&&f.emitters.length===2,`${id}: ${label} needs two boot emitters`);f.emitters.forEach((p,i)=>point(p,`${label}/emitter${i}`));if(f.head)point(f.head,`${label}/head`,3);};
  for(const bank of ['asc','desc']){assert.equal(geometry[bank]?.length,9,`${id}: nine ${bank} geometry rows`);geometry[bank].forEach((f,i)=>pose(f,`${bank}-${i+1}`));}
  pose(geometry.still,'still');
  registration[id]={head:geometry.head,tailPivot:geometry.tailPivot,asc:geometry.asc,desc:geometry.desc,still:geometry.still};
}
if(!selected&&!framesOnly){
  writeFileSync(manifestPath,JSON.stringify({exporter:'illustrated-src/export-cyber-trio.mjs',exporterSha256,
    resampler:{file:'illustrated-src/resize-cyber-trio.py',sha256:resamplerSha256,filter:'premultiplied-alpha Lanczos'},cell:CELL,suits:manifest},null,2)+'\n');
  writeFileSync(join(root,'illustrated-src/game/cyber-trio-registration.ts'),
    '// Generated by export-cyber-trio.mjs from reviewed registered-pixel geometry.json files.\n'
    +'export const CYBER_TRIO_REGISTRATION = '+JSON.stringify(registration,null,2)+' as const;\n');
}
console.log(`Cyber trio: ${ids.length} suits exported${selected||framesOnly?' (partial local preview; final manifest not written)':''}`);
