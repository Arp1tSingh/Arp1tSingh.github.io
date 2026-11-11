/**
 * The pacing function.
 *
 * "Scroll is the only clock." Let X be scroll distance in viewport heights.
 * The core maps X to a route position s: the train holds at stop k for that
 * stop's dwell weight, then travels to the next stop over a fixed weight.
 *
 * The function is pure, so it gets unit tests instead of screenshots.
 */

import type { LineId, PacingConfig, Stop } from './types';

export type SegmentKind = 'dwell' | 'travel';

export interface Segment {
  kind: SegmentKind;
  /** Index into the route array. For a travel segment, the destination stop. */
  stopIndex: number;
  stopId: string;
  /** Scroll position in viewport heights. */
  start: number;
  end: number;
  length: number;
}

export interface Position {
  /** Index into the route array of the stop we are at or heading to. */
  stopIndex: number;
  stopId: string;
  phase: SegmentKind;
  /** 0..1 within the current segment. */
  progress: number;
  /** The scroll position that produced this. */
  x: number;
  /** True while the train is held at a station. */
  atStop: boolean;
  segmentIndex: number;
  /** The continuous route position s: fractional stop index. */
  s: number;
}

/**
 * How long the train holds at a stop.
 *
 * In Express mode a local stop's dwell collapses to zero: the train passes
 * through without opening its doors.
 */
export function dwellWeight(stop: Stop, config: PacingConfig, line: LineId): number {
  if (config.expressZeroesLocalDwell && line === 'express' && stop.tier === 'local') {
    return 0;
  }
  return stop.tier === 'express' ? config.dwell.express : config.dwell.local;
}

/**
 * The scroll timeline. Alternating dwell and travel segments, in line order.
 * A stop with zero dwell produces no segment at all: the train never halts there.
 */
export function buildSegments(stops: Stop[], config: PacingConfig, line: LineId): Segment[] {
  const segments: Segment[] = [];
  let x = 0;

  stops.forEach((stop, index) => {
    const dwell = dwellWeight(stop, config, line);
    if (dwell > 0) {
      segments.push({
        kind: 'dwell',
        stopIndex: index,
        stopId: stop.id,
        start: x,
        end: x + dwell,
        length: dwell,
      });
      x += dwell;
    }

    const next = stops[index + 1];
    if (next) {
      segments.push({
        kind: 'travel',
        stopIndex: index + 1,
        stopId: next.id,
        start: x,
        end: x + config.travel,
        length: config.travel,
      });
      x += config.travel;
    }
  });

  return segments;
}

/** Total scroll distance, in viewport heights, the whole line takes. */
export function totalLength(segments: Segment[]): number {
  const last = segments[segments.length - 1];
  return last ? last.end : 0;
}

/** The scroll position where a given stop is held, or null if the train never halts there. */
export function stopScrollPosition(segments: Segment[], stopId: string): number | null {
  const dwell = segments.find((segment) => segment.kind === 'dwell' && segment.stopId === stopId);
  return dwell ? dwell.start : null;
}

/**
 * The travel curve.
 *
 * A travel segment between two real halts eases out of the origin and into
 * the destination, so a train arriving at a platform settles instead of
 * hitting a wall. If a stop is skipped (a local on the Express line), that
 * end has no halt and keeps its line speed; two travel segments through a
 * skipped stop therefore meet at full speed and stay continuous.
 */
export function travelEase(progress: number, fromHalt: boolean, toHalt: boolean): number {
  const v = Math.min(1, Math.max(0, progress));
  if (fromHalt && toHalt) return v * v * (3 - 2 * v);
  if (fromHalt) return v * v;
  if (toHalt) return 1 - (1 - v) * (1 - v);
  return v;
}

/**
 * Map a scroll position X to a route position.
 *
 * Scroll is still the only clock: `s` is a function of X and nothing else.
 * The travel curve only changes the shape between two halts, not the
 * endpoints, so every stop still lands on its integer position.
 */
export function positionAt(x: number, segments: Segment[]): Position {
  if (segments.length === 0) {
    throw new Error('positionAt: the route has no segments');
  }

  const clamped = Math.max(0, x);
  let index = segments.findIndex((segment) => clamped < segment.end);
  if (index === -1) index = segments.length - 1;

  const segment = segments[index];
  const progress = segment.length > 0 ? Math.min(1, Math.max(0, (clamped - segment.start) / segment.length)) : 1;

  const previous = segments[index - 1];
  const following = segments[index + 1];
  const fromIndex = segment.kind === 'travel' && previous ? previous.stopIndex : segment.stopIndex;
  const fromHalt = previous?.kind === 'dwell';
  const toHalt = following?.kind === 'dwell';
  const eased = segment.kind === 'travel' ? travelEase(progress, fromHalt, toHalt) : progress;
  const s = segment.kind === 'travel' ? fromIndex + eased : segment.stopIndex;

  return {
    stopIndex: segment.stopIndex,
    stopId: segment.stopId,
    phase: segment.kind,
    progress,
    x: clamped,
    atStop: segment.kind === 'dwell',
    segmentIndex: index,
    s,
  };
}

/** The stop index nearest to a fractional route position. */
export function nearestStopIndex(s: number, stopCount: number): number {
  return Math.min(stopCount - 1, Math.max(0, Math.round(s)));
}
