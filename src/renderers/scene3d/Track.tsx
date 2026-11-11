/**
 * The track and the city.
 *
 * The line runs along the X axis and the first station is at x = 0. Every
 * other position in the scene is derived from that one number: the train
 * stops at `index * STATION_SPACING`, so does the platform, and so does the
 * sleeper under it. Nothing here knows what a station is called.
 *
 * Four rules hold this file together.
 *
 *   1. Six draw calls. Two rails, one ballast and three instanced meshes:
 *      the sleepers, the catenary masts and the city. The track costs six
 *      draws whatever the length of the line.
 *   2. The geometry is the same at both detail levels. Only the number of
 *      instances changes, so a low-end phone draws the same city with fewer
 *      windows in it.
 *   3. The city is a backdrop. It stands behind the line, in a grey pulled
 *      towards the night, and it is never allowed to compete with the
 *      station the visitor is standing at.
 *   4. Nothing here is random. The same stations produce the same city
 *      every time, which is what makes the builder testable.
 */

import { useEffect, useLayoutEffect, useMemo } from 'react';
import type { JSX } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';

import { RAIL_GAUGE, SCENE_COLORS, STATION_SPACING, TRACK_Y } from './constants';
import type { Detail } from './tier';

/* ------------------------------------------------------------------ *
 * The shape of the track
 *
 * These are the drawing's constants, not the content's: they decide how
 * tall a mast is and how far the line runs past the terminus. The one
 * number that comes from the world is STATION_SPACING, and the train and
 * the platform both use it.
 * ------------------------------------------------------------------ */

/** How far the track runs past the first and the last station. */
const LINE_OVERRUN = 70;

/** The rail head is at y = 0; everything else hangs below it. */
const RAIL_HEIGHT = 0.22;
const RAIL_WIDTH = 0.16;

/** The ballast: a low, slightly wider box under the sleepers. */
const BALLAST_WIDTH = 4.6;
const BALLAST_DEPTH = 0.6;

/** The ground the ballast, the masts and the city stand on. */
const GROUND_Y = -1;

/** A sleeper: a small box laid across the track. */
const SLEEPER_WIDTH = 0.5;
const SLEEPER_DEPTH = 0.18;
const SLEEPER_LENGTH = 3.2;
/** Sleepers sit on the ballast and the rails sit on the sleepers. */
const SLEEPER_CENTRE_Y = -0.31;

/** The catenary mast: a post with an arm that reaches over the track. */
const MAST_HEIGHT = 7;
const MAST_POST = 0.22;
const MAST_ARM = 5.4;
const MAST_ARM_THICK = 0.14;
const MAST_ARM_Y = 5;
/**
 * The masts stand on the far side of the track, away from the platform and
 * the dioramas, and their arms reach back over the rails.
 */
const MAST_Z = -6.4;

/* ------------------------------------------------------------------ *
 * Density
 * ------------------------------------------------------------------ */

/** How many stations share one mast. */
const MAST_EVERY: Record<Detail, number> = { high: 2, low: 6 };

/** How far apart the sleepers sit. */
const SLEEPER_INTERVAL: Record<Detail, number> = { high: 2, low: 6 };

/** How wide one city block is along the line. */
const BLOCK_WIDTH: Record<Detail, number> = { high: 9, low: 26 };

/**
 * The tallest building allowed at each detail level.
 *
 * On the low tier the city is a low town: the towers are dropped, because
 * a phone has better things to spend its triangles on.
 */
const MAX_BUILDING_HEIGHT: Record<Detail, number> = { high: 38, low: 12 };

/**
 * The three rows of the city.
 *
 * Each row is a band of z, near to far, and each row is allowed to be
 * taller than the one in front of it. That is what turns a row of boxes
 * into a skyline.
 */
const CITY_BANDS = [
  { near: -26, far: -52, tallest: 14 },
  { near: -60, far: -92, tallest: 26 },
  { near: -100, far: -140, tallest: 38 },
];

/* ------------------------------------------------------------------ *
 * The layout
 * ------------------------------------------------------------------ */

/** One block of the city. */
interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

interface TrackLayout {
  /** The track starts this far before the first station. */
  start: number;
  /** The track ends this far past the last station. */
  end: number;
  /** How long the line is. */
  length: number;
  /** The middle of the line, where the long boxes are centred. */
  centre: number;
  /** The x of every sleeper. */
  sleepers: number[];
  /** The x of every mast. */
  masts: number[];
  /** Every block of the city. */
  buildings: Building[];
}

