/**
 * BACKGROUND TEST — painted skies vs procedural skies, judged live.
 *
 * The question on trial: can code draw the environment skies at the quality
 * of today's paintings? Ten slots cycle forever — the first five show the
 * shipping paintings (dark1..dark5) exactly as the game draws them, the next
 * five re-render THE SAME five environments procedurally, seeded from each
 * painting's own sampled palette so hue and mood match and only the
 * technique differs. No gates, no collision, no death: planets, debris,
 * acorns and the pilot drift by so the sky is judged under real foreground
 * art, at any viewport — portrait, landscape, desktop.
 *
 * Deliberately SELF-CONTAINED, like every lab page: it shares the art
 * folder and nothing else, so it can be judged, kept or deleted without
 * touching the shipping game.
 */
const ART = (window.__ACORNAUT_ART__ || "/art").replace(/\/$/, "");
const SLOT_SECONDS = 12; // auto-advance; a tap skips ahead immediately
const SKY_COUNT = 5; // dark1..dark5, then the same five procedural
// ---------------------------------------------------------------- helpers
function loadImg(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}
/** deterministic RNG — the same environment renders the same sky forever */
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// value noise on an integer lattice, hashed — no tables, no allocation
function hash2(ix, iy, seed) {
    let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed);
    const b = hash2(ix + 1, iy, seed);
    const c = hash2(ix, iy + 1, seed);
    const d = hash2(ix + 1, iy + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x, y, seed, octaves) {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    for (let i = 0; i < octaves; i++) {
        sum += vnoise(x * f, y * f, seed + i * 101) * amp;
        amp *= 0.55;
        f *= 2.05;
    }
    return sum;
}
/** The procedural sky borrows its colours from the painting it stands in
 *  for: darkest quarter becomes the void, the brightest sliver the glow,
 *  and the most saturated distinct hues drive the nebula layers. */
function paletteFrom(img) {
    const c = document.createElement("canvas");
    c.width = 24;
    c.height = 24;
    const cc = c.getContext("2d");
    cc.drawImage(img, 0, 0, 24, 24);
    const d = cc.getImageData(0, 0, 24, 24).data;
    const px = [];
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        const lum = (r * 2 + g * 3 + b) / 6;
        const sat = mx === 0 ? 0 : (mx - mn) / mx;
        let hue = 0;
        if (mx !== mn) {
            if (mx === r)
                hue = ((g - b) / (mx - mn)) % 6;
            else if (mx === g)
                hue = (b - r) / (mx - mn) + 2;
            else
                hue = (r - g) / (mx - mn) + 4;
            hue = (hue * 60 + 360) % 360;
        }
        px.push({ rgb: [r, g, b], lum, sat, hue });
    }
    px.sort((a, b) => a.lum - b.lum);
    const avg = (list) => {
        const n = Math.max(1, list.length);
        return [0, 1, 2].map((k) => Math.round(list.reduce((s, p) => s + p.rgb[k], 0) / n));
    };
    const base = avg(px.slice(0, Math.floor(px.length * 0.25)));
    const glow = avg(px.slice(Math.floor(px.length * 0.95)));
    const bySat = [...px].sort((a, b) => b.sat * b.lum - a.sat * a.lum);
    const hues = [];
    const usedHue = [];
    for (const p of bySat) {
        if (usedHue.some((h) => Math.min(Math.abs(h - p.hue), 360 - Math.abs(h - p.hue)) < 42))
            continue;
        hues.push(p.rgb);
        usedHue.push(p.hue);
        if (hues.length === 3)
            break;
    }
    while (hues.length < 3)
        hues.push(glow);
    return { base, glow, hues };
}
// ------------------------------------------------------ procedural render
/** Paint one sky: layered domain-warped noise in the painting's own
 *  colours, a composed focal glow, streaky grain for the brushy feel,
 *  stars, vignette. Rendered once per slot at reduced resolution and
 *  upscaled — painterly softness survives the upscale by design. */
