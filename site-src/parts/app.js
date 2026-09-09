(() => {
  'use strict';
  const asset = name => (window.__ACORNAUT_ASSETS__ || {})[name] || 'assets/'+name;
  const $ = id => document.getElementById(id);
  const modes = {
    normal: {name:'Normal',number:'01',word:'Find your<br>flow.',description:'Thread the gaps, collect power-ups, and beat your best. A good run begins with a little rhythm.',note:'Start here to learn the flight controls.',video:'mode-fly.mp4',poster:'poster-fly.jpg'},
    debris: {name:'Debris Field',number:'02',word:'',description:'Collect Acorn Coins, survive the waves, and return to the Depot to upgrade your ship. Build a stronger run, one choice at a time.',note:'Run upgrades reset after losing all lives.',video:'mode-debris.mp4',poster:'poster-debris.jpg',landscape:true},
    hyper: {name:'Hyper Run',number:'03',word:'Chase the<br>clock.',description:'Hold to rise, release to fall, and thread the blue gates. Build speed and find your way through wormhole shortcuts.',note:'Unlocked through Star Chart progression.',video:'mode-race.mp4',poster:'poster-race.jpg'},
    deep: {name:'Deep Space',number:'04',word:'',description:'Find your way from one black hole to the next. Leave the familiar route behind and see how far you can go.',note:'A different challenge in Free Flight.',video:'mode-deep.mp4',poster:'poster-deep.jpg',landscape:true},
    lost: {name:'Lost in Space',number:'05',word:'',description:'The world tilts and mirrors while you fly. Keep your bearings when space stops behaving the way you expect.',note:'Explore it in Free Flight.',video:'mode-lost.mp4',poster:'poster-lost.jpg',landscape:true},
    arcade: {name:'Arcade',number:'06',word:'Turn it<br>up.',description:'More power-ups and an arcade look. Familiar flight, with a little more going on.',note:'Double power-ups. A different visual style.',video:'mode-arcade.mp4',poster:'poster-arcade.jpg'}
  };
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    const d = modes[button.dataset.mode];
    document.querySelectorAll('[data-mode]').forEach(b => {const selected=b===button;b.setAttribute('aria-pressed',String(selected));b.classList.toggle('selected',selected);});
    $('modeVideo').pause();
    $('modeVideo').closest('.mode-media').classList.toggle('landscape-capture',!!d.landscape);
    $('modeName').textContent=d.name;$('modeDescription').textContent=d.description;$('modeNote').textContent=d.note;
    $('modeNumber').textContent=d.number+' / 06';$('modeWord').innerHTML=d.word;
    $('modeVideo').hidden=!d.video;$('modeImage').hidden=!!d.video;
    if(d.video){$('modeVideo').src=asset(d.video);$('modeVideo').poster=asset(d.poster);$('modeVideo').setAttribute('aria-label',d.name+' gameplay recording');$('mediaCaption').textContent=d.landscape?'Browser preview · desktop capture':'Recorded gameplay';}
    else{$('modeImage').src=asset(d.image);$('modeImage').alt=d.alt;$('mediaCaption').textContent=d.caption;}
    if(d.video){$('modeVideo').load();$('modeVideo').play().catch(()=>{});}
  }));
  const suits = [{"id": "flight", "name": "Flight", "glow": "#c9b6ff", "beta": false}, {"id": "vanguard", "name": "AcorNut", "glow": "#85edff", "beta": false}, {"id": "arcflash", "name": "Arcflash", "glow": "#38caff", "beta": false}, {"id": "iontrim", "name": "Ion", "glow": "#4ad8ff", "beta": false}, {"id": "copper", "name": "Copper", "glow": "#ff8a2a", "beta": false}, {"id": "frost", "name": "Frost", "glow": "#9fe4ff", "beta": false}, {"id": "voidsuit", "name": "Void", "glow": "#b45cff", "beta": false}, {"id": "ember", "name": "Ember", "glow": "#ff5a1e", "beta": false}, {"id": "robo", "name": "Robo", "glow": "#35e0ff", "beta": false}, {"id": "alien", "name": "Alien", "glow": "#7dff4d", "beta": false}, {"id": "ghost", "name": "Ghost", "glow": "#9fd8ff", "beta": false}, {"id": "bigbooty", "name": "Big Booty", "glow": "#ffb84d", "beta": false}, {"id": "catsuit", "name": "Cat", "glow": "#c9b6ff", "beta": false}, {"id": "raccoon", "name": "Bandit", "glow": "#38d0ff", "beta": false}, {"id": "ferret", "name": "Noodle", "glow": "#ffc83a", "beta": false}, {"id": "hedgehog", "name": "Quill", "glow": "#ffa53a", "beta": false}, {"id": "gemmie", "name": "Gemmie", "glow": "#ffb8f0", "beta": false}, {"id": "sammie", "name": "Sammie", "glow": "#c9b6ff", "beta": false}, {"id": "seraph", "name": "Seraph", "glow": "#ffe9a8", "beta": false}, {"id": "leviathan", "name": "Leviathan", "glow": "#4fe8dd", "beta": false}, {"id": "verdant", "name": "Verdant", "glow": "#38ff9a", "beta": false}, {"id": "cryostar", "name": "Cryostar", "glow": "#54d8ff", "beta": false}, {"id": "eclipse", "name": "Eclipse", "glow": "#b552ff", "beta": false}, {"id": "volt", "name": "Volt", "glow": "#54ff2e", "beta": false}, {"id": "cinderforge", "name": "Cinderforge", "glow": "#ff3b22", "beta": false}, {"id": "groveguard", "name": "Groveguard", "glow": "#65dca1", "beta": false}, {"id": "cosmic", "name": "Cosmic", "glow": "#d687ff", "beta": false}, {"id": "briellacat", "name": "Briella's Cat", "glow": "#c9b6ff", "beta": false}, {"id": "sunforged", "name": "Sunforged", "glow": "#ffad2b", "beta": false}, {"id": "abyssal", "name": "Abyssal", "glow": "#39dcff", "beta": false}, {"id": "cyber", "name": "Cyber", "glow": "#7030df", "beta": false}];
  const suitById = new Map(suits.map((s,i)=>[s.id,{...s,index:i}]));
  const collection=document.querySelector('.suit-collection');
  const rails=Array.from(document.querySelectorAll('.suit-rail'));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let suitPaused=reduced.matches, hovered=false, focused=false, railVisible=false, railFrame=null, railLast=0, railTravel=0;
  function updateSuitMotion(){
    $('suitMotion').textContent=suitPaused?'Resume suit scrolling':'Pause suit scrolling';
    $('suitMotion').setAttribute('aria-pressed',String(suitPaused));
    syncRails();
  }
  function pickSuit(id){
    const s=suitById.get(id); if(!s)return;
    $('suitImage').src=asset('preview-'+s.id+'.webp');
    $('suitImage').alt=s.name+' suit preview';
    $('suitName').textContent=s.name;
    $('suitDescription').textContent='Choose another suit from the collection below.';
    $('suitCount').textContent=String(s.index+1).padStart(2,'0')+' / '+suits.length;
    $('suitImage').closest('.suit-stage').style.setProperty('--suit-glow',s.glow);
    collection.querySelectorAll('[data-suit]').forEach(b=>{const selected=b.dataset.suit===id;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
    suitPaused=true; updateSuitMotion();
    const stage=$('suitImage').closest('.suit-stage'),bounds=stage.getBoundingClientRect();
    if(bounds.top<80 || bounds.bottom>innerHeight)stage.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});
  }
  collection.addEventListener('click',e=>{const b=e.target.closest('[data-suit]');if(b)pickSuit(b.dataset.suit);});
  rails.forEach(rail=>{
    const track=rail.querySelector('.suit-track');
    Array.from(track.children).forEach(b=>{const copy=b.cloneNode(true);copy.tabIndex=-1;copy.setAttribute('aria-hidden','true');copy.dataset.copy='true';track.appendChild(copy);});
    rail.addEventListener('pointerdown',()=>{suitPaused=true;updateSuitMotion();},{passive:true});
    rail.addEventListener('wheel',()=>{suitPaused=true;updateSuitMotion();},{passive:true});
  });
  collection.addEventListener('pointerenter',()=>{hovered=true;syncRails();});
  collection.addEventListener('pointerleave',()=>{hovered=false;syncRails();});
  collection.addEventListener('focusin',()=>{focused=rails.some(rail=>rail.contains(document.activeElement));syncRails();});
  collection.addEventListener('focusout',()=>{queueMicrotask(()=>{focused=rails.some(rail=>rail.contains(document.activeElement));syncRails();});});
  $('suitMotion').addEventListener('click',()=>{suitPaused=!suitPaused;updateSuitMotion();});
  function canScroll(){return railVisible&&!suitPaused&&!hovered&&!focused&&!document.hidden;}
  function syncRails(){
    if(canScroll()&&railFrame===null){railLast=performance.now();railFrame=requestAnimationFrame(moveRails);}
    else if(!canScroll()&&railFrame!==null){cancelAnimationFrame(railFrame);railFrame=null;}
  }
  function moveRails(t){
    railFrame=null;if(!canScroll())return;
    railTravel+=Math.min(t-railLast,50)*.025;railLast=t;
    const distance=Math.floor(railTravel);railTravel-=distance;
    rails.forEach((rail,i)=>{
      const track=rail.querySelector('.suit-track'),copy=track.querySelector('[data-copy]');
      const cycle=copy.offsetLeft-track.firstElementChild.offsetLeft;
      if(!cycle)return;
      if(i===0){if(rail.scrollLeft>=cycle)rail.scrollLeft-=cycle;rail.scrollLeft+=distance;}
      else{if(rail.scrollLeft<=0)rail.scrollLeft+=cycle;rail.scrollLeft-=distance;}
    });
    railFrame=requestAnimationFrame(moveRails);
  }
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{railVisible=entries[0].isIntersecting;syncRails();},{threshold:.05}).observe(collection);
  else railVisible=true;
  document.addEventListener('visibilitychange',syncRails);
  reduced.addEventListener('change',e=>{suitPaused=e.matches;updateSuitMotion();});
  updateSuitMotion();
  let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const films=Array.from(document.querySelectorAll('[data-marketing]'));
  const activeFilms=new Set();
  function loadFilm(v){ if(v.dataset.src){v.src=asset(v.dataset.src.split('/').pop());delete v.dataset.src;v.load();} }
  function setMotion(){
    document.body.classList.toggle('motion-paused',paused);
    $('motionToggle').setAttribute('aria-pressed',String(paused));
    $('motionToggle').textContent=paused?'Resume marketing films':'Pause marketing films';
    films.forEach(v=>{if(paused || !activeFilms.has(v))v.pause();else{loadFilm(v);v.play().catch(()=>{});}});
  }
  films.forEach(v=>v.addEventListener('pointerdown',()=>loadFilm(v),{once:true}));
  if('IntersectionObserver' in window){
    const filmObserver=new IntersectionObserver(entries=>entries.forEach(e=>{
      const v=e.target;
      if(e.isIntersecting){activeFilms.add(v);loadFilm(v);if(!paused)v.play().catch(()=>{});}
      else{activeFilms.delete(v);v.pause();}
    }),{threshold:.15});
    films.forEach(v=>filmObserver.observe(v));
  } else films.forEach(v=>loadFilm(v));
  setMotion();$('motionToggle').addEventListener('click',()=>{paused=!paused;setMotion();});
  if('IntersectionObserver' in window){new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)$('modeVideo').pause();},{threshold:.05}).observe($('modeVideo'));}
})();
