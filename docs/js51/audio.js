// Sound for a game set in space. The old bank was one bare oscillator per
// event, which is where the chirp-and-boing came from: a square wave is a
// toy, not a thruster. Everything here is built from two ingredients
// instead — filtered NOISE, which is what exhaust and impacts actually
// are, and tuned tone, which carries the pitch — and every voice is fed
// through a shared plate so the whole game sounds like it is happening
// somewhere large.
let ctx = null;
let master = null;
let verb = null;
let noise = null;
function ac() {
    if (!ctx) {
        const C = window.AudioContext ||
            window.webkitAudioContext;
        ctx = new C();
        build(ctx);
    }
    if (ctx.state === "suspended")
        void ctx.resume();
    return ctx;
}
// Master chain: everything lands on a compressor so a flurry of taps
// cannot stack into clipping, however fast the player is going.
function build(c) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    comp.connect(c.destination);
    master = c.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    // A short synthetic plate. Decaying noise is a crude impulse response,
    // but it is the difference between sounds happening AT you and sounds
    // happening around you — which is the whole point of the ask.
    const len = Math.floor(c.sampleRate * 1.8);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            const t = i / len;
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (1 - t * 0.35);
        }
    }
    const conv = c.createConvolver();
    conv.buffer = ir;
    // roll the top off the tail so the space reads as big, not brittle
    const tame = c.createBiquadFilter();
    tame.type = "lowpass";
    tame.frequency.value = 3600;
    conv.connect(tame);
    tame.connect(master);
    verb = c.createGain();
    verb.gain.value = 1;
    verb.connect(conv);
    // one second of white noise, reused by every voice that needs it
    const nlen = Math.floor(c.sampleRate);
    noise = c.createBuffer(1, nlen, c.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nlen; i++)
        nd[i] = Math.random() * 2 - 1;
}
export function unlockAudio() {
    try {
        ac();
    }
    catch {
        /* ignore */
    }
}
// ————— Music: the retro timeline's soundtrack —————
// A streamed loop, kept OUTSIDE the WebAudio graph on purpose. Decoding
// five megabytes of AAC into a buffer would cost real memory for no gain;
// an <audio> element streams it and loops seamlessly. It plays only while
// the retro renderer is active — the whole arcade run, and only the
// shifted stretches of Free Flight — and never in the illustrated game.
let musicEl = null;
let musicFade = 0; // rAF id for the current fade
let musicWanted = false;
let musicMuted = false;
const MUSIC_VOL = 0.5;
function musicUrl() {
    const raw = (typeof window !== "undefined" && window.__ACORNAUT_ART__) || "/art";
    return `${raw.replace(/\/$/, "")}/music/cosmos.m4a`;
}
function ensureMusic() {
    if (musicEl || typeof Audio === "undefined")
        return musicEl;
    const el = new Audio(musicUrl());
    el.loop = true;
    el.preload = "none";
    el.volume = 0;
    // attach it (muted, off-layout) so mobile browsers treat it as a real
    // media element and keep the loop alive when the tab is backgrounded
    el.setAttribute("aria-hidden", "true");
    el.style.display = "none";
    if (typeof document !== "undefined" && document.body)
        document.body.appendChild(el);
    musicEl = el;
    return el;
}
function fadeMusic(to, ms) {
    const el = musicEl;
    if (!el)
        return;
    if (musicFade)
        cancelAnimationFrame(musicFade);
    const from = el.volume;
    const start = performance.now();
    const step = (now) => {
        const k = Math.min(1, (now - start) / ms);
        el.volume = from + (to - from) * k;
        if (k < 1) {
            musicFade = requestAnimationFrame(step);
        }
        else {
            musicFade = 0;
            if (to === 0)
                el.pause();
        }
    };
    musicFade = requestAnimationFrame(step);
}
export const music = {
    // Called every frame with whether the retro renderer is live right now.
    // It debounces itself, so the engine can call it unconditionally.
    set(active) {
        if (active === musicWanted)
            return;
        musicWanted = active;
        const el = ensureMusic();
        if (!el)
            return;
        if (active && !musicMuted) {
            void el.play().catch(() => {
                /* autoplay may be blocked until the first gesture; the next
                   call after a tap will succeed */
            });
            fadeMusic(MUSIC_VOL, 600);
        }
        else {
            fadeMusic(0, 450);
        }
    },
    setMuted(m) {
        musicMuted = m;
        if (m)
            fadeMusic(0, 200);
        else if (musicWanted) {
            const el = ensureMusic();
            if (el) {
                void el.play().catch(() => { });
                fadeMusic(MUSIC_VOL, 400);
            }
        }
    },
    muted: () => musicMuted,
};
function out(c, node, dry, wet) {
    const d = c.createGain();
    d.gain.value = dry;
    node.connect(d);
    d.connect(master);
    if (wet > 0 && verb) {
        const w = c.createGain();
        w.gain.value = wet;
        node.connect(w);
        w.connect(verb);
    }
}
/** A filtered burst of noise: exhaust, impact, hiss — anything unpitched. */
function burst(o) {
    const c = ac();
    if (!noise)
        return;
    const t = c.currentTime + (o.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = c.createBiquadFilter();
    f.type = o.type ?? "bandpass";
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + o.dur);
    const g = c.createGain();
    const atk = Math.min(o.attack ?? 0.008, o.dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.14, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f);
    f.connect(g);
    out(c, g, 1, o.wet ?? 0.16);
    src.start(t);
    src.stop(t + o.dur + 0.05);
}
/** A tuned voice: the pitched half of a sound. */
function tone(o) {
    const c = ac();
    const t = c.currentTime + (o.delay ?? 0);
    const osc = c.createOscillator();
    osc.type = o.type ?? "sine";
    osc.detune.value = o.detune ?? 0;
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to)
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    const g = c.createGain();
    const atk = Math.min(o.attack ?? 0.006, o.dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.09, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    out(c, g, 1, o.wet ?? 0.2);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
}
function guard(fn) {
    try {
        fn();
    }
    catch {
        /* audio is never worth breaking a frame over */
    }
}
// Taps come in fast, and identical repeats read as a machine gun. Each
// burn is nudged in pitch and level so a run of them breathes.
let lastFlap = -1;
export const sfx = {
    // A deep THRUST, not a high burst. The first pass sat too high — a
    // bright jet sweeping up to ~2kHz over and over is fatiguing. This one
    // keeps its weight low: a lowpassed roar of exhaust that stays under
    // 700Hz, a firm low-sine thump for the kick in the back, and only a
    // whisper of bandpassed air on top so it still reads as a jet, not a
    // rumble. No high hiss layer at all. Bandpassed/lowpassed noise is
    // quiet by nature, so these gains run high and still sit right.
    flap: () => guard(() => {
        const c = ac();
        const now = c.currentTime;
        // a rapid double-tap would otherwise pile two full thrusts on top
        // of each other; the second one is just the roar, softer
        const dense = now - lastFlap < 0.09;
        lastFlap = now;
        const v = 0.94 + Math.random() * 0.12;
        // the body of the thrust: a low roar of exhaust, opening only a
        // little so the energy stays down where a rocket lives
        burst({
            dur: dense ? 0.16 : 0.3,
            from: 150 * v,
            to: 680 * v,
            q: 0.7,
            type: "lowpass",
            gain: (dense ? 0.5 : 0.9) * v,
            wet: 0.12,
        });
        // the shove in the back: a firm low sine, dropping into sub
        // territory. A softer attack keeps its onset from clicking bright.
        tone({ freq: 132 * v, to: 46, dur: dense ? 0.16 : 0.26, gain: dense ? 0.16 : 0.26, attack: 0.01, wet: 0.06 });
        if (!dense) {
            // a breath of low-mid air so it still reads as a jet — quiet, and
            // it sweeps DOWN, kept under 900Hz so nothing ever gets shrill
            burst({ dur: 0.24, from: 820, to: 360, q: 0.8, gain: 0.05, wet: 0.14 });
        }
    }),
    // Falling: the burn inverted — a long lowpassed whoosh dropping away.
    dive: () => guard(() => {
        burst({ dur: 0.36, from: 1900, to: 190, q: 0.7, type: "lowpass", gain: 0.13, wet: 0.2 });
        tone({ freq: 300, to: 90, dur: 0.34, type: "triangle", gain: 0.06, wet: 0.18 });
    }),
    // Hull contact: a dull thud with a short metallic ring over it. No
    // boing — the ring is two close sines beating against each other,
    // which is what struck metal actually does.
    bounce: () => guard(() => {
        burst({ dur: 0.16, from: 900, to: 130, q: 0.8, type: "lowpass", gain: 0.16, attack: 0.002 });
        tone({ freq: 190, to: 120, dur: 0.16, gain: 0.1, attack: 0.002, wet: 0.12 });
        tone({ freq: 640, dur: 0.22, gain: 0.035, attack: 0.002, wet: 0.4 });
        tone({ freq: 640, dur: 0.22, gain: 0.03, attack: 0.002, wet: 0.4, detune: 24 });
    }),
    // Collected: a clean bell doubled at the octave, wet enough to ring out
    // instead of clicking shut.
    acorn: () => guard(() => {
        tone({ freq: 880, dur: 0.16, gain: 0.07, wet: 0.4 });
        tone({ freq: 1760, dur: 0.12, gain: 0.028, wet: 0.45 });
        burst({ dur: 0.07, from: 4200, to: 6800, q: 2.2, gain: 0.02, wet: 0.3 });
    }),
    // Golden: the same bell, arpeggiated upward and left to bloom.
    gold: () => guard(() => {
        [0, 0.055, 0.11].forEach((d, i) => {
            tone({ freq: 660 * Math.pow(1.335, i), dur: 0.4, gain: 0.055, wet: 0.55, delay: d });
        });
        tone({ freq: 1980, dur: 0.5, gain: 0.02, wet: 0.7, delay: 0.11 });
    }),
    // Shield: a rising swell with air moving through it, not a plain sine.
    shield: () => guard(() => {
        tone({ freq: 300, to: 720, dur: 0.34, gain: 0.075, attack: 0.05, wet: 0.45 });
        burst({ dur: 0.42, from: 700, to: 3200, q: 1.6, gain: 0.045, attack: 0.09, wet: 0.5 });
    }),
    // The crossing between the two games: everything drawn inward and up,
    // then a low boom as you arrive on the far side.
    shift: () => guard(() => {
        burst({ dur: 0.5, from: 400, to: 4200, q: 1.2, gain: 0.08, attack: 0.2, wet: 0.6 });
        tone({ freq: 520, to: 130, dur: 0.55, type: "sawtooth", gain: 0.05, attack: 0.12, wet: 0.5 });
        tone({ freq: 70, to: 40, dur: 0.7, gain: 0.12, wet: 0.3, delay: 0.34 });
        burst({ dur: 0.6, from: 2600, to: 300, q: 0.5, type: "lowpass", gain: 0.09, wet: 0.55, delay: 0.34 });
    }),
    // Decompression: the whole thing falls out from under you.
    die: () => guard(() => {
        burst({ dur: 0.75, from: 1500, to: 90, q: 0.6, type: "lowpass", gain: 0.15, wet: 0.4 });
        tone({ freq: 220, to: 42, dur: 0.8, type: "sawtooth", gain: 0.075, wet: 0.35 });
        tone({ freq: 110, to: 34, dur: 0.9, gain: 0.08, wet: 0.3 });
    }),
    // Interface: a soft filtered tick, kept dry so menus stay close.
    ui: () => guard(() => {
        burst({ dur: 0.05, from: 1800, to: 900, q: 2.5, gain: 0.05, attack: 0.002, wet: 0.08 });
    }),
};
