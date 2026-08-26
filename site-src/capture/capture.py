import json, time, urllib.request, base64, os, sys, websocket, shutil
PORT=int(sys.argv[1]); MODE=sys.argv[2]; SECS=float(sys.argv[3]); OUT=sys.argv[4]
OUTDIR=OUT+"-frames"; shutil.rmtree(OUTDIR, ignore_errors=True); os.makedirs(OUTDIR)
for _ in range(80):
    try: tabs=json.load(urllib.request.urlopen("http://127.0.0.1:%d/json"%PORT)); break
    except Exception: time.sleep(.5)
ws=websocket.create_connection([t for t in tabs if t["type"]=="page"][0]["webSocketDebuggerUrl"], timeout=90)
mid=[0]
def cmd(m,p=None):
    mid[0]+=1; ws.send(json.dumps({"id":mid[0],"method":m,"params":p or {}}))
    while True:
        r=json.loads(ws.recv())
        if r.get("id")==mid[0]: return r
def ev(e): return cmd("Runtime.evaluate",{"expression":e,"returnByValue":True,"awaitPromise":True}).get("result",{}).get("result",{}).get("value")

cmd("Page.enable"); cmd("Runtime.enable")
cmd("Page.navigate",{"url":"http://127.0.0.1:8760/"})
for _ in range(120):
    time.sleep(1)
    if ev("!!(window.__sandbox && window.__sandbox.world)"): break
time.sleep(7)
ev("(function(){var s=window.__sandbox.save; s.acorns=4820; s.dust=1245; s.best=87; s.suit='seraph'; s.tutorialDone=true;})()")
ev("var st=document.createElement('style');st.textContent='.ac-devroll{display:none!important}';document.head.appendChild(st);")

# The pilot lives in the page, on the game's own frame clock.
# RISE/L/MIN were tuned by measurement: 0 deaths and a score of 15 over 26s.
ev("""(function(){
  var E=window.__sandbox, w=E.world, last=0, RISE=95, L=0.26, MIN=120, MODE='%s';
  window.__bot={taps:0,deaths:0,best:0,deadAt:[]};
  function tap(){var t=performance.now(); if(t-last<MIN)return; last=t; window.__bot.taps++;
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));}
  function near(){var sx=w.W*0.18,b=null;
    for(var i=0;i<w.planets.length;i++){var p=w.planets[i]; if(p.x+p.r*1.2>sx && (!b||p.x<b.x)) b=p;}
    return b;}
  function want(){
    var b=near(), s=w.squirrel;
    var target=b?b.gapY:w.H*0.46, half=b?b.gap*0.5:w.H*0.2;
    if(s.y>w.H*0.90) return true;
    if(s.y - RISE < target - half*0.55) return false;   // a flap here hits the top planet
    return s.y + s.vy*L + 0.5*1300*L*L > target;
  }
  function tick(){
    try{
      if(w.screen==='play'){
        if(w.ready) tap(); else if(want()) tap();
        if(w.score>window.__bot.best) window.__bot.best=w.score;
      } else if(w.screen==='dead'){
        window.__bot.deaths++; window.__bot.deadAt.push(Math.round(performance.now()));
        if(E.dismissDead) E.dismissDead();
        setTimeout(function(){E.fly(MODE);},250);
      }
    }catch(e){}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})()""" % MODE)
ev("window.__sandbox.fly('%s')" % MODE)
time.sleep(2.5)
t_page0 = ev("performance.now()")

cmd("Page.startScreencast",{"format":"jpeg","quality":82,"everyNthFrame":1})
t0=time.time(); n=0; stamps=[]
ws.settimeout(2)
while time.time()-t0 < SECS:
    try: m=json.loads(ws.recv())
    except Exception: continue
    if m.get("method")!="Page.screencastFrame": continue
    p=m["params"]
    open("%s/f%05d.jpg"%(OUTDIR,n),"wb").write(base64.b64decode(p["data"]))
    stamps.append(p["metadata"].get("timestamp",0)); n+=1
    mid[0]+=1; ws.send(json.dumps({"id":mid[0],"method":"Page.screencastFrameAck","params":{"sessionId":p["sessionId"]}}))
ws.settimeout(90)
cmd("Page.stopScreencast")
st=[s for s in stamps if s]
fps=(len(st)-1)/(st[-1]-st[0]) if len(st)>2 else 0
b=ev("window.__bot")
# death moments as a fraction of the tape, so a clean stretch can be cut out
deaths_rel=[round((d-t_page0)/1000.0,2) for d in b.get("deadAt",[])]
print("MODE %-7s frames=%-4d fps=%.1f deaths=%s best=%s deathsAt=%s" % (MODE,n,fps,b.get("deaths"),b.get("best"),deaths_rel))
json.dump({"fps":fps,"frames":n,"deaths":deaths_rel,"best":b.get("best")}, open(OUT+".json","w"))
