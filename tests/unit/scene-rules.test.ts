// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { clampYaw } from '../../src/renderers/scene3d/CameraRig';
import { skyColours } from '../../src/renderers/scene3d/Sky';
import { MAX_YAW_RATE } from '../../src/renderers/scene3d/constants';
import { profileDevice, prefersReducedMotion, saveDataEnabled } from '../../src/renderers/scene3d/tier';

describe('the turn-rate cap', () => {
  it('never turns further than the rate allows', () => {
    let yaw = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      const next = clampYaw(yaw, Math.PI / 2, MAX_YAW_RATE, 1 / 60);
      expect(Math.abs(next - yaw)).toBeLessThanOrEqual(MAX_YAW_RATE / 60 + 1e-9);
      yaw = next;
    }
  });

  it('reaches the target eventually', () => {
    let yaw = 0;
    for (let frame = 0; frame < 600; frame += 1) {
      yaw = clampYaw(yaw, 0.5, MAX_YAW_RATE, 1 / 60);
    }
    expect(yaw).toBeCloseTo(0.5, 6);
  });

  it('turns the short way round', () => {
    // From just below pi to just above minus pi is a short hop, not a spin.
    const yaw = clampYaw(Math.PI - 0.01, -Math.PI + 0.01, MAX_YAW_RATE, 1 / 60);
    expect(Math.abs(yaw - (Math.PI - 0.01))).toBeLessThan(0.05);
  });

  it('does not turn at all when there is no time between frames', () => {
    expect(clampYaw(0, 1, MAX_YAW_RATE, 0)).toBe(0);
  });
});

describe('the sky', () => {
  it('runs from dawn to night across the journey', () => {
    const dawn = skyColours(0);
    const night = skyColours(1);

    // Night is darker than dawn at the top of the sky.
    const dawnLuma = dawn.top.r + dawn.top.g + dawn.top.b;
    const nightLuma = night.top.r + night.top.g + night.top.b;
    expect(nightLuma).toBeLessThan(dawnLuma);
  });

  it('changes continuously', () => {
    const a = skyColours(0.25).horizon;
    const b = skyColours(0.3).horizon;
    expect(a.getHex()).not.toBe(b.getHex());
  });

  it('clamps outside the journey', () => {
    expect(skyColours(-5).horizon.getHex()).toBe(skyColours(0).horizon.getHex());
    expect(skyColours(9).horizon.getHex()).toBe(skyColours(1).horizon.getHex());
  });
});

describe('the device profile', () => {
  it('reports no WebGL when the browser has none', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
    try {
      const profile = profileDevice();
      expect(profile.webgl).toBe(false);
      expect(profile.detail).toBe('low');
      expect(profile.reason).toContain('no WebGL');
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  it('reads the reduced motion preference', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    try {
      expect(prefersReducedMotion()).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });

  it('reads the save data preference', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'connection');
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    });
    try {
      expect(saveDataEnabled()).toBe(true);
    } finally {
      if (original) Object.defineProperty(navigator, 'connection', original);
    }
  });
});
