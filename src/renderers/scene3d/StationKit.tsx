/**
 * The station kit.
 *
 * Six pieces make a station: a platform slab, a red edge strip, a canopy on
 * four posts, a station board, a bench and a lamp. The kit is the same at
 * every stop, so the line reads as one line and the twelve stations cost
 * twelve copies of a handful of triangles.
 *
 * Three rules hold this file together.
 *
 *   1. The name is not drawn in 3D. The board carries a clean blank panel
 *      and the app draws the station name over the canvas in HTML, so it
 *      stays legible and selectable at any distance. `boardLabelAnchor`
 *      says where the app puts it.
 *   2. Everything that shares a material is merged into one geometry, so a
 *      station is seven draw calls and just under six hundred triangles.
 *   3. Flat colour, no shadows, no textures. The palette is the six tokens
 *      in `constants.ts` and nothing else.
 *
 * The geometry is built by a plain function, `buildStation`, so it can be
 * counted and tested without a canvas. The component only owns the React
 * lifecycle: it builds the group and it disposes it. The parent places it.
 */

import { useEffect, useMemo } from 'react';
import type { JSX } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { Stop } from '../../core/types';
import {
  PLATFORM_HEIGHT,
  PLATFORM_LENGTH,
  SCENE_COLORS,
  TRACK_Y,
  stationAnchor,
} from './constants';
import { makePose, poseAt, type LinePath } from './path';

/* ------------------------------------------------------------------ *
 * The layout
 *
 * These are the drawing's numbers, not the content's: they decide where the
 * platform sits and how big each piece is. The only value that comes from
 * the content is the width of the board's blank panel, which is sized from
 * the length of the station name so the HTML label always has a panel to
 * sit on.
 * ------------------------------------------------------------------ */

/**
 * Which side of the track the platform is on.
 *
 * The track runs along the X axis and the train sits on the centreline, so
 * the platform has to go on one side of it. It goes on the -Z side, which
 * puts it across the rails from a camera riding on the +Z side: the train is
 * in front, the platform is behind it, and the board faces the track.
 */
export const PLATFORM_SIDE = -1;

/**
 * A distance on the platform side of the track, in world units.
 *
 * Every Z in this file is written as a distance from the centreline and
 * signed here, so the whole kit can be flipped to the other side of the
 * track by changing one number.
 */
export function zOnPlatform(distance: number): number {
  return PLATFORM_SIDE * distance;
}

/** How far the platform reaches out from the centreline. */
export const PLATFORM_DEPTH = 6;

/** The platform's edge: the side the train runs along. */
export const PLATFORM_EDGE = 2.4;

/** The red edge strip's width, measured in from the platform edge. */
const EDGE_STRIP = 0.55;

/** The canopy: a long roof on four posts, over the platform. */
const CANOPY_LENGTH = 30;
const CANOPY_DEPTH = 4.2;
const CANOPY_THICKNESS = 0.3;
/** How far the roof's underside sits above the platform. */
const CANOPY_CLEARANCE = 3.2;
/** Where the four posts stand: along the track, and across it. */
const CANOPY_POST_X = 12;
const CANOPY_POST_Z = [3.9, 7.0];
/** The middle of the canopy roof, held a little behind the posts. */
const CANOPY_DISTANCE = 5.6;

/** The board: a panel on two legs, standing at the platform's edge. */
const BOARD_X = 8;
/** How far the board stands from the centreline. The track bows towards the
 * platform at the ends, so the furniture sits a little further back than the
 * straight-slab layout used to. */
const BOARD_DISTANCE = 3.2;
/** The panel's bottom edge, above the platform. */
const BOARD_CLEARANCE = 1.4;
const BOARD_HEIGHT = 1.8;
/** The red band across the top of the panel. */
const BOARD_HEADER = 0.42;
const BOARD_THICKNESS = 0.18;

/** The bench: a slab on two legs, under the canopy at the back. */
const BENCH_X = -1.2;
const BENCH_DISTANCE = 7.2;
const BENCH_LENGTH = 3;
const BENCH_DEPTH = 0.9;
const BENCH_SEAT_HEIGHT = 0.47;
const BENCH_SEAT_THICKNESS = 0.16;

