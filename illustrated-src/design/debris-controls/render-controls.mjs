// Native SVG material proof; this is not a browser screenshot.
import { writeFileSync } from 'node:fs';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { spillControlArt, SPILL_CONTROL_LAYOUT as L } from '../../../docs/js/spill-control-art.js';
GlobalFonts.loadFontsFromDir('docs/fonts');
const canvas=createCanvas(780,590),ctx=canvas.getContext('2d');ctx.scale(2,2);
ctx.fillStyle='#0c1422';ctx.fillRect(0,0,390,295);
ctx.fillStyle='#e5e4ec';ctx.font='bold 14px sans-serif';ctx.fillText('DEBRIS FIELD · FLIGHT PADS',20,27);
ctx.fillStyle='#a5b4cb';ctx.font='11px sans-serif';ctx.fillText('Native SVG proof · 390px and 320px viewports',20,47);
for(const [width,top] of [[358,65],[288,185]]) {
 const x=(390-width)/2,scale=width/L.width;
 for(const kind of ['dive','throttle','lunge']) {
  const box=L[kind],im=await loadImage(Buffer.from(spillControlArt(kind)));
  ctx.drawImage(im,x+box.x*scale,top+box.y*scale,box.width*scale,box.height*scale);
 }
 ctx.fillStyle='#b4edff';ctx.font='bold 8px sans-serif';ctx.textAlign='center';
 ctx.fillText('1/1 READY',x+297*scale,top+106*scale);ctx.textAlign='left';
}
writeFileSync(new URL('./controls.png',import.meta.url),canvas.toBuffer('image/png'));
