import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { Indicator, Ticket } from '../ui';
import { CONTENT } from '../data/content';
import { Poster } from '../renderers/scene3d/Poster';
import { prefersReducedMotion, profileDevice } from '../renderers/scene3d/tier';
import { useMediaQuery } from './useMediaQuery';
import type { Stop } from '../core/types';
import type { JourneyApi } from './useJourney';
import type { WalletApi } from './useWallet';

/**
 * The scene is loaded after the first paint.
 *
 * "Show a poster image first so the largest paint lands before the 3D loads."
 * three.js is a quarter of the bundle, and the poster stands in until the
 * canvas is ready.
 */
const Scene3D = lazy(() =>
  import('../renderers/scene3d/Scene').then((module) => ({ default: module.Scene3D })),
);

interface JourneyViewProps {
  journey: JourneyApi;
  wallet: WalletApi;
  /** Stop rendering the scene entirely. */
  paused: boolean;
  reducedMotion: boolean;
  onContextLost(): void;
}

/**
 * The line.
 *
 * The tall element is the clock: its height is the total scroll distance the
 * pacing function asks for. Nothing animates on its own. The train moves
 * because the visitor moved.
 *
 * The 3D scene is a fixed layer behind everything, and the position it is
 * given is the same route position the core computes for the ticket.
 */
export function JourneyView({
  journey,
  wallet,
  paused,
  reducedMotion,
  onContextLost,
}: JourneyViewProps) {
  const { state, stops, totalVh, current, next, stage, closeTicket, jumpTo, positionRef } =
    journey;
  const ticketOpen = state.phase === 'dwelling' || state.phase === 'terminus';

  const container = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const [contextLost, setContextLost] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const detail = useMemo(() => profileDevice().detail, []);
  /**
   * Whether this browser can run the scene at all.
   *
   * The answer is taken before the scene is loaded, so a visitor without
   * WebGL never downloads three.js: they get the poster, which is the whole
   * point of having one.
   */
  const [canRenderScene] = useState(() => profileDevice().webgl);
  /**
   * The progress bar is a DOM detail, not a React state. Reading the live
   * position here keeps the bar smooth without re-rendering the scene.
   */
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const position = positionRef.current;
      if (fill.current) {
        const progress = position && stops.length > 1
          ? Math.min(1, Math.max(0, position.s / (stops.length - 1)))
          : 0;
        fill.current.style.transform = `scaleX(${progress.toFixed(4)})`;
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [positionRef, stops.length]);

  /**
   * Whether the scene is worth having.
   *
   * On a narrow screen the gate covers the whole viewport, so a scene behind
   * it would be invisible and the visitor would pay for it anyway. On a wide
   * one the gate is a panel and the line is the first thing on the screen, so
   * the scene is loaded and drawn.
   */
  const atGate = journey.state.phase === 'gate';
  const wide = useMediaQuery('(min-width: 721px)');
  const showScene = !atGate || wide;

  /**
   * Whether the visitor has moved the line yet.
   *
   * "Scroll is the only clock" is a rule about the scene, not about the
   * interface: the page has to say so, or the train looks parked.
   */
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 60) setScrolled(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="journey-view" ref={container}>
      <div className="scene3d" aria-hidden="true">
        {contextLost ? (
          <Poster reason="the graphics context was lost" />
        ) : !showScene ? null : canRenderScene ? (
          <Suspense fallback={<Poster reason="loading the scene" />}>
            <Scene3D
              stops={stops}
              targetSRef={positionRef}
              activeIndex={state.stopIndex}
              dwelling={state.phase === 'dwelling' || state.phase === 'terminus'}
              night={stage === 'night'}
              reducedMotion={reducedMotion}
              detail={detail}
              paused={paused}
              still={atGate}
              onContextLost={() => {
                setContextLost(true);
                onContextLost();
              }}
            />
          </Suspense>
        ) : (
          <Poster reason="this browser cannot run WebGL" />
        )}
      </div>

      <div
        className="journey-view__track"
        style={{ height: `${Math.max(1, totalVh) * 100}vh` }}
        aria-hidden="true"
      />

      <div className="journey-view__stage">
        {current ? (
          <div className="station-card" data-phase={state.phase}>
            <p className="station-card__station mono">{current.station}</p>
            <p className="station-card__title">{current.title}</p>
            {next ? (
              <p className="station-card__next mono">
                Next: {next.station}
              </p>
            ) : (
              <p className="station-card__next mono">Terminus</p>
            )}
            <div className="station-card__rail" role="presentation">
              <span ref={fill} className="station-card__fill" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="journey-view__dots" role="group" aria-label="Stops on this line">
        {stops.map((stop: Stop, index) => (
          <button
            key={stop.id}
            type="button"
            className="journey-view__dot"
            aria-current={index === state.stopIndex ? 'true' : undefined}
            aria-label={`${stop.station}: ${stop.title}`}
            onClick={() => jumpTo(stop.id)}
          />
        ))}
      </div>

      <Indicator stops={stops} currentIndex={state.stopIndex} phase={state.phase} />

      {/*
        The line only moves when the visitor moves it. The page says so, once,
        and then stops saying it.
      */}
      {state.phase !== 'gate' && !scrolled ? (
        <p className="journey-view__cue">
          Scroll to ride <span aria-hidden="true">↓</span>
        </p>
      ) : null}

      {current ? (
        <Ticket
          stop={current}
          open={ticketOpen}
          onClose={closeTicket}
          kept={wallet.has(current.id)}
          onKeep={wallet.keep}
          resume={CONTENT.profile.resume || undefined}
        />
      ) : null}

      {/*
        The scene needs a mirror that is not a canvas. A screen reader and a
        search engine must see every stop, with real headings, whether or not
        the 3D ever runs.
      */}
      <nav className="journey-view__index visually-hidden-focusable" aria-label="Stations on this line">
        <h2>Stations on this line</h2>
        <ol>
          {stops.map((stop) => (
            <li key={stop.id}>
              <a href={`#${stop.id}`}>{stop.station}</a>: {stop.title}. {stop.claim}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

export { prefersReducedMotion };
