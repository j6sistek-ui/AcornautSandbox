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


ev("(function(){var s=window.__sandbox.save; s.best=120; for(var st=1;st<=10;st++){} })()")
RINGS = [[600, 320], [1020, 280], [1440, 360], [1880, 240], [2320, 400], [2780, 200], [3240, 440], [3680, 220], [4120, 420], [4580, 260], [5220, 380], [5840, 240], [6460, 430], [7080, 300], [7520, 440], [7960, 200], [8400, 380], [9040, 144], [9400, 496], [10000, 320], [10440, 220], [11040, 430], [11460, 180], [12080, 460], [12520, 250], [13140, 440], [13600, 200], [14300, 360], [15000, 320], [15440, 270], [15880, 390], [16340, 200], [16780, 450], [17420, 240], [17860, 420], [18520, 180], [18960, 460], [19640, 260], [20100, 400], [20740, 220], [21180, 440], [21860, 300], [22540, 420], [22980, 200], [23600, 380], [24040, 160], [24400, 440], [25000, 300], [25440, 220], [26040, 430], [26460, 180], [27080, 460], [27520, 250], [28140, 440], [28600, 200], [29300, 360], [30000, 320], [30440, 240], [30880, 420], [31340, 180], [31780, 460], [32420, 220], [32860, 440], [33520, 200], [33960, 480], [34640, 260], [35100, 420], [35740, 180], [36180, 460], [36840, 300], [37540, 420], [38160, 260], [38840, 496], [39232, 496], [39616, 144], [40000, 496], [40440, 220], [41040, 430], [41460, 180], [42080, 460], [42520, 250], [43140, 440], [43600, 200], [44300, 360]]
ev("""(function(){
  var E=window.__sandbox, RINGS=%s, SC=0.75, held=false;
  window.__bot={deaths:0,best:0,deadAt:[],press:0};
  function press(){ if(held)return; held=true; window.__bot.press++;
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true})); }
  function release(){ if(!held)return; held=false;
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true})); }
  function tick(){
    try{
      var w=E.world, r=w.race;
      if(w.screen==='play' && r){
        if(r.tick===0){ press(); return requestAnimationFrame(tick); }  // PRESS + HOLD launches
        var cp=r.coursePosition, t=null;
        for(var i=0;i<RINGS.length;i++){ if(RINGS[i][0]*SC > cp+40){ t=RINGS[i][1]; break; } }
        if(t==null) t=320;
        if(r.y + r.vy*0.16 > t) press(); else release();
        if(r.acorns>window.__bot.best) window.__bot.best=r.acorns;
      } else { release(); }
    }catch(e){}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})()""" % json.dumps(RINGS))
print("launch:", ev("window.__sandbox.flyLevel('hyper-run')"))
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
