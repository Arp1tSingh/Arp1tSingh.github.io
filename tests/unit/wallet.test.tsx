import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { CONTENT } from '../../src/data/content';
import { Wallet } from '../../src/ui/Wallet';

const terminus = CONTENT.stops.find((stop) => stop.kind === 'terminus')!;
const project = CONTENT.stops.find((stop) => stop.kind === 'project')!;

const handlers = {
  onRemove: () => {},
  onClear: () => {},
  onJump: () => {},
  onRideAgain: () => {},
  onOpenMap: () => {},
};

describe('the terminus wallet', () => {
  it('is a closing screen, not just a list', () => {
    const html = renderToStaticMarkup(
      <Wallet
        kept={[]}
        terminus={terminus}
        profile={CONTENT.profile}
        {...handlers}
      />,
    );

    expect(html).toContain('You have reached the end of the line.');
    expect(html).toContain(terminus.oneLiner);
    expect(html).toContain('Ride the line again');
    expect(html).toContain('Browse the map');
    expect(html).toContain('Résumé');
    expect(html).toContain(CONTENT.profile.location);
  });

  it('gives an empty wallet actions instead of a dead end', () => {
    const html = renderToStaticMarkup(
      <Wallet kept={[]} terminus={terminus} profile={CONTENT.profile} {...handlers} />,
    );

    expect(html).toContain('Nothing kept yet.');
    expect(html).toContain('Start a conversation');
    expect(html).toContain(`mailto:${CONTENT.profile.email}`);
  });

  it('lists a kept ticket and offers to send the shortlist', () => {
    const html = renderToStaticMarkup(
      <Wallet kept={[project]} terminus={terminus} profile={CONTENT.profile} {...handlers} />,
    );

    expect(html).toContain(project.title);
    expect(html).toContain(project.station);
    expect(html).toContain('Email me these tickets');
    expect(html).toContain(`Remove ${project.title} from the wallet`);
    expect(html).toContain('Clear all');
  });
});
