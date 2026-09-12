// Rasterize an explicitly reviewed selection boundary, without changing pixels.
// Each polygon selects the painted tail from asc-1; the exporter puts every
// unselected source pixel in the complementary body layer.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const {createCanvas}=createRequire(import.meta.url)(process.env.ACORNAUT_CANVAS||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ids=process.argv.slice(2);assert(ids.length,'Pass one or more suit IDs');
for(const id of ids){
  assert(['porcelain','nacre','origamist'].includes(id),'Unknown suit');
  const source=join(root,'art-src/cyber-standard-trio',id),geometry=JSON.parse(readFileSync(join(source,'geometry.json'),'utf8'));
  assert(Array.isArray(geometry.tailMaskPolygons)&&geometry.tailMaskPolygons.length,'Missing reviewed tailMaskPolygons');
  const c=createCanvas(256,256),g=c.getContext('2d');g.fillStyle='#fff';
  for(const polygon of geometry.tailMaskPolygons){
    assert(polygon.length>=3,'A selection polygon needs at least3 vertices');g.beginPath();
    polygon.forEach(([x,y],i)=>{assert(Number.isFinite(x)&&Number.isFinite(y),'Invalid selection point');if(i)g.lineTo(x,y);else g.moveTo(x,y);});g.closePath();g.fill();
  }
  const data=g.getImageData(0,0,256,256);for(let k=0;k<256*256;k++)data.data[k*4+3]=data.data[k*4+3]>127?255:0;g.putImageData(data,0,0);
  writeFileSync(join(source,'still-tail-mask.png'),c.toBuffer('image/png'));console.log(`${id}: reviewed tail selection mask256px`);
}
