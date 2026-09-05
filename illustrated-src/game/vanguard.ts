import type { ArtBank } from './art';

export const VANGUARD_FRAMES = 32;
export const VANGUARD_TAP_SECONDS = 0.72;
// Reviewed choreography: retain every drawing, place the extra tuck in
// anticipation and the shallow dive before the steeper pose.
export const VANGUARD_TAP_ORDER = [0,1,2,12,3,4,13,14,5,15,6,7,8,9,10,11];
export const VANGUARD_DIVE_ORDER = [16,17,18,20,19,21,22,23];

/** One drawn bank: tap 0..15, dive 16..23, contact 24..31.
 * Contact wins; a downward swipe takes over from tap recovery immediately.
 * This routing is deliberately exclusive to the owner-authorized flagship.
 */
export function vanguardFrame(tap: number, bounce: number, vy: number) {
  if (bounce >= 0 && bounce < 0.38) return 24 + Math.min(7, Math.floor(bounce / 0.38 * 8));
  if (vy > 80) return VANGUARD_DIVE_ORDER[Math.min(7, Math.floor((vy - 80) / 540 * 8))];
  if (tap >= 0 && tap < VANGUARD_TAP_SECONDS) return VANGUARD_TAP_ORDER[Math.min(15, Math.floor(tap / VANGUARD_TAP_SECONDS * 16))];
  return 0;
}

/** All frames share one camera, torso pivot and measured helmet size.
 * Never fit a changing silhouette or add the generic squash/scale pulse.
 */
export function paintVanguard(ctx: CanvasRenderingContext2D, art: ArtBank | null | undefined,
  x: number, y: number, size: number, tap: number, bounce: number, vy: number) {
  const index = vanguardFrame(tap, bounce, vy);
  const frame = art?.vanguard?.length === VANGUARD_FRAMES ? art.vanguard[index] : art?.suits.vanguard;
  if (!frame) return;
  const scale = size / 400;
  ctx.drawImage(frame, x - 280 * scale, y - 280 * scale, 512 * scale, 512 * scale);
}

/** Cosmetic shield: quiet cyan lens with three gold field arcs. No flash,
 * hitbox, duration or charge changes. Called inside the world's transform.
 */
export function paintVanguardShield(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  ctx.save();ctx.translate(x,y);
  const lens=ctx.createRadialGradient(-7,-8,2,0,0,29);
  lens.addColorStop(0,'rgba(130,235,255,0)');lens.addColorStop(.8,'rgba(130,235,255,.025)');
  lens.addColorStop(1,'rgba(130,235,255,.22)');
  ctx.fillStyle=lens;ctx.beginPath();ctx.arc(0,0,29,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,215,137,.8)';ctx.lineWidth=1.4;
  for(let i=0;i<3;i++){
    const a=time*.3+i*Math.PI*2/3;ctx.beginPath();ctx.arc(0,0,29,a,a+1.45);ctx.stroke();
  }
  ctx.restore();
}

export function paintVanguardWake(ctx: CanvasRenderingContext2D,x:number,y:number,t:number){
  ctx.save();ctx.lineCap='round';
  for(let lane=-1;lane<=1;lane+=2){
    ctx.strokeStyle=lane<0?'#85edff':'#edc780';ctx.lineWidth=1.6;
    ctx.beginPath();ctx.moveTo(x+18,y+lane*3);ctx.bezierCurveTo(x+1,y+lane*5,x-12,y+lane*2,x-24,y+lane*7);ctx.stroke();
    ctx.fillStyle='#fff1d0';const dx=18-((t*24)%42);ctx.fillRect(x+dx,y+lane*4-1,3,2);
  }
  ctx.restore();
}
