/**
 * The journey controller.
 *
 * Scroll is the only clock. This hook turns a scroll position into a route
 * position using the pure core, then feeds that into the journey state
 * machine. It owns no rendering of its own.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { CONTENT, getStop } from '../data/content';
import {
  buildSegments,
  positionAt,
  stopScrollPosition,
  totalLength,
  type Position,
  type Segment,
} from '../core/pacing';
import {
  canJumpTo,
  currentStopId,
  initialState,
  reduce,
  type JourneyState,
} from '../core/journey';
import { routeIdsForLine } from '../core/route';
import { skyStageAt, type SkyStage } from '../core/sky';
import type { LineId, Stop } from '../core/types';

export interface JourneyApi {
  state: JourneyState;
  /** The stops on the current route, in line order. */
  stops: Stop[];
  segments: Segment[];
  /** Total scroll length of the line, in viewport heights. */
  totalVh: number;
  position: Position | null;
  /**
   * The live scroll position.
   *
   * The scene reads this every frame. It is a ref on purpose: a scroll frame
   * must not re-render the React tree.
   */
  positionRef: MutableRefObject<Position | null>;
  /** The named sky stage, for the page's ambient tokens. */
  stage: SkyStage;
  /** 0..1 along the whole line. Updates at segment boundaries. */
  progress: number;
  current: Stop | null;
  next: Stop | null;
  selectLine(line: LineId): void;
  jumpTo(stopId: string): void;
  closeTicket(): void;
  reset(): void;
}

function scrollVh(): number {
  if (typeof window === 'undefined') return 0;
  return window.scrollY / Math.max(1, window.innerHeight);
}

export function useJourney(): JourneyApi {
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    initialState(CONTENT.route.defaultLine),
  );
  const [position, setPosition] = useState<Position | null>(null);
  const [stage, setStage] = useState<SkyStage>('dawn');
  const pendingJump = useRef<string | null>(null);
  /** The last position read, so a dismissal knows where the train was. */
  const positionRef = useRef<Position | null>(null);

  /**
   * The stops on the current route.
   *
   * Before a line has been chosen there is no route yet, but the scene still
   * has to have something to draw: the default line waits behind the gate, so
   * the first thing a visitor sees is the line itself rather than a flat
   * screen with a question on it.
   */
  const routeStops = useMemo<Stop[]>(() => {
    const ids =
      state.route.length > 0
        ? state.route
        : routeIdsForLine(CONTENT.stops, CONTENT.route, CONTENT.route.defaultLine);
    return ids.map((id) => getStop(id)).filter((stop): stop is Stop => Boolean(stop));
  }, [state.route]);

  const segments = useMemo(
    () => buildSegments(routeStops, CONTENT.route.pacing, state.line),
    [routeStops, state.line],
  );

  const totalVh = useMemo(() => totalLength(segments), [segments]);

  // Scroll is the clock. Read it once per frame, but only tell React when
  // the segment or the sky stage actually changes. The continuous value is
  // in `positionRef`, where the scene can read it without a re-render.
  useEffect(() => {
    if (state.phase === 'gate') return undefined;

    let frame = 0;
    let lastSegment = -1;
    let lastStage: SkyStage | null = null;

    const read = () => {
      const next = positionAt(scrollVh(), segments);
      positionRef.current = next;

      if (next.segmentIndex !== lastSegment) {
        lastSegment = next.segmentIndex;
        setPosition(next);
        dispatch({ type: 'scroll', position: next });
      }

      const nextStage = skyStageAt(next.s, routeStops.length);
      if (nextStage !== lastStage) {
        lastStage = nextStage;
        setStage(nextStage);
      }
    };

    const tick = () => {
      read();
      frame = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [state.phase, segments, routeStops.length]);

  // Boarding: the train waits at the first stop.
  useEffect(() => {
    if (state.phase !== 'boarding') return;
    const first = segments[0];
    if (!first) return;
    window.scrollTo({ top: first.start * window.innerHeight, behavior: 'auto' });
  }, [state.phase, segments]);

  // A jump that was queued while the line was being swapped.
  useEffect(() => {
    const target = pendingJump.current;
    if (!target) return;
    const at = stopScrollPosition(segments, target);
    if (at === null) return;
    pendingJump.current = null;
    window.scrollTo({ top: at * window.innerHeight, behavior: 'smooth' });
  }, [segments]);

  const selectLine = useCallback((line: LineId) => {
    const route = routeIdsForLine(CONTENT.stops, CONTENT.route, line);
    dispatch({ type: 'select-line', line, route });
  }, []);

  const jumpTo = useCallback(
    (stopId: string) => {
      if (!canJumpTo(state, stopId)) {
        // Every stop is reachable: if it is not on this line, change lines.
        const route = routeIdsForLine(CONTENT.stops, CONTENT.route, 'all');
        dispatch({ type: 'select-line', line: 'all', route });
        pendingJump.current = stopId;
        return;
      }
      const at = stopScrollPosition(segments, stopId);
      if (at === null) return;
      window.scrollTo({ top: at * window.innerHeight, behavior: 'smooth' });
      dispatch({ type: 'jump-to', stopId });
    },
    [state, segments],
  );

  const closeTicket = useCallback(
    () => dispatch({ type: 'close-ticket', x: positionRef.current?.x }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  const current = useMemo(() => {
    const id = currentStopId(state);
    return id ? (getStop(id) ?? null) : null;
  }, [state]);

  const next = useMemo(() => {
    if (state.phase === 'terminus') return null;
    const following = routeStops[state.stopIndex + 1];
    return following ?? null;
  }, [routeStops, state.stopIndex, state.phase]);

  const progress = useMemo(() => {
    if (!position || routeStops.length < 2) return 0;
    return Math.min(1, Math.max(0, position.s / (routeStops.length - 1)));
  }, [position, routeStops.length]);

  return {
    state,
    stops: routeStops,
    segments,
    totalVh,
    position,
    positionRef,
    stage,
    progress,
    current,
    next,
    selectLine,
    jumpTo,
    closeTicket,
    reset,
  };
}
