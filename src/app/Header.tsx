import type { Profile } from '../core/types';

interface HeaderProps {
  profile: Profile;
  onOpenMap(): void;
  onOpenClassic(): void;
  onOpenJourney(): void;
  view: 'journey' | 'map' | 'classic';
}

/**
 * The fixed header.
 *
 * The email is the one thing a visitor must never have to hunt for, so it
 * lives here as a solid accent button on frame one, at every width, and never
 * scrolls away. It is a `mailto:`, so there is no form and nothing to fail.
 */
export function Header({ profile, onOpenMap, onOpenClassic, onOpenJourney, view }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__bar">
        <button type="button" className="site-header__mark" onClick={onOpenJourney}>
          <span className="site-header__name">{profile.name}</span>
          <span className="site-header__handle mono">{profile.handle}</span>
        </button>

        <nav className="site-header__nav" aria-label="Views">
          <button
            type="button"
            className="site-header__link"
            aria-current={view === 'journey' ? 'page' : undefined}
            onClick={onOpenJourney}
          >
            Line
          </button>
          <button
            type="button"
            className="site-header__link"
            aria-current={view === 'map' ? 'page' : undefined}
            onClick={onOpenMap}
          >
            Map
          </button>
          <button
            type="button"
            className="site-header__link"
            aria-current={view === 'classic' ? 'page' : undefined}
            onClick={onOpenClassic}
          >
            Classic
          </button>
        </nav>

        <a className="site-header__cta" href={`mailto:${profile.email}`}>
          Hire me
        </a>
      </div>
    </header>
  );
}
