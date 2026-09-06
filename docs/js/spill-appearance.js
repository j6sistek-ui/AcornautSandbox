import { STAR_MAP_PREVIEW } from "./catalog.js?v=196";
export const stockSpillAppearance = () => ({ finish: "stock", trail: "stock" });
/** Sample cosmetics are not published rewards. The separate sample save is
 * their only equip surface until the extension's reward ladder is activated. */
export function spillAppearance(save) {
    if (!STAR_MAP_PREVIEW)
        return stockSpillAppearance();
    return {
        finish: save.spillAppearance?.finish === "rust-runner" ? "rust-runner" : "stock",
        trail: save.spillAppearance?.trail === "rust-wake" ? "rust-wake" : "stock",
    };
}
