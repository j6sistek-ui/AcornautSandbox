// Offline, read-only loopback host. No npm packages or internet needed to run.
import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,dirname,resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const directory=dirname(fileURLToPath(import.meta.url)),root=resolve(directory,'../..');
const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
export async function createStudioServer(port=8960){
  const publicRoot=await realpath(directory),artRoot=await realpath(join(root,'docs/art'));
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Read-only tool');return;}
    try{
      const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      if(path==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({tool:'acornaut-flight-studio',version:1}));return;}
      if(path.includes('\\')||path.includes('\0'))throw Error('Invalid path');
      const art=path.startsWith('/art/'),base=art?artRoot:publicRoot,name=path==='/'?'index.html':path.slice(art?5:1);
      if(!art&&!/^(index\.html|styles\.css|manifest\.json|(?:app|core|renderer)\.mjs|game\/[a-z0-9-]+\.mjs)$/.test(name))throw Error('Not a public tool file');
      if(art&&!/^(suits|helms)\/[a-zA-Z0-9_./-]+\.(png|webp|jpg)$/.test(name))throw Error('Not tool artwork');
      const target=await realpath(resolve(base,name));if(!target.startsWith(base+sep))throw Error('Outside public assets');
      const info=await stat(target);if(!info.isFile())throw Error('Not a file');
      res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Content-Length':info.size});
      res.end(req.method==='HEAD'?undefined:await readFile(target));
    }catch{res.writeHead(404);res.end('Local asset not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return server;
}
function openWindows(url){
  if(process.platform==='win32'){
    const browser=[join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
      join(process.env.ProgramFiles||'C:/Program Files','Google/Chrome/Application/chrome.exe')].find(existsSync);
    if(browser){
      spawn(browser,[`--app=${url}`,'--window-size=1180,900','--window-position=20,20'],{detached:true,stdio:'ignore'}).unref();
      spawn(browser,[`--app=${url}?viewer=1`,'--window-size=850,900','--window-position=1210,20'],{detached:true,stdio:'ignore'}).unref();return;
    }
    // A default browser may choose tabs; the in-tool button can pop out a window.
    for(const target of [url,url+'?viewer=1'])spawn('rundll32.exe',['url.dll,FileProtocolHandler',target],{detached:true,stdio:'ignore'}).unref();
  }else{
    const command=process.platform==='darwin'?'open':'xdg-open';
    for(const target of [url,url+'?viewer=1']){const p=spawn(command,[target],{stdio:'ignore'});p.on('error',()=>console.log('Open '+target+' in your browser.'));}
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const i=process.argv.indexOf('--port'),port=i<0?8960:Number(process.argv[i+1]);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Use a port between 1024 and 65535.');
  const url=`http://127.0.0.1:${port}/`;
  try{
    await createStudioServer(port);console.log(`Flight Studio is ready.\nEditor: ${url}\nViewer: ${url}?viewer=1\nNo internet required. Keep this launcher running; Ctrl+C stops it.`);
    if(!process.argv.includes('--no-open'))openWindows(url);
  }catch(e){
    let existing=false;
    if(e.code==='EADDRINUSE')try{const response=await fetch(url+'health',{signal:AbortSignal.timeout(2000)});existing=(await response.json()).tool==='acornaut-flight-studio';}catch{}
    if(existing){console.log('Flight Studio is already running at '+url);if(!process.argv.includes('--no-open'))openWindows(url);}
    else {console.error(`Flight Studio could not start: ${e.message}\nIf the port is in use, close the previous launcher or use --port 8961.`);process.exitCode=1;}
  }
}
