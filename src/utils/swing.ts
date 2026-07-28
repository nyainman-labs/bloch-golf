/**
 * Golf Swing Timeline
 *
 * Pure functions describing the club's swing over time.
 * All tuning of the swing's feel lives here — nothing else needs to change.
 *
 * The angle describes where the club *head* sits on its arc around the pivot,
 * measured in the club's local frame:
 *   negative = behind the ball (the side it is struck from)
 *   0        = impact, head on the ball
 *   positive = through the ball, toward the direction it travels
 *
 * It is deliberately the head's angle and not the shaft's lean — the head hangs
 * below the pivot, so the two have opposite signs. GolfClub negates when it
 * applies this to the pivot's rotation; getting that backwards is what made the
 * club swing away from the ball's travel direction.
 */

/** Phase durations in seconds */
export const SWING = {
  /** Club pops in at address */
  address: 0.1,
  /** Takeaway up to the top of the backswing */
  backswing: 0.26,
  /** Accelerating drop into the ball — impact lands at the end of this phase */
  downswing: 0.09,
  /** Follow-through after impact */
  follow: 0.26,
  /** Club pops back out */
  retract: 0.16,
} as const;

/** Time from the start of the swing to impact. The ball's motion clock starts here. */
export const SWING_LEAD = SWING.address + SWING.backswing + SWING.downswing;

/** Total time the club is on screen */
export const SWING_TOTAL = SWING_LEAD + SWING.follow + SWING.retract;

/** Head angles in radians (see module docstring for the sign convention) */
const ADDRESS_ANGLE = -0.18;
const TOP_ANGLE = -1.2;
const IMPACT_ANGLE = 0;
const FOLLOW_ANGLE = 1.15;

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);
const easeInQuad = (t: number): number => t * t;
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Overshooting ease used for the pop-in, so the club lands with a bit of snap */
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface SwingPose {
  /** Head angle in radians on its arc around the pivot (see module docstring) */
  headAngle: number;
  /** Uniform scale of the club, used for the pop in/out */
  scale: number;
  /** Whether the club should be rendered at all */
  visible: boolean;
}

const HIDDEN: SwingPose = { headAngle: ADDRESS_ANGLE, scale: 0, visible: false };

/**
 * Evaluate the club's pose at time `t` seconds from the start of the swing.
 */
export function evaluateSwing(t: number): SwingPose {
  if (t < 0) return HIDDEN;

  let cursor = t;

  // Pop in at address
  if (cursor < SWING.address) {
    const u = cursor / SWING.address;
    return { headAngle: ADDRESS_ANGLE, scale: 0.2 + 0.8 * easeOutBack(u), visible: true };
  }
  cursor -= SWING.address;

  // Takeaway — decelerates into the top of the swing
  if (cursor < SWING.backswing) {
    const u = cursor / SWING.backswing;
    return { headAngle: lerp(ADDRESS_ANGLE, TOP_ANGLE, easeOutQuad(u)), scale: 1, visible: true };
  }
  cursor -= SWING.backswing;

  // Downswing — accelerates so the club is fastest at impact
  if (cursor < SWING.downswing) {
    const u = cursor / SWING.downswing;
    return { headAngle: lerp(TOP_ANGLE, IMPACT_ANGLE, easeInQuad(u)), scale: 1, visible: true };
  }
  cursor -= SWING.downswing;

  // Follow-through
  if (cursor < SWING.follow) {
    const u = cursor / SWING.follow;
    return { headAngle: lerp(IMPACT_ANGLE, FOLLOW_ANGLE, easeOutCubic(u)), scale: 1, visible: true };
  }
  cursor -= SWING.follow;

  // Pop out
  if (cursor < SWING.retract) {
    const u = cursor / SWING.retract;
    return { headAngle: FOLLOW_ANGLE, scale: 1 - easeInQuad(u), visible: true };
  }

  return HIDDEN;
}
