/**
 * The journey state machine.
 *
 *   Gate -> Boarding -> Traveling <-> Dwelling -> Terminus
 *
 * A map click, a progress dot or a deep link jumps straight to Dwelling at
 * any stop. The machine is pure: the same event always produces the same
 * state, which is what makes the transitions testable without a browser.
 */

import type { LineId } from './types';
import type { Position } from './pacing';

export type JourneyPhase = 'gate' | 'boarding' | 'traveling' | 'dwelling' | 'terminus';

export interface JourneyState {
  phase: JourneyPhase;
  line: LineId;
  /** Stop ids on the current route, in line order. */
  route: string[];
  /** Index into `route` of the stop we are at. */
  stopIndex: number;
  /**
   * The scroll position at which the visitor dismissed the ticket.
   *
   * The phase is derived from the scroll position, so without this a ticket
   * closed by hand would spring open again on the next read of the position.
   * The ticket stays dismissed until the train has actually moved.
   */
  dismissedAt: number | null;
}

export type JourneyEvent =
  | { type: 'select-line'; line: LineId; route: string[] }
  | { type: 'scroll'; position: Position }
  | { type: 'jump-to'; stopId: string }
  | { type: 'close-ticket'; x?: number }
  | { type: 'reset' };

export function initialState(line: LineId = 'express'): JourneyState {
  return { phase: 'gate', line, route: [], stopIndex: 0, dismissedAt: null };
}

function phaseAt(state: JourneyState, stopIndex: number): JourneyPhase {
  const isLast = stopIndex >= state.route.length - 1;
  return isLast ? 'terminus' : 'dwelling';
}

/** Two scroll positions are the same place if they are within this many viewport heights. */
const SAME_PLACE = 0.01;

export function reduce(state: JourneyState, event: JourneyEvent): JourneyState {
  switch (event.type) {
    case 'select-line': {
      if (event.route.length === 0) return state;
      return {
        phase: 'boarding',
        line: event.line,
        route: event.route,
        stopIndex: 0,
        dismissedAt: null,
      };
    }

    case 'scroll': {
      // Nothing moves until the visitor has picked a line at the gate.
      if (state.phase === 'gate') return state;
      if (state.route.length === 0) return state;

      const { position } = event;
      const stopIndex = Math.min(state.route.length - 1, Math.max(0, position.stopIndex));

      if (position.atStop) {
        const dismissed =
          state.dismissedAt !== null && Math.abs(position.x - state.dismissedAt) < SAME_PLACE;
        if (dismissed) {
          // The ticket was closed by hand and the train has not moved since.
          return { ...state, phase: 'traveling', stopIndex };
        }
        return {
          ...state,
          phase: phaseAt(state, stopIndex),
          stopIndex,
          dismissedAt: null,
        };
      }

      // The train is between stations: whatever was dismissed is behind us.
      return { ...state, phase: 'traveling', stopIndex, dismissedAt: null };
    }

    case 'jump-to': {
      if (state.route.length === 0) return state;
      const index = state.route.indexOf(event.stopId);
      // A stop that is not on this line cannot be jumped to; the caller is
      // responsible for switching lines first.
      if (index === -1) return state;
      return {
        ...state,
        phase: phaseAt(state, index),
        stopIndex: index,
        dismissedAt: null,
      };
    }

    case 'close-ticket': {
      if (state.phase !== 'dwelling' && state.phase !== 'terminus') return state;
      return { ...state, phase: 'traveling', dismissedAt: event.x ?? null };
    }

    case 'reset':
      return initialState(state.line);

    default:
      return state;
  }
}

/** The stop id the journey is currently at, if any. */
export function currentStopId(state: JourneyState): string | null {
  if (state.phase === 'gate') return null;
  return state.route[state.stopIndex] ?? null;
}

/** Whether a stop can be reached in one jump on the current line. */
export function canJumpTo(state: JourneyState, stopId: string): boolean {
  return state.route.includes(stopId);
}
