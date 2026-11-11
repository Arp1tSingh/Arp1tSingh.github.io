import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import { CameraRig } from './CameraRig';
import { Diorama } from './Dioramas';
import { Poster } from './Poster';
import { Sky } from './Sky';
import { Station, zOnPlatform } from './StationKit';
import { StationSigns } from './StationSigns';
import { Track } from './Track';
import { Train } from './Train';
import { PLATFORM_HEIGHT, SCENE_COLORS, STATION_SPACING, FOG_NEAR, FOG_FAR, stationX } from './constants';
import { profileDevice, type Detail } from './tier';
import type { Stop } from '../../core/types';

export interface SceneProps {
  /** The stops on the current line, in line order. */
  stops: Stop[];
  /** The route position: a fractional stop index. */
  s: number;
  /** The index of the stop the train is at. */
  activeIndex: number;
  /** Journey progress, 0 to 1. */
  progress: number;
  reducedMotion: boolean;
  detail: Detail;
}

/**
 * The scene.
 *
 * One directional light and one hemisphere light. No shadows, no textures,
 * no post-processing. Everything else is geometry.
 */
export function Scene({ stops, s, activeIndex, progress, reducedMotion, detail }: SceneProps) {
  const trainX = s * STATION_SPACING;
  const dwelling = Number.isInteger(s);

  return (
    <>
      <fog attach="fog" args={['#3a2a4e', FOG_NEAR, FOG_FAR]} />
      <color attach="background" args={[SCENE_COLORS.navy]} />

      <hemisphereLight args={['#f1f1f1', '#0a0a22', 0.85]} />
      <directionalLight position={[40, 60, 30]} intensity={1.5} color="#f1f1f1" />

      {/*
        The ground. Without it the lower half of the frame is the sky
        sphere's underside, which turns the whole world the colour of the
        horizon.
      */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(stops.length * STATION_SPACING) / 2, -0.62, -50]}
      >
        <planeGeometry args={[stops.length * STATION_SPACING + 320, 460]} />
        <meshBasicMaterial color={SCENE_COLORS.navy} />
      </mesh>

      <Sky progress={progress} />
      <CameraRig s={s} reducedMotion={reducedMotion} />

      <Track stations={stops.length} detail={detail} />

      {stops.map((stop, index) => (
        <group key={stop.id} position={[stationX(index), 0, 0]}>
          <Station stop={stop} index={index} active={index === activeIndex && dwelling} />
          {/* The prop stands on the platform, clear of the bench and the board. */}
          <Diorama stop={stop} position={[-5, PLATFORM_HEIGHT, zOnPlatform(4.4)]} />
        </group>
      ))}

      <StationSigns stops={stops} />

      <group position={[trainX, 0, 0]}>
        <Train dwelling={dwelling} doorsOpen={dwelling} />
      </group>
    </>
  );
}

export interface Scene3DProps extends SceneProps {
  /** Stop rendering entirely. */
  paused: boolean;
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
export function Scene3D({ paused, onContextLost, ...scene }: Scene3DProps) {
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
      frameloop={paused || hidden ? 'never' : 'always'}
      gl={{
        antialias: profile.detail === 'high',
        powerPreference: profile.detail === 'high' ? 'high-performance' : 'low-power',
        alpha: false,
      }}
      camera={{ fov: 42, near: 0.5, far: 900, position: [-26, 13, 24] }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color(SCENE_COLORS.navy), 1);
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
