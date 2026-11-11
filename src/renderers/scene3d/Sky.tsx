import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { SCENE_COLORS } from './constants';

export interface SkyProps {
  /** Journey progress, 0 to 1. */
  progress: number;
}

/**
 * The four stages of the sky, from dawn to night.
 *
 * These are the same four the stylesheet uses for the page, so the scene and
 * the document change together.
 */
const STAGES = [
  { top: '#0a0a33', mid: '#3a2438', horizon: '#8a3a24' },
  { top: '#000016', mid: '#16163f', horizon: '#3a2a4e' },
  { top: '#05052a', mid: '#2a1a3e', horizon: '#6a2434' },
  { top: '#020210', mid: '#080820', horizon: '#141432' },
] as const;

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vWorld;
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;

  void main() {
    float height = normalize(vWorld).y;
    vec3 colour = mix(uHorizon, uMid, smoothstep(-0.08, 0.30, height));
    colour = mix(colour, uTop, smoothstep(0.24, 0.88, height));
    gl_FragColor = vec4(colour, 1.0);
    #include <colorspace_fragment>
  }
`;

function mixHex(a: string, b: string, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

/** The three colours of the sky at a given progress. */
export function skyColours(progress: number): {
  top: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
} {
  const clamped = Math.min(1, Math.max(0, progress));
  const scaled = clamped * (STAGES.length - 1);
  const index = Math.min(STAGES.length - 2, Math.floor(scaled));
  const t = scaled - index;
  const from = STAGES[index];
  const to = STAGES[index + 1];
  return {
    top: mixHex(from.top, to.top, t),
    mid: mixHex(from.mid, to.mid, t),
    horizon: mixHex(from.horizon, to.horizon, t),
  };
}

/**
 * The sky.
 *
 * One inverted sphere, one shader, no texture. The gradient is keyed to the
 * journey progress, so the sky runs from dawn to night across the ride, and
 * the fog is set to the horizon colour so the city dissolves into it.
 */
export function Sky({ progress }: SkyProps) {
  const scene = useThree((state) => state.scene);
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(STAGES[0].top) },
      uMid: { value: new THREE.Color(STAGES[0].mid) },
      uHorizon: { value: new THREE.Color(STAGES[0].horizon) },
    }),
    [],
  );

  useFrame(() => {
    const colours = skyColours(progress);
    uniforms.uTop.value.copy(colours.top);
    uniforms.uMid.value.copy(colours.mid);
    uniforms.uHorizon.value.copy(colours.horizon);

    // The fog is the horizon, so the city behind dissolves into the sky
    // rather than sitting on top of it.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(colours.horizon);
    }
  });

  return (
    <mesh scale={[-1, 1, 1]} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[600, 32, 16]} />
      <shaderMaterial
        ref={material}
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
  );
}

/** The colour of the sky at its horizon, used by the poster and the fog. */
export const HORIZON_FALLBACK = new THREE.Color(STAGES[0].horizon);

/** The deepest navy in the system, reused by the scene background. */
export const BACKGROUND = new THREE.Color(SCENE_COLORS.navy);
