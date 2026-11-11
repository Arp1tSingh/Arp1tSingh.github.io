import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Ticket, ticketSerial } from '../../src/ui/Ticket';
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
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain(project.claim);
    expect(html).toContain(project.links.repo);
  });

  it('fetches the QR code rather than carrying it in the bundle', () => {
    // The encoder is a separate chunk, so the static markup has the stub and
    // the URL but not the code itself.
    const html = renderToStaticMarkup(<Ticket stop={project} open onClose={() => {}} />);
    expect(html).not.toContain('role="img"');
    expect(html).toContain(project.links.repo);
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

describe('the serial number', () => {
  it('is the same every time for the same station', () => {
    expect(ticketSerial('slot-01')).toBe(ticketSerial('slot-01'));
    expect(ticketSerial('slot-01')).not.toBe(ticketSerial('slot-02'));
  });

  it('looks like a serial', () => {
    expect(ticketSerial('slot-01')).toMatch(/^LT-[0-9A-Z]{12}$/);
  });
});
