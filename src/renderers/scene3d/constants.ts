/**
 * The world.
 *
 * The track runs along the X axis and the first station is at the origin.
 * The train's position is the route position times the spacing, so the
 * position the pacing function produces and the place the train stands are
 * the same number. There is no second clock and no second piece of state.
 */

/** World units between two stations. */
export const STATION_SPACING = 44;

/** The rail head. Everything sits on top of this. */
export const TRACK_Y = 0;

/** How tall the platform is. */
export const PLATFORM_HEIGHT = 1.1;

/** How far apart the two rails are. */
export const RAIL_GAUGE = 2.4;

/** How long the whole train is, three cars and two couplings. */
export const TRAIN_LENGTH = 16;

/** How far the platform slab runs along the track. */
export const PLATFORM_LENGTH = 22;

/** Where the camera sits, relative to the train. */
export const CAMERA_BACK = 28;
export const CAMERA_SIDE = 24;
export const CAMERA_HEIGHT = 12;

/** How far ahead of the train the camera looks. */
export const LOOK_AHEAD = 6;
export const LOOK_HEIGHT = 3;

/**
 * The maximum turn rate of the camera, in radians per second.
 *
 * A diagonal sweep must never feel like a whip. The camera may look towards
 * the station it is approaching, but it turns at no more than this rate.
 */
export const MAX_YAW_RATE = 0.7;

/** How quickly the camera catches up with the train. */
export const CAMERA_DAMPING = 3.4;

/** How many stations the camera starts looking ahead for. */
export const LOOK_APPROACH_RANGE = 34;

/** The fog: the city dissolves into the horizon rather than sitting on it. */
export const FOG_NEAR = 90;
export const FOG_FAR = 380;

export function stationX(index: number): number {
  return index * STATION_SPACING;
}

/**
 * The six colours the whole site uses. The scene has no others: no textures,
 * no environment map, no physical materials.
 */
export const SCENE_COLORS = {
  navy: '#000016',
  navyRaise: '#080820',
  navyPanel: '#0c0c26',
  paper: '#f1f1f1',
  grey: '#9797a5',
  greyDim: '#6b6b78',
  red: '#e4032e',
} as const;
