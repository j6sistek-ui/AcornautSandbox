import { PLANET_RGB, sep } from "./catalog.js?v=267";
/** Fade separation out when hue or brightness already defines the planet.
 * At its strongest this uses the existing faint cached sprite halo. */
export function planetHalo(kind, background) {
    const color = PLANET_RGB[kind];
    if (!color)
        return undefined;
    const distance = sep(color, background);
    if (distance >= 0.38)
        return undefined;
    const t = 1 - distance / 0.38;
    return {
        mode: 0.2126 * background[0] + 0.7152 * background[1] + 0.0722 * background[2] > 0.5 ? "dark" : "light",
        opacity: t * t * (3 - 2 * t),
    };
}
const samples = new WeakMap();
/** Read a tiny copy of the already-painted background at most twice a second.
 * This follows actual local grey/cloud patches without editing the sky or
 * blurring every planet every frame. Samples are taken before foreground art. */
export function samplePlanetBackdrop(ctx, key, time) {
    let sample = samples.get(ctx.canvas);
    if (!sample) {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 24;
        sample = { canvas, key: "", at: -Infinity };
        samples.set(ctx.canvas, sample);
    }
    if (sample.key !== key || time < sample.at || time - sample.at >= 0.5) {
        sample.at = time;
        sample.key = key;
        try {
            const c = sample.canvas.getContext("2d", { willReadFrequently: true });
            if (c) {
                c.drawImage(ctx.canvas, 0, 0, 32, 24);
                sample.data = c.getImageData(0, 0, 32, 24).data;
            }
        }
        catch {
            sample.data = undefined;
        }
    }
    const matrix = ctx.getTransform();
    return (kind, x, y, radius, fallback) => {
        if (!sample?.data || sample.data.length < 32 * 24 * 4)
            return planetHalo(kind, fallback);
        // Average a neighbourhood of the actual contour, including the side
        // facing the flight opening; never let a single star enable the effect.
        const rgb = [0, 0, 0];
        let count = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const px = x + dx * radius, py = y + dy * radius;
            const sx = matrix.a * px + matrix.c * py + matrix.e;
            const sy = matrix.b * px + matrix.d * py + matrix.f;
            if (sx < 0 || sy < 0 || sx >= ctx.canvas.width || sy >= ctx.canvas.height)
                continue;
            const i = (Math.min(23, Math.floor(sy / ctx.canvas.height * 24)) * 32
                + Math.min(31, Math.floor(sx / ctx.canvas.width * 32))) * 4;
            for (let channel = 0; channel < 3; channel++)
                rgb[channel] += sample.data[i + channel] / 255;
            count++;
        }
        return planetHalo(kind, count ? rgb.map(v => v / count) : fallback);
    };
}
