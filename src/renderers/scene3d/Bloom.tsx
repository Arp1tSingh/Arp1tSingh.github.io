import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface BloomProps {
  /** How much the light blooms. */
  strength?: number;
  /** How far the glow spreads. */
  radius?: number;
  /**
   * Luminance above which a pixel blooms.
   *
   * High on purpose. The rails are the brightest mark on the ground and they
   * should not turn into a laser beam; only the train's window band, the
   * station lamps and the platform edges are meant to glow.
   */
  threshold?: number;
}

/**
 * Bloom.
 *
 * "One directional and one hemisphere light; bloom at night on the high tier
 * only." The glow is the train's window band, the platform edges and the
 * station lamps, and it only earns its cost after the sky has gone dark.
 *
 * The composer replaces R3F's own render loop, so the passes are in charge
 * of the frame. Three renders into a linear target without tone mapping, the
 * bloom pass works in linear light, and the output pass applies the tone map
 * and the colour space at the end - which is the order the renderer would
 * have used on its own, so nothing about the frame changes except the glow.
 */
export function Bloom({ strength = 0.34, radius = 0.45, threshold = 0.9 }: BloomProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const composer = useMemo(() => {
    const instance = new EffectComposer(gl);
    instance.addPass(new RenderPass(scene, camera));
    instance.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(size.width, size.height),
        strength,
        radius,
        threshold,
      ),
    );
    instance.addPass(new OutputPass());
    return instance;
  }, [gl, scene, camera, strength, radius, threshold, size.width, size.height]);

  useEffect(() => {
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
  }, [composer, size, dpr]);

  useEffect(() => () => composer.dispose(), [composer]);

  // A frame callback with a priority above zero takes the render over from
  // R3F's own loop.
  useFrame((_, delta) => {
    composer.render(delta);
  }, 1);

  return null;
}
