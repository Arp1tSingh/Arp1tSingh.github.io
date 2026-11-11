/**
 * The diorama props.
 *
 * One small object per stop, standing on the platform beside the station:
 * the thing you would find on the desk of that project, shrunk to a
 * silhouette. It has to be readable before the name is, so every prop is
 * one shape with one detail that says what it is: the red lamp on the
 * signal mast, the paper coming off the roll, the spiral down the side of
 * the notebook.
 *
 * Three rules hold this file together.
 *
 *   1. The content chooses the prop. `stop.prop` picks the builder, and a
 *      prop nobody has heard of renders nothing at all. A placeholder box
 *      on the platform is worse than an empty platform.
 *   2. Flat colour, five colours, no textures. The solid body of a prop is
 *      one merged mesh with the colour baked into the vertices; the parts
 *      that glow are a second mesh with an emissive material.
 *   3. Two draw calls and three thousand triangles, per prop. Parts that
 *      share a colour are merged with `mergeGeometries`, so a prop costs
 *      one draw call for its body and one for its light.
 *
 * The group a builder returns has its origin on the ground: the prop
 * stands on the platform, it does not float above it and it does not sink
 * into it.
 */

import { useEffect, useMemo } from 'react';
import type { JSX } from 'react';

import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { Stop } from '../../core/types';

/* ------------------------------------------------------------------ *
 * The palette
 *
 * The same five tokens the rest of the site uses, and nothing else. A
 * prop is drawn in the scene, not painted.
 * ------------------------------------------------------------------ */

const PALETTE = {
  navy: '#101216',
  navyRaise: '#1c2027',
  paper: '#fdf3d0',
  grey: '#b9b2a2',
  red: '#d92d3a',
} as const;

/* ------------------------------------------------------------------ *
 * Geometry helpers
 * ------------------------------------------------------------------ */

/** One part of a prop: a piece of geometry and the flat colour it wears. */
interface Piece {
  geometry: THREE.BufferGeometry;
  color: string;
}

/**
 * Paints every vertex of a geometry one flat colour.
 *
 * The colour is baked into the vertices rather than set on the material so
 * that a whole prop, in five different colours, can still be one mesh and
 * one draw call.
 */
function paint(geometry: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  if (geometry.getAttribute('color')) return geometry;
  const value = new THREE.Color(color);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = value.r;
    colors[index * 3 + 1] = value.g;
    colors[index * 3 + 2] = value.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Puts a piece of geometry where it belongs.
 *
 * The rotation happens about the geometry's own centre, then the geometry
 * is moved to `position`. `offset` is a place in the rotated frame, so a
 * part of a tilted assembly can be positioned against the rest of it.
 */
function frame(
  geometry: THREE.BufferGeometry,
  position: [number, number, number],
  rotation?: [number, number, number],
  offset?: [number, number, number],
): THREE.BufferGeometry {
  const matrix = new THREE.Matrix4();
  if (rotation) {
    matrix.makeRotationFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]));
    geometry.applyMatrix4(matrix);
  }
  const shift = new THREE.Vector3(offset ? offset[0] : 0, offset ? offset[1] : 0, offset ? offset[2] : 0);
  if (rotation) shift.applyMatrix4(matrix);
  geometry.translate(position[0] + shift.x, position[1] + shift.y, position[2] + shift.z);
  return geometry;
}

/**
 * A thin bar between two points.
 *
 * A beam of light, an arm, a spoke: anything that is really a line with a
 * thickness. The bar is built along its own length and then turned to
 * point at the second point.
 */
function bar(
  from: [number, number, number],
  to: [number, number, number],
  thickness: number,
): THREE.BufferGeometry {
  const start = new THREE.Vector3(from[0], from[1], from[2]);
  const end = new THREE.Vector3(to[0], to[1], to[2]);
  const direction = end.clone().sub(start);
  const geometry = new THREE.BoxGeometry(thickness, thickness, direction.length());
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction.clone().normalize(),
  );
  geometry.applyQuaternion(quaternion);
  geometry.translate(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2,
  );
  return geometry;
}

/**
 * A strip that follows a curve.
 *
 * The tape of a ticker and the sheet of a receipt are the same object: a
 * ribbon that bends. Building it as a strip of quads along the curve
 * costs two triangles a step and lets the curve be as loose as it likes.
 *
 * `across` is the direction the ribbon is wide in. The width is projected
 * onto the curve so the ribbon never twists.
 */
