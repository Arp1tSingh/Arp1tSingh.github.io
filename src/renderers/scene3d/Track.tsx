/**
 * The track and the city.
 *
 * The line weaves between two lanes. The ballast, both running rails, the
 * third rail and its cover are profiled ribbons extruded along the smoothed
 * path, so they turn with the track instead of being boxes laid on a
 * straight axis. Sleepers and the city are instanced.
 *
 * The refinements are the ones the concept got right: sleepers lie across
 * the rails at a real interval, the rails have a head and a web rather than
 * being flat strips, and the ballast is a shallow bed with shoulders. There
 * are still no catenary masts and no new furniture.
 *
 * Eight draw calls: ballast, two running rails, third rail, third-rail cover,
 * sleepers, the small city and the tower skyline. Nothing here knows what a
 * station is called.
 */

import { useEffect, useMemo } from 'react';
import type { JSX } from 'react';
import * as THREE from 'three';

import { RAIL_GAUGE, SCENE_COLORS } from './constants';
import { buildLine, type LinePath } from './path';
import type { Detail } from './tier';

/* ------------------------------------------------------------------ *
 * Density and track layers
 * ------------------------------------------------------------------ */

const SLEEPER_INTERVAL: Record<Detail, number> = { high: 1.5, low: 5 };

const CITY_COUNT: Record<Detail, number> = { high: 320, low: 170 };

const CITY_HEIGHT: Record<Detail, number> = { high: 58, low: 16 };

/** The bed: a shallow trapezoid, wide enough to leave ballast shoulders. */
const BALLAST_TOP = -0.18;
const BALLAST_BASE = -0.4;
const BALLAST_TOP_HALF = 2.3;
const BALLAST_BASE_HALF = 2.9;

/** A sleeper rests on the bed; its top is the foot of the rail. */
const SLEEPER_HEIGHT = 0.24;

/** The third rail is lower than the running rail; its cover clears both. */
const THIRD_RAIL_OFFSET = 1.25;

/**
 * How far the city stands back from the line.
 *
 * The camera rides eleven units to the right of the track, so a block at
 * thirty units filled half the frame with a flat grey wall at Thane. The
 * near row is kept low and the towers are set well back.
 */
const CITY_SETBACK = 46;
const CITY_SPREAD = 120;
const CITY_NEAR_HEIGHT = 0.2;

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

type ProfilePoint = readonly [lateral: number, height: number];

/** A running rail: head, web and foot, in cross-section. */
const RAIL_PROFILE: readonly ProfilePoint[] = [
  [0.065, 0.22],
  [0.075, 0.2],
  [0.075, 0.17],
  [0.03, 0.155],
  [0.03, 0.105],
  [0.115, 0.09],
  [0.115, 0.06],
  [-0.115, 0.06],
  [-0.115, 0.09],
  [-0.03, 0.105],
  [-0.03, 0.155],
  [-0.075, 0.17],
  [-0.075, 0.2],
  [-0.065, 0.22],
];

/** The conductor rail, a bar with a chamfered top. */
const THIRD_RAIL_PROFILE: readonly ProfilePoint[] = [
  [0.07, 0.34],
  [0.09, 0.31],
  [0.09, 0.12],
  [-0.09, 0.12],
  [-0.09, 0.31],
  [-0.07, 0.34],
];

/** The protective cover, a shallow peaked plate over the conductor. */
const THIRD_RAIL_COVER_PROFILE: readonly ProfilePoint[] = [
  [-0.16, 0.52],
  [0.16, 0.52],
  [0.3, 0.46],
  [0.3, 0.42],
  [-0.3, 0.42],
  [-0.3, 0.46],
];

/** The ballast bed: a trapezoid with a shoulder either side. */
const BALLAST_PROFILE: readonly ProfilePoint[] = [
  [-BALLAST_TOP_HALF, BALLAST_TOP],
  [BALLAST_TOP_HALF, BALLAST_TOP],
  [BALLAST_BASE_HALF, BALLAST_BASE],
  [-BALLAST_BASE_HALF, BALLAST_BASE],
];

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

