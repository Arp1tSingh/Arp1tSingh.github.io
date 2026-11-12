import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';

import './app.css';

import { CONTENT, getStop, lineStops } from '../data/content';
import { Gate, Wallet } from '../ui';
import { prefersReducedMotion } from '../renderers/scene3d/tier';
import { Header } from './Header';
import { Footer } from './Footer';
import { JourneyView } from './JourneyView';
import { useJourney } from './useJourney';
import { useWallet } from './useWallet';
import { useKeyboard } from './useKeyboard';
import type { ViewMode } from './useKeyboard';

/**
 * The two other views are fetched when they are asked for.
 *
 * A visitor who never opens the map or the text view should not carry
 * either of them, and on a slow phone the main bundle is the difference
 * between a page that paints in half a second and one that does not.
 */
const MapView = lazy(() =>
  import('../renderers/map2d').then((module) => ({ default: module.MapView })),
);
const ClassicView = lazy(() =>
  import('../renderers/classic').then((module) => ({ default: module.ClassicView })),
);

/**
 * A lazy view gets a real loading state instead of an empty overlay.
 *
 * The chunk is small, but a cold cache or a slow phone still leaves a gap
 * between the click and the first paint. `role="status"` tells a screen
 * reader that the view is coming rather than that the page has died.
 */
function ViewLoading({ label }: { label: string }): JSX.Element {
  return (
    <div className="app__loading" role="status">
      <span className="app__loading-mark" aria-hidden="true" />
      <span>Loading {label}...</span>
    </div>
  );
}

/**
 * The bar every non-line view carries.
 *
 * The first control is always the way back, at every width, because the
 * header's own navigation is a compact menu on a phone. The title is a real
 * heading and receives the focus when the view opens, so a keyboard or screen
 * reader user lands in the new surface rather than at the top of the page.
 */
function ViewBar({ label, onBack }: { label: string; onBack: () => void }): JSX.Element {
  return (
    <div className="app__viewbar">
      <button type="button" className="app__back" onClick={onBack}>
        <span aria-hidden="true">&larr;</span> Back to the line
      </button>
      <h2 className="app__viewtitle" data-view-heading tabIndex={-1}>
        {label}
      </h2>
    </div>
  );
}