/** The lamp: a post with a small head, so the platform reads at night. */
const LAMP_X = 4.8;
const LAMP_DISTANCE = 3.4;
const LAMP_POST_HEIGHT = 4;
const LAMP_HEAD = 0.45;

/** How hard the edge strip lights up while the train is dwelling here. */
const EDGE_GLOW = 0.9;
/** The header band only leans into it. */
const HEADER_GLOW = 0.35;
/** The lamp always burns: it is the light of the platform. */
const LAMP_GLOW = 0.85;

/**
 * The canopy is the one big pale shape in the frame, so it is a shade below
 * the cream paper: still the same colour family, just held back so the board
 * and the platform read in front of it.
 */
const CANOPY_PAPER = SCENE_COLORS.canopy;

/* ------------------------------------------------------------------ *
 * The board
 * ------------------------------------------------------------------ */

/**
 * How wide the board's blank panel is, in world units.
 *
 * The panel is sized from the length of the station name, so the name the
 * app draws in HTML always has a panel behind it. The app should use the
 * same number to cap the width of its label.
 */
export function boardPanelWidth(stop: Stop): number {
  const letters = stop.station.trim().length;
  return Math.min(5.6, Math.max(3.6, 2.4 + 0.3 * letters));
}

/** The height of the blank area below the header band. */
export const BOARD_NAME_HEIGHT = BOARD_HEIGHT - BOARD_HEADER;

/** Where a label goes on a board, and how much room it has. */
export interface LabelAnchor {
  /** The middle of the blank panel, along the track. */
  x: number;
  /** The middle of the blank panel, above the platform. */
  y: number;
  /** Just in front of the board's face. */
  z: number;
  /** How wide the blank panel is, so a label can be capped to it. */
  width: number;
}

/**
 * Where the HTML label goes, in the station's local space.
 *
 * The anchor is the middle of the blank panel, a hair in front of the
 * board's face, so the label lands on the board and not on the world behind
 * it. The station group is placed by the parent at `stationX(index)`, so
 * the world position is the anchor plus that.
 */
export function boardLabelAnchor(stop: Stop): LabelAnchor {
  return {
    x: BOARD_X,
    y: PLATFORM_HEIGHT + BOARD_CLEARANCE + BOARD_NAME_HEIGHT / 2,
    z: zOnPlatform(BOARD_DISTANCE - BOARD_THICKNESS / 2 - 0.03),
    width: boardPanelWidth(stop),
  };
}

/**
 * The same anchor in world space, for the station at the given index.
 *
 * This is the point the app projects to the screen: put the label there,
 * centred, and it sits on the board.
 */
export function boardLabelWorld(index: number, stop: Stop): [number, number, number] {
  const anchor = boardLabelAnchor(stop);
  const station = stationAnchor(index);
  return [station.x + anchor.x, TRACK_Y + anchor.y, station.z + anchor.z];
}

/* ------------------------------------------------------------------ *
 * The geometry
 * ------------------------------------------------------------------ */

interface BoxPart {
  kind: 'box';
  size: [number, number, number];
  at: [number, number, number];
}

interface CylinderPart {
  kind: 'cylinder';
  radius: number;
  height: number;
  at: [number, number, number];
}

/** A geometry built by hand, already in the station's local space. */
interface GeometryPart {
  kind: 'geometry';
  geometry: THREE.BufferGeometry;
  at: [number, number, number];
}

type Part = BoxPart | CylinderPart | GeometryPart;

/** The seven materials, and so the seven draw calls. */
const MATERIAL_KEYS = ['structure', 'paper', 'board', 'canopy', 'edge', 'header', 'lamp'] as const;
type MaterialKey = (typeof MATERIAL_KEYS)[number];

/** One primitive, placed. */
function part(kind: 'box', size: [number, number, number], at: [number, number, number]): BoxPart;
function part(
  kind: 'cylinder',
  size: [number, number, number],
  at: [number, number, number],
): CylinderPart;
function part(
  kind: 'box' | 'cylinder',
  size: [number, number, number],
  at: [number, number, number],
): Part {
  return kind === 'box'
    ? { kind: 'box', size, at }
    : { kind: 'cylinder', radius: size[0], height: size[1], at };
}

/** The primitive for one part. */
function geometryOf(one: Part): THREE.BufferGeometry {
  if (one.kind === 'box') {
    return new THREE.BoxGeometry(one.size[0], one.size[1], one.size[2]);
  }
  if (one.kind === 'cylinder') {
    return new THREE.CylinderGeometry(one.radius, one.radius, one.height, 8);
  }
  return one.geometry;
}

