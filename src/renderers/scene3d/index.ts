/**
 * The 3D line.
 *
 * One of the three renderers of the same dataset. It owns the canvas and
 * nothing else: the content, the route and the pacing all come from the
 * core, and the scene reads them without copying a value.
 */

import './scene3d.css';

export { Scene, Scene3D, useDocumentHidden } from './Scene';
export type { SceneProps, Scene3DProps } from './Scene';
export { Poster } from './Poster';
export { Track, buildTrack } from './Track';
export type { TrackProps } from './Track';
export { Train, buildTrain } from './Train';
export type { TrainProps } from './Train';
export { Station, buildStation } from './StationKit';
export type { StationProps } from './StationKit';
export { Diorama, buildDiorama } from './Dioramas';
export type { DioramaProps } from './Dioramas';
export { profileDevice, prefersReducedMotion, saveDataEnabled } from './tier';
export type { Detail, DeviceProfile } from './tier';
export * from './constants';
