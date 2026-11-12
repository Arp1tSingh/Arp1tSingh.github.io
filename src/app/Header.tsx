import { useEffect, useId, useRef, useState } from 'react';
import type { Profile } from '../core/types';

interface HeaderProps {
  profile: Profile;
  onOpenMap(): void;
  onOpenClassic(): void;
  onOpenJourney(): void;
  view: 'journey' | 'map' | 'classic';
  /** The scene is not rendering. */
  paused: boolean;
  onTogglePause(): void;
}

/**
 * The fixed header.
 *
 * The email is the one thing a visitor must never have to hunt for, so it
 * lives here as a solid accent button on frame one, at every width, and never
 * scrolls away. It is a `mailto:`, so there is no form and nothing to fail.
 *
 * On a wide screen the views are a row of links. On a phone they collapse
 * into one menu button: the nav used to disappear completely below 720px,
 * which made the map and the text view unreachable after boarding.
 */
export function Header({
  profile,
  onOpenMap,
  onOpenClassic,
  onOpenJourney,
  view,
  paused,
  onTogglePause,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const headerRef = useRef<HTMLElement | null>(null);

  // A view change is also a menu choice. Close the sheet behind it.
  useEffect(() => {
    setMenuOpen(false);
  }, [view]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      const header = headerRef.current;
      if (header && event.target instanceof Node && !header.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  const choose = (open: () => void) => () => {
    setMenuOpen(false);
    open();
  };

  const resume = profile.resume ? (
    <a className="site-header__link site-header__resume" href={profile.resume} download>
      Résumé
    </a>
  ) : null;

  return (
    <header className="site-header" ref={headerRef}>
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
            Text view
          </button>
        </nav>

        {resume}

        <button
          type="button"
          className="site-header__link site-header__pause"
          aria-pressed={paused}
          onClick={onTogglePause}
        >
          {paused ? 'Resume motion' : 'Pause motion'}
        </button>

        <a className="site-header__cta" href={`mailto:${profile.email}`}>
          Hire me
        </a>

        <button
          type="button"
          className="site-header__menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>{menuOpen ? 'Close' : 'Views'}</span>
          <span className="site-header__menu-mark" aria-hidden="true">
            {menuOpen ? '×' : '☰'}
          </span>
        </button>
      </div>

      {menuOpen ? (
        <nav className="site-header__sheet" id={menuId} aria-label="Views">
          <button
            type="button"
            className="site-header__sheet-link"
            aria-current={view === 'journey' ? 'page' : undefined}
            onClick={choose(onOpenJourney)}
          >
            <span>Line</span>
            <span className="site-header__sheet-note mono">the ride</span>
          </button>
          <button
            type="button"
            className="site-header__sheet-link"
            aria-current={view === 'map' ? 'page' : undefined}
            onClick={choose(onOpenMap)}
          >
            <span>Map</span>
            <span className="site-header__sheet-note mono">by skill</span>
          </button>
          <button
            type="button"
            className="site-header__sheet-link"
            aria-current={view === 'classic' ? 'page' : undefined}
            onClick={choose(onOpenClassic)}
          >
            <span>Text view</span>
            <span className="site-header__sheet-note mono">no 3D</span>
          </button>

          {profile.resume ? (
            <a className="site-header__sheet-link" href={profile.resume} download>
              <span>Résumé</span>
              <span className="site-header__sheet-note mono">PDF</span>
            </a>
          ) : null}

          <button
            type="button"
            className="site-header__sheet-link"
            aria-pressed={paused}
            onClick={onTogglePause}
          >
            <span>{paused ? 'Resume motion' : 'Pause motion'}</span>
            <span className="site-header__sheet-note mono">{paused ? 'off' : 'on'}</span>
          </button>
        </nav>
      ) : null}
    </header>
  );
}