function ribbon(
  points: THREE.Vector3[],
  width: number,
  across: THREE.Vector3,
  colors?: string[],
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const half = width / 2;
  const side = across.clone().normalize();

  points.forEach((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const tangent = after.clone().sub(before);
    if (tangent.lengthSq() < 1e-8) tangent.set(0, 1, 0);
    tangent.normalize();
    const width3 = side.clone().addScaledVector(tangent, -side.dot(tangent));
    if (width3.lengthSq() < 1e-8) width3.set(1, 0, 0);
    width3.normalize().multiplyScalar(half);

    positions.push(point.x + width3.x, point.y + width3.y, point.z + width3.z);
    positions.push(point.x - width3.x, point.y - width3.y, point.z - width3.z);
    const along = index / Math.max(1, points.length - 1);
    uvs.push(along, 0, along, 1);

    if (index < points.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  if (colors) {
    const count = geometry.getAttribute('position').count;
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const step = Math.floor(index / 2);
      const value = new THREE.Color(colors[Math.min(step, colors.length - 1)]);
      values[index * 3] = value.r;
      values[index * 3 + 1] = value.g;
      values[index * 3 + 2] = value.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  }

  return geometry;
}

/** Smooths a handful of control points into a curve of `steps` points. */
function curve(control: [number, number, number][], steps: number): THREE.Vector3[] {
  const path = new THREE.CatmullRomCurve3(
    control.map((point) => new THREE.Vector3(point[0], point[1], point[2])),
    false,
    'catmullrom',
    0.5,
  );
  return path.getPoints(steps);
}

/**
 * Merges the parts of a prop into one geometry.
 *
 * Everything that shares a mesh shares a vertex colour, so the whole
 * solid body of a prop is one buffer and one draw call.
 */
function merge(pieces: Piece[]): THREE.BufferGeometry {
  const geometries = pieces.map((entry) => paint(entry.geometry, entry.color));
  const merged = mergeGeometries(geometries, false) as THREE.BufferGeometry | null;
  geometries.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error('scene3d: a diorama could not be merged into one mesh.');
  return merged;
}

/* ------------------------------------------------------------------ *
 * The props
 * ------------------------------------------------------------------ */

/** A prop: a solid body, and the parts of it that glow. */
interface Prop {
  /** The solid parts, merged into one mesh. */
  body: Piece[];
  /** The parts that light up, merged into a second mesh. */
  glow?: Piece[];
  /** The colour of the light. */
  glowColor?: string;
  /** How hard the light burns. */
  glowStrength?: number;
}

/** A part of a prop. */
function part(geometry: THREE.BufferGeometry, color: string): Piece {
  return { geometry, color };
}

/**
 * The signal mast.
 *
 * A post on a footing with a lamp in the head of it. The lamp is the
 * whole point of the thing, so it is the one part that glows.
 */
function signalMast(): Prop {
  return {
    body: [
      part(frame(new THREE.CylinderGeometry(0.42, 0.52, 0.26, 12), [0, 0.13, 0]), PALETTE.navy),
      part(frame(new THREE.CylinderGeometry(0.09, 0.11, 3, 8), [0, 1.76, 0]), PALETTE.grey),
      part(frame(new THREE.BoxGeometry(0.26, 0.2, 0.3), [0, 2.9, 0]), PALETTE.grey),
      part(frame(new THREE.BoxGeometry(0.5, 1.05, 0.42), [0, 3.5, 0]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(0.62, 0.1, 0.54), [0, 4.07, 0]), PALETTE.grey),
    ],
    glow: [
      part(
        frame(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 12), [-0.24, 3.72, 0], [0, 0, Math.PI / 2]),
        PALETTE.red,
      ),
    ],
    glowColor: PALETTE.red,
  };
}

/**
 * The glass prism.
 *
 * A triangular prism on a plinth, apex up, one flat face turned to the
 * line, with a beam bending through it.
 */
function glassPrism(): Prop {
  const apex: [number, number, number] = [0, 1.88, 0];
  return {
    body: [
      part(frame(new THREE.BoxGeometry(1.6, 0.3, 1.4), [0, 0.15, 0]), PALETTE.navyRaise),
      part(frame(new THREE.BoxGeometry(1.15, 0.08, 1), [0, 0.34, 0]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.12, 0.15, 0.3, 8), [0, 0.53, 0]), PALETTE.grey),
      // The prism itself: three sides, a flat base, apex up.
      part(
        frame(new THREE.CylinderGeometry(0.8, 0.8, 1, 3, 1), [0, 1.08, 0], [-Math.PI / 2, 0, Math.PI / 2]),
        PALETTE.paper,
      ),
      // The beam that goes in.
      part(bar([1.55, 2.45, 0], apex, 0.07), PALETTE.paper),
    ],
    glow: [
      // The beam that comes out, bent.
      part(bar(apex, [-1.05, 2.45, 0], 0.07), PALETTE.red),
    ],
    glowColor: PALETTE.red,
  };
}

/**
 * The ticker tape.
 *
 * A drum on a stand with a length of paper curling off the top of it.
 * The drum turns across the line, so the camera sees the curl flat on.
 */
function tickerTape(): Prop {
  const path = curve(
    [
      [0.08, 1.66, 0],
      [-0.36, 1.8, 0.04],
      [-0.78, 1.58, 0.1],
      [-1.04, 1.06, 0.18],
      [-1.0, 0.5, 0.26],
      [-0.76, 0.14, 0.32],
    ],
    26,
  );
  const colors = path.map((_, index) => (index < 6 ? PALETTE.red : PALETTE.paper));
  return {
    body: [
      part(frame(new THREE.BoxGeometry(1.1, 0.1, 0.9), [0, 0.05, 0]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(0.14, 1.3, 0.16), [0.42, 0.75, 0]), PALETTE.grey),
      part(frame(new THREE.BoxGeometry(0.14, 1.3, 0.16), [-0.42, 0.75, 0]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.06, 0.06, 1, 8), [0, 1.25, 0], [Math.PI / 2, 0, 0]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.42, 0.42, 0.62, 16), [0, 1.25, 0], [Math.PI / 2, 0, 0]), PALETTE.navy),
      part(frame(new THREE.CylinderGeometry(0.54, 0.54, 0.05, 16), [0, 1.25, 0.33], [Math.PI / 2, 0, 0]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.54, 0.54, 0.05, 16), [0, 1.25, -0.33], [Math.PI / 2, 0, 0]), PALETTE.grey),
      part(ribbon(path, 0.58, new THREE.Vector3(0, 0, 1), colors), PALETTE.paper),
    ],
  };
}