/** Stable 0..1 noise for a vertex, so the ballast does not read as flat. */
function vertexNoise(i: number, j: number): number {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(j + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A cross-section extruded along the line.
 *
 * The profile is a list of `[lateral, height]` points in clockwise order
 * when seen from behind the ring, which makes the computed normals face
 * outward. `vary` adds a little per-vertex shade to a surface; the ballast
 * uses it to break up what would otherwise be a long flat ribbon.
 */
function profileRibbon(
  line: LinePath,
  offset: number,
  profile: readonly ProfilePoint[],
  color: string,
  options: { vary?: number } = {},
): THREE.Mesh {
  const count = line.points.length;
  const ring = profile.length;
  const positions = new Float32Array(count * ring * 3);
  const indices: number[] = [];
  const vary = options.vary ?? 0;

  for (let i = 0; i < count; i += 1) {
    const point = line.points[i];
    const before = line.points[Math.max(0, i - 1)];
    const after = line.points[Math.min(count - 1, i + 1)];
    const tx = after.x - before.x;
    const tz = after.z - before.z;
    const length = Math.hypot(tx, tz) || 1;
    const nx = -tz / length;
    const nz = tx / length;

    for (let j = 0; j < ring; j += 1) {
      const [lateral, y] = profile[j];
      const at = (i * ring + j) * 3;
      positions[at] = point.x + nx * (offset + lateral);
      positions[at + 1] = y;
      positions[at + 2] = point.z + nz * (offset + lateral);
    }

    if (i > 0) {
      for (let j = 0; j < ring; j += 1) {
        const next = (j + 1) % ring;
        const a = (i - 1) * ring + j;
        const b = (i - 1) * ring + next;
        const c = i * ring + j;
        const d = i * ring + next;
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  let material: THREE.MeshLambertMaterial;
  if (vary > 0) {
    const tint = new THREE.Color(color);
    const colors = new Float32Array(count * ring * 3);
    for (let i = 0; i < count; i += 1) {
      for (let j = 0; j < ring; j += 1) {
        const shade = 1 - vary * 0.5 + vary * vertexNoise(i, j);
        const at = (i * ring + j) * 3;
        colors[at] = tint.r * shade;
        colors[at + 1] = tint.g * shade;
        colors[at + 2] = tint.b * shade;
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    material = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true });
  } else {
    material = new THREE.MeshLambertMaterial({ color });
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** One block of the city. */
interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  /** The bottom of the block. Defaults to the city's ground line. */
  base?: number;
  /** A per-instance tint, used by the towers. */
  colour?: string;
}

/**
 * The tower plan.
 *
 * The small blocks are spread along the whole line, but the towers are the
 * skyline's narrative: three over Dadar, thinning to one at Thane, and none
 * at all after it. Heights taper on the same arc, so the ride out of the
 * city reads as the city falling away.
 */
const TOWER_COUNTS = [3, 2, 2, 1, 1, 1] as const;

/** The low and high end of each station's tower height, in world units. */
const TOWER_HEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [95, 110],
  [88, 100],
  [82, 94],
  [78, 88],
  [74, 82],
  [70, 78],
];

/** How far back each station's towers stand from the line. */
const TOWER_SETBACKS: ReadonlyArray<readonly [number, number]> = [
  [64, 96],
  [76, 104],
  [84, 112],
  [92, 120],
  [104, 132],
  [116, 144],
];

/** Where each tower sits along the track relative to its station. Thane's
 * single tower stands before the station, so nothing is left after it. */
const TOWER_ALONG: ReadonlyArray<ReadonlyArray<number>> = [
  [-20, 4, 26],
  [-14, 14],
  [-14, 16],
  [-8],
  [6],
  [-12],
];

const TOWER_TINTS = [
  SCENE_COLORS.canopy,
  SCENE_COLORS.grey,
  SCENE_COLORS.greyDim,
  SCENE_COLORS.inkPanel,
] as const;

/** One tower, before it is split into its tiers. */
export interface TowerSpec {
  /** The station index the tower belongs to. */
  station: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  /** The share of the height taken by the wide lower tier. */
  baseFraction: number;
  /** The crown's footprint as a share of the base. */
  crownScale: number;
  /** Zero when the tower has no spire. */
  spireHeight: number;
  colour: string;
}

/**
 * Lay the towers out along the line.
 *
 * This is pure geometry, so the distribution can be asserted without a
 * canvas: the plan is the contract, the instanced mesh is only how it is
 * drawn.
 */
export function towerLayout(line: LinePath): TowerSpec[] {
  const random = seeded(line.stations.length * 15485863 + 7);
  const towers: TowerSpec[] = [];
  const zones = Math.min(TOWER_COUNTS.length, line.stations.length);

  for (let station = 0; station < zones; station += 1) {
    const count = TOWER_COUNTS[station];
    const [lowHeight, highHeight] = TOWER_HEIGHTS[station];
    const [nearSetback, farSetback] = TOWER_SETBACKS[station];
    const along = TOWER_ALONG[station];

    for (let i = 0; i < count; i += 1) {
      const side = ((station + i) % 2 === 0 ? -1 : 1) as -1 | 1;
      const setback = nearSetback + random() * (farSetback - nearSetback);
      const pose = sample(line, line.stations[station] + along[i]);
      const height = lowHeight + random() * (highHeight - lowHeight);

      towers.push({
        station,
        x: pose.x - pose.tz * side * setback,
        z: pose.z + pose.tx * side * setback,
        width: 7 + random() * 7,
        depth: 7 + random() * 7,
        height,
        baseFraction: 0.55 + random() * 0.12,
        crownScale: 0.58 + random() * 0.12,
        spireHeight: random() < 0.45 ? 6 + random() * 6 : 0,
        colour: TOWER_TINTS[Math.floor(random() * TOWER_TINTS.length)],
      });
    }
  }

  return towers;
}

/** Split each tower into a lower tier, a crown and an optional spire. */
function towerParts(towers: TowerSpec[]): Building[] {
  const parts: Building[] = [];

  towers.forEach((tower) => {
    const baseHeight = tower.height * tower.baseFraction;
    const crownHeight = tower.height - baseHeight;
    const crownWidth = tower.width * tower.crownScale;
    const crownDepth = tower.depth * tower.crownScale;
    const base = -0.6;

    parts.push({
      x: tower.x,
      z: tower.z,
      width: tower.width,
      depth: tower.depth,
      height: baseHeight,
      base,
      colour: tower.colour,
    });

    const crownBase = base + baseHeight;
    parts.push({
      x: tower.x,
      z: tower.z,
      width: crownWidth,
      depth: crownDepth,
      height: crownHeight,
      base: crownBase,
      colour: tower.colour,
    });

    if (tower.spireHeight > 0) {
      parts.push({
        x: tower.x,
        z: tower.z,
        width: 1.1,
        depth: 1.1,
        height: tower.spireHeight,
        base: crownBase + crownHeight,
        colour: SCENE_COLORS.greyDim,
      });
    }
  });

  return parts;
}

function cityBlocks(line: LinePath, detail: Detail): Building[] {
  const random = seeded(line.stations.length * 7919 + (detail === 'high' ? 17 : 29));
  const blocks: Building[] = [];
  const count = CITY_COUNT[detail];
  const tallest = CITY_HEIGHT[detail];

  for (let i = 0; i < count; i += 1) {
    // Place the block relative to the line's own normal, so the weave does
    // not put a tower on top of the camera.
    const pose = sample(line, random() * line.total);
    const side = random() < 0.5 ? -1 : 1;
    const setback = CITY_SETBACK + random() * CITY_SPREAD;
    const width = 6 + random() * 14;
    const depth = 6 + random() * 14;
    const rise = (setback - CITY_SETBACK) / CITY_SPREAD;
    const height = 3 + Math.pow(random(), 2.1) * tallest * (CITY_NEAR_HEIGHT + (1 - CITY_NEAR_HEIGHT) * rise);
    blocks.push({
      x: pose.x - pose.tz * side * setback,
      z: pose.z + pose.tx * side * setback,
      width,
      depth,
      height,
    });
  }

  return blocks;
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

export function buildTrack(options: { stations: number; detail: Detail }): {
  group: THREE.Group;
  drawCalls: number;
} {
  const stations = Math.max(1, Math.floor(options.stations));
  const { detail } = options;
  const line = buildLine(stations);
  const group = new THREE.Group();
  group.name = 'track';

  const ballast = profileRibbon(line, 0, BALLAST_PROFILE, SCENE_COLORS.ballast, { vary: 0.18 });
  ballast.name = 'ballast';
  group.add(ballast);

  [-1, 1].forEach((side) => {
    const rail = profileRibbon(line, (side * RAIL_GAUGE) / 2, RAIL_PROFILE, SCENE_COLORS.rail);
    rail.name = side < 0 ? 'rail-left' : 'rail-right';
    group.add(rail);
  });

  const third = profileRibbon(
    line,
    THIRD_RAIL_OFFSET,
    THIRD_RAIL_PROFILE,
    SCENE_COLORS.rail,
  );
  third.name = 'third-rail';
  group.add(third);

  const cover = profileRibbon(
    line,
    THIRD_RAIL_OFFSET,
    THIRD_RAIL_COVER_PROFILE,
    SCENE_COLORS.grey,
  );
  cover.name = 'third-rail-cover';
  group.add(cover);

  const sleepers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.4, SLEEPER_HEIGHT, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    Math.max(1, Math.ceil(line.total / SLEEPER_INTERVAL[detail]) + 2),
  );
  sleepers.name = 'sleepers';
  sleepers.frustumCulled = false;
  sleepers.castShadow = false;
  sleepers.receiveShadow = false;
  sleepers.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const sleeperColour = new THREE.Color(SCENE_COLORS.sleeper);
  const sleeperTint = new THREE.Color();
  const sleeperPalette = seeded(stations * 4093 + (detail === 'high' ? 11 : 19));
  const dummy = new THREE.Object3D();
  const sleeperY = BALLAST_TOP + SLEEPER_HEIGHT / 2;
  let sleeperCount = 0;
  for (let d = 0; d <= line.total; d += SLEEPER_INTERVAL[detail]) {
    if (sleeperCount >= sleepers.count) break;
    // Walk the path by sampling the distance table directly.
    const pose = sample(line, d);
    dummy.position.set(pose.x, sleeperY, pose.z);
    // lookAt points the box's +Z down the track, so its 3.4-unit X axis
    // lies across the rails. Without this the sleepers become one long plank.
    dummy.lookAt(pose.x + pose.tx, sleeperY, pose.z + pose.tz);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    sleepers.setMatrixAt(sleeperCount, dummy.matrix);
    sleepers.setColorAt(
      sleeperCount,
      sleeperTint.copy(sleeperColour).multiplyScalar(0.82 + sleeperPalette() * 0.36),
    );
    sleeperCount += 1;
  }
  sleepers.count = sleeperCount;
  sleepers.instanceMatrix.needsUpdate = true;
  if (sleepers.instanceColor) sleepers.instanceColor.needsUpdate = true;
  group.add(sleepers);

  const blocks = cityBlocks(line, detail);
  const city = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, dithering: true }),
    Math.max(1, blocks.length),
  );
  city.name = 'city';
  city.frustumCulled = false;
  city.castShadow = false;
  city.receiveShadow = false;
  city.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const color = new THREE.Color();
  const palette = seeded(stations * 104729 + (detail === 'high' ? 31 : 47));
  blocks.forEach((block, index) => {
    dummy.position.set(block.x, block.height / 2 - 0.6, block.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(block.width, block.height, block.depth);
    dummy.updateMatrix();
    city.setMatrixAt(index, dummy.matrix);
    // The concept's own spread: a little blue in the hue, a little life in
    // the saturation and lightness. A single grey made every silhouette
    // edge read as a hard line against the sky.
    color.setHSL(
      0.55 + palette() * 0.12,
      0.12 + palette() * 0.18,
      0.38 + palette() * 0.3,
      THREE.SRGBColorSpace,
    );
    city.setColorAt(index, color);
  });
  city.count = blocks.length;
  city.instanceMatrix.needsUpdate = true;
  if (city.instanceColor) city.instanceColor.needsUpdate = true;
  group.add(city);

  /* The towers are their own mesh: the small blocks can stay at their old
   * density and the skyline can change without rebuilding them. Each tower
   * is two stacked boxes and, sometimes, a thin spire. */
  const towers = towerParts(towerLayout(line));
  const towerMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, dithering: true }),
    Math.max(1, towers.length),
  );
  towerMesh.name = 'towers';
  towerMesh.frustumCulled = false;
  towerMesh.castShadow = false;
  towerMesh.receiveShadow = false;
  towerMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const towerColour = new THREE.Color();
  towers.forEach((block, index) => {
    dummy.position.set(block.x, (block.base ?? -0.6) + block.height / 2, block.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(block.width, block.height, block.depth);
    dummy.updateMatrix();
    towerMesh.setMatrixAt(index, dummy.matrix);
    towerColour.set(block.colour ?? SCENE_COLORS.grey);
    towerMesh.setColorAt(index, towerColour);
  });
  towerMesh.count = towers.length;
  towerMesh.instanceMatrix.needsUpdate = true;
  if (towerMesh.instanceColor) towerMesh.instanceColor.needsUpdate = true;
  group.add(towerMesh);

  return { group, drawCalls: countMeshes(group) };
}

/**
 * A small sampler for the static track build.
 *
 * `poseAt` is the public, allocation-free API; this wrapper keeps the
 * builder readable while it writes instance matrices.
 */
function sample(line: LinePath, distance: number): { x: number; z: number; tx: number; tz: number } {
  const d = Math.min(line.total, Math.max(0, distance));
  let lo = 0;
  let hi = line.points.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (line.cum[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  const a = line.points[lo];
  const b = line.points[lo + 1];
  const span = line.cum[lo + 1] - line.cum[lo];
  const alpha = span > 0 ? (d - line.cum[lo]) / span : 0;
  const tx = b.x - a.x;
  const tz = b.z - a.z;
  const length = Math.hypot(tx, tz) || 1;
  return {
    x: a.x + tx * alpha,
    z: a.z + tz * alpha,
    tx: tx / length,
    tz: tz / length,
  };
}

function countMeshes(root: THREE.Object3D): number {
  let meshes = 0;
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes += 1;
  });
  return meshes;
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

function disposeGroup(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((one) => materials.add(one));
    else if (material) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  group.clear();
}

export interface TrackProps {
  stations: number;
  detail: Detail;
}

export function Track({ stations, detail }: TrackProps): JSX.Element {
  const group = useMemo(() => buildTrack({ stations, detail }).group, [stations, detail]);
  useEffect(() => () => disposeGroup(group), [group]);
  return <primitive object={group} dispose={null} />;
}
