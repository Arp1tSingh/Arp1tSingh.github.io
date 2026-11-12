/**
 * The atmosphere.
 *
 * The lights, the ground and the fog are one grade, driven by the same ride
 * clock as the sky. At Dadar the world is warm and the hemisphere light is
 * strong; by Badlapur the sun is below the line and the moon carries what
 * light is left.
 */

import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { SCENE_COLORS, STATION_SPACING } from './constants';
import { celestialAt } from './celestial';
import { nightAmount, skyColours } from './Sky';
import { rideProgress } from './ride';

export interface AtmosphereProps {
  /** The rendered route position, written by the ride driver. */
  clock: MutableRefObject<{ s: number }>;
  /** How many stops are on the current line. */
  stopCount: number;
}

export function Atmosphere({ clock, stopCount }: AtmosphereProps) {
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const ground = useRef<THREE.Mesh>(null);

  const white = useRef(new THREE.Color('#ffffff'));
  const groundColour = useRef(new THREE.Color(SCENE_COLORS.ground));
  const span = Math.max(1, stopCount - 1) * STATION_SPACING;

  useFrame(() => {
    const progress = rideProgress(clock.current.s, stopCount);
    const night = nightAmount(progress);
    const colours = skyColours(progress);
    const celestial = celestialAt(progress);

    if (hemisphere.current) {
      hemisphere.current.intensity = 0.95 - 0.62 * night;
    }

    if (sun.current) {
      // A directional light's direction is `target - position`, so placing
      // it along the sun (or the risen moon) is all the alignment we need.
      sun.current.position.copy(celestial.light).multiplyScalar(120);
      sun.current.intensity = 1.15 * (1 - night) + 0.08;
      sun.current.color.copy(colours.horizon).lerp(white.current, 0.6);
    }

    if (ground.current) {
      const material = ground.current.material as THREE.MeshLambertMaterial;
      material.color
        .copy(groundColour.current)
        .lerp(colours.horizon, 0.2)
        .multiplyScalar(1 - 0.65 * night);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemisphere} args={['#ffffff', '#555a60', 0.95]} />
      <directionalLight
        ref={sun}
        position={[-60, 90, 40]}
        intensity={1.15}
        color="#ffffff"
      />

      {/*
        The ground. Without it the lower half of the frame is the sky
        sphere's underside, which turns the whole world the colour of the
        horizon.
      */}
      <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} position={[span / 2, -0.62, -220]}>
        <planeGeometry args={[span + 1600, 1800]} />
        <meshLambertMaterial color={SCENE_COLORS.ground} />
      </mesh>
    </>
  );
}
