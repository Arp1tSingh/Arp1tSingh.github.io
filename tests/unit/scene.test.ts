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

  it('is between twelve and twenty thousand triangles', () => {
    const triangles = countTriangles(train);
    expect(triangles).toBeGreaterThanOrEqual(12000);
    expect(triangles).toBeLessThanOrEqual(20000);
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
