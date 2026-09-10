// Exercise the actual worn-glass painters, including the offline preview.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cpSync,mkdtempSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {StudioRenderer} from '../tools/flight-studio/renderer.mjs';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=mkdtempSync(join(tmpdir(),'acornaut-visor-continuity-'));
globalThis.Image=Image;globalThis.HTMLImageElement=Image;
globalThis.window={__ACORNAUT_BETA__:false,location:{href:'http://local/',search:''},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.document={createElement:()=>createCanvas(1,1),documentElement:{style:{}},addEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
try {
  cpSync(join(root,'docs/js'),join(scratch,'js'),{recursive:true});
  writeFileSync(join(scratch,'package.json'),'{"type":"module"}');
  for(const file of readdirSync(join(scratch,'js')).filter(f=>f.endsWith('.js'))){
    const p=join(scratch,'js',file);
    writeFileSync(p,readFileSync(p,'utf8').replace(/(\.js)\?v=[^"']+/g,'$1')+(file==='draw.js'?'\nexport {punchedHelm};\n':''));
  }
  const {punchedHelm}=await import(pathToFileURL(join(scratch,'js/draw.js')).href);
  const manifest=JSON.parse(readFileSync(join(root,'tools/flight-studio/manifest.json'),'utf8'));
  const studio=new StudioRenderer(manifest,()=>new Image(),()=>createCanvas(1,1));
  const probe={royal:[125,206],chronarch:[125,186],sammie:[120,159],princess:[176,150],phoenix:[130,185],seraph:[135,199],cryostar:[137,187],verdant:[129,188],eclipse:[130,188],leviathan:[145,143]};
  const exports=JSON.parse(readFileSync(join(root,'art-src/visor-glass/export-review.json'),'utf8'));
  const decoration={royal:[130,45],chronarch:[32,128],sammie:[170,42],princess:[65,115],phoenix:[34,118],seraph:[61,154],cryostar:[57,78],verdant:[58,75],eclipse:[54,72],leviathan:[79,76]};
  const target=createCanvas(128,128).getContext('2d');
  for(const helmet of manifest.helmets){
    const raw=await loadImage(join(root,'docs/art',helmet.file));
    const game=punchedHelm(raw,helmet.id,helmet.opaqueVisor===true);
    assert(game,helmet.id+': production painter must produce a visor');
    const pixels=game.getContext('2d').getImageData(0,0,game.width,game.height).data;
    studio.images.set(helmet.file,raw);studio.helmet(target,helmet.id,64,64,40,0);
    const preview=studio.helmets.get(helmet.id);
    assert.deepEqual(preview.getContext('2d').getImageData(0,0,preview.width,preview.height).data,pixels,helmet.id+': Studio and game must have identical glass');
    if(probe[helmet.id]){
      const record=exports.find(r=>r.id===helmet.id),[sx,sy,sr]=record.sourceGlass;
      assert.deepEqual(helmet.glass.slice(0,3),[128,136,80],helmet.id+': shared registration');
      const point=([x,y])=>[Math.round(128+(x-sx)*80/sr),Math.round(136+(y-sy)*80/sr)];
      const [x,y]=point(probe[helmet.id]),alpha=pixels[(y*game.width+x)*4+3];
      assert(alpha>0&&alpha<255,helmet.id+': worn lower pane must be translucent glass, not an empty hole or opaque rear ring');
      const c=createCanvas(256,256),g=c.getContext('2d');g.drawImage(raw,0,0);const source=g.getImageData(0,0,256,256).data;
      const [dx,dy]=point(decoration[helmet.id]),i=(dy*256+dx)*4;
      assert.deepEqual(pixels.slice(i,i+4),source.slice(i,i+4),helmet.id+': painted decoration retains its color and opacity');
      if(helmet.id==='princess'){const [cx,cy]=point([155,195]);assert.equal(pixels[(cy*256+cx)*4+3],255,'Rose chin remains closed and opaque when worn');}
    }
    assert.equal(punchedHelm(raw,helmet.id,helmet.opaqueVisor===true),game,helmet.id+': repair is cached, not repeated every animation frame');
  }
  console.log(`PASS ${manifest.helmets.length} worn visors match Flight Studio; ten lower panes retain translucent glass, decoration colors, normalized fit and cached composites.`);
} finally {
  assert(resolve(scratch).startsWith(resolve(tmpdir())+sep+'acornaut-visor-continuity-'));
  rmSync(scratch,{recursive:true,force:true});
}
