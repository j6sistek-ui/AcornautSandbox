// All catalog pairings, rendered with the shipping portrait compositor.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {helmetReview,createCanvas} from './qa/helmet-fit-render.mjs';
const output=resolve(process.argv[2]||'illustrated-src/design/helmet-fit-all');
mkdirSync(output,{recursive:true});
const r=await helmetReview();
const suits=r.cat.SUITS.filter(s=>!r.cat.wearsOwnHead(s)),helmets=r.cat.HELMETS;
function label(c,t,x,y){c.fillStyle='#e5ecf8';c.font='14px Arial';c.fillText(t,x,y);}
function bg(c,w,h){c.fillStyle='#172234';c.fillRect(0,0,w,h);}
const coverage=r.cat.SUITS.map(s=>({id:s.id,name:s.name,ownHead:r.cat.wearsOwnHead(s),
  helmets:r.cat.wearsOwnHead(s)?[]:helmets.filter(h=>!h.suitOnly||h.suitOnly===s.id).map(h=>h.id),
  frames:Object.fromEntries(['Asc','Desc','Tap'].map(k=>[k.toLowerCase(),r.bank['suit'+k][s.id]?.length||0])),
  articulated:!!r.bank.highOrbit[s.id]}));
writeFileSync(join(output,'coverage.json'),JSON.stringify({artVersion:r.cat.ART_VER,
  characters:coverage.length,helmets:helmets.length,pairings:coverage.reduce((n,s)=>n+s.helmets.length,0),
  visualEvidence:'Native Canvas contact sheets; not an interactive browser session',roster:coverage},null,2)+'\n');
