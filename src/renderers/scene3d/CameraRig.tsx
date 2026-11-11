import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import {
  CAMERA_BACK,
  CAMERA_DAMPING,
  CAMERA_HEIGHT,
  CAMERA_SIDE,
  LOOK_APPROACH_RANGE,
  LOOK_AHEAD,
  LOOK_HEIGHT,
  MAX_YAW_RATE,
  STATION_SPACING,
} from './constants';

export interface CameraRigProps {
  /** The route position: a fractional stop index. */
  s: number;
  /** Cuts between stops instead of sweeping. */
  reducedMotion: boolean;
}

/**
 * The camera.
 *
 * Three rules from the blueprint, and they are the whole of this file:
 *
 *  - The camera eases behind the train rather than being rigidly attached
 *    to it, so a flick of the scroll does not throw the frame around.
 *  - Its angular velocity is capped, so a sweep towards the next station
 *    never exceeds a gentle turn rate.
 *  - The horizon stays level. There is no roll, ever: the camera's up vector
 *    is never touched, and `lookAt` is the only orientation it ever gets.
 */

/**
 * The turn-rate cap, as a pure function so it can be tested.
 *
 * The result is the yaw the camera is allowed to reach this frame. It never
 * moves further than `maxRate` radians per second from where it was, and it
 * always takes the shorter way round.
 */
export function clampYaw(
  currentYaw: number,
  targetYaw: number,
  maxRate: number,
  delta: number,
): number {
  let difference = targetYaw - currentYaw;
  // Always turn the short way round.
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;

  const allowed = maxRate * Math.max(0, delta);
  const applied = Math.max(-allowed, Math.min(allowed, difference));
  return currentYaw + applied;
}
export function CameraRig({ s, reducedMotion }: CameraRigProps) {
  const camera = useThree((state) => state.camera);

  const position = useRef(new THREE.Vector3(-CAMERA_BACK, CAMERA_HEIGHT, CAMERA_SIDE));
  const look = useRef(new THREE.Vector3(LOOK_AHEAD, LOOK_HEIGHT, 0));
  const yaw = useRef(0);
  const initialised = useRef(false);

  useFrame((_, delta) => {
    const trainX = s * STATION_SPACING;

    // Where the camera wants to be, and where it wants to look.
    const wantedPosition = new THREE.Vector3(
      trainX - CAMERA_BACK,
      CAMERA_HEIGHT,
      CAMERA_SIDE,
    );

    // As the train nears a station the camera turns towards the board, so
    // the sign is readable before the train has stopped. This is the only
    // thing in the scene that rotates, and it is what the cap protects.
    const nextIndex = Math.ceil(s + 0.08);
    const nextX = nextIndex * STATION_SPACING;
    const distance = Math.abs(nextX - trainX);
    const proximity = 1 - Math.min(1, distance / LOOK_APPROACH_RANGE);
    const lookX = trainX + LOOK_AHEAD + (nextX - trainX - LOOK_AHEAD) * proximity * 0.75;
    const wantedLook = new THREE.Vector3(lookX, LOOK_HEIGHT, 0);

    if (reducedMotion) {
      // Cuts, not sweeps. The frame changes when the station changes.
      const index = Math.round(s);
      const x = index * STATION_SPACING;
      camera.position.set(x - CAMERA_BACK, CAMERA_HEIGHT, CAMERA_SIDE);
      camera.lookAt(x + LOOK_AHEAD, LOOK_HEIGHT, 0);
      position.current.copy(camera.position);
      look.current.set(x + LOOK_AHEAD, LOOK_HEIGHT, 0);
      yaw.current = 0;
      initialised.current = true;
      return;
    }

    if (!initialised.current) {
      position.current.copy(wantedPosition);
      look.current.copy(wantedLook);
      initialised.current = true;
    }

    // Ease behind the train: a frame-rate independent damp, not a fixed
    // fraction of the remaining distance.
    const ease = 1 - Math.exp(-CAMERA_DAMPING * Math.min(delta, 0.1));
    position.current.lerp(wantedPosition, ease);
    look.current.lerp(wantedLook, ease);

    camera.position.copy(position.current);

    // Cap the turn rate.
    const direction = new THREE.Vector3().subVectors(look.current, camera.position);
    const targetYaw = Math.atan2(direction.x, direction.z);
    yaw.current = clampYaw(yaw.current, targetYaw, MAX_YAW_RATE, Math.min(delta, 0.1));

    // Rebuild the look target at the clamped angle, so the cap actually
    // holds the frame instead of only being recorded.
    const distanceToLook = look.current.distanceTo(camera.position);
    const clampedLook = new THREE.Vector3(
      camera.position.x + Math.sin(yaw.current) * distanceToLook,
      look.current.y,
      camera.position.z + Math.cos(yaw.current) * distanceToLook,
    );
    look.current.copy(clampedLook);

    camera.lookAt(look.current);
  });

  return null;
}
