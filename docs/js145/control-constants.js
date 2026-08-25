// Loadout-neutral flight values shared by ordinary flight, Wormhole Run,
// and any race regime that promises the same control feel.
export const FLIGHT_GRAVITY = 1300;
export const QUICK_DROP_VY = 380;
export const WORMHOLE_RELEASE_ACCEL = FLIGHT_GRAVITY;
export const WORMHOLE_HOLD_ACCEL = -2100;
export const WORMHOLE_MIN_VY = -520;
export const WORMHOLE_MAX_VY = 620;
/** SLIDE AND HOLD, the Hyper Run control brought to the Wormhole Run: the
 *  pilot is a rate-limited follower of wherever the finger is, rather than
 *  an accelerating body. The cap is what stops a flick from teleporting the
 *  squirrel across the corridor, and it is expressed as a TRAVERSAL TIME so
 *  it means the same thing on every screen height - Hyper Run crosses its
 *  full field in 48 ticks at 60Hz, which is this. */
export const WORMHOLE_DRAG_TRAVERSAL = 0.8;
/** THE TUNING RUN'S AUTOPILOT. It flies the pilot's own control law - it
 *  synthesises a hold, a drag or a tap and lets the ordinary physics
 *  consume it - so every dial is genuinely being exercised while it is
 *  being turned. These two are the autopilot's own feel, not the game's. */
export const TUNE_AUTO_LEAD = 0.55;
/** seconds of velocity projected ahead; without it a position-only
 *  controller hunts around the centre line and never settles */
export const TUNE_AUTO_DAMP = 0.3;
/** how long one contact stays lit on the readout, and the window in which
 *  a second contact is treated as the same one */
export const TUNE_HIT_FLASH = 0.5;
