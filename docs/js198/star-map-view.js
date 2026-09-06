import { ENVS } from "./catalog.js?v=198";
import { artUrl, drawSprite } from "./art.js?v=198";
import { mapDebrisIndex, mapPlanetIndex, visualHash, zoneVisual } from "./zone-visuals.js?v=198";
/** Scenery belongs to the same stable zone as the mission node. Four mission
 * spacings overlap at each transition; there are no chapter panels or seams. */
export function addChartScenery(map, levels, pos, step, art) {
    const layers = [];
    let first = 0;
    while (first < levels.length) {
        const env = levels[first].fx.env ?? 0;
        let end = first + 1;
        while (end < levels.length && levels[end].fx.env === env)
            end++;
        const family = zoneVisual(env);
        const scene = document.createElement("div");
        scene.className = "ac-zone-scene";
        scene.dataset.zone = family.id;
        scene.style.top = `${pos[end - 1].y - step * 2.5}px`;
        scene.style.height = `${(end - first + 4) * step}px`;
        scene.style.setProperty("--zone-pan", `${family.pan * 100}%`);
        scene.style.setProperty("--zone-wash", ENVS[env].wash.slice(0, 3).join(","));
        scene.setAttribute("aria-hidden", "true");
        map.prepend(scene);
        const label = document.createElement("span");
        label.className = "ac-zone-name";
        label.textContent = ENVS[env].name;
        label.style.top = `${pos[first].y - step * 0.6}px`;
        map.append(label);
        layers.push({ node: scene, first, last: end - 1, env });
        first = end;
    }
    const nodes = [...map.querySelectorAll(".ac-mapnode")];
    let stopped = false, frame = 0, sc = null;
    const paint = () => {
        frame = 0;
        if (stopped || !map.isConnected || !sc)
            return;
        const viewport = sc.getBoundingClientRect();
        const candidates = nodes.map((node, i) => ({ node, i, y: node.getBoundingClientRect().top }))
            .filter(x => x.y >= viewport.top - 500 && x.y <= viewport.bottom + 500)
            .sort((a, b) => Math.abs(a.y - (viewport.top + viewport.bottom) / 2) - Math.abs(b.y - (viewport.top + viewport.bottom) / 2))
            .slice(0, 48);
        const visible = new Set(candidates.map(x => x.i));
        nodes.forEach((node, i) => {
            const disc = node.querySelector(".ac-mapdisc");
            if (!visible.has(i)) {
                disc.querySelector("canvas")?.remove();
                return;
            }
            if (disc.querySelector("canvas"))
                return;
            const size = node.classList.contains("cur") ? 84 : 62;
            const c = document.createElement("canvas");
            c.width = c.height = size * 2;
            c.style.width = c.style.height = `${size}px`;
            c.dataset.planet = String(mapPlanetIndex(levels[i]));
            const ctx = c.getContext("2d");
            if (ctx)
                drawSprite(ctx, art.planets[mapPlanetIndex(levels[i])] ?? null, size, size, size * 1.88);
            disc.prepend(c);
        });
        for (const layer of layers) {
            const rect = layer.node.getBoundingClientRect();
            const near = rect.bottom >= viewport.top - 500 && rect.top <= viewport.bottom + 500;
            if (!near) {
                layer.node.replaceChildren();
                layer.node.style.backgroundImage = "none";
                continue;
            }
            if (layer.node.childElementCount)
                continue;
            const zone = zoneVisual(layer.env);
            const environment = ENVS[layer.env];
            const tint = environment.wash.slice(0, 3).join(",");
            const tint2 = environment.wash2.slice(0, 3).join(",");
            layer.node.style.backgroundImage = `linear-gradient(rgba(${tint},.18),rgba(${tint2},.12)),linear-gradient(rgba(5,9,20,.25),rgba(5,9,20,.5)),url("${artUrl(zone.painted)}"),url("${artUrl(`skies/${environment.sky}.jpg`)}")`;
            const starLayer = document.createElement("div");
            starLayer.className = "ac-zone-stars";
            const count = 30;
            for (let i = 0; i < count; i++) {
                const h = visualHash(`${zone.id}:star:${i}`);
                const star = document.createElement("i");
                star.style.left = `${h % 100}%`;
                star.style.top = `${(h >>> 8) % 100}%`;
                star.style.opacity = `${0.2 + ((h >>> 16) % 40) / 100}`;
                star.style.width = star.style.height = `${1 + (h % 3) * 0.5}px`;
                starLayer.append(star);
            }
            layer.node.append(starLayer);
            for (let i = 0; i < 5; i++) {
                const image = document.createElement("img");
                image.alt = "";
                image.src = artUrl(`debris/${mapDebrisIndex(layer.env, i)}.png`);
                image.className = "ac-zone-debris";
                image.style.left = `${i % 2 ? 84 : 4}%`;
                image.style.top = `${16 + i * 15}%`;
                image.style.transform = `rotate(${visualHash(zone.id + i) % 360}deg)`;
                layer.node.append(image);
            }
        }
        const center = (viewport.top + viewport.bottom) / 2;
        const closest = candidates.reduce((best, x) => Math.abs(x.y - center) < Math.abs(best.y - center) ? x : best, candidates[0]);
        const place = sc.parentElement?.querySelector(".ac-current-zone");
        if (place && closest)
            place.textContent = ENVS[levels[closest.i].fx.env ?? 0].name;
    };
    const schedule = () => { if (!frame)
        frame = requestAnimationFrame(paint); };
    frame = requestAnimationFrame(() => {
        frame = 0;
        if (stopped)
            return;
        sc = map.closest(".ac-sheet-scroll");
        sc?.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        map.addEventListener("focusin", schedule);
        paint();
    });
    return () => { stopped = true; cancelAnimationFrame(frame); sc?.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); map.removeEventListener("focusin", schedule); };
}
