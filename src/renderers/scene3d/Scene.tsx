import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import { Atmosphere } from './Atmosphere';
import { CameraRig } from './CameraRig';
import { Bloom } from './Bloom';
import { Diorama } from './Dioramas';
import { Poster } from './Poster';
import { RideDriver, type RideClockValue } from './RideDriver';
import { Sky } from './Sky';
import { Station, zOnPlatform } from './StationKit';
import { StationSigns } from './StationSigns';
import { Track } from './Track';
import { Train } from './Train';
import {
  CAMERA_FOV,
  FOG_FAR,
  FOG_NEAR,
  PLATFORM_HEIGHT,
  SCENE_COLORS,
  stationAnchor,
} from './constants';
import { buildLine } from './path';
import { profileDevice, type Detail } from './tier';
import type { Position } from '../../core/pacing';
import type { Stop } from '../../core/types';

export interface SceneProps {
  /** The stops on the current line, in line order. */
  stops: Stop[];
  /** The live scroll target. The scene reads it without re-rendering. */
  targetSRef: MutableRefObject<Position | null>;
  /** The index of the stop the train is at. */
  activeIndex: number;
  /** The train is holding at a platform. */
  dwelling: boolean;
  /** The far end of the journey. Gates the expensive bloom pass. */
  night: boolean;
  reducedMotion: boolean;
  detail: Detail;
}

/**
 * The scene.
 *
 * One directional light and one hemisphere light. No shadows, no textures,
 * no post-processing by day. Everything else is geometry.
 */
export function Scene({
  stops,
  targetSRef,
  activeIndex,
  dwelling,
  night,
  reducedMotion,
  detail,
}: SceneProps) {
  const clock = useRef<RideClockValue>({ s: 0 });
  const line = useMemo(() => buildLine(stops.length), [stops.length]);

  return (
    <>
      <fog attach="fog" args={['#f2a36b', FOG_NEAR, FOG_FAR]} />
      <color attach="background" args={[SCENE_COLORS.ink]} />

      <Atmosphere clock={clock} stopCount={stops.length} />

      <RideDriver
        clock={clock}
        targetSRef={targetSRef}
        stopCount={stops.length}
        reducedMotion={reducedMotion}
      />
      <Sky clock={clock} stopCount={stops.length} />
      <CameraRig clock={clock} line={line} reducedMotion={reducedMotion} />

      {/* Bloom is the high tier's job and only pays off after dark. */}
      {detail === 'high' && night ? <Bloom /> : null}

      <Track stations={stops.length} detail={detail} />

      {stops.map((stop, index) => {
        const anchor = stationAnchor(index);
        return (
          <group key={stop.id} position={[anchor.x, 0, anchor.z]}>
            <Station stop={stop} index={index} line={line} active={index === activeIndex && dwelling} />
            {/* The prop stands on the platform, clear of the bench and the board. */}
            <Diorama stop={stop} position={[-5, PLATFORM_HEIGHT, zOnPlatform(4.4)]} />
          </group>
        );
      })}

      <StationSigns stops={stops} />

      <Train line={line} clock={clock} dwelling={dwelling} />
    </>
  );
}

export interface Scene3DProps extends SceneProps {
  /** Stop rendering entirely. */
  paused: boolean;
  /**
   * Draw one frame and wait.
   *
   * At the gate the train is standing still and nothing in the scene moves, so
   * rendering sixty frames a second tells the visitor nothing and costs the
   * main thread. The scene wakes up when the ride starts.
   */
  still: boolean;
  /** The WebGL context was lost and cannot be restored. */
  onContextLost(): void;
}

/**
 * The 3D renderer.
 *
 * It owns the canvas and nothing else. If the device cannot run WebGL it
 * renders the poster scene instead, and if the context is lost the poster
 * takes over as well, so there is never a blank rectangle where the line
 * should be.
 */
export function Scene3D({ paused, still, onContextLost, ...scene }: Scene3DProps) {
  const profile = useMemo(() => profileDevice(), []);
  const [lost, setLost] = useState(false);
  const hidden = useDocumentHidden();

  useEffect(() => {
    if (lost) onContextLost();
  }, [lost, onContextLost]);

  if (!profile.webgl || lost) {
    return <Poster reason={profile.reason} />;
  }

  return (
    <Canvas
      className="scene3d__canvas"
      dpr={profile.dpr}
      frameloop={paused || hidden ? 'never' : still ? 'demand' : 'always'}
      gl={{
        // MSAA on both tiers. The low tier saves its budget on instances and
        // pixel ratio, not on the stair-stepped city edges.
        antialias: true,
        powerPreference: profile.detail === 'high' ? 'high-performance' : 'low-power',
        alpha: false,
      }}
      camera={{ fov: CAMERA_FOV, near: 0.5, far: 1600, position: [-22, 8.5, 11] }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color(SCENE_COLORS.ink), 1);
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          // Without this the browser does not try to restore the context.
          event.preventDefault();
          setLost(true);
        });
      }}
      onError={() => setLost(true)}
    >
      <Scene {...scene} />
    </Canvas>
  );
}

/**
 * Stop rendering when the tab is hidden.
 *
 * A canvas that nobody is looking at is a battery being spent for nothing.
 */
export function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(
    typeof document !== 'undefined' ? document.hidden : false,
  );

  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return hidden;
}