/**
 * The flashcard.
 *
 * A card on a tilted stand, with a red band across the top of it and a
 * few lines under the band.
 */
function flashcard(): Prop {
  const tilt: [number, number, number] = [0, 0, -0.26];
  const cardAt: [number, number, number] = [0.073, 0.739, 0];
  return {
    body: [
      part(frame(new THREE.BoxGeometry(0.75, 0.08, 1.5), [0, 0.04, 0]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(0.14, 0.24, 1.5), [-0.3, 0.16, 0]), PALETTE.grey),
      // The rest the card leans on.
      part(frame(new THREE.BoxGeometry(0.1, 1, 1.5), [0.1, 0.56, 0], tilt), PALETTE.grey),
      // The card.
      part(frame(new THREE.BoxGeometry(0.05, 0.95, 1.25), cardAt, tilt), PALETTE.paper),
      // The band across the top of it.
      part(frame(new THREE.BoxGeometry(0.02, 0.16, 1), cardAt, tilt, [-0.035, 0.26, 0]), PALETTE.red),
      // Three lines of something written on it.
      part(frame(new THREE.BoxGeometry(0.012, 0.035, 0.85), cardAt, tilt, [-0.032, -0.05, 0]), PALETTE.grey),
      part(frame(new THREE.BoxGeometry(0.012, 0.035, 0.85), cardAt, tilt, [-0.032, -0.16, 0]), PALETTE.grey),
      part(frame(new THREE.BoxGeometry(0.012, 0.035, 0.85), cardAt, tilt, [-0.032, -0.27, 0]), PALETTE.grey),
    ],
  };
}

/**
 * The receipt roll.
 *
 * A roll on a pedestal with a sheet of paper hanging off it and curling
 * out at the bottom.
 */
