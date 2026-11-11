/**
 * The camera.
 *
 * The camera rides behind the train on the track's own tangent, offset to
 * the right of the line. Because the line weaves, the camera swings through
 * the jogs instead of staring down a fixed axis. It looks further along the
 * line than the train has reached, so the next curve is always visible.
 *
 * Three rules hold:
 *
 *  - Position and look target are damped. A flick of the scroll does not
 *    throw the frame around.
 *  - The yaw rate is capped, so a sweep never becomes a whip.
 *  - The horizon stays level. There is no roll; only `lookAt` orients it.
 */

import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import {
  CAMERA_BACK,
  CAMERA_DAMPING,
  CAMERA_FOV,
  CAMERA_FOV_NARROW,
  CAMERA_HEIGHT,
  CAMERA_HEIGHT_NARROW,
  CAMERA_SIDE,
  CAMERA_SIDE_NARROW,
  LOOK_AHEAD,
  LOOK_HEIGHT,
  LOOK_SIDE,
  MAX_YAW_RATE,
} from './constants';
import { makePose, poseAt, routeDistance, type LinePath } from './path';

export interface CameraRigProps {
  /** The rendered route position, written by the ride driver. */
  clock: MutableRefObject<{ s: number }>;
  /** The current line. */
  line: LinePath;
  /** Cuts between stops instead of sweeping. */
  reducedMotion: boolean;
}

/**
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
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;

  const allowed = maxRate * Math.max(0, delta);
  const applied = Math.max(-allowed, Math.min(allowed, difference));
  return currentYaw + applied;
}

export function CameraRig({ clock, line, reducedMotion }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);

  const pose = useRef(makePose());
  const tangent = useRef(new THREE.Vector3(1, 0, 0));
  const position = useRef(new THREE.Vector3(-CAMERA_BACK, CAMERA_HEIGHT, CAMERA_SIDE));
  const look = useRef(new THREE.Vector3(LOOK_AHEAD, LOOK_HEIGHT, 0));
  const yaw = useRef(0);
  const initialised = useRef(false);

  const narrow = width < 720;
  const fov = narrow ? CAMERA_FOV_NARROW : CAMERA_FOV;

  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    if (Math.abs(perspective.fov - fov) < 0.01) return;
    perspective.fov = fov;
    perspective.updateProjectionMatrix();
  }, [camera, fov]);

  useFrame((_, delta) => {
    const s = clock.current.s;
    const distance = routeDistance(line.stations, s);
    poseAt(line, distance, pose.current);
    const point = pose.current.p;
    const forward = pose.current.t;

    const dt = Math.min(delta, 0.1);
    const ease = reducedMotion ? 1 : 1 - Math.exp(-CAMERA_DAMPING * dt);

    if (!initialised.current || reducedMotion) {
      tangent.current.copy(forward);
    } else {
      tangent.current.lerp(forward, 1 - Math.exp(-4 * dt)).normalize();
    }
    const t = tangent.current;
    const right = new THREE.Vector3(-t.z, 0, t.x);
    const side = narrow ? CAMERA_SIDE_NARROW : CAMERA_SIDE;
    const height = narrow ? CAMERA_HEIGHT_NARROW : CAMERA_HEIGHT;

    const wantedPosition = new THREE.Vector3()
      .copy(point)
      .addScaledVector(t, -CAMERA_BACK)
      .addScaledVector(right, side);
    wantedPosition.y = height;

    const wantedLook = new THREE.Vector3()
      .copy(point)
      .addScaledVector(t, LOOK_AHEAD)
      .addScaledVector(right, narrow ? 0 : LOOK_SIDE);
    wantedLook.y = narrow ? -2 : LOOK_HEIGHT;

    if (!initialised.current) {
      position.current.copy(wantedPosition);
      look.current.copy(wantedLook);
      yaw.current = Math.atan2(
        wantedLook.x - wantedPosition.x,
        wantedLook.z - wantedPosition.z,
      );
      initialised.current = true;
    } else {
      position.current.lerp(wantedPosition, ease);
      look.current.lerp(wantedLook, ease);
    }

    camera.position.copy(position.current);

    const direction = new THREE.Vector3().subVectors(look.current, camera.position);
    const targetYaw = Math.atan2(direction.x, direction.z);
    yaw.current = reducedMotion
      ? targetYaw
      : clampYaw(yaw.current, targetYaw, MAX_YAW_RATE, dt);

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
