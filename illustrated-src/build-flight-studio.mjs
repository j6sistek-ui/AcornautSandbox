// Build the offline tool from current source. Never edits the game or its art.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,copyFileSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildTables} from './lab/rig-tables.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'tools/flight-studio'),source=join(root,'illustrated-src/flight-studio');
mkdirSync(join(out,'game'),{recursive:true});
for(const name of readdirSync(source)) if(/\.(mjs|html|css)$/.test(name))copyFileSync(join(source,name),join(out,name));
const visited=new Set();
function compile(name){
  if(visited.has(name))return;visited.add(name);
  const input=readFileSync(join(root,'illustrated-src/game',name+'.ts'),'utf8');
  const compiled=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
  const output=compiled.replace(/(from\s*['"]|import\s*['"])\.\/([^'"]+)(['"])/g,(_,a,dep,b)=>{
    compile(dep);return `${a}./${dep}.mjs${b}`;
  });
  writeFileSync(join(out,'game',name+'.mjs'),output);
}
for(const name of ['high-orbit','high-orbit-motion','premium-flight','premium-flight-frames','premium-bank-wake','sprite-detail','arcflash','arcflash-motion','vanguard-maneuver','helmet-openings'])compile(name);
// Remove generated modules retired from the current dependency graph.
for(const name of readdirSync(join(out,'game')))if(name.endsWith('.mjs')&&!visited.has(name.slice(0,-4)))rmSync(join(out,'game',name));
const {PREMIUM_FLIGHT_FRAMES}=await import(pathToFileURL(join(out,'game/premium-flight-frames.mjs')).href);
const {isPremiumSuit}=await import(pathToFileURL(join(out,'game/high-orbit-config.mjs')).href);
const tables=buildTables(root),artSource=readFileSync(join(root,'illustrated-src/game/art.ts'),'utf8').replace(/\/\/[^\n]*/g,'');
function bank(name){
  const b=artSource.match(new RegExp(`const ${name}_BANKS[^=]*=\\s*\\{([^}]*)\\}`));
  if(!b)throw new Error('Cannot read '+name+' bank registry');
  return Object.fromEntries([...b[1].matchAll(/(\w+):\s*(\d+)/g)].map(m=>[m[1],Number(m[2])]));
}
const banks={tap:bank('TAP'),asc:bank('ASC'),desc:bank('DESC'),loop:bank('LOOP')};
const orbit=['cinderforge','groveguard','cosmic','sunforged','abyssal'];
const hash=path=>createHash('sha256').update(readFileSync(join(root,'docs/art',path))).digest('hex');
const models=tables.suits.filter(s=>!s.frame).map(s=>{
  if(s.id==='arcflash')s={...s,file:'suits/arcflash/body.png'};
  // A registered ascent/descent bank supersedes the archived premium atlas.
  // Percy, Envoy and Patriot now take exactly Cyber's standard bank family.
  const sheet=banks.asc[s.id]&&banks.desc[s.id]?undefined:PREMIUM_FLIGHT_FRAMES[s.id];
  const family=sheet?'premium-flight':orbit.includes(s.id)?'high-orbit':s.id==='arcflash'?'arcflash':s.id==='vanguard'?'acornut':'bank';
  const lists={};
  for(const [kind,counts] of Object.entries(banks))lists[kind]=Array.from({length:counts[s.id]||0},(_,i)=>`suits/${s.id}-${kind}-${i+1}.png`);
  const atlas=sheet?`suits/${s.id}/flight.png`:family==='bank'?null:`suits/${s.id}/${family==='acornut'?'maneuver-parts':'parts'}.png`;
  if(sheet){for(const kind of Object.keys(lists))lists[kind]=[];lists.loop=Array(sheet.frameCount).fill(atlas);}
  const assets=[...new Set([s.file,...Object.values(lists).flat(),...(atlas?[atlas]:[])])];
  for(const p of assets)if(!existsSync(join(root,'docs/art',p)))throw new Error('Missing '+p);
  if(isPremiumSuit(s.id))assets.push(...assets.map(p=>p.replace('suits/','suits/hd/')).filter(p=>existsSync(join(root,'docs/art',p))));
  return {...s,family,atlas,...(sheet?{sheet}:{}),banks:lists,hashes:Object.fromEntries(assets.map(p=>[p,hash(p)]))};
});
const sourceCommit=execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const visorSource=readFileSync(join(root,'illustrated-src/game/draw.ts'),'utf8').match(/const LIGHT_OPAQUE_VISORS = new Set\(\[([\s\S]*?)\]\)/);
if(!visorSource)throw Error('Cannot read visor transparency rules');
const lightOpaqueVisors=[...visorSource[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
const manifest={version:1,artVer:tables.artVer,sourceCommit,models,helmets:tables.helmets,
  lightOpaqueVisors,
  anchors:Object.fromEntries(tables.suits.map(s=>[s.key,s.dome])),
  painterHashes:Object.fromEntries([...visited].sort().map(n=>[n,createHash('sha256').update(readFileSync(join(root,'illustrated-src/game',n+'.ts'),'utf8').replaceAll('\r\n','\n')).digest('hex')]))};
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Flight Studio: ${models.length} models, ${models.filter(m=>!['bank','premium-flight'].includes(m.family)).length} cut rigs, ${models.filter(m=>m.family==='premium-flight').length} full-body sheet banks, ${visited.size} source modules. No app output changed.`);
