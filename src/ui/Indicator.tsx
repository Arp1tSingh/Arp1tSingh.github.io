/**
 * The indicator.
 *
 * The indicator answers two questions and never stops answering them:
 * where am I, and what is left.
 *
 *   board    the current station and the next one, in a 5x7 dot matrix
 *   dots     one dot per stop on the line, the current one marked
 *   sky      the journey phase as a colour temperature, dawn to night
 *
 * The dot matrix is a CSS grid of square cells. The font is defined here as
 * five wide, seven tall bitmaps: a '#' is a lit module, a '.' is a dark one.
 * The board is `aria-hidden` - it is a picture of a station board, and the
 * live region below carries the same information as text.
 */

import { memo, useMemo } from 'react';
import type { JourneyPhase } from '../core/journey';
import type { Stop } from '../core/types';

import './ui.css';

export interface IndicatorProps {
  stops: Stop[];
  currentIndex: number;
  phase: JourneyPhase;
}

/* -------------------------------------------------------------------------- */
/* The 5x7 font                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A five wide, seven tall bitmap font.
 *
 * Each glyph is seven rows of five characters separated by a slash. '#' is a
 * lit module, '.' is an unlit one.
 */
const FONT: Readonly<Record<string, string>> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.###.',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '#####/..#../..#../..#../..#../..#../#####',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#...#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/##.##/#...#/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '#####/...#./..#../...#./....#/#...#/.###.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '..##./.#.../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/...#./.##..',
  ' ': '...../...../...../...../...../...../.....',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  '-': '...../...../...../#####/...../...../.....',
  '.': '...../...../...../...../...../.##../.##..',
  ':': '...../.##../.##../...../.##../.##../.....',
};

const GLYPH_ROWS = 7;
const GLYPH_COLUMNS = 5;

function glyphOf(character: string): string[] {
  const glyph = FONT[character] ?? FONT[' '];
  return glyph.split('/');
}

/** The longest string the board will draw before it starts dropping letters. */
const MAX_CHARACTERS = 18;

/* -------------------------------------------------------------------------- */
/* The board                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One line of dot matrix. Memoised on the text, so scrolling the journey does
 * not rebuild a grid of cells that did not change.
 */
const DotMatrix = memo(function DotMatrix({ text }: { text: string }) {
  const grid = useMemo(() => {
    const characters = text
      .toUpperCase()
      .replace(/[^A-Z0-9 /.:-]/g, ' ')
      .slice(0, MAX_CHARACTERS)
      .split('');

    const glyphs = characters.map(glyphOf);
    const rows: boolean[][] = [];

    for (let row = 0; row < GLYPH_ROWS; row += 1) {
      const cells: boolean[] = [];
      for (const glyph of glyphs) {
        const line = glyph[row] ?? '.....';
        for (let column = 0; column < GLYPH_COLUMNS; column += 1) {
          cells.push(line[column] === '#');
        }
        cells.push(false); // the gap between two letters
      }
      cells.pop(); // no trailing gap
      rows.push(cells);
    }

    return rows;
  }, [text]);

  const columns = grid[0]?.length ?? 0;

  return (
    <span
      className="dm"
      style={{ gridTemplateColumns: `repeat(${columns}, var(--dm-cell))` }}
      aria-hidden="true"
    >
      {grid.map((row, rowIndex) =>
        row.map((lit, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className={lit ? 'dm__cell is-on' : 'dm__cell'}
          />
        )),
      )}
    </span>
  );
});

/* -------------------------------------------------------------------------- */
/* The indicator                                                                */
/* -------------------------------------------------------------------------- */

type Sky = 'dawn' | 'day' | 'dusk' | 'night';

const SKIES: readonly Sky[] = ['dawn', 'day', 'dusk', 'night'];

function skyFor(progress: number): Sky {
  const index = Math.min(SKIES.length - 1, Math.max(0, Math.floor(progress * SKIES.length)));
  return SKIES[index];
}

export function Indicator({ stops, currentIndex, phase }: IndicatorProps) {
  const current = stops[currentIndex];
  const next = stops[currentIndex + 1];

  const progress = stops.length > 0 ? currentIndex / stops.length : 0;
  const sky = skyFor(progress);

  // The text only changes when the station changes, so the live region is
  // updated once per station and not once per frame.
  const announcement = current
    ? `Now at ${current.station}. Next ${next ? next.station : 'the end of the line'}.`
    : '';

  return (
    <div className="indicator" data-sky={sky} data-phase={phase}>
      <div className="indicator__board" aria-hidden="true">
        <div className="indicator__row">
          <span className="indicator__row-label">Now</span>
          <DotMatrix text={current ? current.station : ''} />
        </div>
        <div className="indicator__row">
          <span className="indicator__row-label">Next</span>
          <DotMatrix text={next ? next.station : 'END OF LINE'} />
        </div>
      </div>

      <div className="indicator__meta">
        <span className="indicator__phase mono">{phase}</span>
        <span className="indicator__count mono">
          {stops.length > 0 ? currentIndex + 1 : 0} / {stops.length}
        </span>
      </div>

      <ul className="indicator__dots" aria-label="Stations on this line">
        {stops.map((stop, index) => (
          <li
            key={stop.id}
            className={index === currentIndex ? 'indicator__dot is-current' : 'indicator__dot'}
            aria-label={`${index + 1} of ${stops.length}: ${stop.station}${
              index === currentIndex ? ', current station' : ''
            }`}
            aria-current={index === currentIndex ? 'true' : undefined}
          />
        ))}
      </ul>

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
