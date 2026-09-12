import type {PremiumSuitId} from './high-orbit-config';
import type {HighOrbitMotion} from './high-orbit-motion';
import {paintHighOrbitEffect} from './high-orbit-effects';
import {CYBER_TRIO_REGISTRATION} from './cyber-trio-registration';

export type PremiumBankWake={state:HighOrbitMotion;travel:number};
/** Place the existing signature wake at the selected painting's boots.
 * Resolve the painter's full transform before drawing the wake in screen
 * coordinates, so previously emitted samples do not bank with the pilot. */
export function paintPremiumBankWake(ctx:CanvasRenderingContext2D,id:PremiumSuitId,
 bank:'asc'|'desc',index:number,ref:{x:number;y:number;w:number;h:number},
 x:number,y:number,size:number,wake:PremiumBankWake){
  const boots=CYBER_TRIO_REGISTRATION[id][bank][index].emitters;
  const m=ctx.getTransform(),unit=size/Math.max(1,ref.w,ref.h);
  const scale=Math.hypot(m.a,m.b),effectSize=size*scale;
  if(effectSize<=0)return;
  const cx=m.a*x+m.c*y+m.e,cy=m.b*x+m.d*y+m.f;
  const emitters=boots.map(([ex,ey]):readonly [number,number]=>{
    const bx=(ex-ref.x-ref.w/2)*unit,by=(ey-ref.y-ref.h/2)*unit;
    return [128+(m.a*bx+m.c*by)*192/effectSize,128+(m.b*bx+m.d*by)*192/effectSize];
  });
  ctx.save();ctx.setTransform(1,0,0,1,cx,cy);
  paintHighOrbitEffect(ctx,id,wake.state,effectSize,emitters,{x:cx,y:cy,travel:wake.travel*scale});
  ctx.restore();
}