/**
 * A small deterministic generator.
 *
 * The city must be identical every time the component renders and identical
 * in the test, so nothing here calls `Math.random`.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The city.
 *
 * Three rows of blocks behind the line, walking along it in even steps and
 * skipping a few cells so the skyline has gaps in it.
 */
function buildCity(
  start: number,
  end: number,
  detail: Detail,
  random: () => number,
): Building[] {
  const buildings: Building[] = [];
  const step = BLOCK_WIDTH[detail];
  const tallest = MAX_BUILDING_HEIGHT[detail];
  const skip = detail === 'high' ? 0.18 : 0.3;

  for (const band of CITY_BANDS) {
    const limit = Math.min(band.tallest, tallest);
    for (let x = start; x < end; x += step) {
      const last = x + step >= end;
      // The last cell of a row is never skipped: the city has to reach the
      // end of the line.
      if (!last && random() < skip) continue;

      const depth = 6 + random() * 10;
      const width = 5 + random() * 8;
      const jitter = (random() - 0.5) * step * 0.3;
      // Most of the city is low and a few blocks are towers.
      const height = 3 + Math.pow(random(), 2.2) * (limit - 3);
      const near = band.far + random() * Math.max(0.001, band.near - band.far - depth);

      buildings.push({
        x: x + jitter + width / 2,
        z: near + depth / 2,
        width,
        depth,
        height,
      });
    }
  }

  return buildings;
}

/** Where everything on the line sits. */
function buildLayout(options: { stations: number; detail: Detail }): TrackLayout {
  const stations = Math.max(1, Math.floor(options.stations));
  const { detail } = options;

  const lastStation = (stations - 1) * STATION_SPACING;
  const start = -LINE_OVERRUN;
  const end = lastStation + LINE_OVERRUN;
  const length = end - start;

  const sleepers: number[] = [];
  const interval = SLEEPER_INTERVAL[detail];
  for (let x = start; x <= end; x += interval) {
    sleepers.push(Math.round(x * 1000) / 1000);
  }

  const masts: number[] = [];
  for (let index = 0; index < stations; index += MAST_EVERY[detail]) {
    masts.push(index * STATION_SPACING);
  }
  // The line never ends without a mast at the last station.
  if (!masts.includes(lastStation)) masts.push(lastStation);

  const random = seeded(stations * 7919 + (detail === 'high' ? 17 : 29));
  const buildings = buildCity(start, end, detail, random);

  return {
    start,
    end,
    length,
    centre: (start + end) / 2,
    sleepers,
    masts,
    buildings,
  };
}

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/**
 * One box: eight corners, six faces, twelve triangles.
 *
 * The mast is a post and an arm in a single geometry, so the whole mast
 * fits in one instance, and the buildings are a unit box scaled per
 * instance. Writing the boxes out by hand keeps the triangle count exact
 * and keeps the file clear of the helpers that ship with three but are not
 * part of its public API.
 */
