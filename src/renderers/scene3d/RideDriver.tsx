import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MutableRefObject } from 'react';

import { advanceRide } from './ride';
import type { Position } from '../../core/pacing';

/** The mutable value every moving part of the scene reads. */
export interface RideClockValue {
  s: number;
}

export interface RideDriverProps {
  clock: MutableRefObject<RideClockValue>;
  /** The live scroll target, updated outside React. */
  targetSRef: MutableRefObject<Position | null>;
  stopCount: number;
  reducedMotion: boolean;
}

/**
 * The one writer of the rendered route position.
 *
 * Every consumer (camera, train, sky) reads the same `clock.s` in its own
 * frame callback. This component is mounted first in the scene so its
 * callback runs before theirs.
 */
export function RideDriver({ clock, targetSRef, stopCount, reducedMotion }: RideDriverProps) {
  const lastCount = useRef(stopCount);

  useFrame((_, delta) => {
    const target = targetSRef.current?.s ?? 0;
    const clamped = Math.min(stopCount - 1, Math.max(0, target));

    // A new line is a new world: snap rather than sweeping across it.
    if (lastCount.current !== stopCount) {
      lastCount.current = stopCount;
      clock.current.s = clamped;
      return;
    }

    clock.current.s = advanceRide(clock.current.s, clamped, delta, reducedMotion);
  });

  return null;
}
