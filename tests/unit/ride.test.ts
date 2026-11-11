import { describe, expect, it } from 'vitest';

import {
  advanceRide,
  RIDE_EPSILON,
  RIDE_MAX_SPEED,
  rideProgress,
  rideSettled,
} from '../../src/renderers/scene3d/ride';

describe('the ride clock', () => {
  it('follows the target by reducing the gap every frame', () => {
    let s = 0;
    let previous = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      s = advanceRide(s, 3, 1 / 60, false);
      expect(s).toBeGreaterThanOrEqual(previous);
      expect(s).toBeLessThanOrEqual(3);
      previous = s;
    }
    expect(s).toBeCloseTo(3, 2);
  });

  it('never overshoots the target', () => {
    let s = 4;
    for (let frame = 0; frame < 120; frame += 1) {
      s = advanceRide(s, 1.5, 1 / 60, false);
      expect(s).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('caps a jump to another line at the ride speed', () => {
    const step = advanceRide(0, 12, 1 / 60, false);
    expect(step).toBeLessThanOrEqual(RIDE_MAX_SPEED / 60 + 1e-12);
  });

  it('snaps when motion is reduced', () => {
    expect(advanceRide(0, 9, 1 / 60, true)).toBe(9);
  });

  it('settles on the target rather than buzzing around it', () => {
    let s = 2;
    for (let frame = 0; frame < 200; frame += 1) {
      s = advanceRide(s, 2.0005, 1 / 60, false);
    }
    expect(s).toBe(2.0005);
    expect(rideSettled(s, 2.0005)).toBe(true);
  });

  it('treats a tiny gap as arrived', () => {
    const target = 1 + RIDE_EPSILON / 2;
    expect(advanceRide(1, target, 1 / 60, false)).toBe(target);
  });

  it('is frame-rate independent to within a frame', () => {
    const sixty = Array.from({ length: 60 }, () => 0).reduce<number>(
      (s) => advanceRide(s, 1, 1 / 60, false),
      0,
    );
    const thirty = Array.from({ length: 30 }, () => 0).reduce<number>(
      (s) => advanceRide(s, 1, 1 / 30, false),
      0,
    );
    expect(sixty).toBeCloseTo(thirty, 2);
  });

  it('ignores a negative or absurd frame time', () => {
    expect(advanceRide(1, 2, -1, false)).toBeGreaterThanOrEqual(1);
    const bounded = advanceRide(0, 1, 100, false);
    expect(bounded).toBeLessThanOrEqual(RIDE_MAX_SPEED * 0.1 + 1e-12);
  });
});

describe('journey progress', () => {
  it('runs from zero to one across the stops', () => {
    expect(rideProgress(0, 8)).toBe(0);
    expect(rideProgress(7, 8)).toBe(1);
    expect(rideProgress(3.5, 8)).toBeCloseTo(0.5, 12);
  });

  it('clamps outside the line', () => {
    expect(rideProgress(-3, 8)).toBe(0);
    expect(rideProgress(99, 8)).toBe(1);
  });

  it('returns dawn for a single stop', () => {
    expect(rideProgress(2, 1)).toBe(0);
  });
});
