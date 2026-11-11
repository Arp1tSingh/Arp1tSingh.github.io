/**
 * The four named stages of the sky.
 *
 * The 3D sky has six colour keys, because a gradient needs dawn, noon,
 * golden hour and dusk to be distinct. The document only needs four names,
 * so the page can change its ambient tokens at the same broad moments.
 */

export type SkyStage = 'dawn' | 'day' | 'dusk' | 'night';

/** The stage a journey progress of 0..1 is in. */
export function skyStage(progress: number): SkyStage {
  const p = Math.min(1, Math.max(0, progress));
  if (p < 0.18) return 'dawn';
  if (p < 0.72) return 'day';
  if (p < 0.88) return 'dusk';
  return 'night';
}

/** The stage at a route position, given the number of stops on the line. */
export function skyStageAt(position: number, stopCount: number): SkyStage {
  if (stopCount < 2) return 'dawn';
  return skyStage(position / (stopCount - 1));
}
