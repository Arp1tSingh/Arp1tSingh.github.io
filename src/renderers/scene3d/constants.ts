/**
 * The world.
 *
 * Forward is +X, lateral is Z, and the first station sits at the origin.
 * The line weaves between two lanes so the camera has something to follow:
 * station k stands at `(k * STATION_SPACING, lane(k))`, with a straight run
 * through the platform and a smoothed jog between stations.
 */

/** World units between two station centres along the line. */
export const STATION_SPACING = 84;

/** How far the line swings either side of the centreline. */
export const LANE = 15;

/** The straight run through each platform: +/- this around the centre. */
export const STRAIGHT_HALF = 26;

/** How far the track runs behind the first station and past the last. */
export const LEAD_IN = 70;
export const LEAD_OUT = 100;

/** The rail head. Everything sits on top of this. */
export const TRACK_Y = 0;

/** How tall the platform is. */
export const PLATFORM_HEIGHT = 1.1;

/** How far apart the two rails are. */
export const RAIL_GAUGE = 1.6;

/** How long the whole train is, three cars and two couplings. */
export const TRAIN_LENGTH = 26;

/** How far the platform slab runs along the track. */
export const PLATFORM_LENGTH = 46;

/** Where the camera sits, relative to the train. */
export const CAMERA_BACK = 22;
export const CAMERA_SIDE = 11;
export const CAMERA_HEIGHT = 8.5;
export const CAMERA_SIDE_NARROW = 7;
export const CAMERA_HEIGHT_NARROW = 10;

/** How far ahead of the train the camera looks. */
export const LOOK_AHEAD = 36;
export const LOOK_SIDE = 6;
export const LOOK_HEIGHT = 1;

/** The vertical field of view, wide on a phone. */
export const CAMERA_FOV = 55;
export const CAMERA_FOV_NARROW = 68;

/**
 * The maximum turn rate of the camera, in radians per second.
 *
 * A diagonal sweep must never feel like a whip. The camera may look towards
 * the station it is approaching, but it turns at no more than this rate.
 */
export const MAX_YAW_RATE = 0.7;

/** How quickly the camera catches up with the train. */
export const CAMERA_DAMPING = 5;

/** The fog: the city dissolves into the horizon rather than sitting on it. */
export const FOG_NEAR = 100;
export const FOG_FAR = 520;

/** The X coordinate of a station. */
export function stationX(index: number): number {
  return index * STATION_SPACING;
}

/** The lane a station sits in, alternating down the line. */
export function laneAt(index: number): number {
  return index % 2 === 0 ? -LANE : LANE;
}

/** The station's anchor in the XZ plane. */
export function stationAnchor(index: number): { x: number; z: number } {
  return { x: stationX(index), z: laneAt(index) };
}

/**
 * The concept palette, shared by the canvas and the document.
 *
 * These are the only colours in the scene. No textures, no environment map,
 * no physical materials.
 */
export const SCENE_COLORS = {
  ink: '#101216',
  inkRaise: '#1b1f28',
  inkPanel: '#252a33',
  paper: '#fdf3d0',
  board: '#ffc52e',
  red: '#d92d3a',
  silver: '#e6e9ee',
  blue: '#1f4fb0',
  grey: '#8a9099',
  greyDim: '#5f5a4e',
  canopy: '#d8d2c2',
  ballast: '#4d4a46',
  rail: '#c3c9d1',
  sleeper: '#2d2a28',
  ground: '#4b4f55',
  lamp: '#fff2c0',
  headlight: '#fff0c8',
  window: '#22345a',
} as const;
