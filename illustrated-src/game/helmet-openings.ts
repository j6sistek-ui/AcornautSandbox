// Source-pixel cutouts for rear collar arcs painted across the face window.
// Each path follows the inside of the collar; the external/front rim stays.
// These are artwork coordinates, independent of suit fitting and animation.
type CollarOpening = readonly [number, number, number, number, number, number,
  number, number, number, number, number, number, number, number];

export const HELMET_COLLAR_OPENINGS: Readonly<Record<string, CollarOpening>> = {
  // Clear and the eight bubble variants now have painted continuous glass.
  // Their rear arcs are absent from the PNGs; cutting them again creates a
  // bright slit or an open wedge over the muzzle. Keep normal visor tinting.
  sammie: [68, 138, 133, 142, 213, 176, 174, 194, 125, 195, 84, 175, 68, 153],
  princess: [133, 130, 177, 136, 229, 157, 208, 175, 178, 176, 146, 156, 133, 143],
  chronarch: [65, 159, 139, 168, 217, 199, 187, 224, 139, 225, 86, 194, 65, 178],
  phoenix: [69, 160, 139, 166, 219, 202, 185, 224, 136, 224, 84, 193, 69, 177],
  seraph: [77, 174, 136, 177, 207, 207, 178, 224, 135, 226, 88, 201, 77, 187],
  cryostar: [80, 162, 137, 158, 232, 188, 192, 213, 138, 216, 97, 197, 80, 181],
  verdant: [67, 159, 139, 165, 211, 196, 185, 216, 140, 216, 87, 190, 67, 175],
  eclipse: [65, 161, 138, 167, 221, 203, 184, 221, 133, 221, 86, 191, 65, 177],
  royal: [74, 181, 123, 182, 196, 210, 169, 226, 125, 226, 89, 207, 74, 195],
  leviathan: [98, 117, 151, 124, 198, 151, 180, 164, 145, 164, 110, 142, 98, 130],
};

export function clearHelmetRearCollar(ctx: CanvasRenderingContext2D, id: string): void {
  const p = HELMET_COLLAR_OPENINGS[id];
  if (!p) return;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]);
  ctx.bezierCurveTo(p[8], p[9], p[10], p[11], p[12], p[13]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
