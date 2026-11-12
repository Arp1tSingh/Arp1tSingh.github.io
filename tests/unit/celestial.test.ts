import { describe, expect, it } from 'vitest';

import {
  celestialAt,
  moonElevation,
  SKY_RADIUS,
  starDome,
  starVisibility,
  sunElevation,
} from '../../src/renderers/scene3d/celestial';

describe('the sun and the moon', () => {
  it('are unit directions', () => {
    const state = celestialAt(0.42);
    expect(state.sun.length()).toBeCloseTo(1, 6);
    expect(state.moon.length()).toBeCloseTo(1, 6);
  });

  it('never jump between frames', () => {
    let previous = celestialAt(0).sun;
    for (let p = 0.002; p <= 1; p += 0.002) {
      const next = celestialAt(p).sun;
      expect(previous.angleTo(next)).toBeLessThan(0.03);
      previous = next;
    }
  });

  it('sets below the horizon before the terminus', () => {
    expect(sunElevation(0)).toBeGreaterThan(0.15);
    expect(sunElevation(0.5)).toBeGreaterThan(0.7);
    expect(sunElevation(0.86)).toBeLessThan(0.15);
    expect(sunElevation(0.9)).toBeLessThan(0.01);
    expect(sunElevation(1)).toBeLessThan(-0.2);
    expect(sunElevation(0.6)).toBeGreaterThan(sunElevation(0.8));
    expect(sunElevation(0.8)).toBeGreaterThan(sunElevation(0.92));
  });

  it('leaves the moon rising as the sun goes down', () => {
    expect(moonElevation(0.8)).toBeLessThanOrEqual(-0.05);
    expect(moonElevation(0.86)).toBeLessThan(0.02);
    expect(moonElevation(0.95)).toBeGreaterThan(0.1);
    expect(moonElevation(1)).toBeGreaterThan(0.15);
  });

  it('makes the higher body the light', () => {
    const noon = celestialAt(0.5);
    expect(noon.moonlit).toBe(false);
    expect(noon.light.equals(noon.sun)).toBe(true);

    const night = celestialAt(1);
    expect(night.moonlit).toBe(true);
    expect(night.light.equals(night.moon)).toBe(true);
  });
});

describe('the stars', () => {
  it('fade in slowly and only after the sun is low', () => {
    expect(starVisibility(0)).toBe(0);
    expect(starVisibility(0.7)).toBe(0);
    expect(starVisibility(0.8)).toBeGreaterThan(0);
    expect(starVisibility(0.86)).toBeGreaterThan(0.2);
    expect(starVisibility(0.86)).toBeLessThan(0.8);
    expect(starVisibility(0.95)).toBeGreaterThan(0.9);
    expect(starVisibility(1)).toBe(1);

    let previous = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const value = starVisibility(p);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
  });

  it('form a dome above the horizon, centred on the camera', () => {
    const positions = starDome(1200);
    expect(positions.length).toBe(1200 * 3);

    let forward = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      expect(Math.hypot(x, y, z)).toBeCloseTo(SKY_RADIUS, 3);
      expect(y).toBeGreaterThan(0);

      // The camera looks down +X, so the forward view is the half of the
      // dome with positive X. This is the count that used to be zero.
      if (x > 0 && Math.abs(z) < x * 0.84) forward += 1;
    }

    expect(forward).toBeGreaterThan(120);
  });

  it('is deterministic', () => {
    expect(Array.from(starDome(64))).toEqual(Array.from(starDome(64)));
  });
});
