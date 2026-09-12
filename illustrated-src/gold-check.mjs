// GOLD CHECK: grade a suit's climb/dive bank against the Cyber standard.
//
//   node illustrated-src/gold-check.mjs <suitId> [--dir folder] [--pivot x,y]
//
// Reads <id>-asc-1..N.png and <id>-desc-1..N.png (256x256) from the art
// folder (or --dir for an unwired drop), measures what GOLD_STANDARD.md
// measures on Cyber - frame count, coverage, silhouette box progression,
// per-frame step, the plume's angle path - and prints them side by side with
// Cyber's numbers, then a verdict per line of the needs list. Art only: it
// does not fly the suit (that needs the wiring; see test-gold-standard).
import {createRequire} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),id=args.find(a=>!a.startsWith('--'));
const dirArg=args.indexOf('--dir');const dir=dirArg>=0?resolve(args[dirArg+1]):join(root,'docs/art/suits');
if(!id){console.error('usage: node illustrated-src/gold-check.mjs <suitId> [--dir folder] [--pivot x,y]');process.exit(2);}
const CELL=256;
const gold=JSON.parse(readFileSync(join(root,'art-src/gold-standard/cyber/measurements.json'),'utf8'));
const goldFrames=Object.fromEntries(gold.frames.map(f=>[f.frame,f]));
async function px(name){const p=join(dir,`${name}.png`);if(!existsSync(p))return null;const im=await loadImage(p);
  if(im.width!==CELL||im.height!==CELL){console.log(`  ! ${name}.png is ${im.width}x${im.height}, not ${CELL}x${CELL}`);}
  const c=createCanvas(CELL,CELL),g=c.getContext('2d');g.drawImage(im,0,0,CELL,CELL);return g.getImageData(0,0,CELL,CELL).data;}
function stats(d,pivotX){let n=0,minx=CELL,miny=CELL,maxx=-1,maxy=-1,tn=0,tsx=0,tsy=0,tminy=CELL;
  for(let k=0;k<CELL*CELL;k++){if(d[k*4+3]<=24)continue;const x=k%CELL,y=(k/CELL)|0;n++;if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;
    if(x<pivotX){tn++;tsx+=x;tsy+=y;if(y<tminy)tminy=y;}}
  return {coverage:n/(CELL*CELL),box:[maxx-minx+1,maxy-miny+1],tail:tn?{cx:tsx/tn,cy:tsy/tn,top:tminy,n:tn}:null};}
