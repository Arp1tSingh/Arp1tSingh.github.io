import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Ticket } from '../../src/ui/Ticket';
import { CONTENT } from '../../src/data/content';

const terminus = CONTENT.stops.find((stop) => stop.kind === 'terminus')!;
const project = CONTENT.stops.find((stop) => stop.kind === 'project')!;

describe('the ticket', () => {
  it('renders nothing at all when it is closed', () => {
    expect(renderToStaticMarkup(<Ticket stop={project} open={false} onClose={() => {}} />)).toBe('');
  });

  it('carries the claim, the proof and the repository', () => {
    const html = renderToStaticMarkup(
      <Ticket stop={project} open onClose={() => {}} onKeep={() => {}} />,
    );

    expect(html).toContain('role="dialog"');
    // The header stays usable while the ticket is open, so the ticket must
    // not claim to be modal.
    expect(html).not.toContain('aria-modal');
    expect(html).toContain(project.claim);
    expect(html).toContain(project.links.repo);
  });

  it('keeps the wallet action in the actions row, with no floating stub', () => {
    const html = renderToStaticMarkup(
      <Ticket stop={project} open onClose={() => {}} onKeep={() => {}} />,
    );

    expect(html).not.toContain('ticket__stub');
    expect(html).not.toContain('ticket__qr');
    expect(html).not.toContain('role="img"');
    expect(html).toContain('Keep ticket');
    expect(html).toContain('ticket__close');
  });

  it('puts the close action on the station board and prints no serial', () => {
    const html = renderToStaticMarkup(
      <Ticket stop={project} open onClose={() => {}} onKeep={() => {}} />,
    );

    expect(html).toContain('ticket__board-end');
    expect(html).toMatch(/ticket__board-end[\s\S]*ticket__close/);
    expect(html).not.toContain('ticket__top');
    expect(html).not.toContain('ticket__serial');
    expect(html).not.toMatch(/LT-[0-9A-Z]{12}/);
  });

  it('marks a kept ticket and leaves the wallet action in place', () => {
    const html = renderToStaticMarkup(
      <Ticket stop={project} open onClose={() => {}} kept onKeep={() => {}} />,
    );

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('>Kept</button>');
  });

  it('offers no résumé action while there is no résumé', () => {
    const html = renderToStaticMarkup(<Ticket stop={terminus} open onClose={() => {}} />);
    expect(html).not.toContain('Résumé');
    expect(html).not.toContain('download');
  });

  it('offers the résumé action the moment there is one', () => {
    const html = renderToStaticMarkup(
      <Ticket stop={terminus} open onClose={() => {}} resume="resume.pdf" />,
    );
    expect(html).toContain('Résumé');
    expect(html).toContain('href="resume.pdf"');
    expect(html).toContain('download');
  });
});