function pushBox(
  position: number[],
  normal: number[],
  index: number[],
  centre: [number, number, number],
  size: [number, number, number],
): void {
  const [cx, cy, cz] = centre;
  const hx = size[0] / 2;
  const hy = size[1] / 2;
  const hz = size[2] / 2;

  const corners: [number, number, number][] = [
    [cx - hx, cy - hy, cz - hz],
    [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz],
    [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz],
    [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz],
    [cx - hx, cy + hy, cz + hz],
  ];

  const faces: { normal: [number, number, number]; corners: number[] }[] = [
    { normal: [0, 0, -1], corners: [0, 3, 2, 1] },
    { normal: [0, 0, 1], corners: [4, 5, 6, 7] },
    { normal: [-1, 0, 0], corners: [0, 4, 7, 3] },
    { normal: [1, 0, 0], corners: [1, 2, 6, 5] },
    { normal: [0, -1, 0], corners: [0, 1, 5, 4] },
    { normal: [0, 1, 0], corners: [3, 7, 6, 2] },
  ];

  for (const face of faces) {
    const base = position.length / 3;
    for (const corner of face.corners) {
      const point = corners[corner];
      position.push(point[0], point[1], point[2]);
      normal.push(face.normal[0], face.normal[1], face.normal[2]);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

/** A geometry made of boxes. */
function boxGeometry(
  boxes: { centre: [number, number, number]; size: [number, number, number] }[],
): THREE.BufferGeometry {
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];

  for (const box of boxes) pushBox(position, normal, index, box.centre, box.size);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The catenary mast.
 *
 * A post with an arm that reaches over the track, in one geometry, so the
 * masts are one instanced mesh and one draw call. The base of the post is
 * at y = 0 and the arm reaches towards +z.
 */
function mastGeometry(): THREE.BufferGeometry {
  return boxGeometry([
    { centre: [0, MAST_HEIGHT / 2, 0], size: [MAST_POST, MAST_HEIGHT, MAST_POST] },
    { centre: [0, MAST_ARM_Y, MAST_ARM / 2], size: [MAST_ARM_THICK, MAST_ARM_THICK, MAST_ARM] },
  ]);
}

/* ------------------------------------------------------------------ *
 * The colours
 * ------------------------------------------------------------------ */

/**
 * The colour of the city.
 *
 * The contract gives the city `--grey` at low intensity. The only way to
 * lower the intensity of a flat colour without inventing a new one is to
 * pull it towards the night: the backdrop is the same grey seen from
 * further away.
 */
function cityColour(): THREE.Color {
  return new THREE.Color(SCENE_COLORS.grey).lerp(new THREE.Color(SCENE_COLORS.navy), 0.62);
}

/* ------------------------------------------------------------------ *
 * The build
 * ------------------------------------------------------------------ */

interface TrackParts {
  group: THREE.Group;
  sleepers: THREE.InstancedMesh;
  masts: THREE.InstancedMesh;
  city: THREE.InstancedMesh;
}

/** The parts of a build, kept so the layout effect can find them again. */
interface TrackBuild {
  parts: TrackParts;
  layout: TrackLayout;
}

const BUILDS = new WeakMap<THREE.Group, TrackBuild>();

/** How many meshes the track costs. */
function countMeshes(group: THREE.Group): number {
  let count = 0;
  group.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) count += 1;
  });
  return count;
}

/**
 * The meshes of the track.
 *
 * Two rails, one ballast and three instanced meshes. The instanced meshes
 * never cast a shadow and never cull themselves: their bounding volume
 * comes from the base geometry, not from the instances, so a bound computed
 * the ordinary way would cut the track out of the scene.
 */
function buildParts(layout: TrackLayout): TrackParts {
  const group = new THREE.Group();
  group.name = 'track';

  // The rails are a graphic mark on the ground, so they are unlit and
  // always read as paper, whatever the hour is.
  const railMaterial = new THREE.MeshBasicMaterial({ color: SCENE_COLORS.paper });
  const ballastMaterial = new THREE.MeshLambertMaterial({
    color: SCENE_COLORS.navyRaise,
    flatShading: true,
  });
  const sleeperMaterial = new THREE.MeshBasicMaterial({ color: SCENE_COLORS.greyDim });
  const mastMaterial = new THREE.MeshLambertMaterial({
    color: SCENE_COLORS.grey,
    flatShading: true,
  });
  const cityMaterial = new THREE.MeshLambertMaterial({
    color: cityColour(),
    flatShading: true,
  });

  // The two rails, RAIL_GAUGE apart.
  const railGeometry = boxGeometry([
    { centre: [0, 0, 0], size: [layout.length, RAIL_HEIGHT, RAIL_WIDTH] },
  ]);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeometry, railMaterial);
    rail.name = side < 0 ? 'rail-far' : 'rail-near';
    rail.position.set(layout.centre, TRACK_Y - RAIL_HEIGHT / 2, (side * RAIL_GAUGE) / 2);
    rail.castShadow = false;
    rail.receiveShadow = false;
    group.add(rail);
  }

  // The ballast: a low, wider, darker box under the rails.
  const ballast = new THREE.Mesh(
    boxGeometry([
      { centre: [0, 0, 0], size: [layout.length + 4, BALLAST_DEPTH, BALLAST_WIDTH] },
    ]),
    ballastMaterial,
  );
  ballast.name = 'ballast';
  ballast.position.set(layout.centre, GROUND_Y + BALLAST_DEPTH / 2, 0);
  ballast.castShadow = false;
  ballast.receiveShadow = false;
  group.add(ballast);

  // The sleepers: one box, repeated along the line.
  const sleepers = new THREE.InstancedMesh(
    boxGeometry([
      { centre: [0, 0, 0], size: [SLEEPER_WIDTH, SLEEPER_DEPTH, SLEEPER_LENGTH] },
    ]),
    sleeperMaterial,
    Math.max(1, layout.sleepers.length),
  );
  sleepers.name = 'sleepers';
  sleepers.castShadow = false;
  sleepers.receiveShadow = false;
  sleepers.frustumCulled = false;
  sleepers.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  group.add(sleepers);

  // The catenary masts: a post with an arm, every few stations.
  const masts = new THREE.InstancedMesh(
    mastGeometry(),
    mastMaterial,
    Math.max(1, layout.masts.length),
  );
  masts.name = 'masts';
  masts.castShadow = false;
  masts.receiveShadow = false;
  masts.frustumCulled = false;
  masts.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  group.add(masts);

  // The city: one unit box, scaled into a skyline behind the line.
  const city = new THREE.InstancedMesh(
    boxGeometry([{ centre: [0, 0, 0], size: [1, 1, 1] }]),
    cityMaterial,
    Math.max(1, layout.buildings.length),
  );
  city.name = 'city';
  city.castShadow = false;
  city.receiveShadow = false;
  city.frustumCulled = false;
  city.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  group.add(city);

  return { group, sleepers, masts, city };
}