export function App() {
  const journey = useJourney();
  const wallet = useWallet();
  const [view, setView] = useState<ViewMode>(() => {
    // `?view=classic` opens the flat version straight away: a link to the
    // Classic view is a link anyone can share.
    if (typeof window !== 'undefined') {
      const asked = new URLSearchParams(window.location.search).get('view');
      if (asked === 'classic' || asked === 'map') return asked;
    }
    return 'journey';
  });
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion] = useState(() => prefersReducedMotion());
  const [contextLost, setContextLost] = useState(false);
  const savedScroll = useRef(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  /**
   * Where focus goes when the visitor comes back to the line.
   *
   * Opening a view is a navigation, not a page load: the header control that
   * opened it should be focused again on the way back, unless that control
   * unmounted (a mobile menu item does).
   */
  const returnFocus = useRef<HTMLElement | null>(null);

  // Boot.
  //
  // The inline script in index.html arms the page before the app loads, and
  // puts it back to the static page if the app has not booted in time. The
  // app therefore has to arm it again when it does boot: a slow machine must
  // not end up with the static copy and the live app at the same time.
  useEffect(() => {
    document.documentElement.classList.add('js-armed');
    window.__local3dBooted = true;
    if (window.__local3dFallback) {
      window.clearTimeout(window.__local3dFallback);
      window.__local3dFallback = undefined;
    }
  }, []);

  const atGate = journey.state.phase === 'gate';

  // The sky cycle: dawn to night across the journey. The stage changes a
  // handful of times per ride, so this is not a per-frame effect.
  useEffect(() => {
    document.documentElement.dataset.journey = journey.stage;
  }, [journey.stage]);

  // While the gate is up the page cannot scroll: the visitor has not chosen a
  // line yet, and the line behind it is standing still. The text view and the
  // map are their own surfaces, so the gate steps aside for them.
  useEffect(() => {
    document.documentElement.classList.toggle('gate-open', atGate && view === 'journey');
  }, [atGate, view]);

  // If the graphics context is lost and cannot be restored, the text view is
  // the finished state and the visitor goes there rather than to a hole.
  useEffect(() => {
    if (contextLost) setView('classic');
  }, [contextLost]);

  // The text view is a separate surface, not a scroll position.
  //
  // Only the text view moves the page: it is a full static document, so it
  // starts at its own top and the line gets its scroll position back on the
  // way out. The map is a fixed overlay over the line; touching the page
  // scroll there would undo a "Ride here" jump as the map closes.
  useEffect(() => {
    const root = document.documentElement;
    const wasClassic = root.classList.contains('classic-open');

    if (view === 'classic') {
      if (!wasClassic) {
        savedScroll.current = window.scrollY;
        root.classList.add('classic-open');
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      return;
    }

    root.classList.remove('classic-open');
    if (wasClassic) {
      window.scrollTo({ top: savedScroll.current, behavior: 'auto' });
    }
  }, [view]);

  const openView = useCallback((next: ViewMode) => {
    if (next !== 'journey') {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) {
        returnFocus.current = active;
      }
    }
    setView(next);
  }, []);

  const closeView = useCallback(() => setView('journey'), []);

  /**
   * A ticket belongs to the line, not to the map or the text view.
   *
   * The panel is a fixed layer; leaving it open over another surface is how
   * it used to cover half the map. Closing it here keeps the journey state
   * honest, so coming back returns to a travelling train rather than to a
   * ticket that reappears by itself.
   */
  const { closeTicket } = journey;
  useEffect(() => {
    if (view !== 'journey' && journey.state.phase === 'dwelling') closeTicket();
  }, [view, journey.state.phase, closeTicket]);

  // Move focus into the new surface, and give it back when the surface closes.
  // The heading lives in the view bar, so it exists even while the lazy chunk
  // is still loading.
  useEffect(() => {
    if (view === 'map' || view === 'classic') {
      const heading = overlayRef.current?.querySelector<HTMLElement>('[data-view-heading]');
      heading?.focus();
      return;
    }

    const target = returnFocus.current;
    returnFocus.current = null;
    if (!target) return;
    if (target.isConnected) target.focus();
    else document.querySelector<HTMLElement>('.site-header__mark')?.focus();
  }, [view]);

  // A deep link jumps straight to a stop.
  useEffect(() => {
    const readHash = () => {
      const id = window.location.hash.replace(/^#\/?/, '');
      if (!id) return;
      if (!getStop(id)) return;
      journey.jumpTo(id);
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectLine = useCallback(
    (line: 'express' | 'all' | 'map') => {
      if (line === 'map') {
        openView('map');
        return;
      }
      journey.selectLine(line);
      setView('journey');
    },
    [journey.selectLine, openView],
  );

  const mapStops = useMemo(() => lineStops('all'), []);
  const terminus = useMemo(
    () => CONTENT.stops.find((stop) => stop.kind === 'terminus') ?? null,
    [],
  );

  useKeyboard({
    journey,
    view,
    setView: openView,
    onSelectLine: selectLine,
  });

  return (
    <div className="app">
      <Header
        profile={CONTENT.profile}
        view={view}
        paused={paused}
        onTogglePause={() => setPaused((value) => !value)}
        onOpenJourney={closeView}
        onOpenMap={() => openView('map')}
        onOpenClassic={() => openView('classic')}
      />

      <main className="app__main">
        {/*
          The line is always mounted. At the gate it waits behind the panel,
          so the first thing a visitor sees is the train at the first station
          rather than a flat screen with a question on it.
        */}
        <JourneyView
          journey={journey}
          wallet={wallet}
          active={view === 'journey'}
          paused={paused}
          reducedMotion={reducedMotion}
          onContextLost={() => setContextLost(true)}
        />

        {atGate && view === 'journey' ? (
          <Gate
            lines={CONTENT.route.lines}
            profile={CONTENT.profile}
            currentLine={journey.state.line}
            onSelect={(line) => selectLine(line)}
          />
        ) : null}
      </main>

      {view === 'map' ? (
        <div className="app__overlay" ref={overlayRef}>
          <ViewBar label="Network map" onBack={closeView} />
          <Suspense fallback={<ViewLoading label="the map" />}>
            <MapView
              content={CONTENT}
              stops={mapStops}
              currentId={journey.current?.id ?? null}
              activeSkill={activeSkill}
              onRide={(id) => {
                journey.jumpTo(id);
                setView('journey');
              }}
              onFilter={setActiveSkill}
            />
          </Suspense>
        </div>
      ) : null}

      {view === 'journey' && journey.state.phase === 'terminus' ? (
        <section className="app__wallet" aria-label="Your tickets">
          <Wallet
            kept={wallet.kept}
            terminus={terminus}
            profile={CONTENT.profile}
            onRemove={wallet.remove}
            onClear={wallet.clear}
            onJump={(id) => journey.jumpTo(id)}
            onRideAgain={() => {
              const first = journey.stops[0];
              if (first) journey.jumpTo(first.id);
            }}
            onOpenMap={() => openView('map')}
          />
        </section>
      ) : null}

      {view === 'classic' ? (
        <div className="app__overlay app__overlay--classic" ref={overlayRef}>
          <ViewBar label="Text view" onBack={closeView} />
          <Suspense fallback={<ViewLoading label="the text view" />}>
            <div className="classic-view">
              <ClassicView content={CONTENT} />
            </div>
          </Suspense>
        </div>
      ) : null}

      <Footer profile={CONTENT.profile} />
    </div>
  );
}
