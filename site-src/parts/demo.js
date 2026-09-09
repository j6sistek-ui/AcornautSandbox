window.__ASC__=["assets/asc-1.webp", "assets/asc-2.webp", "assets/asc-3.webp", "assets/asc-4.webp", "assets/asc-5.webp", "assets/asc-6.webp", "assets/asc-7.webp", "assets/asc-8.webp"];
window.__DESC__=["assets/desc-1.webp", "assets/desc-2.webp", "assets/desc-3.webp", "assets/desc-4.webp", "assets/desc-5.webp", "assets/desc-6.webp", "assets/desc-7.webp", "assets/desc-8.webp"];
window.__PLANETS__=["assets/p-3.webp", "assets/p-7.webp", "assets/p-12.webp", "assets/p-18.webp", "assets/p-24.webp", "assets/p-29.webp"];
(function(){
"use strict";
var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
var host = document.getElementById("toy"), cv = document.getElementById("cv");
if(!host || !cv) return;

var ASC = window.__ASC__ || [], DESC = window.__DESC__ || [], PLANETS = window.__PLANETS__ || [];

var ctx = cv.getContext("2d"), DPR = Math.min(devicePixelRatio || 1, 2);
var W = 0, H = 0, S = 1;
var asc = [], desc = [], planets = [];
ASC.forEach(function(src,i){ var im = new Image(); im.addEventListener("load",function(){ if(W && !running) paint(); }); im.src = src; asc[i] = im; });
DESC.forEach(function(src,i){ var im = new Image(); im.addEventListener("load",function(){ if(W && !running) paint(); }); im.src = src; desc[i] = im; });
PLANETS.forEach(function(src,i){ var im = new Image(); im.addEventListener("load",function(){ if(W && !running) paint(); }); im.src = src; planets[i] = im; });

var stars = [], gates = [], drift = [];
var y, vy, alive, dead, score, bounces, best, shake, started, cool, smoothVy;
var pose = null;
try { best = parseInt(localStorage.getItem("acornaut.toy") || "0", 10) || 0; } catch(e){ best = 0; }
document.getElementById("bs").textContent = best;

function resize(){
  var r = cv.getBoundingClientRect();
  W = r.width; H = r.height;
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  S = H/320;                                   /* the band is a cropped viewport */
  stars = [];
  for(var i=0;i<110;i++) stars.push({x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.25+.25, a:Math.random()*.6+.2, s:Math.random()*.5+.15});
  drift = [];
  for(var j=0;j<5;j++) drift.push({x:Math.random()*W, y:Math.random()*H, k:j%PLANETS.length, sc:(.2+Math.random()*.3), sp:.1+Math.random()*.2, a:.05+Math.random()*.07});
}

function reset(full){
  y = H*0.44; vy = 0; alive = true; dead = 0; shake = 0; cool = 0; smoothVy = 0;
  if(full){ score = 0; bounces = 0; hud(); }
  gates = [];
  spawn(W + 120*S);
  spawn(W + 120*S + 340*S);
  spawn(W + 120*S + 680*S);
}
function hud(){
  document.getElementById("sc").textContent = score;
  var b = document.getElementById("bo"); if(b) b.textContent = bounces;
}
function spawn(x){
  var gap = 168*S*0.98, r = 42*S;
  var lo = gap/2 + r*0.55 + 14, hi = H - gap/2 - r*0.55 - 14;
  gates.push({x:x, cy:lo + Math.random()*(hi-lo), gap:gap, r:r,
              kt:(Math.random()*PLANETS.length)|0, kb:(Math.random()*PLANETS.length)|0,
              done:false, spin:Math.random()*6.28});
}

var startEl = document.getElementById("start"), everFlew = false;
function idle(){
  startEl.classList.remove("gone");
  startEl.querySelector("b").textContent = everFlew ? "Try another flight" : "Tap to take off";
}
function flap(){
  if(userPaused) return;
  if(!started){
    started = true; everFlew = true;
    startEl.classList.add("gone");
    var cr = document.getElementById("craft"); if(cr) cr.classList.add("on");
  }
  if(!alive) return;
  vy = -450*S;
  syncLoop();
}
host.addEventListener("pointerdown", function(e){ e.preventDefault(); host.focus({preventScroll:true}); flap(); });
host.addEventListener("keydown", function(e){
  if(e.key === " " || e.key === "Enter"){ e.preventDefault(); flap(); }
});

host.addEventListener("click", function(e){ if(e.detail === 0) flap(); });

var last = 0, running = false, userPaused = false, inViewport = false, rafId = null;
function canRun(){ return inViewport && !document.hidden && !userPaused && (started || !RM); }
function syncLoop(){
  if(canRun()){
    if(!running){ running=true; last=performance.now(); rafId=requestAnimationFrame(frame); }
  } else {
    running=false; if(rafId !== null) cancelAnimationFrame(rafId); rafId=null;
  }
}
function frame(t){
  rafId=null;
  if(!canRun()){ running = false; return; }
  var dt = Math.min((t - last)/1000 || 0, .05); last = t;
  step(dt); paint();
  rafId=requestAnimationFrame(frame);
}

/* THE POSE. draw.ts: a light exponential smooth on vy, normalised over
   -470 climbing and 620 diving, then rounded across the bank. Velocities
   here are scaled by S, so they go back to game units before mapping. */
function poseFrame(dt){
  smoothVy += (vy - smoothVy) * Math.min(1, dt*9);
  var sv = smoothVy / S;
  var v = sv < 0 ? -Math.min(1, -sv/470) : Math.min(1, sv/620);
  var bank = v < 0 ? asc : desc;
  if(!bank.length) return null;
  var idx = Math.max(0, Math.min(bank.length - 1, Math.round(Math.abs(v) * (bank.length - 1))));
  return bank[idx];
}

function step(dt){
  if(!started){                                  /* attract */
    y = H*0.44 + (RM ? 0 : Math.sin(performance.now()/900)*10*S);
    vy = RM ? 0 : Math.cos(performance.now()/900)*40*S;
    if(!RM) drape(dt);
    pose = poseFrame(dt) || pose;
    return;
  }
  drape(dt);
  if(shake > 0) shake = Math.max(0, shake - dt*3.4);
  if(cool > 0) cool -= dt;

  if(!alive){
    dead += dt;
    y += vy*dt; vy += 1300*S*dt;
    pose = poseFrame(dt) || pose;
    if(dead > .9){ reset(true); started = false; idle(); }
    return;
  }

  vy += 1300*S*dt;
  vy = Math.min(vy, 620*S);
  y += vy*dt;

  var sr = 27*S, sx = W*0.26, speed = 165*S*1.5;

  /* THE CEILING BOUNCES. Only debris is lethal up there, and there is none. */
  if(y < sr*0.6 && vy < 0){
    y = sr*0.6;
    vy = Math.abs(vy)*0.45 + 90*S;
  }

  for(var i=gates.length-1; i>=0; i--){
    var g = gates[i];
    g.x -= speed*dt; g.spin += dt*.25;
    if(!g.done && g.x < sx - g.r*0.4){
      g.done = true; score++; hud();
      if(score > best){ best = score; document.getElementById("bs").textContent = best;
        try{ localStorage.setItem("acornaut.toy", String(best)); }catch(e){} }
    }
    if(g.x < -g.r*2){ gates.splice(i,1); spawn(gates[gates.length-1].x + 340*S); }
    var ty = g.cy - g.gap/2 - g.r, by = g.cy + g.gap/2 + g.r;
    for(var k=0;k<2;k++){
      var py = k ? by : ty;
      if(!hit(sx, y, sr, g.x, py, g.r*0.82)) continue;
      if(cool <= 0) bounce(g.x, py);
      else pushOut(g.x, py, g.r*0.82, sr, sx);
    }
  }

  /* THE FLOOR is the only way down. */
  if(y > H + 12*S) die();

  pose = poseFrame(dt) || pose;
}
function drape(dt){
  drift.forEach(function(d){ d.x -= d.sp*40*S*dt; if(d.x < -160){ d.x = W+160; d.y = Math.random()*H; } });
  stars.forEach(function(s){ s.x -= s.s*22*dt; if(s.x < 0) s.x = W; });
}

/* bounceOff(), from sim.ts */
function bounce(px, py){
  var sx = W*0.26;
  var dx = sx - px, dy = y - py;
  var dist = Math.hypot(dx, dy) || 1;
  dy /= dist;
  var mag = Math.min(560*S, 170*S + Math.abs(vy)*0.5);
  vy = dy*mag + (dy >= 0 ? 90*S : -160*S);
  y += dy*14*S;
  cool = 0.55;
  shake = 0.5;
  bounces++; hud();
}
function pushOut(px, py, pr, sr, sx){
  var dx = sx - px, dy = y - py;
  var dist = Math.hypot(dx, dy) || 1;
  if(dist >= pr + sr) return;
  y = py + (dy/dist) * (pr + sr);
}
function hit(ax,ay,ar,bx,by,br){ var dx=ax-bx, dy=ay-by; return dx*dx+dy*dy < (ar+br)*(ar+br); }
function die(){
  if(!alive) return;
  alive = false; shake = 1; vy = -160*S;
}

function paint(){
  var ox = shake ? (Math.random()-.5)*10*shake : 0, oy = shake ? (Math.random()-.5)*10*shake : 0;
  ctx.save(); ctx.translate(ox, oy);
  var g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#0a0620"); g.addColorStop(.55,"#08040f"); g.addColorStop(1,"#0d0722");
  ctx.fillStyle = g; ctx.fillRect(-12,-12,W+24,H+24);

  ctx.fillStyle = "#cbb4ff";
  stars.forEach(function(s){ ctx.globalAlpha = s.a; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.284); ctx.fill(); });
  ctx.globalAlpha = 1;

  drift.forEach(function(d){
    var im = planets[d.k]; if(!im || (!im.complete || !im.naturalWidth)) return;
    var sz = 190*S*d.sc; ctx.globalAlpha = d.a;
    ctx.drawImage(im, d.x - sz/2, d.y - sz/2, sz, sz);
  });
  ctx.globalAlpha = 1;

  if(started){
    gates.forEach(function(gt){
      var t = planets[gt.kt], b = planets[gt.kb], d = gt.r*2.35;
      var ty = gt.cy - gt.gap/2 - gt.r, by = gt.cy + gt.gap/2 + gt.r;
      if(t && t.complete && t.naturalWidth) ring(t, gt.x, ty, d, gt.spin);
      if(b && b.complete && b.naturalWidth) ring(b, gt.x, by, d, -gt.spin);
    });
  }

  var im = pose;
  if(im && im.complete && im.naturalWidth){
    var sz = 132*S, sx = W*0.26;
    ctx.save();
    ctx.translate(sx, y);
    /* no rotation: the motion bank's frames carry the attitude themselves */
    ctx.globalAlpha = alive ? 1 : Math.max(0, 1 - dead*1.1);
    ctx.drawImage(im, -sz/2, -sz/2, sz, sz);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function ring(im, x, cy, d, spin){
  ctx.save(); ctx.translate(x, cy); ctx.rotate(spin*.12);
  ctx.drawImage(im, -d/2, -d/2, d, d);
  ctx.restore();
}


var pauseButton = document.getElementById("demoPause");
pauseButton.addEventListener("click", function(){
  userPaused = !userPaused;
  pauseButton.textContent = userPaused ? "Resume" : "Pause";
  pauseButton.setAttribute("aria-pressed", String(userPaused));
  syncLoop();
});
document.addEventListener("visibilitychange",function(){
  syncLoop();
});

function boot(){
  resize(); reset(true); started = false;
  pose = desc[0] || asc[0] || null;
  var bounds=host.getBoundingClientRect(); inViewport=bounds.bottom>0 && bounds.top<innerHeight;
  paint(); syncLoop();
}
addEventListener("resize", function(){
  var oldW=W, oldH=H;
  resize();
  if(oldW && oldH){
    var xs=W/oldW, ys=H/oldH;
    y*=ys; vy*=ys; smoothVy*=ys;
    gates.forEach(function(g){g.x*=xs;g.cy*=ys;g.gap*=ys;g.r*=ys;});
  } else reset(true);
  paint();
});

/* only run the loop while the strip is on screen */
if("IntersectionObserver" in window){
  new IntersectionObserver(function(es){
    es.forEach(function(e){
      inViewport=e.isIntersecting; syncLoop();
    });
  },{threshold:.12}).observe(host);
}
if(document.readyState !== "loading") boot(); else addEventListener("DOMContentLoaded", boot);
})();
