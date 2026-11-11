import { describe, expect, it } from 'vitest';

import { skyStage, skyStageAt } from '../../src/core/sky';

describe('the sky stage', () => {
  it('names the four parts of the day', () => {
    expect(skyStage(0)).toBe('dawn');
    expect(skyStage(0.4)).toBe('day');
    expect(skyStage(0.8)).toBe('dusk');
    expect(skyStage(1)).toBe('night');
  });

  it('changes at the same keys the scene uses', () => {
    expect(skyStage(0.179)).toBe('dawn');
    expect(skyStage(0.18)).toBe('day');
    expect(skyStage(0.719)).toBe('day');
    expect(skyStage(0.72)).toBe('dusk');
    expect(skyStage(0.879)).toBe('dusk');
    expect(skyStage(0.88)).toBe('night');
  });

  it('clamps outside the journey', () => {
    expect(skyStage(-1)).toBe('dawn');
    expect(skyStage(2)).toBe('night');
  });

  it('reads a route position against the number of stops', () => {
    expect(skyStageAt(0, 8)).toBe('dawn');
    expect(skyStageAt(7, 8)).toBe('night');
    expect(skyStageAt(3.5, 8)).toBe('day');
    expect(skyStageAt(6.1, 8)).toBe('dusk');
  });

  it('stays at dawn when there is nowhere to travel', () => {
    expect(skyStageAt(4, 1)).toBe('dawn');
    expect(skyStageAt(4, 0)).toBe('dawn');
  });
});
