/**
 * What this device can take.
 *
 * The blueprint degrades in five tiers. This module decides which one we are
 * in before anything expensive is loaded, and the scene reads the answer
 * rather than guessing.
 */

export type Detail = 'low' | 'high';

export interface DeviceProfile {
  /** Can this browser run WebGL at all? */
  webgl: boolean;
  /** Has the visitor asked for less motion? */
  reducedMotion: boolean;
  /** Has the visitor asked for less data? */
  saveData: boolean;
  /** How much of the track to draw. */
  detail: Detail;
  /** The pixel ratio range the canvas may use. */
  dpr: [number, number];
  /** A one-line reason, shown in the console and in the tests. */
  reason: string;
}

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    // The probe canvas is never added to the document, so the browser
    // collects it and its context with it. Asking for it to be lost would
    // print a context-lost message in some browsers, and this site asserts
    // that it prints no console errors at all.
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function saveDataEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (navigator as NavigatorWithHints).connection?.saveData === true;
}

/**
 * Guess the tier from what the device says about itself.
 *
 * Four cores or fewer, or four gigabytes of memory or fewer, means the low
 * tier: fewer instances, a lower pixel ratio and no motion.
 */
export function profileDevice(): DeviceProfile {
  const webgl = hasWebGL();
  const reducedMotion = prefersReducedMotion();
  const saveData = saveDataEnabled();

  if (!webgl) {
    return {
      webgl: false,
      reducedMotion,
      saveData,
      detail: 'low',
      dpr: [1, 1],
      reason: 'no WebGL: the poster scene and the Classic view',
    };
  }

  const nav = (typeof navigator === 'undefined' ? undefined : navigator) as
    | NavigatorWithHints
    | undefined;
  const cores = nav?.hardwareConcurrency ?? 0;
  const memory = nav?.deviceMemory ?? 0;

  const low = (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4);
  const detail: Detail = low ? 'low' : 'high';

  return {
    webgl,
    reducedMotion,
    saveData,
    detail,
    dpr: detail === 'low' ? [1, 1] : [1, 1.75],
    reason: low
      ? `low tier: ${cores || '?'} cores, ${memory || '?'} GB`
      : `full tier: ${cores || '?'} cores, ${memory || '?'} GB`,
  };
}
