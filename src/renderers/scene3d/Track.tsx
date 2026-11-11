/**
 * The track and the city.
 *
 * The line weaves between two lanes. The ballast, both running rails and the
 * third rail are ribbons extruded along the smoothed path, so they turn with
 * the track instead of being boxes laid on a straight axis. Sleepers and the
 * city are instanced.
 *
 * Seven draw calls: ballast, two running rails, third rail, third-rail cover,
 * sleepers and one city mesh. Nothing here knows what a station is called.
 */

import { useEffect, useMemo } from 'react';
import type { JSX } from 'react';
import * as THREE from 'three';

import { RAIL_GAUGE, SCENE_COLORS } from './constants';
import { buildLine, type LinePath } from './path';
import type { Detail } from './tier';

/* ------------------------------------------------------------------ *
 * Density
 * ------------------------------------------------------------------ */

const SLEEPER_INTERVAL: Record<Detail, number> = { high: 1.7, low: 5 };

const CITY_COUNT: Record<Detail, number> = { high: 320, low: 170 };

const CITY_HEIGHT: Record<Detail, number> = { high: 58, low: 16 };

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
 * A flat strip following the line.
 *
 * `offset` is signed distance from the centreline on the right-hand normal,
 * `width` is the strip's width and `y` is its height. The strip is double
 * sided because the camera can look at it from either side of a curve.
 */
function ribbon(
  line: LinePath,
  offset: number,
  width: number,
  y: number,
  color: string,
): THREE.Mesh {
  const count = line.points.length;
  const positions = new Float32Array(count * 2 * 3);
  const indices: number[] = [];
  const half = width / 2;

  for (let i = 0; i < count; i += 1) {
    const point = line.points[i];
    const before = line.points[Math.max(0, i - 1)];
    const after = line.points[Math.min(count - 1, i + 1)];
    const tx = after.x - before.x;
    const tz = after.z - before.z;
    const length = Math.hypot(tx, tz) || 1;
    const nx = -tz / length;
    const nz = tx / length;
    const a = offset - half;
    const b = offset + half;
    positions[i * 6] = point.x + nx * a;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = point.z + nz * a;
    positions[i * 6 + 3] = point.x + nx * b;
    positions[i * 6 + 4] = y;
    positions[i * 6 + 5] = point.z + nz * b;

    if (i > 0) {
      const j = i * 2;
      indices.push(j - 2, j - 1, j, j - 1, j + 1, j);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      color,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** A sleeper: a dark timber laid across the rails. */
function sleeperGeometry(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(RAIL_GAUGE + 1.5, 0.18, 0.4);
}

/** One block of the city. */
interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
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

  const ballast = ribbon(line, 0, 4.8, -0.22, SCENE_COLORS.ballast);
  ballast.name = 'ballast';
  group.add(ballast);

  [-1, 1].forEach((side) => {
    const rail = ribbon(line, (side * RAIL_GAUGE) / 2, 0.17, 0.03, SCENE_COLORS.rail);
    rail.name = side < 0 ? 'rail-left' : 'rail-right';
    group.add(rail);
  });

  const third = ribbon(line, 1.25, 0.14, 0.3, SCENE_COLORS.rail);
  third.name = 'third-rail';
  group.add(third);

  const cover = ribbon(line, 1.25, 0.5, 0.54, SCENE_COLORS.grey);
  cover.name = 'third-rail-cover';
  group.add(cover);

  const sleepers = new THREE.InstancedMesh(
    sleeperGeometry(),
    new THREE.MeshLambertMaterial({ color: SCENE_COLORS.sleeper, flatShading: true }),
    Math.max(1, Math.ceil(line.total / SLEEPER_INTERVAL[detail]) + 2),
  );
  sleepers.name = 'sleepers';
  sleepers.frustumCulled = false;
  sleepers.castShadow = false;
  sleepers.receiveShadow = false;
  sleepers.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const dummy = new THREE.Object3D();
  let sleeperCount = 0;
  for (let d = 0; d <= line.total; d += SLEEPER_INTERVAL[detail]) {
    if (sleeperCount >= sleepers.count) break;
    // Walk the path by sampling the distance table directly.
    const pose = sample(line, d);
    dummy.position.set(pose.x, -0.08, pose.z);
    dummy.rotation.set(0, Math.atan2(-pose.tz, pose.tx), 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    sleepers.setMatrixAt(sleeperCount, dummy.matrix);
    sleeperCount += 1;
  }
  sleepers.count = sleeperCount;
  sleepers.instanceMatrix.needsUpdate = true;
  group.add(sleepers);

  const blocks = cityBlocks(line, detail);
  const city = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
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
    dummy.position.set(block.x, block.height / 2 - 0.55, block.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(block.width, block.height, block.depth);
    dummy.updateMatrix();
    city.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.55 + palette() * 0.08, 0.12, 0.38 + palette() * 0.22);
    city.setColorAt(index, color);
  });
  city.count = blocks.length;
  city.instanceMatrix.needsUpdate = true;
  if (city.instanceColor) city.instanceColor.needsUpdate = true;
  group.add(city);

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
