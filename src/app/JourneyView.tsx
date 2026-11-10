import { Indicator, Ticket } from '../ui';
import type { Stop } from '../core/types';
import type { JourneyApi } from './useJourney';
import type { WalletApi } from './useWallet';

interface JourneyViewProps {
  journey: JourneyApi;
  wallet: WalletApi;
}

/**
 * The line.
 *
 * The tall element is the clock: its height is the total scroll distance the
 * pacing function asks for. Nothing animates on its own. The train moves
 * because the visitor moved.
 */
export function JourneyView({ journey, wallet }: JourneyViewProps) {
  const { state, stops, totalVh, current, next, progress, closeTicket, jumpTo } = journey;
  const ticketOpen = state.phase === 'dwelling' || state.phase === 'terminus';

  return (
    <div className="journey-view">
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
              <span
                className="station-card__fill"
                style={{ transform: `scaleX(${progress.toFixed(4)})` }}
              />
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

      {current ? (
        <Ticket
          stop={current}
          open={ticketOpen}
          onClose={closeTicket}
          kept={wallet.has(current.id)}
          onKeep={wallet.keep}
        />
      ) : null}
    </div>
  );
}
