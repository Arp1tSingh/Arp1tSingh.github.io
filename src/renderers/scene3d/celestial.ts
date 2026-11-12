/**
 * The sun, the moon and the stars.
 *
 * The three are one small piece of astronomy, kept out of the renderer so it
 * can be tested without a canvas. The sun follows a single continuous arc:
 * it stands low over the line at Dadar, climbs through noon and is below the
 * horizon by Badlapur. The moon rises on the other side of the sky as the
 * sun goes down, and the stars are a fixed dome that fades in behind them.
 *
 * Every direction is a unit vector in world space. The discs are placed at
 * `camera.position + direction * SKY_RADIUS`, so their bearing never changes
 * with the camera: the journey moves the train, not the sky.
 */

import * as THREE from 'three';

/** How far the discs and the star dome sit from the camera. */
export const SKY_RADIUS = 560;

/** The sun is above the horizon between these two progress values. */
const SUN_RISE = -0.14;
const SUN_SET = 0.9;

/** How far the sun climbs at noon and how far it swings across the sky. */
const SUN_HEIGHT = 0.86;
const SUN_SWING = 0.7;
const SUN_START_AZIMUTH = -0.54;

/** The moon clears the horizon late and stays low enough to be in frame. */
const MOON_START = 0.8;
const MOON_END = 0.98;
const MOON_BASE_ELEVATION = -0.1;
const MOON_HEIGHT = 0.3;
const MOON_AZIMUTH = -0.34;
const MOON_SWING = 0.1;

/** The stars begin to show at dusk and reach full strength at the terminus. */
const STAR_START = 0.72;
const STAR_END = 1;

export interface CelestialState {
  /** Unit direction of the sun. */
  sun: THREE.Vector3;
  /** Unit direction of the moon. */
  moon: THREE.Vector3;
  /** Unit direction of whichever body is currently lighting the scene. */
  light: THREE.Vector3;
  sunElevation: number;
  moonElevation: number;
  /** How opaque the sun disc is, 0..1. */
  sunOpacity: number;
  /** How opaque the moon disc is, 0..1. */
  moonOpacity: number;
  /** How visible the stars are, 0..1. */
  stars: number;
  /** True once the moon is the brighter body. */
  moonlit: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** A smooth 0..1 ramp between two edges. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  const span = Math.max(0.0001, edge1 - edge0);
  const t = clamp01((value - edge0) / span);
  return t * t * (3 - 2 * t);
}

/**
 * Turn an azimuth and an elevation into a unit direction.
 *
 * Azimuth is measured in the ground plane from +X towards +Z, which is the
 * direction the train travels. Negative azimuths are the left-hand sky.
 */
function direction(azimuth: number, elevation: number, out: THREE.Vector3): THREE.Vector3 {
  const horizontal = Math.cos(elevation);
  return out.set(
    Math.cos(azimuth) * horizontal,
    Math.sin(elevation),
    Math.sin(azimuth) * horizontal,
  );
}

/** The sun's own clock: 0 at rise, 1 at set, beyond both outside the day. */
function sunTime(progress: number): number {
  return (progress - SUN_RISE) / (SUN_SET - SUN_RISE);
}

export function sunElevation(progress: number): number {
  return SUN_HEIGHT * Math.sin(Math.PI * sunTime(clamp01(progress)));
}

export function moonElevation(progress: number): number {
  const rise = smoothstep(MOON_START, MOON_END, clamp01(progress));
  return MOON_BASE_ELEVATION + MOON_HEIGHT * rise;
}

/** How visible the stars are at a point on the route. */
export function starVisibility(progress: number): number {
  return smoothstep(STAR_START, STAR_END, clamp01(progress));
}

/**
 * The whole sky at a point on the route.
 *
 * Returns fresh vectors. It is called twice a frame, which is two small
 * allocations, and it keeps the two renderers reading the same numbers
 * instead of each owning half of the sun path.
 */
export function celestialAt(progress: number): CelestialState {
  const p = clamp01(progress);

  const sunElevationValue = sunElevation(p);
  const moonElevationValue = moonElevation(p);

  const day = sunTime(p);
  const sunAzimuth = SUN_START_AZIMUTH + SUN_SWING * day;

  const moonRise = smoothstep(MOON_START, MOON_END, p);
  const moonAzimuth = MOON_AZIMUTH + MOON_SWING * moonRise;

  const sun = direction(sunAzimuth, sunElevationValue, new THREE.Vector3());
  const moon = direction(moonAzimuth, moonElevationValue, new THREE.Vector3());

  const moonlit = moonElevationValue > sunElevationValue;

  return {
    sun,
    moon,
    light: moonlit ? moon : sun,
    sunElevation: sunElevationValue,
    moonElevation: moonElevationValue,
    // The ground hides a body below the horizon; the fade only softens the
    // last degree so the disc does not pop out of the geometry.
    sunOpacity: smoothstep(-0.05, 0.01, sunElevationValue),
    moonOpacity: smoothstep(-0.03, 0.12, moonElevationValue),
    stars: starVisibility(p),
    moonlit,
  };
}

/**
 * A deterministic dome of stars, above the horizon and centred on the
 * camera. The golden-angle spiral keeps the spacing even, so the forward
 * view has as many stars as the side view.
 */
export function starDome(count = 1200, radius = SKY_RADIUS): Float32Array {
  const positions = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    // Uniform in height on the sphere, from just above the horizon to the
    // zenith. That is the same density per square degree everywhere.
    const y = 0.04 + 0.96 * (1 - (i + 0.5) / count);
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = i * golden;

    positions[i * 3] = Math.cos(angle) * ring * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(angle) * ring * radius;
  }

  return positions;
}
