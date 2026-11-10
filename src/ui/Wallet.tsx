/**
 * The ticket wallet.
 *
 * The wallet turns browsing into a shortlist. It holds the tickets the
 * visitor kept while riding the line, and at the terminus it offers to send
 * the whole list as one email.
 *
 * It reads nothing itself: the app owns the state, the wallet only draws it
 * and reports what the visitor did.
 */

import { useId } from 'react';
import type { Stop } from '../core/types';

import './ui.css';

export interface WalletProps {
  kept: Stop[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onJump: (id: string) => void;
  /**
   * The address the terminus writes to. The wallet does not read the profile
   * itself, so the app passes the address in. Without it the email action is
   * simply not drawn.
   */
  email?: string;
}

/** The mailto the terminus offers: one message listing the kept tickets. */
function walletMailto(email: string, kept: Stop[]): string {
  const subject = 'The tickets I kept';
  const body = kept.map((stop) => `- ${stop.title} (${stop.station})`).join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function Wallet({ kept, onRemove, onClear, onJump, email }: WalletProps) {
  const titleId = useId();
  const count = kept.length;

  return (
    <section className="wallet" aria-labelledby={titleId}>
      <header className="wallet__head">
        <h2 className="wallet__title" id={titleId}>
          Ticket wallet
        </h2>
        <p className="wallet__count mono">
          {count} {count === 1 ? 'ticket' : 'tickets'}
        </p>
      </header>

      {count === 0 ? (
        <p className="wallet__empty">Nothing kept yet. Keep a ticket and it stays here.</p>
      ) : (
        <ul className="wallet__list">
          {kept.map((stop) => (
            <li className="wallet__row" key={stop.id}>
              <button type="button" className="wallet__jump" onClick={() => onJump(stop.id)}>
                <span className="wallet__stop-title">{stop.title}</span>
                <span className="wallet__stop-station mono">{stop.station}</span>
              </button>
              <button
                type="button"
                className="wallet__remove"
                onClick={() => onRemove(stop.id)}
                aria-label={`Remove ${stop.title} from the wallet`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="wallet__foot">
        <button type="button" className="wallet__clear" onClick={onClear} disabled={count === 0}>
          Clear all
        </button>

        {email ? (
          <a className="wallet__send" href={walletMailto(email, kept)}>
            Email me these tickets
          </a>
        ) : null}
      </footer>
    </section>
  );
}
