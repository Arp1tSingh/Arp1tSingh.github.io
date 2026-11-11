/**
 * The ride clock.
 *
 * Scroll is still the only clock: the target route position comes from the
 * core and nowhere else. This module is the small visual follower between
 * the scroll target and what the scene draws. It removes the stepping that
 * comes from wheel events and coarse scroll deltas without inventing motion
 * after the visitor has stopped scrolling.
 *
 * The function is pure so it can be tested without a browser or a canvas.
 */

/** How quickly the rendered position catches the target, per second. */
export const RIDE_LAMBDA = 11;

/**
 * The fastest the rendered position may travel, in stops per second.
 *
 * A map jump can cross half the line at once. Without a cap it would glide
 * for several seconds; with a cap it arrives in about the time a fast scroll
 * would take.
 */
export const RIDE_MAX_SPEED = 16;

/** How close counts as settled, in fractions of a stop. */
export const RIDE_EPSILON = 0.0015;

/**
 * Advance the rendered route position one frame.
 *
 * Exponential damping makes the result frame-rate independent. The speed
 * clamp only matters for large jumps; normal scrolling stays under it.
 */
export function advanceRide(
  current: number,
  target: number,
  delta: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return target;

  const dt = Math.min(Math.max(delta, 0), 0.1);
  const difference = target - current;
  if (Math.abs(difference) <= RIDE_EPSILON) return target;

  const eased = difference * (1 - Math.exp(-RIDE_LAMBDA * dt));
  const fastest = RIDE_MAX_SPEED * dt;
  const step = Math.max(-fastest, Math.min(fastest, eased));
  return current + step;
}

/** Whether the scene has caught the scroll target. */
export function rideSettled(current: number, target: number): boolean {
  return Math.abs(target - current) <= 0.02;
}

/** Journey progress from a rendered route position. */
export function rideProgress(position: number, stopCount: number): number {
  if (stopCount < 2) return 0;
  return Math.min(1, Math.max(0, position / (stopCount - 1)));
}
