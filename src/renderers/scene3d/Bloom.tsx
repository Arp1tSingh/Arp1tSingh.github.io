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
 * of the frame. Its beauty target is multisampled: without that, the glow
 * would quietly turn off the canvas's own antialiasing exactly when the
 * city's dark silhouettes need it most. The bloom and output passes run on
 * resolved, full-screen images, so only the first target pays for MSAA.
 */
export function Bloom({ strength = 0.34, radius = 0.45, threshold = 0.9 }: BloomProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const composer = useMemo(() => {
    // The default composer target has no samples. Give the beauty pass the
    // same 4x MSAA the canvas would have had, capped by the GPU.
    const samples = Math.min(4, gl.capabilities.samples || 0);
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples,
    });
    target.texture.name = 'Bloom.rt1';

    const instance = new EffectComposer(gl, target);
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