function receiptRoll(): Prop {
  const path = curve(
    [
      [0.02, 1.32, 0],
      [-0.42, 1.3, 0.03],
      [-0.66, 0.98, 0.06],
      [-0.72, 0.58, 0.09],
      [-0.62, 0.24, 0.12],
      [-0.46, 0.1, 0.14],
    ],
    24,
  );
  const colors = path.map((_, index) => (index > 2 && index < 7 ? PALETTE.red : PALETTE.paper));
  return {
    body: [
      part(frame(new THREE.BoxGeometry(0.7, 0.08, 0.7), [0, 0.04, 0]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(0.45, 0.4, 0.45), [0, 0.28, 0]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 16), [0, 0.9, 0], [Math.PI / 2, 0, 0]), PALETTE.paper),
      // The core of the roll, showing at both ends.
      part(frame(new THREE.CylinderGeometry(0.15, 0.15, 0.66, 10), [0, 0.9, 0], [Math.PI / 2, 0, 0]), PALETTE.navy),
      part(ribbon(path, 0.56, new THREE.Vector3(0, 0, 1), colors), PALETTE.paper),
    ],
  };
}

/**
 * The microphone.
 *
 * A stand, a stem and a capsule tilted towards whoever is speaking. The
 * ring at the foot of the base is the light that says the channel is
 * open.
 */
function microphone(): Prop {
  const tilt: [number, number, number] = [0, 0, 0.26];
  const top: [number, number, number] = [0, 2.24, 0];
  return {
    body: [
      part(frame(new THREE.CylinderGeometry(0.45, 0.5, 0.1, 16), [0, 0.05, 0]), PALETTE.navy),
      part(frame(new THREE.CylinderGeometry(0.055, 0.07, 2.1, 8), [0, 1.15, 0]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 8), [0, 2.2, 0]), PALETTE.navy),
      // The body of the capsule.
      part(
        frame(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 14).translate(0, 0.25, 0), top, tilt),
        PALETTE.navy,
      ),
      // The grille on top of it.
      part(
        frame(
          new THREE.SphereGeometry(0.17, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.5, 0),
          top,
          tilt,
        ),
        PALETTE.paper,
      ),
    ],
    glow: [
      part(frame(new THREE.CylinderGeometry(0.46, 0.46, 0.035, 16), [0, 0.115, 0]), PALETTE.red),
    ],
    glowColor: PALETTE.red,
  };
}

/**
 * The vault door.
 *
 * A round door set into a square frame, with a wheel on the front of it.
 * The wheel is the one part that carries the accent colour.
 */
function vaultDoor(): Prop {
  const spokes: Piece[] = [];
  for (let index = 0; index < 4; index += 1) {
    spokes.push(
      part(
        frame(new THREE.BoxGeometry(0.05, 0.42, 0.07), [-0.34, 1, 0], [(index * Math.PI) / 4, 0, 0]),
        PALETTE.red,
      ),
    );
  }
  return {
    body: [
      // The frame, four rails around a square hole.
      part(frame(new THREE.BoxGeometry(0.25, 0.3, 2), [0, 1.85, 0]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(0.25, 0.3, 2), [0, 0.15, 0]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(0.25, 1.4, 0.3), [0, 1, -0.85]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(0.25, 1.4, 0.3), [0, 1, 0.85]), PALETTE.navy),
      // The door itself, sunk into the frame.
      part(frame(new THREE.CylinderGeometry(0.72, 0.72, 0.3, 20), [-0.05, 1, 0], [0, 0, Math.PI / 2]), PALETTE.grey),
      // Bolts in the corners of the frame.
      part(frame(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), [-0.14, 1.85, -0.85], [0, 0, Math.PI / 2]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), [-0.14, 1.85, 0.85], [0, 0, Math.PI / 2]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), [-0.14, 0.15, -0.85], [0, 0, Math.PI / 2]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), [-0.14, 0.15, 0.85], [0, 0, Math.PI / 2]), PALETTE.grey),
      // The wheel on the front of the door.
      part(frame(new THREE.TorusGeometry(0.42, 0.055, 5, 16), [-0.34, 1, 0], [0, 0, Math.PI / 2]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), [-0.32, 1, 0], [0, 0, Math.PI / 2]), PALETTE.grey),
    ],
    glow: spokes,
    glowColor: PALETTE.red,
  };
}

/**
 * The bus model.
 *
 * A little block bus on a plinth: a red body, a window band, four wheels
 * and a pair of tail lights.
 */
