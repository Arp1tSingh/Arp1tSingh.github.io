/**
 * The ticket.
 *
 * A ticket has two faces and the visitor turns them over in three seconds of
 * attention:
 *
 *   front  two seconds   station board, claim, three stack tags, tier stamp
 *   back   thirty seconds metrics, screenshots, architecture, role, period
 *
 * The station board carries the close action at its far end. Keeping a
 * ticket for the wallet sits with the other actions at the end of the proof,
 * so nothing floats over the evidence while it is being read.
 *
 * It is a dialog, but not a modal one: the header stays usable, Escape closes
 * it, a click outside closes it, and focus is handed in and back out.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { Stop } from '../core/types';

import './ui.css';

export interface TicketProps {
  stop: Stop;
  open: boolean;
  onClose: () => void;
  kept?: boolean;
  onKeep?: (stop: Stop) => void;
  /**
   * The résumé, if there is one.
   *
   * The terminus is the conversion, so the résumé is its action. The field is
   * empty until there is a PDF to point at, and then the action appears: a
   * dead download link is worse than no download link.
   */
  resume?: string;
}

/* -------------------------------------------------------------------------- */
/* The ticket                                                                   */
/* -------------------------------------------------------------------------- */

const LINK_LABELS: ReadonlyArray<{ key: 'repo' | 'demo' | 'caseStudy'; label: string }> = [
  { key: 'repo', label: 'Repository' },
  { key: 'demo', label: 'Demo' },
  { key: 'caseStudy', label: 'Case study' },
];

export function Ticket({
  stop,
  open,
  onClose,
  kept = false,
  onKeep,
  resume,
}: TicketProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  const [justKept, setJustKept] = useState(false);

  // The close handler is read through a ref so the focus effect below only
  // runs when the ticket opens or closes, never on every render.
  useEffect(() => {
    closeRef.current = onClose;
  });

  // A new stop is a new ticket. The "saved" line belongs to the old one.
  useEffect(() => {
    setJustKept(false);
  }, [stop.id, open]);

  // Open: remember who had the focus and move it into the panel. Close: give
  // it back. The panel does not trap Tab: the header is part of the page and
  // stays usable while the ticket is open, which is the point of a
  // non-modal panel.
  useEffect(() => {
    if (!open) return undefined;

    const opener = document.activeElement;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }

      /*
       * The ticket is the reading surface, so the arrows belong to it.
       *
       * Native arrow scrolling depends on the panel holding the focus, which
       * it does, but it also loses the key to the page under a busy first
       * paint. Driving the scroll here makes the behaviour the same in every
       * browser and keeps the journey from jumping stations mid-read.
       */
      const panel = panelRef.current;
      if (!panel) return;

      const step = 48;
      const page = Math.max(step, panel.clientHeight - step * 2);
      let next: number | null = null;

      switch (event.key) {
        case 'ArrowDown':
          next = panel.scrollTop + step;
          break;
        case 'ArrowUp':
          next = panel.scrollTop - step;
          break;
        case 'PageDown':
          next = panel.scrollTop + page;
          break;
        case 'PageUp':
          next = panel.scrollTop - page;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = panel.scrollHeight;
          break;
        default:
          return;
      }

      event.preventDefault();
      panel.scrollTo({ top: next, behavior: 'auto' });
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  const keep = () => {
    if (!onKeep) return;
    onKeep(stop);
    setJustKept(true);
  };

  /**
   * The ticket does not trap the wheel.
   *
   * The panel scrolls its own proof first, and `overscroll-behavior: auto`
   * hands the wheel to the page the moment the proof is read to the end. The
   * page scrolling is what moves the train, and the journey state machine
   * closes the ticket when the train leaves the station. Nothing here has to
   * listen for the wheel: the scroll position is the only clock.
   */
  const tags = stop.stack.slice(0, 3);

  const actions = LINK_LABELS.map((action) => ({ ...action, href: stop.links[action.key] })).filter(
    (action) => action.href.length > 0,
  );

  if (!open) return null;

  return (
    <div
      className="ticket-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="ticket"
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="ticket__grid">
          {/* ---------------------------------------------------------- front */}
          <div className="ticket__front">
            <div className="ticket__board">
              <span className="ticket__station">{stop.station}</span>
              <span className="ticket__board-end">
                <span className="ticket__tier">{stop.tier}</span>
                <button
                  type="button"
                  className="ticket__close"
                  onClick={onClose}
                  aria-label="Close the ticket"
                >
                  Close
                </button>
              </span>
            </div>

            <h2 className="ticket__title" id={titleId}>
              {stop.title}
            </h2>

            <p className="ticket__oneline">{stop.oneLiner}</p>

            <p className="ticket__claim">{stop.claim}</p>

            {tags.length > 0 ? (
              <ul className="ticket__stack" aria-label="Built with">
                {tags.map((tag) => (
                  <li className="ticket__tag" key={tag}>
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* ----------------------------------------------------------- back */}
          <div className="ticket__back">
            {stop.proof.metrics.length > 0 ? (
              <section className="ticket__section">
                <h3 className="ticket__label">Proof</h3>
                <ul className="ticket__metrics">
                  {stop.proof.metrics.map((metric) => (
                    <li key={metric}>{metric}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {stop.proof.media.length > 0 ? (
              <section className="ticket__section">
                <h3 className="ticket__label">Evidence</h3>
                <div className="ticket__figures">
                  {stop.proof.media.map((item) => (
                    <figure className="ticket__figure" key={item.src}>
                      <img
                        src={item.src}
                        alt={item.alt}
                        loading="lazy"
                        decoding="async"
                        {...(item.width && item.height
                          ? { width: item.width, height: item.height }
                          : {})}
                      />
                      {item.caption ? <figcaption>{item.caption}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              </section>
            ) : null}

            {stop.proof.architecture ? (
              <section className="ticket__section">
                <h3 className="ticket__label">Architecture</h3>
                <p className="ticket__architecture">{stop.proof.architecture}</p>
              </section>
            ) : null}

            <section className="ticket__section">
              <h3 className="ticket__label">Record</h3>
              <dl className="ticket__facts">
                <div className="ticket__fact">
                  <dt className="ticket__fact-label mono">Role</dt>
                  <dd className="ticket__fact-value">{stop.role}</dd>
                </div>
                <div className="ticket__fact">
                  <dt className="ticket__fact-label mono">Period</dt>
                  <dd className="ticket__fact-value mono">
                    {stop.period.start} - {stop.period.end}
                  </dd>
                </div>
              </dl>
            </section>

            {actions.length > 0 || resume || onKeep ? (
              <section className="ticket__section">
                <h3 className="ticket__label">Actions</h3>
                <div className="ticket__actions">
                  {actions.map((action) => (
                    <a
                      className="ticket__action"
                      key={action.key}
                      href={action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {action.label}
                    </a>
                  ))}
                  {resume ? (
                    <a className="ticket__action" href={resume} download>
                      Résumé
                    </a>
                  ) : null}
                  {onKeep ? (
                    <button
                      type="button"
                      className="ticket__keep"
                      aria-pressed={kept}
                      onClick={keep}
                    >
                      {kept ? 'Kept' : 'Keep ticket'}
                    </button>
                  ) : null}
                </div>

                {justKept ? (
                  <p className="ticket__kept-note mono" role="status">
                    Saved for the terminus.
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
