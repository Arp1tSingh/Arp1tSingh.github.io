import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { boardLabelWorld, boardPanelWidth, BOARD_NAME_HEIGHT } from './StationKit';
import type { Stop } from '../../core/types';

export interface StationSignsProps {
  /** The stops on the line, in line order. */
  stops: Stop[];
}

/**
 * The station names.
 *
 * The board in the station kit is a blank panel on purpose: drawing text in
 * 3D means either a texture atlas per station or a mesh per letter. Instead
 * one small canvas texture is drawn per station and put on a single plane
 * that sits exactly on the board, which keeps the name crisp and keeps the
 * texture budget at about 400 KB for the whole line.
 *
 * The names are also in the DOM, in the station index, so a screen reader
 * never depends on the canvas.
 */

const SIGN_WIDTH = 256;
const SIGN_HEIGHT = 80;

/** Draw one station name into a canvas texture. */
export function makeSignTexture(name: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIGN_WIDTH;
  canvas.height = SIGN_HEIGHT;

  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#000016';
    context.fillRect(0, 0, SIGN_WIDTH, SIGN_HEIGHT);
    context.fillStyle = '#e4032e';
    context.fillRect(0, 0, SIGN_WIDTH, 6);
    context.fillStyle = '#f1f1f1';
    context.font = '700 34px "JetBrains Mono Variable", "JetBrains Mono", monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name.toUpperCase().slice(0, 18), SIGN_WIDTH / 2, SIGN_HEIGHT / 2 + 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * One sign per station, standing on the board.
 */
export function StationSigns({ stops }: StationSignsProps) {
  const textures = useMemo(
    () => stops.map((stop) => makeSignTexture(stop.station)),
    [stops],
  );

  useEffect(
    () => () => {
      for (const texture of textures) texture.dispose();
    },
    [textures],
  );

  return (
    <>
      {stops.map((stop, index) => {
        const [x, y, z] = boardLabelWorld(index, stop);
        return (
          <mesh key={stop.id} position={[x, y, z + 0.02]}>
            <planeGeometry args={[boardPanelWidth(stop) * 0.92, BOARD_NAME_HEIGHT * 0.92]} />
            <meshBasicMaterial map={textures[index]} toneMapped={false} />
          </mesh>
        );
      })}
    </>
  );
}
