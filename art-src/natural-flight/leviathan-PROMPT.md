Use case: identity-preserve. Asset: a production 16-frame whole-character flight spritesheet, 4 columns by 4 rows, identical square cells, read left to right then top to bottom. Generate actual transparent alpha, no checkerboard drawn into the image, no ground, no shadow, no grid lines, labels, text, effects, speed lines or trail. Keep every character safely inside its cell. Same margins and scale in all cells. High quality clean painted game art, matching the character reference exactly.

Input image 1 is the ORIGINAL COSTUME AND CHARACTER REFERENCE. It is not a motion guide. Do not copy the motion of any existing game character. Author the new natural flight arc described below. The character faces right throughout, same three-quarter camera, never flips or turns away. No helmet or glass dome: the game supplies that separately.

One character, one costume, one camera. Only the pose changes.

This is one 16-frame flight sequence of a single character. Every frame is the SAME animal in the SAME outfit, photographed by the SAME lens at the SAME distance. Treat the previous frame as the ground truth for everything except the pose.

Identical in every frame — no exceptions:
- The costume. Every garment, panel, strap, buckle, seam, zip, collar, trim line, badge and marking is present, the same shape, the same size, in the same place on the body. A jacket that is open in one frame is open in all of them. Nothing appears. Nothing disappears. Nothing changes colour, material or count.
- The character. Same species, same proportions, same fur or skin pattern, same eye shape and colour, same ear shape, same muzzle.
- The palette. Same hues, same saturation, same value range, same light direction, same rim light, same shadow colour.
- The scale. The head is the same SIZE in every frame. Do not zoom, dolly, or crop differently between frames. The camera does not move.

Changes between frames — this is the whole animation:
- Body pitch, along the ramp given for this frame.
- The tail, which does most of the work: a long, continuous, readable arc that carries through the sequence. Neighbouring frames must be one motion caught at two moments, never two separate drawings.
- Limbs, following the body, secondary to the tail.

The head is an anchor, not a subject. It travels on a smooth path and holds its size. It must not drift sideways, must not resize, and must not jump: no frame may put the head somewhere its two neighbours do not imply. If the head is the thing that moves most between two frames, the frame is wrong.

NEW SHARED NATURAL MOTION: buoyant shallow swimming flight. The upper body is composed and stable. Tail bends through its entire plume, with a delayed tip and a broad continuous C-to-S sweep. Not a rigid fan spinning at the root. The near/right arm makes a small deliberate forward reach and recovery, visibly bending at the elbow. The far arm follows more subtly; knees follow the body. No limb appears or disappears. This is not a somersault, dive tuck, corkscrew or vertical plunge.

Cell-space guidance in exported 256px coordinates: keep the head centre near x184, with no more than 10px total x travel, around y94-110 with gradual smooth steps. Retain the reference head-to-body proportions, same head diameter every cell. Keep the collar/chest design in the same view. Most changing ink should be in the tail, at least three times the changing ink near the face. Tail and body may use the full safe canvas; leave at least 8px empty margin. The two neutral drawings (cells 1 and 9) must be identical.

Cells 1-8, ASCENT: neutral to strongest climb. Torso attitude is shallow and grades smoothly, from about 15 degrees nose-up to 32 degrees nose-up. Tail starts in a loose backward C, uncoils with the tip trailing low, swings outward and upward through a broad S, then curls forward at the strongest climb. The sweep is large while the head stays nearly stationary. Right arm reaches a little forward through cells 2-5, then gently folds back in cells 6-8. Distinct neighbouring poses, not duplicate stickers.
1 neutral, tail loose C; 2 begin uncoiling; 3 tail reaches low/back; 4 tail broad S; 5 tip sweeps upward; 6 plume rises; 7 curling tip leads forward; 8 soft forward curl, maximum climb.

Cells 9-16, DESCENT: neutral to strongest shallow fall. Cell 9 is EXACTLY cell 1. Torso attitude grades from 15 degrees nose-up through level to only 16 degrees nose-down. Tail flows from the loose C through a wider rearward arc, lifts behind the pelvis into a long S as the body descends, and finally settles into a soft upright curl. The head stays near the same fixed location; the hips and limbs follow the shallow attitude. Right forearm lengthens gently into the glide, never flaps or swaps sides.
9 neutral; 10 slightly open C; 11 wider trailing arc; 12 tip begins lifting; 13 broad lifted S; 14 plume trails high; 15 soft upright curl; 16 curl settles, shallow fall. Do not compress the animal or change its head size to fit the frame.

Final check before rendering: compare all 16 costumes against the reference. Preserve the exact count and body location of buttons, fasteners, trim lines, plates, collar and chest opening. All 16 images must be the same individual, continuous motion, fixed camera, fixed skull scale, stable lighting.


CHARACTER IDENTITY: Leviathan: the exact turquoise aquatic squirrel/dragon in overlapping teal scale armor, cream-gray muzzle, same large dark eye, small ears, fin crest behind neck, circular shoulder ornaments and ribbed joints. It has a LONG THIN AQUATIC TAIL ending in a TWO-LOBED FISH FIN, NOT a furry squirrel plume. Preserve the same scales, fin rays, palette, face and tail proportions. Translate the broad tail sweep into a smooth flexible fin-tail wave; do not add orange fur or new armor.
OUTPUT BACKGROUND: actual transparent alpha if available. If you cannot output alpha, use ONLY one perfectly flat saturated magenta #FF00FF backing plate, which will be removed in export. Never draw a checkerboard or white transparency simulation. The character must be unchanged by this production backing.
