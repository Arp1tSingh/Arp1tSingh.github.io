/**
 * The sky.
 *
 * Six keys take the ride from dawn at Dadar to night at Badlapur: dawn,
 * morning, noon, golden hour, dusk and night. The gradient is keyed to the
 * rendered route position, so the sky and the fog change together and the
 * city dissolves into the horizon instead of sitting on it.
 *
 * The sun sets, the moon rises and the stars fade in. All three are placed
 * in world directions from `celestial.ts` and only translated with the
 * camera, so they stay put while the train moves down the line.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { celestialAt, SKY_RADIUS, starDome } from './celestial';
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

  // A sub-LSB hash is enough to break the banding in the dark gradient.
  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    float height = normalize(vLocal).y;
    vec3 colour = mix(uHorizon, uMid, smoothstep(-0.08, 0.30, height));
    colour = mix(colour, uTop, smoothstep(0.24, 0.88, height));
    gl_FragColor = vec4(colour, 1.0);
    gl_FragColor.rgb += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
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

/** A little colour in the stars, so the dome is not a sheet of white dots. */
function starColours(count: number): Float32Array {
  const colours = new Float32Array(count * 3);
  let seed = 23;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let i = 0; i < count; i += 1) {
    const brightness = 0.45 + 0.55 * Math.pow(random(), 1.7);
    const tint = random();
    const r = tint < 0.16 ? 1 : tint > 0.9 ? 0.82 : 0.96;
    const g = tint < 0.16 ? 0.9 : tint > 0.9 ? 0.9 : 0.97;
    const b = tint < 0.16 ? 0.72 : 1;
    colours[i * 3] = brightness * r;
    colours[i * 3 + 1] = brightness * g;
    colours[i * 3 + 2] = brightness * b;
  }

  return colours;
}

/**
 * The sky.
 *
 * One inverted sphere, one shader, no texture. The sun, the moon and the
 * stars are placed from world directions every frame, so they are always in
 * front of the viewer and never left behind at the first station.
 */
export function Sky({ clock, stopCount }: SkyProps) {
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const sky = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.Mesh>(null);
  const moon = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Points>(null);

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(STAGES[0].top) },
      uMid: { value: new THREE.Color(STAGES[0].mid) },
      uHorizon: { value: new THREE.Color(STAGES[0].horizon) },
    }),
    [],
  );

  const sunGeometry = useMemo(() => new THREE.CircleGeometry(26, 48), []);
  const sunMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#fff2c0',
        fog: false,
        depthWrite: false,
        toneMapped: false,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const moonGeometry = useMemo(() => new THREE.CircleGeometry(18, 48), []);
  const moonMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#e8edff',
        fog: false,
        depthWrite: false,
        toneMapped: false,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const starGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const count = 1200;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(starDome(count), 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(starColours(count), 3));
    return geometry;
  }, []);
  const starMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#ffffff',
        size: 2.4,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      sunGeometry.dispose();
      sunMaterial.dispose();
      moonGeometry.dispose();
      moonMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
    },
    [sunGeometry, sunMaterial, moonGeometry, moonMaterial, starGeometry, starMaterial],
  );

  const offset = useRef(new THREE.Vector3());
  const sunColour = useMemo(() => new THREE.Color('#fff2c0'), []);
  const sunsetColour = useMemo(() => new THREE.Color('#ff9a55'), []);
  const moonColour = useMemo(() => new THREE.Color('#e8edff'), []);

  useFrame(() => {
    const progress = rideProgress(clock.current.s, stopCount);
    const colours = skyColours(progress);
    const state = celestialAt(progress);

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

    // The discs sit at a fixed bearing and distance, always facing the
    // viewer. Only the bearing comes from the sky clock.
    if (sun.current) {
      offset.current.copy(state.sun).multiplyScalar(SKY_RADIUS).add(camera.position);
      sun.current.position.copy(offset.current);
      sun.current.quaternion.copy(camera.quaternion);
      const low = 1 - Math.min(1, Math.max(0, state.sunElevation / 0.7));
      sun.current.scale.setScalar(1 + 0.22 * low);
      sunMaterial.color.copy(sunColour).lerp(sunsetColour, low);
      sunMaterial.opacity = state.sunOpacity;
    }

    if (moon.current) {
      offset.current.copy(state.moon).multiplyScalar(SKY_RADIUS).add(camera.position);
      moon.current.position.copy(offset.current);
      moon.current.quaternion.copy(camera.quaternion);
      moonMaterial.color.copy(moonColour);
      moonMaterial.opacity = state.moonOpacity;
    }

    if (stars.current) {
      stars.current.position.copy(camera.position);
      starMaterial.opacity = state.stars;
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

      <points
        ref={stars}
        geometry={starGeometry}
        material={starMaterial}
        renderOrder={-999}
        frustumCulled={false}
      />

      <mesh
        ref={sun}
        geometry={sunGeometry}
        material={sunMaterial}
        renderOrder={-998}
        frustumCulled={false}
      />

      <mesh
        ref={moon}
        geometry={moonGeometry}
        material={moonMaterial}
        renderOrder={-997}
        frustumCulled={false}
      />
    </>
  );
}