/**
 * The instance matrices.
 *
 * One dummy object writes every matrix, so the sleepers, the masts and the
 * buildings all come from the same place, and the buffers are flagged as
 * static because none of them ever moves.
 */
function applyInstances(parts: TrackParts, layout: TrackLayout): void {
  const dummy = new THREE.Object3D();

  // The sleepers, laid at a regular interval along the line.
  parts.sleepers.count = layout.sleepers.length;
  layout.sleepers.forEach((x, index) => {
    dummy.position.set(x, SLEEPER_CENTRE_Y, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    parts.sleepers.setMatrixAt(index, dummy.matrix);
  });
  parts.sleepers.instanceMatrix.needsUpdate = true;

  // The masts, standing beside the line with their arms over the track.
  parts.masts.count = layout.masts.length;
  layout.masts.forEach((x, index) => {
    dummy.position.set(x, GROUND_Y, MAST_Z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    parts.masts.setMatrixAt(index, dummy.matrix);
  });
  parts.masts.instanceMatrix.needsUpdate = true;

  // The city: a block of its own height and depth on the ground.
  parts.city.count = layout.buildings.length;
  layout.buildings.forEach((building, index) => {
    dummy.position.set(
      building.x,
      GROUND_Y + building.height / 2,
      building.z,
    );
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(building.width, building.height, building.depth);
    dummy.updateMatrix();
    parts.city.setMatrixAt(index, dummy.matrix);
  });
  parts.city.instanceMatrix.needsUpdate = true;
}

/**
 * Build the track.
 *
 * The pure half of the module: it makes the group, it writes the instance
 * matrices and it says what it costs, and it reads no DOM and no clock, so
 * a test can call it and count what it finds.
 */
export function buildTrack(options: { stations: number; detail: Detail }): {
  group: THREE.Group;
  /** How many draw calls the track costs. */
  drawCalls: number;
} {
  const layout = buildLayout(options);
  const parts = buildParts(layout);
  applyInstances(parts, layout);
  BUILDS.set(parts.group, { parts, layout });

  return { group: parts.group, drawCalls: countMeshes(parts.group) };
}

/**
 * Give back everything the track made.
 *
 * The geometries and the materials are ours, so we dispose of them when the
 * track goes away. The set keeps the two rails, which share one geometry,
 * from being disposed of twice.
 */
function disposeGroup(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => materials.add(entry));
    else if (material) materials.add(material);
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

export interface TrackProps {
  /** How many stations the line has. */
  stations: number;
  /** Fewer instances on a low-end device. */
  detail: Detail;
}

/**
 * The props of the element the track is mounted on.
 *
 * `ThreeElements` is imported for its type alone: it is what teaches the
 * compiler that `<primitive>` is an element at all.
 */
type PrimitiveProps = ThreeElements['primitive'];

/**
 * The track.
 *
 * The whole thing is one group built in memory, mounted as a primitive.
 * The group is rebuilt when the line or the detail level changes, and it is
 * disposed of when it is thrown away.
 */
export function Track(props: TrackProps): JSX.Element {
  const { stations, detail } = props;

  const built = useMemo(() => buildTrack({ stations, detail }), [stations, detail]);

  // The matrices are written once when the group is built and written again
  // when it is mounted, so the buffer is always the one the renderer reads.
  useLayoutEffect(() => {
    const build = BUILDS.get(built.group);
    if (build) applyInstances(build.parts, build.layout);
  }, [built]);

  useEffect(() => () => disposeGroup(built.group), [built]);

  const mount: PrimitiveProps = { object: built.group, dispose: null };
  return <primitive {...mount} />;
}