if(process.argv.includes('--baseline')){
  const baseline=await helmetReview(resolve(process.argv[process.argv.indexOf('--baseline')+1]));
  const examples=[['flight','clear'],['robo','royal'],['bigbooty','clear'],['copper','clear'],
    ['voidsuit','princess'],['seraph','seraph'],['eclipse','clear'],['cryostar','cryostar'],
    ['verdant','verdant'],['cinderforge','clear'],['cosmic','princess'],['sunforged','sunforged']];
  const sheet=createCanvas(1440,960),g=sheet.getContext('2d');bg(g,sheet.width,sheet.height);
  for(const [i,[sid,hid]]of examples.entries())for(const [side,ref]of [baseline,r].entries()){
    const x=(i%3*2+side)*240,y=Math.floor(i/3)*240,s=ref.cat.SUITS.find(s=>s.id===sid),h=ref.cat.HELMETS.find(h=>h.id===hid);
    label(g,`${s.name} / ${h.name}`,x+8,y+20);label(g,side?'After':'Before',x+8,y+40);
    ref.draw.paintPortrait(g,ref.bank,h,s,x+103,y+141,156);
  }
  writeFileSync(join(output,'before-after.png'),sheet.toBuffer('image/png'));baseline.dispose();
}
if(process.argv.includes('--sources')||process.argv.includes('--motion')){
  for(let page=0;process.argv.includes('--sources')&&page<3;page++){
    const sheet=createCanvas(1280,600),g=sheet.getContext('2d');bg(g,sheet.width,sheet.height);
    for(const [i,h] of helmets.slice(page*10,page*10+10).entries()){
      const x=i%5*256,y=Math.floor(i/5)*300;label(g,h.id,x+8,y+20);
      g.drawImage(r.bank.helms[h.id],x,y+30);const a=r.draw.HELM_GLASS[h.id];
      g.strokeStyle='#ff55aa';g.lineWidth=1;g.beginPath();g.arc(x+a[0],y+30+a[1],a[2],0,2*Math.PI);g.stroke();
    }
    writeFileSync(join(output,'helm-source-'+page+'.png'),sheet.toBuffer('image/png'));
  }
  for(const s of suits){
    if(r.bank.highOrbit[s.id])continue;
    const rows=[['still',[r.bank.suits[s.id]]],['asc',r.bank.suitAsc[s.id]||[]],['desc',r.bank.suitDesc[s.id]||[]],['tap',r.bank.suitTap[s.id]||[]]]
      .flatMap(([kind,frames])=>Array.from({length:Math.ceil(frames.length/8)},(_,page)=>[kind,frames.slice(page*8,page*8+8),page*8]));
    const sheet=createCanvas(2048,rows.length*280),g=sheet.getContext('2d');bg(g,sheet.width,sheet.height);
    for(const [row,[kind,frames,offset]] of rows.entries())for(const [i,f] of frames.entries()){
      const x=i*256,y=row*280,key=kind==='still'?'suit:'+s.id:`${s.id}-${kind}-${offset+i+1}`,a=r.draw.DOME[key]||r.draw.DOME['suit:'+s.id];
      label(g,key,x+6,y+18);g.drawImage(f,x,y+24);
      if(process.argv.includes('--motion'))r.draw.paintRegisteredDome(g,helmets[0],x+a[0],y+24+a[1],a[2],a[3]||0,r.bank);
      else{g.strokeStyle='#ff55aa';g.beginPath();g.arc(x+a[0],y+24+a[1],a[2],0,2*Math.PI);g.stroke();}
    }
    writeFileSync(join(output,'frames-'+s.id+'.png'),sheet.toBuffer('image/png'));
  }
  for(const s of suits.filter(s=>r.bank.highOrbit[s.id])){
    const sheet=createCanvas(1600,900),g=sheet.getContext('2d');bg(g,sheet.width,sheet.height);
    const ids=['clear','princess',s.id];
    for(const [row,id]of ids.entries()){
      const owner={},times=[0,.12,.36,.6,1.4,2.4,3.6,4.5];let clock=0;
      for(const [i,t]of times.entries()){
        const h=helmets.find(h=>h.id===id),x=i*200,y=row*300;
        while(clock<t){r.motion.highOrbitPreview(owner,s.id,clock);clock=Math.min(t,clock+1/60);}
        const state=r.motion.highOrbitPreview(owner,s.id,t);
        label(g,`${s.name} / ${h.name}`,x+6,y+20);label(g,`${t.toFixed(2)}s`,x+6,y+40);
        r.draw.paintOrbitPilot(g,r.bank,s.id,x+86,y+175,150,h,state,undefined,false,0);
      }
    }
    writeFileSync(join(output,'frames-'+s.id+'.png'),sheet.toBuffer('image/png'));
  }
}
for(const suit of suits){
  const image=createCanvas(1200,1000),c=image.getContext('2d');bg(c,1200,1000);
  for(const [i,h] of helmets.entries()){
    const x=i%6*200,y=Math.floor(i/6)*200;
    label(c,suit.name+' / '+h.name,x+8,y+21);
    if(h.suitOnly&&h.suitOnly!==suit.id){label(c,'Suit exclusive',x+16,y+100);continue;}
    r.draw.paintPortrait(c,r.bank,h,suit,x+85,y+109,130);
  }
  writeFileSync(join(output,suit.id+'.png'),image.toBuffer('image/png'));
}
const image=createCanvas(1200,Math.ceil(suits.length/6)*220),c=image.getContext('2d');bg(c,image.width,image.height);
for(const [i,s] of suits.entries()){
  const x=i%6*200,y=Math.floor(i/6)*220;label(c,s.name,x+8,y+21);
  r.draw.paintPortrait(c,r.bank,helmets[0],s,x+85,y+115,135);
}
writeFileSync(join(output,'clear-roster.png'),image.toBuffer('image/png'));
console.log(JSON.stringify({suits:suits.length,allCharacters:r.cat.SUITS.length,helmets:helmets.length,pairs:suits.reduce((n,s)=>n+helmets.filter(h=>!h.suitOnly||h.suitOnly===s.id).length,0),output}));
r.dispose();
