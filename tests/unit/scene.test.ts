import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { CONTENT } from '../../src/data/content';
import { buildTrain } from '../../src/renderers/scene3d/Train';
import { buildStation } from '../../src/renderers/scene3d/StationKit';
import { buildDiorama } from '../../src/renderers/scene3d/Dioramas';
import { buildTrack } from '../../src/renderers/scene3d/Track';
import { STATION_SPACING, TRAIN_LENGTH } from '../../src/renderers/scene3d/constants';

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

describe('the track', () => {
  const built = buildTrack({ stations: 12, detail: 'high' });

  it('costs a handful of draw calls', () => {
    expect(countMeshes(built.group)).toBeLessThanOrEqual(8);
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
  it('are under eight thousand triangles and eight draw calls each', () => {
    for (const stop of CONTENT.stops) {
      const station = buildStation({ stop, active: false });
      expect(countTriangles(station), stop.id).toBeLessThan(8000);
      expect(countMeshes(station), stop.id).toBeLessThanOrEqual(8);
    }
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