function busModel(): Prop {
  const wheels: Piece[] = [];
  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.48, 0.48]) {
      wheels.push(
        part(frame(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 10), [x, 0.42, z], [Math.PI / 2, 0, 0]), PALETTE.navy),
      );
    }
  }
  return {
    body: [
      part(frame(new THREE.BoxGeometry(2.9, 0.22, 1.35), [0, 0.11, 0]), PALETTE.navyRaise),
      part(frame(new THREE.BoxGeometry(2.4, 0.8, 0.95), [0, 0.75, 0]), PALETTE.red),
      part(frame(new THREE.BoxGeometry(2.25, 0.26, 0.99), [-0.05, 0.9, 0]), PALETTE.paper),
      part(frame(new THREE.BoxGeometry(2.3, 0.08, 0.88), [0, 1.19, 0]), PALETTE.grey),
      ...wheels,
    ],
    glow: [
      part(frame(new THREE.BoxGeometry(0.06, 0.1, 0.16), [-1.22, 0.75, -0.32]), PALETTE.red),
      part(frame(new THREE.BoxGeometry(0.06, 0.1, 0.16), [-1.22, 0.75, 0.32]), PALETTE.red),
    ],
    glowColor: PALETTE.red,
  };
}

/**
 * The spiral notebook.
 *
 * A closed book standing on its base, with the wire of the binding
 * running down the side of it.
 */
function spiralNotebook(): Prop {
  const coils: Piece[] = [];
  for (let index = 0; index < 7; index += 1) {
    coils.push(
      part(
        frame(new THREE.TorusGeometry(0.16, 0.035, 5, 10), [0, 0.32 + index * 0.215, -0.6], [Math.PI / 2, 0, 0]),
        PALETTE.grey,
      ),
    );
  }
  return {
    body: [
      part(frame(new THREE.BoxGeometry(0.9, 0.06, 1.5), [0, 0.03, 0]), PALETTE.navy),
      // The back cover, the block of pages and the front cover.
      part(frame(new THREE.BoxGeometry(0.06, 1.7, 1.2), [0.1, 0.95, 0]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(0.18, 1.6, 1.1), [0.02, 0.95, 0]), PALETTE.paper),
      part(frame(new THREE.BoxGeometry(0.06, 1.7, 1.2), [-0.1, 0.95, 0]), PALETTE.red),
      ...coils,
    ],
  };
}

/**
 * The laptop.
 *
 * An open laptop with the screen up and lit, and the keyboard deck in
 * front of it.
 */
function laptop(): Prop {
  const tilt: [number, number, number] = [0, 0, -0.26];
  const hinge: [number, number, number] = [0.72, 0.1, 0];
  return {
    body: [
      part(frame(new THREE.BoxGeometry(1.5, 0.07, 1.05), [0, 0.035, 0]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(1.3, 0.02, 0.85), [0.05, 0.075, 0]), PALETTE.grey),
      part(frame(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), [0.72, 0.1, 0], [Math.PI / 2, 0, 0]), PALETTE.grey),
      // The back of the screen.
      part(frame(new THREE.BoxGeometry(0.05, 0.95, 1.05).translate(0, 0.475, 0), hinge, tilt), PALETTE.navy),
    ],
    glow: [
      // The screen itself, lit from inside.
      part(frame(new THREE.BoxGeometry(0.012, 0.8, 0.88).translate(0, 0.475, 0), hinge, tilt, [-0.032, 0, 0]), PALETTE.paper),
    ],
    glowColor: PALETTE.paper,
    glowStrength: 0.75,
  };
}

/**
 * The platform.
 *
 * A bench and a lamp: the two things a platform is made of.
 */
function thePlatform(): Prop {
  return {
    body: [
      // The bench: a seat, a back and two legs.
      part(frame(new THREE.BoxGeometry(1.7, 0.1, 0.55), [0, 0.5, 0]), PALETTE.paper),
      part(frame(new THREE.BoxGeometry(1.7, 0.45, 0.09), [0, 0.78, 0.26], [0.18, 0, 0]), PALETTE.paper),
      part(frame(new THREE.BoxGeometry(0.12, 0.45, 0.5), [0.7, 0.22, 0]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(0.12, 0.45, 0.5), [-0.7, 0.22, 0]), PALETTE.navy),
      // The lamp: a base, a post and a head.
      part(frame(new THREE.CylinderGeometry(0.22, 0.26, 0.1, 12), [1.3, 0.05, 0.3]), PALETTE.navy),
      part(frame(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 8), [1.3, 1.2, 0.3]), PALETTE.grey),
      part(frame(new THREE.BoxGeometry(0.34, 0.18, 0.34), [1.3, 2.46, 0.3]), PALETTE.navy),
    ],
    glow: [
      part(frame(new THREE.BoxGeometry(0.26, 0.05, 0.26), [1.3, 2.35, 0.3]), PALETTE.red),
    ],
    glowColor: PALETTE.red,
  };
}

