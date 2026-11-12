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

function inside(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

/**
 * "Keyboard: arrow keys move between stops, E picks Express, M opens the map,
 * T opens the text view."
 *
 * The journey shortcuts belong to the line. When focus is inside the ticket,
 * the map, the text view or the wallet, the arrow keys are for reading and
 * scrolling that surface, not for jumping the train. Escape still leaves an
 * overlay, and the ticket handles its own Escape.
 */
export function useKeyboard({ journey, view, setView, onSelectLine }: KeyboardOptions): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // The ticket owns Escape and the arrow keys while it is open.
      if (inside(event.target, '[role="dialog"]')) return;

      // A surface that scrolls or contains its own controls keeps the arrows.
      // The view shortcuts still work there (C closes the text view it
      // opened), but the journey itself does not move under the overlay.
      if (inside(event.target, '.app__overlay, .app__wallet')) {
        switch (event.key) {
          case 'Escape':
            if (view === 'map' || view === 'classic') setView('journey');
            break;
          case 'm':
          case 'M':
            setView(view === 'map' ? 'journey' : 'map');
            break;
          case 't':
          case 'T':
          case 'c':
          case 'C':
            setView(view === 'classic' ? 'journey' : 'classic');
            break;
          default:
            break;
        }
        return;
      }

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

        case 't':
        case 'T':
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