const diff=(a,b)=>{let n=0;for(let p=0;p<a.length;p+=4){if(Math.abs(a[p]-b[p])+Math.abs(a[p+1]-b[p+1])+Math.abs(a[p+2]-b[p+2])+Math.abs(a[p+3]-b[p+3])>40)n++;}return n;};
const still=await px(id);
// THE PLUME BOUNDARY. The spec fixes the registration (dome 128,128 r40, tail
// root 101,125), so a suit built to it is measured at Cyber's neck cut. A
// wired suit's own TAIL_PIVOT (draw.ts) wins; --pivot x,y overrides both.
const pivArg=args.indexOf('--pivot');
let pivotX=101,pivotY=125,pivotFrom='the spec (Cyber)';
const drawTs=join(root,'illustrated-src/game/draw.ts');
if(existsSync(drawTs)){const m=readFileSync(drawTs,'utf8').match(new RegExp(`^\\s*${id}: \\[(\\d+), (\\d+)\\],`,'m'));if(m){pivotX=+m[1];pivotY=+m[2];pivotFrom='TAIL_PIVOT in draw.ts';}}
if(pivArg>=0){[pivotX,pivotY]=args[pivArg+1].split(',').map(Number);pivotFrom='--pivot';}
console.log(`GOLD CHECK · ${id} · frames from ${dir}`);
console.log(`  plume boundary (tail pivot): ${pivotX},${pivotY} from ${pivotFrom} · Cyber 101,125`);
let verdicts=[];
for(const bank of ['asc','desc']){
  const frames=[];for(let i=1;i<=16;i++){const d=await px(`${id}-${bank}-${i}`);if(!d)break;frames.push(d);}
  const n=frames.length;console.log(`\n${bank.toUpperCase()} · ${n} frames (Cyber 9)`);
  if(!n){verdicts.push(`✗ ${bank}: no frames found`);continue;}
  const st=frames.map(d=>stats(d,pivotX));
  const step=[];for(let i=1;i<n;i++)step.push(diff(frames[i-1],frames[i]));const max=Math.max(...step,1);
  const pct=step.map(v=>Math.round(100*v/max));
  // plume angle: pivot -> plume centre of mass, positive = raised
  const ang=st.map(s=>s.tail?+(Math.atan2(pivotY-s.tail.cy,pivotX-s.tail.cx)*180/Math.PI).toFixed(1):null);
  const g=gold.tail?.[bank];
  console.log(`  box w×h      ${st.map(s=>s.box.join('×')).join('  ')}`);
  console.log(`  Cyber        ${Array.from({length:9},(_,i)=>goldFrames[`${bank}-${i+1}`].box.slice(2).join('×')).join('  ')}`);
  console.log(`  coverage %   ${st.map(s=>(100*s.coverage).toFixed(1)).join(' ')}   (Cyber 11.6–13.8)`);
  console.log(`  step % max   ${pct.join(' ')}`);
  console.log(`  Cyber        ${bank==='asc'?'91 84 98 100 91 70 92 96':'100 71 69 87 93 64 87 67'}`);
  console.log(`  plume angle  ${ang.map(a=>a===null?'-':(a>0?'+':'')+a+'°').join(' ')}`);
  if(g)console.log(`  Cyber        ${g.frames.map(f=>(f.angleDeg>0?'+':'')+f.angleDeg+'°').join(' ')}`);
  // verdicts
  verdicts.push(n===9?`✓ ${bank}: nine frames`:`✗ ${bank}: ${n} frames, the spec is nine`);
  const minStep=Math.min(...pct);verdicts.push(minStep>=60?`✓ ${bank}: every frame moves (smallest step ${minStep}% of the largest)`:`✗ ${bank}: a near-duplicate neighbour (smallest step ${minStep}%; Cyber's floor is ${bank==='asc'?70:64}%)`);
  const cov=st.map(s=>s.coverage);verdicts.push(Math.min(...cov)>=.09&&Math.max(...cov)<=.17?`✓ ${bank}: coverage in range`:`? ${bank}: coverage ${(100*Math.min(...cov)).toFixed(1)}–${(100*Math.max(...cov)).toFixed(1)}% (Cyber 11.6–13.8)`);
  if(bank==='asc'){
    const w=st.map(s=>s.box[0]),h=st.map(s=>s.box[1]);
    verdicts.push(w[n-1]<w[0]&&h[n-1]>h[0]?`✓ asc: the climb gathers and lifts (box ${w[0]}×${h[0]} → ${w[n-1]}×${h[n-1]})`:`? asc: the climb box goes ${w[0]}×${h[0]} → ${w[n-1]}×${h[n-1]} (Cyber narrows and grows)`);
    const a=ang.filter(x=>x!==null);
    if(a.length===n){const lowAt=a.indexOf(Math.min(...a));const rises=a.slice(lowAt).every((v,i,arr)=>i===0||v>=arr[i-1]-.5);
      verdicts.push(lowAt>=1&&lowAt<=3&&rises&&a[n-1]>a[0]?`✓ asc: the plume whips - winds down to frame ${lowAt+1}, then sweeps up to ${a[n-1]>0?'+':''}${a[n-1]}° (Cyber: down to 3, up to +27.4°)`:`✗ asc: the plume path is ${a.join(' ')} - Cyber winds down through 1–3 then sweeps up and overshoots`);
      const mid=a.slice(2,7);const distinct=new Set(mid.map(v=>Math.round(v))).size;verdicts.push(distinct===mid.length?`✓ asc: frames 3–7 are each a different place on the path`:`✗ asc: frames 3–7 repeat a plume position (${mid.join(' ')})`);}
  } else {
    const a=ang.filter(x=>x!==null);
    if(a.length===n){const travel=a.slice(1).map((v,i)=>Math.abs(v-a[i]));const settling=travel.slice(0,3).reduce((x,y)=>x+y,0)>=travel.slice(-3).reduce((x,y)=>x+y,0);
      verdicts.push(settling?`✓ desc: the plume settles and trails (no whip)`:`? desc: the plume moves more late than early (${a.join(' ')}); Cyber settles once then trails`);}
  }
}
for(const part of ['body','tail']){verdicts.push(existsSync(join(dir,`${id}-${part}.png`))?`✓ ${part} layer present`:`✗ ${id}-${part}.png missing (the still needs a rigged tail)`);}
verdicts.push(still?`✓ still present`:`✗ ${id}.png missing`);
console.log('\nVERDICT');for(const v of verdicts)console.log('  '+v);
console.log('\nThe numbers are the floor; the feel is the ruling. Wire it (ASC_BANKS/DESC_BANKS, TAP_SHAPE velocity, SUIT_DIVE_DEPTH 1, TAIL_PIVOT from the neck cut) and fly it in beta.');
