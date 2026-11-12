import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { CONTENT } from '../../src/data/content';
import { buildTrain } from '../../src/renderers/scene3d/Train';
import { buildStation, PLATFORM_DEPTH, PLATFORM_EDGE } from '../../src/renderers/scene3d/StationKit';
import { buildDiorama } from '../../src/renderers/scene3d/Dioramas';
import { buildTrack, towerLayout } from '../../src/renderers/scene3d/Track';
import {
  STATION_SPACING,
  TRAIN_HALF_WIDTH,
  TRAIN_LENGTH,
  stationAnchor,
  stationX,
} from '../../src/renderers/scene3d/constants';
import { buildLine, type LinePath } from '../../src/renderers/scene3d/path';

function countTriangles(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    const vertices = geometry.index
      ? geometry.index.count
      : (geometry.getAttribute('position')?.count ?? 0);
    triangles += vertices / 3;
  });
  return Math.round(triangles);
}

function countMeshes(root: THREE.Object3D): number {
  let meshes = 0;
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes += 1;
  });
  return meshes;
}

/** The shortest distance from a point to the smoothed centreline, in XZ. */
function distanceToLine(line: LinePath, x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < line.points.length - 1; i += 1) {
    const a = line.points[i];
    const b = line.points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = dx * dx + dz * dz;
    const t =
      length > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / length)) : 0;
    const px = a.x + dx * t - x;
    const pz = a.z + dz * t - z;
    best = Math.min(best, px * px + pz * pz);
  }
  return Math.sqrt(best);
}

describe('the track', () => {
  const built = buildTrack({ stations: 12, detail: 'high' });

  it('costs eight draw calls', () => {
    expect(countMeshes(built.group)).toBe(8);
    expect(built.drawCalls).toBe(countMeshes(built.group));
  });

  it('covers the whole line', () => {
    const furthest = new THREE.Box3().setFromObject(built.group);
    expect(furthest.max.x).toBeGreaterThanOrEqual((12 - 1) * STATION_SPACING);
  });

  it('lays its sleepers across the line, not along it', () => {
    const sleepers = built.group.getObjectByName('sleepers') as THREE.InstancedMesh;
    expect(sleepers.count).toBeGreaterThan(700);

    const first = new THREE.Matrix4();
    const second = new THREE.Matrix4();
    sleepers.getMatrixAt(0, first);
    sleepers.getMatrixAt(1, second);

    const p0 = new THREE.Vector3().setFromMatrixPosition(first);
    const p1 = new THREE.Vector3().setFromMatrixPosition(second);
    const along = p1.clone().sub(p0).normalize();
    const across = new THREE.Vector3(1, 0, 0).applyQuaternion(
      new THREE.Quaternion().setFromRotationMatrix(first),
    );

    // The 3.4-unit axis is the one that crosses the rails.
    expect(Math.abs(across.dot(along))).toBeLessThan(0.1);
    expect(p0.distanceTo(p1)).toBeCloseTo(1.5, 1);
  });

  it('gives the rails and ballast a profile instead of a flat ribbon', () => {
    const rail = built.group.getObjectByName('rail-left') as THREE.Mesh;
    const ballast = built.group.getObjectByName('ballast') as THREE.Mesh;
    rail.geometry.computeBoundingBox();
    ballast.geometry.computeBoundingBox();

    const railBox = rail.geometry.boundingBox!;
    const ballastBox = ballast.geometry.boundingBox!;
    expect(railBox.max.y - railBox.min.y).toBeGreaterThan(0.12);
    expect(ballastBox.max.y - ballastBox.min.y).toBeGreaterThan(0.15);
  });

  it('draws less on a low-end device', () => {
    const low = buildTrack({ stations: 12, detail: 'low' });
    const high = buildTrack({ stations: 12, detail: 'high' });
    expect(countMeshes(low.group)).toBe(countMeshes(high.group));

    const instances = (group: THREE.Object3D) => {
      let total = 0;
      group.traverse((object) => {
        const mesh = object as THREE.InstancedMesh;
        if (mesh.isInstancedMesh) total += mesh.count;
      });
      return total;
    };

    expect(instances(low.group)).toBeLessThan(instances(high.group));
  });

  it('is densest at Dadar and stops after Thane', () => {
    const line = buildLine(12);
    const towers = towerLayout(line);
    const counts = new Array(12).fill(0) as number[];
    towers.forEach((tower) => {
      counts[tower.station] += 1;
    });

    expect(counts.slice(0, 6)).toEqual([3, 2, 2, 1, 1, 1]);
    expect(counts.slice(6)).toEqual([0, 0, 0, 0, 0, 0]);
    // No tower stands past Thane, even after the lateral offset from the line.
    expect(Math.max(...towers.map((tower) => tower.x))).toBeLessThan(stationX(5));
  });

  it('tapers from Dadar down to Thane', () => {
    const towers = towerLayout(buildLine(12));
    const at = (station: number) => towers.filter((tower) => tower.station === station);
    const dadar = at(0);
    const thane = at(5);

    expect(Math.min(...dadar.map((tower) => tower.height))).toBeGreaterThanOrEqual(95);
    expect(Math.max(...dadar.map((tower) => tower.height))).toBeLessThanOrEqual(110);
    expect(Math.max(...thane.map((tower) => tower.height))).toBeLessThanOrEqual(78);
    expect(Math.max(...thane.map((tower) => tower.height))).toBeLessThan(
      Math.min(...dadar.map((tower) => tower.height)),
    );
  });

  it('draws the towers in their own mesh', () => {
    const towers = built.group.getObjectByName('towers') as THREE.InstancedMesh;
    const city = built.group.getObjectByName('city') as THREE.InstancedMesh;
    expect(towers).toBeDefined();
    expect(city.count).toBe(320);
    expect(towers.count).toBeGreaterThan(20);
  });
});

