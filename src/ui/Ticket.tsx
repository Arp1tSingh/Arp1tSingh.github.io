/**
 * The ticket.
 *
 * A ticket has three faces and the visitor turns them over in three seconds
 * of attention:
 *
 *   front  two seconds   station board, claim, three stack tags, tier stamp
 *   back   thirty seconds metrics, screenshots, architecture, role, period, links
 *   stub   always        QR code, serial number, keep action
 *
 * It is a modal dialog: it traps focus, closes on Escape, closes on a click on
 * the backdrop, and gives the focus back to whatever opened it.
 *
 * The serial number is derived from the stop id with a hash, never from a
 * random number or a clock, so the same station always prints the same
 * ticket. A visitor can photograph a ticket and compare it later.
 */

import { useEffect, useId, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import type { Stop } from '../core/types';
import { qrMatrix } from './qr';

import './ui.css';

export interface TicketProps {
  stop: Stop;
  open: boolean;
  onClose: () => void;
  kept?: boolean;
  onKeep?: (stop: Stop) => void;
}

/* -------------------------------------------------------------------------- */
/* The serial number                                                            */
/* -------------------------------------------------------------------------- */

/** FNV-1a, 32 bit. Small, fast and stable across runs and machines. */
function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Base 36, fixed width, upper case: a serial looks like a serial. */
function chunk(value: number, width: number): string {
  return value.toString(36).toUpperCase().padStart(width, '0').slice(-width);
}

/**
 * The serial number printed on the stub. Deterministic: the same stop id
 * always gives the same serial, on every device, in every render.
 */
export function ticketSerial(id: string): string {
  const head = chunk(fnv1a(id, 0x811c9dc5), 6);
  const tail = chunk(fnv1a(`${id}#local-3d`, 0x811c9dc5), 6);
  return `LT-${head}${tail}`;
}

/* -------------------------------------------------------------------------- */
/* The QR code                                                                  */
/* -------------------------------------------------------------------------- */

/** Modules of blank space around the symbol, as the QR standard asks for. */
const QUIET_ZONE = 4;

/**
 * The QR code on the stub. It is decorative in the sense that the repository
 * URL is printed next to it as text: nothing is ever reachable only by
 * pointing a camera at it.
 */
function TicketQr({ url }: { url: string }) {
  const matrix = useMemo(() => {
    try {
      const result = qrMatrix(url);
      return result.length > 0 ? result : null;
    } catch {
      return null;
    }
  }, [url]);

  if (!matrix) return null;

  const size = matrix.length;
  const span = size + QUIET_ZONE * 2;
  const modules: ReactElement[] = [];

  for (let row = 0; row < size; row += 1) {
    const line = matrix[row] ?? [];
    for (let column = 0; column < line.length; column += 1) {
      if (!line[column]) continue;
      modules.push(
        <rect
          key={`${row}-${column}`}
          x={column + QUIET_ZONE}
          y={row + QUIET_ZONE}
          width={1}
          height={1}
        />,
      );
    }
  }

  return (
    <svg
      className="ticket__qr-svg"
      viewBox={`0 0 ${span} ${span}`}
      width={span * 3}
      height={span * 3}
      role="img"
      aria-label={`QR code linking to ${url}`}
      shapeRendering="crispEdges"
    >
      {modules}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* The focus trap                                                               */
/* -------------------------------------------------------------------------- */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.getClientRects().length > 0 || node === document.activeElement,
  );
}

/* -------------------------------------------------------------------------- */
/* The ticket                                                                   */
/* -------------------------------------------------------------------------- */

const LINK_LABELS: ReadonlyArray<{ key: 'repo' | 'demo' | 'caseStudy'; label: string }> = [
  { key: 'repo', label: 'Repository' },
  { key: 'demo', label: 'Demo' },
  { key: 'caseStudy', label: 'Case study' },
];

export function Ticket({ stop, open, onClose, kept = false, onKeep }: TicketProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);

  // The close handler is read through a ref so the focus effect below only
  // runs when the ticket opens or closes, never on every render.
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Open: remember who had the focus, move the focus into the dialog, trap
  // Tab inside it. Close: give the focus back to that same element.
  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement;
    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const nodes = focusableIn(panel);
      if (nodes.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === panel || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);

  /**
   * The ticket does not trap the wheel.
   *
   * The panel scrolls its own proof first, and `overscroll-behavior: auto`
   * hands the wheel to the page the moment the proof is read to the end. The
   * page scrolling is what moves the train, and the journey state machine
   * closes the ticket when the train leaves the station. Nothing here has to
   * listen for the wheel: the scroll position is the only clock.
   */
  const serial = useMemo(() => ticketSerial(stop.id), [stop.id]);
  const tags = stop.stack.slice(0, 3);
  const repo = stop.links.repo;

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
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="ticket__grid">
          {/* ---------------------------------------------------------- front */}
          <div className="ticket__front">
            <div className="ticket__board">
              <span className="ticket__station">{stop.station}</span>
              <span className="ticket__tier">{stop.tier}</span>
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

            {actions.length > 0 ? (
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
                </div>
              </section>
            ) : null}
          </div>
        </div>

        {/* ----------------------------------------------------------- stub */}
        <div className="ticket__stub">
          <div className="ticket__stub-code">
            {repo ? (
              <span className="ticket__qr">
                <TicketQr url={repo} />
              </span>
            ) : null}
            <span className="ticket__serial mono">{serial}</span>
          </div>

          <div className="ticket__stub-detail">
            {repo ? (
              <a className="ticket__url mono" href={repo} target="_blank" rel="noopener noreferrer">
                {repo}
              </a>
            ) : null}
            <button
              type="button"
              className="ticket__keep"
              aria-pressed={kept}
              onClick={() => onKeep?.(stop)}
            >
              {kept ? 'Kept' : 'Keep ticket'}
            </button>
          </div>

          <button type="button" className="ticket__close" onClick={onClose} aria-label="Close the ticket">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