function renderProceduralSky(w, h, envIndex, pal) {
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d");
    const scale = Math.min(1, 560 / Math.max(w, h));
    const W = Math.max(64, Math.round(w * scale));
    const H = Math.max(64, Math.round(h * scale));
    const work = document.createElement("canvas");
    work.width = W;
    work.height = H;
    const wc = work.getContext("2d");
    const img = wc.createImageData(W, H);
    const d = img.data;
    const seed = 7700 + envIndex * 977;
    const rnd = mulberry32(seed);
    // composition: the focal glow sits on a rule-of-thirds point, jittered
    const fx = (rnd() < 0.5 ? 0.33 : 0.67) + (rnd() - 0.5) * 0.12;
    const fy = 0.3 + rnd() * 0.34;
    // sampled hues arrive muted (paintings average dark); push saturation and
    // lift so the nebula reads as COLOR, the way a painter would exaggerate it
    const punch = (rgb) => {
        const m = (rgb[0] + rgb[1] + rgb[2]) / 3;
        return [0, 1, 2].map((k) => Math.min(255, m + (rgb[k] - m) * 2.1 + 26));
    };
    const layers = pal.hues.map((rgb, i) => ({
        rgb: punch(rgb),
        freq: 1.7 + i * 1.5 + rnd() * 0.6,
        amp: 1.15 - i * 0.2,
        t0: 0.34 + rnd() * 0.06,
        seed: seed + 31 * (i + 1),
    }));
    const inv = 1 / Math.max(W, H);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const u = x * inv;
            const v = y * inv;
            const g = y / H;
            // the void: the painting's darkest quarter, deepening downward
            let r = pal.base[0] * (0.72 + g * 0.42);
            let gg = pal.base[1] * (0.72 + g * 0.42);
            let b = pal.base[2] * (0.78 + g * 0.4);
            // one warp field bends every layer, so the wisps agree with each other
            const wx = fbm(u * 2.3 + 11, v * 2.3, seed + 5, 4) - 0.5;
            const wy = fbm(u * 2.3, v * 2.3 + 7, seed + 9, 4) - 0.5;
            for (const L of layers) {
                const n = fbm((u + wx * 0.9) * L.freq, (v + wy * 0.9) * L.freq, L.seed, 6);
                const t = Math.max(0, (n - L.t0) / (1 - L.t0));
                const val = Math.pow(t, 1.45) * L.amp;
                r += L.rgb[0] * val;
                gg += L.rgb[1] * val;
                b += L.rgb[2] * val;
            }
            // focal glow — the painting's brightest sliver, breathing outward
            const dx = u - fx;
            const dy = v - fy * (H * inv);
            const glow = Math.exp(-(dx * dx + dy * dy) * 14) * 0.72;
            r += pal.glow[0] * glow;
            gg += pal.glow[1] * glow;
            b += pal.glow[2] * glow;
            // brushy grain: anisotropic streaks, barely there
            const grain = (vnoise(u * 90, v * 260, seed + 77) - 0.5) * 9;
            r += grain;
            gg += grain;
            b += grain;
            const i4 = (y * W + x) * 4;
            d[i4] = Math.min(255, r);
            d[i4 + 1] = Math.min(255, gg);
            d[i4 + 2] = Math.min(255, b);
            d[i4 + 3] = 255;
        }
    }
    wc.putImageData(img, 0, 0);
    // stars live at full resolution so they stay crisp under the upscale
    octx.imageSmoothingEnabled = true;
    octx.drawImage(work, 0, 0, w, h);
    const starCount = Math.round((w * h) / 6200);
    for (let i = 0; i < starCount; i++) {
        const sx = rnd() * w;
        const sy = rnd() * h;
        const sr = rnd() < 0.85 ? 0.7 + rnd() * 0.7 : 1.4 + rnd() * 1.2;
        const a = 0.25 + rnd() * 0.6;
        if (sr > 1.6) {
            const halo = octx.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
            halo.addColorStop(0, `rgba(255,255,255,${a * 0.5})`);
            halo.addColorStop(1, "rgba(255,255,255,0)");
            octx.fillStyle = halo;
            octx.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
        }
        octx.fillStyle = `rgba(255,255,255,${a})`;
        octx.beginPath();
        octx.arc(sx, sy, sr, 0, Math.PI * 2);
        octx.fill();
    }
    const vig = octx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,10,0.34)");
    octx.fillStyle = vig;
    octx.fillRect(0, 0, w, h);
    return out;
}
export async function bootSkyTest(root) {
    const canvas = document.createElement("canvas");
    canvas.className = "sk-canvas";
    root.appendChild(canvas);
    const label = document.createElement("div");
    label.className = "sk-label";
    root.appendChild(label);
    const hint = document.createElement("div");
    hint.className = "sk-hint";
    hint.textContent = "TAP FOR NEXT SKY · BACKGROUND TEST · NOTHING CAN HIT YOU";
    root.appendChild(hint);
    const ctx = canvas.getContext("2d");
    const paintings = await Promise.all(Array.from({ length: SKY_COUNT }, (_, i) => loadImg(`${ART}/skies/dark${i + 1}.jpg`)));
    const squirrel = await Promise.all([1, 2, 3, 4].map((n) => loadImg(`${ART}/squirrel/flap-${n}.png`)));
    const planetImgs = (await Promise.all([0, 1, 2, 3, 4].map((n) => loadImg(`${ART}/planets/${n}.png`)))).filter(Boolean);
    const debrisImgs = (await Promise.all([0, 1, 2].map((n) => loadImg(`${ART}/debris/${n}.png`)))).filter(Boolean);
    const acornImg = await loadImg(`${ART}/acorn/1.png`);
    const palettes = paintings.map((p) => (p ? paletteFrom(p) : { base: [10, 14, 30], glow: [200, 210, 255], hues: [[90, 60, 160], [40, 90, 170], [160, 80, 120]] }));
    let W = 0;
    let H = 0;
    let dpr = 1;
    let slot = 0; // 0..9: five painted, five procedural, cycling
    let slotT = 0;
    const procCache = new Map();
    function envOf(s) { return s % SKY_COUNT; }
    function isProcedural(s) { return s % (SKY_COUNT * 2) >= SKY_COUNT; }
    function proceduralSky(env) {
        const key = `${env}|${canvas.width}x${canvas.height}`;
        let hit = procCache.get(key);
        if (!hit) {
            hit = renderProceduralSky(canvas.width, canvas.height, env, palettes[env]);
            procCache.clear(); // one resolution at a time is plenty
            procCache.set(key, hit);
        }
        return hit;
    }
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = root.clientWidth;
        H = root.clientHeight;
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
    }
    resize();
    window.addEventListener("resize", resize);
    // the drifting field — pure scenery, nothing collides with anything
    const rnd = mulberry32(20260821);
    const stars = Array.from({ length: 120 }, () => ({ x: rnd(), y: rnd(), z: 0.25 + rnd() * 0.75, tw: rnd() * 7 }));
    const drifters = [];
    function spawnDrifter(offscreen) {
        const pool = rnd() < 0.6 && planetImgs.length ? planetImgs : debrisImgs;
        if (!pool.length)
            return;
        const img = pool[Math.floor(rnd() * pool.length)];
        const planet = planetImgs.includes(img);
        drifters.push({
            img,
            x: offscreen ? 1.05 + rnd() * 0.4 : rnd(),
            y: 0.08 + rnd() * 0.84,
            size: planet ? 90 + rnd() * 130 : 34 + rnd() * 40,
            speed: planet ? 0.028 + rnd() * 0.02 : 0.05 + rnd() * 0.035,
            spin: planet ? 0 : (rnd() - 0.5) * 0.9,
            rot: rnd() * Math.PI * 2,
        });
    }
    for (let i = 0; i < 7; i++)
        spawnDrifter(false);
    const acorns = Array.from({ length: 4 }, () => ({ x: rnd(), y: 0.15 + rnd() * 0.7, bob: rnd() * 7 }));
    function advance() { slot = (slot + 1) % (SKY_COUNT * 2); slotT = 0; }
    canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); advance(); });
    window.addEventListener("keydown", (e) => { if (e.code === "Space" || e.code === "ArrowRight")
        advance(); });
    let last = performance.now();
    let time = 0;
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        time += dt;
        slotT += dt;
        if (slotT >= SLOT_SECONDS)
            advance();
        const env = envOf(slot);
        const proc = isProcedural(slot);
        const cw = canvas.width;
        const ch = canvas.height;
        // ---- the sky under judgement ----
        if (proc) {
            ctx.drawImage(proceduralSky(env), 0, 0);
        }
        else {
            const img = paintings[env];
            if (img) {
                // cover-fit, exactly how the game crops a painted panorama
                const s = Math.max(cw / img.width, ch / img.height);
                const dw = img.width * s;
                const dh = img.height * s;
                ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
            }
            else {
                ctx.fillStyle = "#0a0e20";
                ctx.fillRect(0, 0, cw, ch);
            }
        }
        // ---- the game's own foreground, so style clashes have nowhere to hide ----
        for (const s of stars) {
            s.x -= 0.012 * s.z * dt;
            if (s.x < 0)
                s.x += 1;
            const a = 0.35 + Math.sin(time * 2 + s.tw) * 0.25;
            ctx.fillStyle = `rgba(255,255,255,${Math.max(0.08, a) * s.z})`;
            ctx.fillRect(s.x * cw, s.y * ch, 1.6 * dpr * s.z, 1.6 * dpr * s.z);
        }
        for (let i = drifters.length - 1; i >= 0; i--) {
            const p = drifters[i];
            p.x -= p.speed * dt;
            p.rot += p.spin * dt;
            if (p.x < -0.25) {
                drifters.splice(i, 1);
                spawnDrifter(true);
                continue;
            }
            const size = p.size * dpr;
            ctx.save();
            ctx.translate(p.x * cw, p.y * ch);
            ctx.rotate(p.rot);
            ctx.drawImage(p.img, -size / 2, -size / 2, size, size);
            ctx.restore();
        }
        if (acornImg) {
            for (const a of acorns) {
                a.x -= 0.06 * dt;
                if (a.x < -0.05) {
                    a.x = 1.05 + rnd() * 0.3;
                    a.y = 0.15 + rnd() * 0.7;
                }
                const size = 26 * dpr;
                const bobY = Math.sin(time * 3 + a.bob) * 6 * dpr;
                ctx.drawImage(acornImg, a.x * cw - size / 2, a.y * ch + bobY - size / 2, size, size);
            }
        }
        const frameImg = squirrel[Math.floor(time * 6) % 4];
        if (frameImg) {
            const size = 96 * dpr;
            const px = cw * 0.22;
            const py = ch * 0.44 + Math.sin(time * 1.7) * ch * 0.05;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(Math.sin(time * 1.7 + 1.2) * 0.12);
            ctx.drawImage(frameImg, -size / 2, -size / 2, size, size);
            ctx.restore();
        }
        label.textContent = `${slot + 1}/10 · ${proc ? "PROCEDURAL" : "PAINTED"} · SKY ${env + 1}`;
        label.className = `sk-label ${proc ? "sk-proc" : "sk-paint"}`;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