describe('the train', () => {
  const train = buildTrain();

  it('stays under a small triangle budget', () => {
    const triangles = countTriangles(train);
    expect(triangles).toBeGreaterThanOrEqual(5000);
    expect(triangles).toBeLessThanOrEqual(9000);
  });

  it('costs a small number of draw calls', () => {
    expect(countMeshes(train)).toBeLessThanOrEqual(12);
  });

  it('is about as long as the train the layout expects', () => {
    const box = new THREE.Box3().setFromObject(train);
    const length = box.max.x - box.min.x;
    expect(length).toBeGreaterThan(TRAIN_LENGTH * 0.75);
    expect(length).toBeLessThan(TRAIN_LENGTH * 1.35);
  });

  it('is a low, wide set rather than a box', () => {
    const box = new THREE.Box3().setFromObject(train);
    const height = box.max.y - box.min.y;
    expect(height).toBeLessThan(6);
    expect(height).toBeGreaterThan(1);
  });
});

describe('the stations', () => {
  const line = buildLine(CONTENT.stops.length);

  it('are under eight thousand triangles and eight draw calls each', () => {
    CONTENT.stops.forEach((stop, index) => {
      const station = buildStation({ stop, active: false, line, index });
      expect(countTriangles(station), stop.id).toBeLessThan(8000);
      expect(countMeshes(station), stop.id).toBeLessThanOrEqual(8);
    });
  });

  it('leave the train room along the whole platform', () => {
    expect(PLATFORM_EDGE).toBeGreaterThanOrEqual(TRAIN_HALF_WIDTH + 0.5);

    CONTENT.stops.forEach((stop, index) => {
      const station = buildStation({ stop, active: false, line, index });
      const anchor = stationAnchor(index);
      let nearest = Infinity;

      station.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const positions = mesh.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i += 1) {
          const x = positions.getX(i) + anchor.x;
          const z = positions.getZ(i) + anchor.z;
          nearest = Math.min(nearest, distanceToLine(line, x, z));
        }
      });

      // The old straight slab cut the corner here. The swept edge keeps a
      // constant offset, so nothing on the station reaches the train.
      expect(nearest, stop.id).toBeGreaterThanOrEqual(TRAIN_HALF_WIDTH + 0.5);
    });
  });

  it('keeps its full depth around the curve', () => {
    CONTENT.stops.forEach((stop, index) => {
      const station = buildStation({ stop, active: false, line, index });
      const anchor = stationAnchor(index);
      const structure = station.getObjectByName(`station-${stop.id}-structure`) as THREE.Mesh;
      const positions = structure.geometry.getAttribute('position');
      let farthest = 0;

      for (let i = 0; i < positions.count; i += 1) {
        farthest = Math.max(
          farthest,
          distanceToLine(line, positions.getX(i) + anchor.x, positions.getZ(i) + anchor.z),
        );
      }

      expect(farthest, stop.id).toBeGreaterThanOrEqual(
        PLATFORM_EDGE + PLATFORM_DEPTH - 0.3,
      );
    });
  });
});

describe('the dioramas', () => {
  it('are under three thousand triangles and three draw calls each', () => {
    for (const stop of CONTENT.stops) {
      const prop = buildDiorama(stop);
      expect(prop, `${stop.id} has no prop`).not.toBeNull();
      if (!prop) continue;
      expect(countTriangles(prop), stop.id).toBeLessThan(3000);
      expect(countMeshes(prop), stop.id).toBeLessThanOrEqual(3);
    }
  });

  it('renders nothing for a prop nobody has heard of', () => {
    const stop = { ...CONTENT.stops[0], prop: 'a thing nobody has heard of' };
    expect(buildDiorama(stop)).toBeNull();
  });
});