/**
 * Sweep a solid ribbon along the line.
 *
 * A platform used to be one straight box, but the smoothed centreline bows
 * towards the platform lane by the ends of the straight run. A straight box
 * therefore cut into the train. This ribbon is sampled at a constant offset
 * from the same centreline the train follows, so the edge keeps its distance
 * all the way to the platform ends.
 *
 * The four corners of each sample are inner-top, outer-top, outer-bottom and
 * inner-bottom. The bottom face is left out: it sits on the ground and is
 * never seen. The ribbon is already in the station's local space, because the
 * parent places the group at `stationAnchor(index)`.
 */
function ribbonGeometry(
  line: LinePath,
  index: number,
  innerOffset: number,
  outerOffset: number,
  bottomY: number,
  topY: number,
  segments = 32,
): THREE.BufferGeometry {
  const anchor = stationAnchor(index);
  const centre = line.stations[index] ?? 0;
  const half = PLATFORM_LENGTH / 2;
  const pose = makePose();

  const rings = segments + 1;
  const positions = new Float32Array(rings * 4 * 3);
  const uvs = new Float32Array(rings * 4 * 2);
  const indices: number[] = [];

  for (let i = 0; i < rings; i += 1) {
    poseAt(line, centre - half + (i / segments) * PLATFORM_LENGTH, pose);
    const normalX = pose.t.z;
    const normalZ = -pose.t.x;
    const x = pose.p.x - anchor.x;
    const z = pose.p.z - anchor.z;

    const base = i * 4;
    const at = (corner: number, offset: number, y: number): void => {
      positions[(base + corner) * 3] = x + normalX * offset;
      positions[(base + corner) * 3 + 1] = y;
      positions[(base + corner) * 3 + 2] = z + normalZ * offset;
      uvs[(base + corner) * 2] = i / segments;
      uvs[(base + corner) * 2 + 1] = corner % 2;
    };

    at(0, innerOffset, topY);
    at(1, outerOffset, topY);
    at(2, outerOffset, bottomY);
    at(3, innerOffset, bottomY);
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 4;
    const b = a + 4;
    indices.push(
      // top
      a, b, b + 1,
      a, b + 1, a + 1,
      // the platform edge, facing the track
      a, a + 3, b + 3,
      a, b + 3, b,
      // the back wall
      a + 1, b + 1, b + 2,
      a + 1, b + 2, a + 2,
    );
  }

  const last = (rings - 1) * 4;
  indices.push(
    // the near end cap
    0, 1, 2,
    0, 2, 3,
    // the far end cap, wound the other way
    last, last + 3, last + 2,
    last, last + 2, last + 1,
  );

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A ribbon as a mergeable part, already placed in the station's space. */
function ribbonPart(
  line: LinePath,
  index: number,
  innerOffset: number,
  outerOffset: number,
  bottomY: number,
  topY: number,
): GeometryPart {
  return {
    kind: 'geometry',
    geometry: ribbonGeometry(line, index, innerOffset, outerOffset, bottomY, topY),
    at: [0, 0, 0],
  };
}

/**
 * Merge a list of parts into one geometry.
 *
 * The parts are translated into place and merged, and the sources are
 * thrown away: only the merged geometry is ever handed to a mesh.
 */
function mergeParts(parts: Part[]): THREE.BufferGeometry {
  const sources = parts.map((one) => {
    const geometry = geometryOf(one);
    geometry.translate(one.at[0], one.at[1], one.at[2]);
    return geometry;
  });
  const merged = mergeGeometries(sources, false);
  sources.forEach((source) => source.dispose());
  if (!merged) throw new Error('station kit: the station geometry could not be merged');
  return merged;
}

/** The material for one of the six, with the active state baked in. */
function makeMaterial(key: MaterialKey, active: boolean): THREE.MeshLambertMaterial {
  const flat = { flatShading: true } as const;
  switch (key) {
    case 'structure':
      return new THREE.MeshLambertMaterial({ ...flat, color: SCENE_COLORS.grey });
    case 'paper':
      return new THREE.MeshLambertMaterial({ ...flat, color: SCENE_COLORS.paper });
    case 'board':
      return new THREE.MeshLambertMaterial({
        ...flat,
        color: SCENE_COLORS.board,
        emissive: SCENE_COLORS.board,
        emissiveIntensity: active ? 0.18 : 0.06,
      });
    case 'canopy':
      return new THREE.MeshLambertMaterial({ ...flat, color: CANOPY_PAPER });
    case 'edge':
      return new THREE.MeshLambertMaterial({
        ...flat,
        color: SCENE_COLORS.board,
        emissive: SCENE_COLORS.board,
        emissiveIntensity: active ? EDGE_GLOW : 0,
      });
    case 'header':
      return new THREE.MeshLambertMaterial({
        ...flat,
        color: SCENE_COLORS.ink,
        emissive: SCENE_COLORS.ink,
        emissiveIntensity: active ? HEADER_GLOW : 0,
      });
    case 'lamp':
      return new THREE.MeshLambertMaterial({
        ...flat,
        color: SCENE_COLORS.lamp,
        emissive: SCENE_COLORS.lamp,
        emissiveIntensity: LAMP_GLOW,
      });
  }
}

/* ------------------------------------------------------------------ *
 * The kit
 * ------------------------------------------------------------------ */

/** The inputs to one station. */
export interface StationKitOptions {
  stop: Stop;
  active: boolean;
  /** The same line the train runs on. The platform edge follows it. */
  line: LinePath;
  /** The station's index in line order. */
  index: number;
}

/**
 * Build a station.
 *
 * The group is returned at the origin: the parent places it. The geometry
 * is flat shaded, casts no shadow and receives no shadow, and the only
 * state it carries is `active`, which brightens the platform edge and
 * brings the board's header band up.
 *
 * The platform and its red edge are swept along the line, while the board,
 * canopy, bench and lamp stay level and square to the track. That mix is
 * deliberate: a station whose furniture leaned with the track would look
 * like a ship, and the curved edge is the part that has to keep clear of the
 * train.
 */
export function buildStation(options: StationKitOptions): THREE.Group {
  const { stop, active, line, index } = options;
  const width = boardPanelWidth(stop);

  const boardZ = zOnPlatform(BOARD_DISTANCE);
  const boardBottom = PLATFORM_HEIGHT + BOARD_CLEARANCE;
  const boardTop = boardBottom + BOARD_HEIGHT;
  const legInset = Math.max(0.6, width / 2 - 0.55);

  /** Everything that is one colour, in the order it is merged. */
  const parts: Record<MaterialKey, Part[]> = {
    /* The platform slab, the legs under the board, the bench legs and the
     * lamp post: all of it is the same structural grey, so it is one mesh.
     * The slab is a ribbon that follows the track; the furniture is straight. */
    structure: [
      ribbonPart(line, index, PLATFORM_EDGE, PLATFORM_EDGE + PLATFORM_DEPTH, 0, PLATFORM_HEIGHT),
      part('box', [0.18, BOARD_CLEARANCE, 0.26], [
        BOARD_X - legInset,
        PLATFORM_HEIGHT + BOARD_CLEARANCE / 2,
        boardZ,
      ]),
      part('box', [0.18, BOARD_CLEARANCE, 0.26], [
        BOARD_X + legInset,
        PLATFORM_HEIGHT + BOARD_CLEARANCE / 2,
        boardZ,
      ]),
      part('box', [0.24, BENCH_SEAT_HEIGHT, 0.7], [
        BENCH_X - 1.15,
        PLATFORM_HEIGHT + BENCH_SEAT_HEIGHT / 2,
        zOnPlatform(BENCH_DISTANCE),
      ]),
      part('box', [0.24, BENCH_SEAT_HEIGHT, 0.7], [
        BENCH_X + 1.15,
        PLATFORM_HEIGHT + BENCH_SEAT_HEIGHT / 2,
        zOnPlatform(BENCH_DISTANCE),
      ]),
      part('cylinder', [0.09, LAMP_POST_HEIGHT, 0], [
        LAMP_X,
        PLATFORM_HEIGHT + LAMP_POST_HEIGHT / 2,
        zOnPlatform(LAMP_DISTANCE),
      ]),
    ],

    /* The board's yellow panel. */
    board: [
      part('box', [width, BOARD_HEIGHT, BOARD_THICKNESS], [
        BOARD_X,
        boardBottom + BOARD_HEIGHT / 2,
        boardZ,
      ]),
    ],

    /* The bench's seat: the one cream surface on the platform. */
    paper: [
      part('box', [BENCH_LENGTH, BENCH_SEAT_THICKNESS, BENCH_DEPTH], [
        BENCH_X,
        PLATFORM_HEIGHT + BENCH_SEAT_HEIGHT + BENCH_SEAT_THICKNESS / 2,
        zOnPlatform(BENCH_DISTANCE),
      ]),
    ],

    /* The canopy: a flat roof on four thin posts. */
    canopy: [
      part('box', [CANOPY_LENGTH, CANOPY_THICKNESS, CANOPY_DEPTH], [
        0,
        PLATFORM_HEIGHT + CANOPY_CLEARANCE + CANOPY_THICKNESS / 2,
        zOnPlatform(CANOPY_DISTANCE),
      ]),
      ...[-CANOPY_POST_X, CANOPY_POST_X].flatMap((x) =>
        CANOPY_POST_Z.map((z) =>
          part('box', [0.22, CANOPY_CLEARANCE, 0.22], [
            x,
            PLATFORM_HEIGHT + CANOPY_CLEARANCE / 2,
            zOnPlatform(z),
          ]),
        ),
      ),
    ],

    /* The platform edge: the one red line on the ground, swept with the
     * slab so it never cuts the corner into the train's path. */
    edge: [
      ribbonPart(
        line,
        index,
        PLATFORM_EDGE,
        PLATFORM_EDGE + EDGE_STRIP,
        PLATFORM_HEIGHT,
        PLATFORM_HEIGHT + 0.16,
      ),
    ],

    /* The board's header band. It is a touch deeper than the panel, so the
     * red wraps both faces and the board reads from either platform. */
    header: [
      part('box', [width + 0.14, BOARD_HEADER, 0.26], [
        BOARD_X,
        boardTop - BOARD_HEADER / 2,
        boardZ,
      ]),
    ],

    /* The lamp head: the one thing that burns all night. */
    lamp: [
      part('box', [LAMP_HEAD, 0.3, LAMP_HEAD], [
        LAMP_X,
        PLATFORM_HEIGHT + LAMP_POST_HEIGHT + 0.15,
        zOnPlatform(LAMP_DISTANCE),
      ]),
    ],
  };

  const group = new THREE.Group();
  group.name = `station-${stop.id}`;
  group.userData = {
    stopId: stop.id,
    /** Where the HTML label belongs, in this group's local space. */
    labelAnchor: boardLabelAnchor(stop),
    /** How wide the blank panel is, so the label can be capped to match. */
    panelWidth: width,
    panelHeight: BOARD_NAME_HEIGHT,
  };

  for (const key of MATERIAL_KEYS) {
    const geometry = mergeParts(parts[key]);
    const mesh = new THREE.Mesh(geometry, makeMaterial(key, active));
    mesh.name = `station-${stop.id}-${key}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }

  return group;
}

/**
 * Throw a station away.
 *
 * The group is built by hand, so nobody else knows about it: the geometry
 * and the materials are ours to dispose.
 */
export function disposeStation(group: THREE.Group): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((one) => one.dispose());
    else material?.dispose();
  });
  group.clear();
}

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

export interface StationProps {
  /** The stop this station serves. */
  stop: Stop;
  /** The station's index in line order. */
  index: number;
  /** The line, so the platform edge can follow the track. */
  line: LinePath;
  /** True when the train is dwelling here. */
  active: boolean;
}

/**
 * A station in the scene.
 *
 * The group is built once per stop and rebuilt when the train arrives or
 * leaves, which is the only state the kit has: the platform edge brightens
 * and the board's header band comes up.
 *
 * The parent places the station - `Scene.tsx` puts it at
 * `stationX(index)` - so the kit itself is built at the origin and knows
 * nothing about where it stands. `index` is part of the contract, and the
 * parent is the one who reads it.
 */
export function Station(props: StationProps): JSX.Element {
  const { stop, index, line, active } = props;
  const group = useMemo(
    () => buildStation({ stop, active, line, index }),
    [stop.id, stop.station, active, index, line],
  );

  useEffect(() => () => disposeStation(group), [group]);

  return <primitive object={group} dispose={null} />;
}
