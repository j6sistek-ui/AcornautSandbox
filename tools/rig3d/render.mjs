#!/usr/bin/env node
// RENDER A RIGGED TRIPO MODEL INTO GAME BANKS.
//
//   node tools/rig3d/render.mjs <model.glb> --id <suit-id> [--out <dir>] [--size 512] [--seconds 2]
//                               [--frames tap:12,desc:4,asc:0]   (per-bank counts; 0 drops a bank)
//
// Writes, for the suit id:
//   <out>/<id>-tap-1..16.png  <id>-asc-1..8.png  <id>-desc-1..8.png   256 px, the game's size
//   <out>/hd/...                                                       the same at --size (512)
//   <out>/sheets/<move>.png                                            every bank frame on one sheet
//   <out>/preview/<move>.mp4                                           each move over --seconds (2 s), with ffmpeg
//   <out>/<id>-rig.glb                                                 the auto-rigged model, every move a clip
//                                                                      --seconds long (open in Blender to scrub)
//   <out>/rig.json                                                     what the auto-rig found
//
// Needs: `npm install` in tools/rig3d (three), Playwright with a Chromium.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const modelPath = args.find(a => a.endsWith('.glb'));
const id = opt('id');
if (!modelPath || !id) { console.error('usage: node render.mjs <model.glb> --id <suit-id> [--out dir] [--size 512] [--seconds 2] [--frames tap:12,desc:4,asc:0]'); process.exit(2); }
const out = path.resolve(opt('out', `rig3d-out/${id}`));
const SIZE = +opt('size', 512), SECONDS = +opt('seconds', 2), FPS = 30, FRAMES = opt('frames', '');
for (const d of ['', 'hd', 'sheets', 'preview']) fs.mkdirSync(path.join(out, d), { recursive: true });

// playwright: local install, then the PLAYWRIGHT_MODULE env var, then a global path
let pw;
for (const m of ['playwright', process.env.PLAYWRIGHT_MODULE, '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean)) {
  try { pw = await import(m.startsWith('/') ? pathToFileURL(m).href : m); break; } catch {}
}
if (!pw) { console.error('Playwright not found: npm install playwright in tools/rig3d, or set PLAYWRIGHT_MODULE'); process.exit(2); }
const { chromium } = pw.default ?? pw;

// a tiny static server: the studio's own folder, plus the model at /model.glb
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url === '/model.glb' ? path.resolve(modelPath) : path.join(here, url);
  if (!file.startsWith(here) && file !== path.resolve(modelPath)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end(); return; } res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
// a model the rig cannot use (no skeleton, say) fails at once instead of waiting out the timeout
let failed = null;
page.on('pageerror', e => { console.error('page error:', e.message); failed = e.message; });
// and a browser that dies (a crash, a paused machine) ends the run rather than hanging it
page.on('crash', () => { console.error('the page crashed'); process.exit(1); });
let closing = false;
browser.on('disconnected', () => { if (closing) return; console.error('the browser went away'); process.exit(1); });
await page.goto(`http://localhost:${port}/studio.html?model=/model.glb&size=${SIZE}&frames=${encodeURIComponent(FRAMES)}`);
await Promise.race([
  page.waitForFunction(() => window.studioReady, null, { timeout: 600000 }),
  (async () => { while (!failed) await new Promise(r => setTimeout(r, 200)); })(),
]);
if (failed) { console.error(`cannot render ${path.basename(modelPath)}: ${failed}`); closing = true; await browser.close(); server.close(); process.exit(1); }
const info = await page.evaluate(() => window.studio.info);
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(info, null, 2));
console.log('rig:', JSON.stringify({ head: info.head, front: info.front.length, hind: info.hind.length, tail: info.tail.length, cutFaces: info.cutFaces, loose: info.looseTailPieces }));

const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
// downscale and sheet-building happen in the page, on a canvas
const resize = (url, s) => page.evaluate(async ([u, s]) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, s, s); return c.toDataURL('image/png'); }, [url, s]);
const sheet = (urls, cols, cell) => page.evaluate(async ([urls, cols, cell]) => { const rows = Math.ceil(urls.length / cols), c = document.createElement('canvas'); c.width = cols * cell; c.height = rows * cell; const g = c.getContext('2d'); g.fillStyle = '#28243c'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#bcb6d8'; g.font = '14px monospace'; for (let i = 0; i < urls.length; i++) { const im = new Image(); im.src = urls[i]; await im.decode(); const x = (i % cols) * cell, y = Math.floor(i / cols) * cell; g.drawImage(im, x, y, cell, cell); g.fillText(String(i + 1), x + 8, y + 20); } return c.toDataURL('image/png'); }, [urls, cols, cell]);

const moves = await page.evaluate(() => window.studio.moves);
const hasFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
for (const [move, m] of Object.entries(moves)) {
  const urls = [];
  for (let i = 0; i < m.frames; i++) {
    const hd = await page.evaluate(([mv, i]) => window.studio.bank(mv, i), [move, i]);
    urls.push(hd);
    save(path.join(out, 'hd', `${id}-${move}-${i + 1}.png`), hd);
    save(path.join(out, `${id}-${move}-${i + 1}.png`), await resize(hd, 256));
  }
  save(path.join(out, 'sheets', `${move}.png`), await sheet(urls, m.frames > 8 ? 8 : m.frames, 256));
  // preview: the move spread over SECONDS, with its lift, so it can be watched at speed or stepped
  const n = Math.round(SECONDS * FPS), tmp = fs.mkdtempSync(path.join(out, 'preview', `.${move}-`));
  for (let i = 0; i < n; i++) save(path.join(tmp, `${String(i).padStart(4, '0')}.png`), await page.evaluate(([mv, u]) => window.studio.sample(mv, u), [move, m.loop ? i / n : i / (n - 1)]));
  if (hasFfmpeg) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x28243c:s=${SIZE}x${SIZE}:r=${FPS}`, '-framerate', String(FPS), '-i', path.join(tmp, '%04d.png'), '-filter_complex', '[0][1]overlay=shortest=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', path.join(out, 'preview', `${move}.mp4`)]);
    fs.rmSync(tmp, { recursive: true, force: true });
  } else fs.renameSync(tmp, path.join(out, 'preview', move));
  console.log(`${move}: ${m.frames} bank frames, ${n}-frame preview`);
}
save(path.join(out, `${id}-rig.glb`), 'data:;base64,' + await page.evaluate(([s, f]) => window.studio.glb(s, f), [SECONDS, FPS]));
console.log('wrote', out);
closing = true; await browser.close(); server.close();
// the static server's keep-alive sockets would hold the process open long after the work is done
process.exit(0);
