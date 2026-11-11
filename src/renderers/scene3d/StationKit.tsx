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
 *      station is six draw calls and a little over two hundred triangles.
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
const PLATFORM_DEPTH = 6;

/** The platform's edge: the side the train runs along. */
const EDGE = 2.4;

/** The canopy: a long roof on four posts, over the platform. */
const CANOPY_LENGTH = 30;
const CANOPY_DEPTH = 4.2;
const CANOPY_THICKNESS = 0.3;
/** How far the roof's underside sits above the platform. */
const CANOPY_CLEARANCE = 3.2;
/** Where the four posts stand: along the track, and across it. */
const CANOPY_POST_X = 12;
const CANOPY_POST_Z = [3.6, 7.0];

/** The board: a panel on two legs, standing at the platform's edge. */
const BOARD_X = 8;
/** How far the board stands from the centreline. */
const BOARD_DISTANCE = 2.9;
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
const LAMP_DISTANCE = 3;
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

type Part = BoxPart | CylinderPart;

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
  return new THREE.CylinderGeometry(one.radius, one.radius, one.height, 8);
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

/**
 * Build a station.
 *
 * The group is returned at the origin: the parent places it. The geometry
 * is flat shaded, casts no shadow and receives no shadow, and the only
 * state it carries is `active`, which brightens the platform edge and
 * brings the board's header band up.
 *
 * The options object is the form the kit is built with. The shorter
 * `(stop, active)` form is the same call with the arguments unpacked, and
 * is what the unit test uses.
 */
export function buildStation(options: { stop: Stop; active: boolean }): THREE.Group;
export function buildStation(stop: Stop, active?: boolean): THREE.Group;
export function buildStation(
  first: { stop: Stop; active: boolean } | Stop,
  second?: boolean,
): THREE.Group {
  const stop = 'stop' in first ? first.stop : first;
  const active = 'stop' in first ? first.active : (second ?? false);
  const width = boardPanelWidth(stop);

  const boardZ = zOnPlatform(BOARD_DISTANCE);
  const boardBottom = PLATFORM_HEIGHT + BOARD_CLEARANCE;
  const boardTop = boardBottom + BOARD_HEIGHT;
  const legInset = Math.max(0.6, width / 2 - 0.55);

  /** Everything that is one colour, in the order it is merged. */
  const parts: Record<MaterialKey, Part[]> = {
    /* The platform slab, the legs under the board, the bench legs and the
     * lamp post: all of it is the same structural grey, so it is one mesh. */
    structure: [
      part('box', [PLATFORM_LENGTH, PLATFORM_HEIGHT, PLATFORM_DEPTH], [
        0,
        PLATFORM_HEIGHT / 2,
        zOnPlatform(EDGE + PLATFORM_DEPTH / 2),
      ]),
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
        zOnPlatform(5.3),
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

    /* The platform edge: the one red line on the ground. */
    edge: [
      part('box', [PLATFORM_LENGTH, 0.16, 0.55], [
        0,
        PLATFORM_HEIGHT + 0.08,
        zOnPlatform(EDGE + 0.275),
      ]),
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
  const { stop, active } = props;
  const group = useMemo(
    () => buildStation({ stop, active }),
    [stop.id, stop.station, active],
  );

  useEffect(() => () => disposeStation(group), [group]);

  return <primitive object={group} dispose={null} />;
}
