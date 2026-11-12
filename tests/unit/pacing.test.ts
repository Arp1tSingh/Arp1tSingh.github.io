import { describe, expect, it } from 'vitest';

import { CONTENT } from '../../src/data/content';
import { stopsForLine } from '../../src/core/route';
import {
  buildSegments,
  dwellWeight,
  nearestStopIndex,
  positionAt,
  stopScrollPosition,
  totalLength,
  travelEase,
} from '../../src/core/pacing';

const pacing = CONTENT.route.pacing;

function lineStops(line: 'express' | 'all' | 'map') {
  return stopsForLine(CONTENT.stops, CONTENT.route, line);
}

describe('dwell', () => {
  it('gives an express stop more time than a local stop', () => {
    const express = CONTENT.stops.find((stop) => stop.tier === 'express')!;
    const local = CONTENT.stops.find((stop) => stop.tier === 'local')!;
    expect(dwellWeight(express, pacing, 'all')).toBeGreaterThan(dwellWeight(local, pacing, 'all'));
  });

  it('collapses a local stop to zero in Express mode, so the train passes through', () => {
    const local = CONTENT.stops.find((stop) => stop.tier === 'local')!;
    expect(dwellWeight(local, pacing, 'express')).toBe(0);
    expect(dwellWeight(local, pacing, 'all')).toBeGreaterThan(0);
  });

  it('never gives an express stop zero dwell', () => {
    for (const stop of CONTENT.stops.filter((entry) => entry.tier === 'express')) {
      expect(dwellWeight(stop, pacing, 'express')).toBeGreaterThan(0);
    }
  });
});

describe('the scroll timeline', () => {
  it('alternates dwell and travel', () => {
    const segments = buildSegments(lineStops('all'), pacing, 'all');
    for (let i = 0; i < segments.length; i += 1) {
      expect(segments[i].kind).toBe(i % 2 === 0 ? 'dwell' : 'travel');
    }
  });

  it('starts at zero and has no gaps', () => {
    const segments = buildSegments(lineStops('all'), pacing, 'all');
    expect(segments[0].start).toBe(0);
    for (let i = 1; i < segments.length; i += 1) {
      expect(segments[i].start).toBeCloseTo(segments[i - 1].end, 10);
    }
  });

  it('has a positive length for every segment', () => {
    const segments = buildSegments(lineStops('all'), pacing, 'all');
    for (const segment of segments) {
      expect(segment.length).toBeGreaterThan(0);
    }
  });

  it('never halts at a local stop in Express mode', () => {
    const stops = lineStops('express');
    const segments = buildSegments(stops, pacing, 'express');
    const halts = segments.filter((segment) => segment.kind === 'dwell').map((segment) => segment.stopId);
    for (const stop of stops) {
      if (stop.tier === 'local') {
        expect(halts).not.toContain(stop.id);
      }
    }
  });

  it('is long enough to be worth scrolling', () => {
    const segments = buildSegments(lineStops('all'), pacing, 'all');
    expect(totalLength(segments)).toBeGreaterThan(5);
  });

  it('keeps the express line quick', () => {
    const segments = buildSegments(lineStops('express'), pacing, 'express');
    expect(totalLength(segments)).toBeLessThan(9);
  });
});

describe('position', () => {
  const stops = lineStops('all');
  const segments = buildSegments(stops, pacing, 'all');

  it('starts at the first stop', () => {
    const position = positionAt(0, segments);
    expect(position.stopIndex).toBe(0);
    expect(position.atStop).toBe(true);
    expect(position.phase).toBe('dwell');
  });

  it('never goes backwards as the scroll advances', () => {
    let previous = -1;
    for (let x = 0; x <= totalLength(segments); x += 0.05) {
      const position = positionAt(x, segments);
      expect(position.s).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = position.s;
    }
  });

  it('reports being at a stop only during a dwell', () => {
    for (const segment of segments) {
      const middle = segment.start + segment.length / 2;
      const position = positionAt(middle, segments);
      expect(position.atStop).toBe(segment.kind === 'dwell');
    }
  });

  it('clamps past the end of the line to the last stop', () => {
    const position = positionAt(totalLength(segments) + 100, segments);
    expect(position.stopIndex).toBe(stops.length - 1);
    expect(position.progress).toBe(1);
  });

  it('never goes below zero', () => {
    const position = positionAt(-50, segments);
    expect(position.s).toBe(0);
    expect(position.stopIndex).toBe(0);
  });

  it('reaches every stop in turn', () => {
    for (const stop of stops) {
      const at = stopScrollPosition(segments, stop.id);
      expect(at).not.toBeNull();
      const position = positionAt(at!, segments);
      expect(position.atStop).toBe(true);
      expect(position.stopId).toBe(stop.id);
    }
  });
});

describe('the travel curve', () => {
  const shapes = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ] as const;

  it('still starts and ends at the stops', () => {
    for (const [fromHalt, toHalt] of shapes) {
      expect(travelEase(0, fromHalt, toHalt)).toBe(0);
      expect(travelEase(1, fromHalt, toHalt)).toBe(1);
    }
  });

  it('never runs backwards', () => {
    for (const [fromHalt, toHalt] of shapes) {
      let previous = -1;
      for (let t = 0; t <= 1; t += 0.01) {
        const eased = travelEase(t, fromHalt, toHalt);
        expect(eased).toBeGreaterThanOrEqual(previous - 1e-12);
        previous = eased;
      }
    }
  });

  it('pulls out of a halt more slowly than a straight line', () => {
    expect(travelEase(0.25, true, true)).toBeLessThan(0.25);
    expect(travelEase(0.25, true, false)).toBeLessThan(0.25);
  });

  it('settles into a halt more slowly than a straight line', () => {
    expect(travelEase(0.75, true, true)).toBeGreaterThan(0.75);
    expect(travelEase(0.75, false, true)).toBeGreaterThan(0.75);
  });

  it('keeps line speed between two skipped stops', () => {
    expect(travelEase(0.37, false, false)).toBeCloseTo(0.37, 12);
  });

  it('clamps outside the segment', () => {
    expect(travelEase(-2, true, true)).toBe(0);
    expect(travelEase(7, true, true)).toBe(1);
  });
});

describe('nearest stop', () => {
  it('stays inside the line', () => {
    expect(nearestStopIndex(-5, 12)).toBe(0);
    expect(nearestStopIndex(99, 12)).toBe(11);
    expect(nearestStopIndex(3.4, 12)).toBe(3);
  });
});
