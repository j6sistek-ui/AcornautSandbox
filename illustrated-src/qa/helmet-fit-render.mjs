// Native Canvas harness for exhaustive helmet fitting reviews. Uses the actual
// source painters; the disposable exports expose registration data for QA only.
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
export const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
export async function helmetReview(root=resolve(import.meta.dirname,'../..')){
  const ts=require('typescript'),scratch=mkdtempSync(join(tmpdir(),'helmet-fit-'));
  globalThis.Image=Image;globalThis.HTMLImageElement=Image;
  globalThis.window={__ACORNAUT_BETA__:true,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
  globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
  for(const name of readdirSync(join(root,'illustrated-src/game')).filter(n=>n.endsWith('.ts'))){
    let source=readFileSync(join(root,'illustrated-src/game',name),'utf8');
    if(name==='draw.ts')source+='\nexport {DOME,HELM_GLASS,paintRegisteredDome,paintDome,paintIllustrated};';
    if(name==='art.ts')source+='\nexport {asSprite,RIGGED_SUITS,TAP_BANKS,TAIL_TAP_BANKS,BOUNCE_BANKS,ASC_BANKS,DESC_BANKS,LOOP_BANKS};';
    const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
    writeFileSync(join(scratch,name.replace('.ts','.mjs')),compiled.replace(/(from\s*['"]|import\s*['"])\.\/([^'"]+)(['"])/g,'$1./$2.mjs$3'));
  }
  const get=name=>import(pathToFileURL(join(scratch,name+'.mjs')).href);
  const [draw,art,cat,orbit,motion]=await Promise.all(['draw','art','catalog','high-orbit','high-orbit-motion'].map(get));
  const bank=art.emptyArt(),cache=new Map();bank.highOrbit={};
  async function sprite(path){
    if(!cache.has(path))cache.set(path,(async()=>{const i=await loadImage(join(root,'docs/art',path));Object.defineProperty(i,'src',{get:()=>path});return art.asSprite(i);})());
    return cache.get(path);
  }
  for(const h of cat.HELMETS)bank.helms[h.id]=await sprite(`helms/${h.id}.png`);
  for(const kind of ['Idle','Flap'])bank['squirrel'+kind]=await Promise.all(Array.from({length:4},(_,i)=>sprite(`squirrel/${kind.toLowerCase()}-${i+1}.png`)));
  for(const s of cat.SUITS){
    const id=s.id;bank.suits[id]=await sprite(id==='arcflash'?'suits/arcflash/body.png':`suits/${id}.png`);
    if(art.RIGGED_SUITS.includes(id)){bank.suitBody[id]=await sprite(`suits/${id}-body.png`);bank.suitTail[id]=await sprite(`suits/${id}-tail.png`);}
    for(const [prop,table,suffix] of [['suitTap','TAP_BANKS','tap'],['suitTapTail','TAIL_TAP_BANKS','tail-tap'],['suitBounce','BOUNCE_BANKS','bounce'],['suitAsc','ASC_BANKS','asc'],['suitDesc','DESC_BANKS','desc'],['suitLoop','LOOP_BANKS','loop']]){
      if(art[table][id])bank[prop][id]=await Promise.all(Array.from({length:art[table][id]},(_,i)=>sprite(`suits/${id}-${suffix}-${i+1}.png`)));
    }
    if(['cinderforge','groveguard','cosmic','sunforged','abyssal'].includes(id))bank.highOrbit[id]=await sprite(`suits/${id}/parts.png`);
    if(id==='arcflash')bank.arcflash=await sprite('suits/arcflash/parts.png');
    if(id==='vanguard')bank.vanguardParts=await sprite('suits/vanguard/maneuver-parts.png');
  }
  return {root,draw,art,cat,bank,orbit,motion,sprite,get,dispose:()=>rmSync(scratch,{recursive:true,force:true})};
}
