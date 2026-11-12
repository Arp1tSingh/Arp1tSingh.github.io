import { describe, expect, it } from 'vitest';

import {
  buildLine,
  makePose,
  poseAt,
  routeDistance,
  yawAlong,
} from '../../src/renderers/scene3d/path';
import {
  LEAD_IN,
  STATION_SPACING,
  TRAIN_LENGTH,
  stationAnchor,
} from '../../src/renderers/scene3d/constants';

describe('the line', () => {
  const line = buildLine(12);

  it('runs from the lead-in to the last station', () => {
    expect(line.total).toBeGreaterThan((12 - 1) * STATION_SPACING);
    expect(line.points[0].x).toBeCloseTo(-LEAD_IN, 6);
    expect(line.points[line.points.length - 1].x).toBeGreaterThan(
      (12 - 1) * STATION_SPACING,
    );
  });

  it('weaves between the two lanes without leaving them', () => {
    for (const point of line.points) {
      expect(Math.abs(point.z)).toBeLessThanOrEqual(15 + 1e-6);
    }
    const lanes = new Set(line.stations.map((d) => (poseAt(line, d, makePose()).p.z > 0 ? 1 : -1)));
    expect(lanes.size).toBe(2);
  });

  it('is longer than the straight distance between the ends', () => {
    const first = line.points[0];
    const last = line.points[line.points.length - 1];
    expect(line.total).toBeGreaterThan(last.x - first.x);
  });

  it('puts every station on its anchor', () => {
    for (let index = 0; index < 12; index += 1) {
      const anchor = stationAnchor(index);
      const pose = poseAt(line, line.stations[index], makePose());
      expect(pose.p.x).toBeCloseTo(anchor.x, 1);
      expect(pose.p.z).toBeCloseTo(anchor.z, 1);
      expect(pose.p.y).toBe(0);
    }
  });

  it('has station distances in order', () => {
    for (let index = 1; index < line.stations.length; index += 1) {
      expect(line.stations[index]).toBeGreaterThan(line.stations[index - 1]);
    }
  });

  it('has a unit tangent at every distance', () => {
    for (let d = 0; d <= line.total; d += 5) {
      const pose = poseAt(line, d, makePose());
      expect(pose.t.length()).toBeCloseTo(1, 6);
    }
  });

  it('keeps the train level with every platform', () => {
    const underTrain = TRAIN_LENGTH / 2;
    for (let index = 0; index < 12; index += 1) {
      const centre = line.stations[index];
      const anchor = stationAnchor(index);
      const middle = poseAt(line, centre, makePose());
      expect(Math.abs(middle.p.x - anchor.x)).toBeLessThan(0.01);
      expect(Math.abs(middle.p.z - anchor.z)).toBeLessThan(0.001);
      expect(Math.abs(middle.t.z)).toBeLessThan(0.02);

      for (const offset of [-underTrain, underTrain]) {
        const pose = poseAt(line, centre + offset, makePose());
        // The smoothed wave leans less than a metre under the train, so the
        // car ends still sit beside the platform edge rather than over it.
        expect(Math.abs(pose.p.z - anchor.z)).toBeLessThan(1.25);
      }
    }
  });

  it('turns without a kink between samples', () => {
    let previous = poseAt(line, 0, makePose()).t.clone();
    let largest = 0;
    for (let d = 0.25; d <= line.total; d += 0.25) {
      const next = poseAt(line, d, makePose()).t.clone();
      largest = Math.max(largest, previous.angleTo(next));
      previous = next;
    }
    // Two Chaikin rounds used to step almost 0.21 rad at one vertex. Four
    // rounds with a blended tangent stay well under 0.01 rad per 0.25 units.
    expect(largest).toBeLessThan(0.01);
  });

  it('clamps before the start and after the end', () => {
    const start = poseAt(line, -50, makePose());
    const end = poseAt(line, line.total + 50, makePose());
    expect(start.p.x).toBeCloseTo(line.points[0].x, 6);
    expect(end.p.x).toBeCloseTo(line.points[line.points.length - 1].x, 6);
  });
});

describe('route distance', () => {
  const line = buildLine(12);

  it('lands exactly on each station', () => {
    for (let index = 0; index < 12; index += 1) {
      expect(routeDistance(line.stations, index)).toBeCloseTo(line.stations[index], 9);
    }
  });

  it('interpolates between two stops', () => {
    const halfway = routeDistance(line.stations, 2.5);
    expect(halfway).toBeCloseTo((line.stations[2] + line.stations[3]) / 2, 9);
  });

  it('clamps outside the line', () => {
    expect(routeDistance(line.stations, -2)).toBe(line.stations[0]);
    expect(routeDistance(line.stations, 99)).toBe(line.stations[11]);
  });
});

describe('the heading', () => {
  it('points a local +X model down the track', () => {
    const forward = poseAt(buildLine(2), 0, makePose()).t;
    const yaw = yawAlong(forward);
    expect(Math.cos(yaw)).toBeCloseTo(forward.x, 6);
    expect(-Math.sin(yaw)).toBeCloseTo(forward.z, 6);
  });

  it('turns a right-hand tangent into a negative yaw', () => {
    const tangent = poseAt(buildLine(2), 20, makePose()).t;
    const yaw = yawAlong(tangent);
    if (tangent.z > 0) expect(yaw).toBeLessThan(0);
    if (tangent.z < 0) expect(yaw).toBeGreaterThan(0);
  });
});
