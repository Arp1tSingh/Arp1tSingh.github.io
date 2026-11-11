import { useCallback, useEffect, useRef, useState } from 'react';

import './app.css';

import { CONTENT, getStop, lineStops } from '../data/content';
import { Gate, Wallet } from '../ui';
import { MapView } from '../renderers/map2d';
import { ClassicView } from '../renderers/classic';
import { prefersReducedMotion } from '../renderers/scene3d/tier';
import { Header } from './Header';
import { Footer } from './Footer';
import { JourneyView } from './JourneyView';
import { useJourney } from './useJourney';
import { useWallet } from './useWallet';
import { useKeyboard } from './useKeyboard';
import type { ViewMode } from './useKeyboard';

const SKY_STAGES = ['dawn', 'day', 'dusk', 'night'] as const;

export function App() {
  const journey = useJourney();
  const wallet = useWallet();
  const [view, setView] = useState<ViewMode>('journey');
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion] = useState(() => prefersReducedMotion());
  const [contextLost, setContextLost] = useState(false);
  const savedScroll = useRef(0);

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

  // The sky cycle: dawn to night across the journey.
  useEffect(() => {
    const stage = SKY_STAGES[Math.min(SKY_STAGES.length - 1, Math.floor(journey.progress * 4))];
    document.documentElement.dataset.journey = stage;
  }, [journey.progress]);

  // While the gate is up the page cannot scroll: the visitor has not chosen a
  // line yet, and the line behind it is standing still. The classic view and
  // the map are their own surfaces, so the gate steps aside for them.
  useEffect(() => {
    document.documentElement.classList.toggle('gate-open', atGate && view === 'journey');
  }, [atGate, view]);

  // If the graphics context is lost and cannot be restored, the Classic view
  // is the finished state and the visitor goes there rather than to a hole.
  useEffect(() => {
    if (contextLost) setView('classic');
  }, [contextLost]);

  // The Classic view is a separate surface, not a scroll position.
  useEffect(() => {
    const root = document.documentElement;
    if (view === 'classic') {
      savedScroll.current = window.scrollY;
      root.classList.add('classic-open');
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      root.classList.remove('classic-open');
      if (view === 'journey') {
        window.scrollTo({ top: savedScroll.current, behavior: 'auto' });
      }
    }
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

  const selectLine = useCallback(    (line: 'express' | 'all' | 'map') => {
      if (line === 'map') {
        setView('map');
        return;
      }
      journey.selectLine(line);
      setView('journey');
    },
    [journey],
  );

  useKeyboard({
    journey,
    view,
    setView,
    onSelectLine: (line) => selectLine(line),
  });

  const mapStops = lineStops('all');

  return (
    <div className="app">
      <Header
        profile={CONTENT.profile}
        view={view}
        paused={paused}
        onTogglePause={() => setPaused((value) => !value)}
        onOpenJourney={() => setView('journey')}
        onOpenMap={() => setView('map')}
        onOpenClassic={() => setView('classic')}
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
          paused={paused}
          reducedMotion={reducedMotion}
          onContextLost={() => setContextLost(true)}
        />

        {atGate && view === 'journey' ? (
          <Gate
            lines={CONTENT.route.lines}
            profile={CONTENT.profile}
            onSelect={(line) => selectLine(line)}
          />
        ) : null}
      </main>

      {view === 'map' ? (
        <div className="app__overlay">
          <MapView
            content={CONTENT}
            stops={mapStops}
            currentId={journey.current?.id ?? null}
            activeSkill={activeSkill}
            onJump={(id) => {
              journey.jumpTo(id);
              setView('journey');
            }}
            onFilter={setActiveSkill}
          />
        </div>
      ) : null}

      {journey.state.phase === 'terminus' ? (
        <section className="app__wallet" aria-label="Your tickets">
          <Wallet
            kept={wallet.kept}
            email={CONTENT.profile.email}
            onRemove={wallet.remove}
            onClear={wallet.clear}
            onJump={(id) => {
              journey.jumpTo(id);
              setView('journey');
            }}
          />
        </section>
      ) : null}

      <div className="classic-view">
        <ClassicView content={CONTENT} />
      </div>

      <Footer profile={CONTENT.profile} />
    </div>
  );
}
