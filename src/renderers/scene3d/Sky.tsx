/**
 * The sky.
 *
 * Six keys take the ride from dawn at Dadar to night at Badlapur: dawn,
 * morning, noon, golden hour, dusk and night. The gradient is keyed to the
 * rendered route position, so the sky and the fog change together and the
 * city dissolves into the horizon instead of sitting on it.
 *
 * The sun and the stars are camera-relative, the way they are in the
 * concept: they follow the viewer down the line rather than standing still
 * at the first station.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { rideProgress } from './ride';

export interface SkyProps {
  /** The rendered route position, written by the ride driver. */
  clock: MutableRefObject<{ s: number }>;
  /** How many stops are on the current line. */
  stopCount: number;
}

/**
 * The six keys of the day.
 *
 * `horizon` is the concept's own colour. `mid` and `top` are the same hue
 * lifted or deepened, so the sky has a gradient without inventing a second
 * palette.
 */
const STAGES = [
  { at: 0, top: '#4a5f97', mid: '#c78a7a', horizon: '#f2a36b' },
  { at: 0.18, top: '#4f9fdc', mid: '#8fc3ef', horizon: '#d6eaf7' },
  { at: 0.5, top: '#2f7bc4', mid: '#6fb0ea', horizon: '#b9dcf5' },
  { at: 0.72, top: '#6b6aa5', mid: '#d99a6b', horizon: '#f0b45e' },
  { at: 0.86, top: '#2b2458', mid: '#6a4f95', horizon: '#d98a63' },
  { at: 1, top: '#050814', mid: '#080c1c', horizon: '#151a2e' },
] as const;

const vertexShader = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vLocal;
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;

  void main() {
    float height = normalize(vLocal).y;
    vec3 colour = mix(uHorizon, uMid, smoothstep(-0.08, 0.30, height));
    colour = mix(colour, uTop, smoothstep(0.24, 0.88, height));
    gl_FragColor = vec4(colour, 1.0);
    #include <colorspace_fragment>
  }
`;

/** How dark the ride is: 0 by day, 1 at the last stop. */
export function nightAmount(progress: number): number {
  const t = Math.min(1, Math.max(0, (progress - 0.7) / 0.25));
  return t * t * (3 - 2 * t);
}

/** The three colours of the sky at a given progress. */
export function skyColours(progress: number): {
  top: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
} {
  const clamped = Math.min(1, Math.max(0, progress));
  let index = 0;
  while (index < STAGES.length - 2 && clamped > STAGES[index + 1].at) index += 1;

  const from = STAGES[index];
  const to = STAGES[index + 1];
  const span = Math.max(0.0001, to.at - from.at);
  const t = Math.min(1, Math.max(0, (clamped - from.at) / span));
  return {
    top: new THREE.Color(from.top).lerp(new THREE.Color(to.top), t),
    mid: new THREE.Color(from.mid).lerp(new THREE.Color(to.mid), t),
    horizon: new THREE.Color(from.horizon).lerp(new THREE.Color(to.horizon), t),
  };
}

/** The deterministic star field, in camera-local space. */
function starField(count = 350): Float32Array {
  const positions = new Float32Array(count * 3);
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (random() - 0.5) * 1500;
    positions[i * 3 + 1] = 60 + random() * 640;
    positions[i * 3 + 2] = -880;
  }
  return positions;
}

/**
 * The sky.
 *
 * One inverted sphere, one shader, no texture. The sun and the stars are
 * placed in world space from the camera every frame, so they are always in
 * front of the viewer and never left behind at the first station.
 */
export function Sky({ clock, stopCount }: SkyProps) {
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const sky = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Points>(null);

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(STAGES[0].top) },
      uMid: { value: new THREE.Color(STAGES[0].mid) },
      uHorizon: { value: new THREE.Color(STAGES[0].horizon) },
    }),
    [],
  );

  const sunGeometry = useMemo(() => new THREE.CircleGeometry(26, 32), []);
  const sunMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#fff2c0',
        fog: false,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const starGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(starField(), 3));
    return geometry;
  }, []);
  const starMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#ffffff',
        size: 2.4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      sunGeometry.dispose();
      sunMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
    },
    [sunGeometry, sunMaterial, starGeometry, starMaterial],
  );

  const offset = useRef(new THREE.Vector3());
  const sunColour = useMemo(() => new THREE.Color('#fff2c0'), []);
  const moonColour = useMemo(() => new THREE.Color('#dfe6ff'), []);

  useFrame(() => {
    const progress = rideProgress(clock.current.s, stopCount);
    const colours = skyColours(progress);
    const night = nightAmount(progress);

    uniforms.uTop.value.copy(colours.top);
    uniforms.uMid.value.copy(colours.mid);
    uniforms.uHorizon.value.copy(colours.horizon);

    // The fog is the horizon, so the city behind dissolves into the sky
    // rather than sitting on top of it.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(colours.horizon);
    }
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(colours.horizon);
    }

    // The sphere is a backdrop, not a place: it travels with the camera.
    if (sky.current) sky.current.position.copy(camera.position);

    // The sun arcs over the day and turns into the moon at night. The
    // numbers are the concept's own path, unchanged.
    if (sun.current) {
      const u = progress / 0.82;
      offset.current.set(
        u < 1 ? 420 - 840 * u : -260,
        u < 1 ? 150 + 190 * Math.sin(u * Math.PI) : 250,
        -700,
      );
      offset.current.applyQuaternion(camera.quaternion).add(camera.position);
      sun.current.position.copy(offset.current);
      sun.current.quaternion.copy(camera.quaternion);
      sun.current.scale.setScalar(1 - 0.4 * night);
      sunMaterial.color.copy(sunColour).lerp(moonColour, night);
    }

    if (stars.current) {
      stars.current.position.copy(camera.position);
      starMaterial.opacity = night;
    }
  });

  return (
    <>
      <mesh ref={sky} renderOrder={-1000} frustumCulled={false}>
        <sphereGeometry args={[600, 32, 16]} />
        <shaderMaterial
          args={[
            {
              uniforms,
              vertexShader,
              fragmentShader,
              depthWrite: false,
              side: THREE.BackSide,
              fog: false,
            },
          ]}
        />
      </mesh>

      <mesh
        ref={sun}
        geometry={sunGeometry}
        material={sunMaterial}
        renderOrder={-999}
        frustumCulled={false}
      />

      <points
        ref={stars}
        geometry={starGeometry}
        material={starMaterial}
        renderOrder={-998}
        frustumCulled={false}
      />
    </>
  );
}