/**
 * The ticket machine.
 *
 * A box on a base with a lit display, a slot for the card and a lamp on
 * the roof.
 */
function ticketMachine(): Prop {
  const buttons: Piece[] = [];
  for (const z of [-0.18, 0, 0.18]) {
    buttons.push(part(frame(new THREE.BoxGeometry(0.05, 0.07, 0.09), [-0.47, 0.3, z]), PALETTE.grey));
  }
  return {
    body: [
      part(frame(new THREE.BoxGeometry(1, 0.12, 0.8), [0, 0.06, 0]), PALETTE.navyRaise),
      part(frame(new THREE.BoxGeometry(0.9, 1.5, 0.72), [0, 0.87, 0]), PALETTE.navy),
      part(frame(new THREE.BoxGeometry(0.94, 0.1, 0.76), [0, 1.67, 0]), PALETTE.grey),
      // The slot the card goes into.
      part(frame(new THREE.BoxGeometry(0.04, 0.09, 0.4), [-0.47, 0.55, 0]), PALETTE.grey),
      ...buttons,
    ],
    glow: [
      // The display, and the lamp on the roof.
      part(frame(new THREE.BoxGeometry(0.03, 0.5, 0.5), [-0.455, 1.05, 0]), PALETTE.red),
      part(frame(new THREE.BoxGeometry(0.14, 0.1, 0.14), [-0.15, 1.77, 0.2]), PALETTE.red),
    ],
    glowColor: PALETTE.red,
  };
}

/* ------------------------------------------------------------------ *
 * The public API
 * ------------------------------------------------------------------ */

/** Every prop the content can ask for, and nothing else. */
const BUILDERS = new Map<string, () => Prop>([
  ['signal mast', signalMast],
  ['glass prism', glassPrism],
  ['ticker tape', tickerTape],
  ['flashcard', flashcard],
  ['receipt roll', receiptRoll],
  ['microphone', microphone],
  ['vault door', vaultDoor],
  ['bus model', busModel],
  ['spiral notebook', spiralNotebook],
  ['laptop', laptop],
  ['the platform', thePlatform],
  ['ticket machine', ticketMachine],
]);

/**
 * The material every solid part of a prop is drawn with.
 *
 * Lambert, like the rest of the scene: flat colour, flat shading, and a
 * fraction of the shader to compile.
 */
function bodyMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
}

/** The material the lit parts of a prop are drawn with. */
function glowMaterial(color: string, strength: number): THREE.MeshLambertMaterial {
  const value = new THREE.Color(color);
  return new THREE.MeshLambertMaterial({
    color: value,
    emissive: value,
    emissiveIntensity: strength,
    flatShading: true,
  });
}

/**
 * Builds the prop a stop asks for.
 *
 * Returns `null` when the stop names a prop this file has never heard of:
 * an unknown prop draws nothing rather than a placeholder box.
 */
export function buildDiorama(stop: Stop): THREE.Group | null {
  const builder = BUILDERS.get(stop.prop.trim().toLowerCase());
  if (!builder) return null;

  const prop = builder();
  const group = new THREE.Group();
  group.name = `diorama:${stop.prop}`;
  group.add(new THREE.Mesh(merge(prop.body), bodyMaterial()));
  if (prop.glow && prop.glow.length > 0) {
    const material = glowMaterial(prop.glowColor ?? PALETTE.red, prop.glowStrength ?? 1);
    group.add(new THREE.Mesh(merge(prop.glow), material));
  }
  return group;
}

/** Everything in this file is ours to clean up. */
function dispose(group: THREE.Group | null): void {
  if (!group) return;
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const material = object.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
  });
}

export interface DioramaProps {
  stop: Stop;
  /** Where the prop stands, in world units. */
  position: [number, number, number];
}

/** The props `<primitive>` takes. */
type PrimitiveProps = ThreeElements['primitive'];

export function Diorama(props: DioramaProps): JSX.Element {
  const { stop, position } = props;
  // The prop of a stop never changes, so the id is the whole dependency.
  const group = useMemo(() => buildDiorama(stop), [stop.id]);

  useEffect(() => {
    return () => {
      dispose(group);
    };
  }, [group]);

  if (!group) return <></>;

  const element: PrimitiveProps = { object: group, position };
  return <primitive {...element} />;
}
