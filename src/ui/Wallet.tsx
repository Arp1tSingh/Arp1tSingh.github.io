/**
 * The ticket wallet.
 *
 * The wallet turns browsing into a shortlist. It holds the tickets the
 * visitor kept while riding the line, and at the terminus it becomes the
 * closing screen: the shortlist, the email action, the résumé and the direct
 * contact details in one place.
 *
 * It reads nothing itself: the app owns the state, the wallet only draws it
 * and reports what the visitor did.
 */

import { useId } from 'react';
import type { Profile, Stop } from '../core/types';

import './ui.css';

export interface WalletProps {
  kept: Stop[];
  /** The terminus stop, for the closing copy and the station name. */
  terminus?: Stop | null;
  profile: Profile;
  onRemove: (id: string) => void;
  onClear: () => void;
  onJump: (id: string) => void;
  /** Start the line again at its first stop. */
  onRideAgain: () => void;
  /** Leave the terminus for the network map. */
  onOpenMap: () => void;
}

/** The mailto the terminus offers: one message listing the kept tickets. */
function walletMailto(email: string, kept: Stop[]): string {
  if (kept.length === 0) {
    return `mailto:${email}?subject=${encodeURIComponent('Hello from the terminus')}`;
  }

  const subject = 'The tickets I kept';
  const body = kept.map((stop) => `- ${stop.title} (${stop.station})`).join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function Wallet({
  kept,
  terminus,
  profile,
  onRemove,
  onClear,
  onJump,
  onRideAgain,
  onOpenMap,
}: WalletProps) {
  const titleId = useId();
  const count = kept.length;
  const mailto = walletMailto(profile.email, kept);

  return (
    <section className="wallet" aria-labelledby={titleId}>
      <header className="wallet__head">
        <p className="wallet__eyebrow mono">{terminus ? `${terminus.station} / Terminus` : 'Terminus'}</p>
        <h2 className="wallet__title" id={titleId}>
          You have reached the end of the line.
        </h2>
        {terminus ? <p className="wallet__lead">{terminus.oneLiner}</p> : null}
      </header>

      <section className="wallet__kept" aria-labelledby={`${titleId}-kept`}>
        <div className="wallet__kept-head">
          <h3 className="wallet__subhead mono" id={`${titleId}-kept`}>
            Tickets you kept
          </h3>
          <p className="wallet__count mono">
            {count} {count === 1 ? 'ticket' : 'tickets'}
          </p>
        </div>

        {count === 0 ? (
          <div className="wallet__empty">
            <p>
              Nothing kept yet. The line is still open: ride it again, or pick a station
              off the map.
            </p>
            <div className="wallet__empty-actions">
              <button type="button" className="wallet__empty-action" onClick={onRideAgain}>
                Ride the line again
              </button>
              <button type="button" className="wallet__empty-action" onClick={onOpenMap}>
                Browse the map
              </button>
            </div>
          </div>
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
      </section>

      <div className="wallet__actions">
        <a className="wallet__send" href={mailto}>
          {count === 0 ? 'Start a conversation' : 'Email me these tickets'}
        </a>

        {profile.resume ? (
          <a className="wallet__action" href={profile.resume} download>
            Résumé
          </a>
        ) : null}

        <button type="button" className="wallet__action" onClick={onRideAgain}>
          Ride again
        </button>

        <button type="button" className="wallet__action" onClick={onOpenMap}>
          Browse the map
        </button>

        {count > 0 ? (
          <button type="button" className="wallet__clear" onClick={onClear}>
            Clear all
          </button>
        ) : null}
      </div>

      <footer className="wallet__contact">
        <p className="wallet__contact-label mono">Direct</p>
        <a className="wallet__contact-email" href={`mailto:${profile.email}`}>
          {profile.email}
        </a>
        <p className="wallet__contact-place">{profile.location}</p>
        <ul className="wallet__contact-links">
          <li>
            <a href={profile.social.github} rel="noopener noreferrer" target="_blank">
              GitHub
            </a>
          </li>
          <li>
            <a href={profile.social.linkedin} rel="noopener noreferrer" target="_blank">
              LinkedIn
            </a>
          </li>
          <li>
            <a href={profile.social.repos} rel="noopener noreferrer" target="_blank">
              Repositories
            </a>
          </li>
        </ul>
      </footer>
    </section>
  );
}
