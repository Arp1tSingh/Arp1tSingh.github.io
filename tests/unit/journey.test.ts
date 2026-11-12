import { describe, expect, it } from 'vitest';

import { CONTENT } from '../../src/data/content';
import { stopsForLine } from '../../src/core/route';
import { buildSegments, positionAt } from '../../src/core/pacing';
import { canJumpTo, currentStopId, initialState, reduce } from '../../src/core/journey';
import type { JourneyState } from '../../src/core/journey';

const allStops = stopsForLine(CONTENT.stops, CONTENT.route, 'all');
const routeIds = allStops.map((stop) => stop.id);
const segments = buildSegments(allStops, CONTENT.route.pacing, 'all');

/**
 * Sample points derived from the timeline, not guessed scroll numbers.
 *
 * The pacing weights are content, so the tests should keep passing when a
 * stop is held longer or a travel is shortened.
 */
const firstDwell = segments[0];
const firstTravel = segments[1];
const secondDwell = segments[2];
const dwellX = firstDwell.start + firstDwell.length / 2;
const travelX = firstTravel.start + firstTravel.length / 2;
const nextDwellX = secondDwell.start + secondDwell.length / 2;

function at(x: number) {
  return positionAt(x, segments);
}

function boarded(): JourneyState {
  return reduce(initialState('all'), { type: 'select-line', line: 'all', route: routeIds });
}

describe('the journey state machine', () => {
  it('starts at the gate', () => {
    const state = initialState();
    expect(state.phase).toBe('gate');
    expect(state.route).toHaveLength(0);
    expect(currentStopId(state)).toBeNull();
  });

  it('boards on the chosen line', () => {
    const state = boarded();
    expect(state.phase).toBe('boarding');
    expect(state.route).toHaveLength(12);
  });

  it('does not move before a line is chosen', () => {
    const state = reduce(initialState(), { type: 'scroll', position: at(3) });
    expect(state.phase).toBe('gate');
  });

  it('dwells when the train stops', () => {
    const state = reduce(boarded(), { type: 'scroll', position: at(dwellX) });
    expect(state.phase).toBe('dwelling');
    expect(state.stopIndex).toBe(0);
  });

  it('travels between stops', () => {
    const state = reduce(boarded(), { type: 'scroll', position: at(travelX) });
    expect(state.phase).toBe('traveling');
  });

  it('reaches the terminus at the last stop', () => {
    const state = reduce(boarded(), { type: 'scroll', position: at(segments[segments.length - 1].end - 0.01) });
    expect(state.phase).toBe('terminus');
  });

  it('jumps straight to a stop from a map click, a dot or a deep link', () => {
    const state = reduce(boarded(), { type: 'jump-to', stopId: 'slot-05' });
    expect(state.phase).toBe('dwelling');
    expect(currentStopId(state)).toBe('slot-05');
  });

  it('ignores a jump to a stop that is not on the line', () => {
    const before = boarded();
    const after = reduce(before, { type: 'jump-to', stopId: 'not-a-stop' });
    expect(after).toEqual(before);
  });

  it('closes the ticket back into travelling', () => {
    const dwelling = reduce(boarded(), { type: 'scroll', position: at(dwellX) });
    const closed = reduce(dwelling, { type: 'close-ticket' });
    expect(closed.phase).toBe('traveling');
  });

  it('does not spring the ticket open again while the train has not moved', () => {
    const dwelling = reduce(boarded(), { type: 'scroll', position: at(dwellX) });
    const closed = reduce(dwelling, { type: 'close-ticket', x: at(dwellX).x });
    expect(closed.phase).toBe('traveling');

    // The same place, read again: still closed.
    const again = reduce(closed, { type: 'scroll', position: at(dwellX) });
    expect(again.phase).toBe('traveling');

    // The train moved: the next station opens its ticket.
    const moved = reduce(closed, { type: 'scroll', position: at(nextDwellX) });
    expect(moved.phase).toBe('dwelling');
  });

  it('reopens the ticket when the train comes back to the same stop', () => {
    const dwelling = reduce(boarded(), { type: 'scroll', position: at(dwellX) });
    const closed = reduce(dwelling, { type: 'close-ticket', x: at(dwellX).x });
    const away = reduce(closed, { type: 'scroll', position: at(nextDwellX) });
    const back = reduce(away, { type: 'scroll', position: at(dwellX) });
    expect(back.phase).toBe('dwelling');
  });

  it('returns to the gate on reset', () => {
    expect(reduce(boarded(), { type: 'reset' }).phase).toBe('gate');
  });
});

describe('reachability', () => {
  it('reaches every stop from the gate in one interaction', () => {
    const state = boarded();
    for (const stop of allStops) {
      expect(canJumpTo(state, stop.id)).toBe(true);
    }
  });

  it('reaches every stop in the dataset, not just the ones on this line', () => {
    const state = boarded();
    for (const stop of CONTENT.stops) {
      expect(canJumpTo(state, stop.id)).toBe(true);
    }
  });

  it('reaches every stop from every other stop in one interaction', () => {
    for (const from of allStops) {
      const state = reduce(boarded(), { type: 'jump-to', stopId: from.id });
      for (const to of allStops) {
        expect(canJumpTo(state, to.id)).toBe(true);
      }
    }
  });
});
