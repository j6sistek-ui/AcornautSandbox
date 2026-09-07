# Torso repair, 7 September 2026

Built-in image generation edit. Input: the original torso from
`parts-master.png`, cropped at (380,0,310,375), placed at (110,50) on a
480×480 chroma-green canvas. The result is `torso-repaired.png`, a
1254×1254 PNG with actual alpha. The exporter packs it into cell1 and
registers the measured neck (676,324) and hip (691,941) to the unchanged
rig endpoints. Other master paintings are preserved.

Prompt:

Use case: precise-object-edit. Asset type: single isolated game rig torso,
1024x1024. Edit the supplied torso armor, keeping the existing camera angle,
navy raised collar, round electric-blue chest reactor, silver edging,
carbon-fiber panels and two shoulder/hip attachment sockets. Primary change:
fill out the LEFT BACK/FLANK silhouette to form a full sturdy rounded squirrel
ribcage, with a continuous convex back panel flowing from the rear of the
collar down to the left hip. The current armor pinches inward severely
beneath the left shoulder socket; eliminate that pinched waist/notch and
extend the left side outward with naturally matching black carbon armor.
Left upper shoulder socket should be embedded in a broad filled back, not
define the whole narrow side. Match original torso height and front features.
Compact round animal chest rather than skinny human waist. No arms, no legs,
no head, no tail, no extra objects. Transparent background with actual alpha,
no checkerboard, no shadow outside the object; if alpha unavailable use
absolutely flat pure RGB(0,255,0) green as in input. Preserve full uncropped
torso with empty margin on all sides. No labels or text.

Leg repairs reuse the original paintings. The exporter widens each thigh
perpendicular to its fixed bone by 1.28×. Shin breadth is 1.35× through the
upper armor and tapers back to 1× before the terminal paw. Those changes
are baked once into the atlas, with the original attachment coordinates.
No frame, animation state, or runtime stretch is introduced.
