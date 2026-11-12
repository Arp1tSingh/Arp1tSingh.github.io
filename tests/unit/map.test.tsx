import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { CONTENT, lineStops } from '../../src/data/content';
import { MapView } from '../../src/renderers/map2d/MapView';

const stops = lineStops('all');

function render(currentId: string | null = null) {
  return renderToStaticMarkup(
    <MapView
      content={CONTENT}
      stops={stops}
      currentId={currentId}
      activeSkill={null}
      onRide={() => {}}
      onFilter={() => {}}
    />,
  );
}

describe('the network map', () => {
  it('puts the skill filter before the plot in the document', () => {
    const html = render();

    // The mobile layout reads heading, skills, drawing. The CSS grid moves
    // the filter into the right column on a wide screen without reordering
    // the DOM, so this order is the phone order.
    expect(html.indexOf('map2d__skills')).toBeGreaterThan(-1);
    expect(html.indexOf('map2d__skills')).toBeLessThan(html.indexOf('map2d__plot'));
  });

  it('marks the train position without opening a card over the map', () => {
    const html = render('slot-05');

    // The map opens with nothing selected: on a phone the card is a sheet,
    // and it must not cover the drawing before the visitor picks a station.
    expect(html).toContain('map2d__station--here');
    expect(html).not.toContain('map2d__station--selected');
    expect(html).toContain('Pick a station on the map');
    expect(html).not.toContain('Ride here');
  });

  it('gives every station on the network a keyboard-reachable control', () => {
    const html = render();
    const stations = html.match(/data-stop="/g) ?? [];
    expect(stations).toHaveLength(CONTENT.stops.length);
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-pressed="false"');
  });
});
