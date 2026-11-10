import { useEffect } from 'react';
import type { LineId } from '../core/types';
import type { JourneyApi } from './useJourney';

export type ViewMode = 'journey' | 'map' | 'classic';

interface KeyboardOptions {
  journey: JourneyApi;
  view: ViewMode;
  setView(view: ViewMode): void;
  onSelectLine(line: LineId): void;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * "Keyboard: arrow keys move between stops, E picks Express, M opens the map,
 * C opens the Classic view."
 */
export function useKeyboard({ journey, view, setView, onSelectLine }: KeyboardOptions): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case 'e':
        case 'E':
          onSelectLine('express');
          setView('journey');
          break;

        case 'm':
        case 'M':
          setView(view === 'map' ? 'journey' : 'map');
          break;

        case 'c':
        case 'C':
          setView(view === 'classic' ? 'journey' : 'classic');
          break;

        case 'ArrowRight':
        case 'ArrowDown': {
          event.preventDefault();
          const next = journey.stops[journey.state.stopIndex + 1];
          if (next) journey.jumpTo(next.id);
          break;
        }

        case 'ArrowLeft':
        case 'ArrowUp': {
          event.preventDefault();
          const previous = journey.stops[journey.state.stopIndex - 1];
          if (previous) journey.jumpTo(previous.id);
          break;
        }

        case 'Escape':
          if (view === 'map' || view === 'classic') {
            setView('journey');
          } else {
            journey.closeTicket();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [journey, view, setView, onSelectLine]);
}
