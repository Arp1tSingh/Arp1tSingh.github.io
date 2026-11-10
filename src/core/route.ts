/**
 * The route function.
 *
 *   Route(i, b) = order({ e in E : relevance(e, i) >= tau(b) })
 *
 * `i` is the visitor's intent, `b` their time budget, `E` all the evidence.
 * The threshold tau falls as the budget grows: a short budget keeps only the
 * flagship stops, a long one keeps all of them.
 *
 * The physical order of the stations is fixed by `route.order`. Relevance
 * decides *which* stops are on the route, never where they sit.
 */

import type { Budget, Intent, LineConfig, LineId, RouteConfig, Stop } from './types';

/** tau(b): the relevance bar a stop must clear to be on the route. */
export const TAU: Record<Budget, number> = {
  short: 0.7,
  medium: 0.45,
  long: 0,
};

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * How much a stop matters to a visitor with a given intent.
 *
 * The tier carries the most weight because the tier is already a judgement
 * about what is flagship. Intent then adjusts for what the visitor is trying
 * to do: someone skimming wants projects, someone verifying wants evidence,
 * someone exploring wants breadth.
 */
export function relevance(stop: Stop, intent: Intent): number {
  const tier = stop.tier === 'express' ? 1 : 0.45;
  const evidence = Math.min(1, (stop.proof.metrics.length + stop.proof.media.length) / 3);

  let affinity = 0;
  switch (intent) {
    case 'skim':
      affinity = stop.kind === 'project' ? 0.2 : 0;
      break;
    case 'verify':
      affinity = evidence * 0.4;
      break;
    case 'explore':
      affinity = stop.kind === 'project' ? 0.25 : 0.05;
      break;
  }

  return clamp01(tier + affinity);
}

/** The stops that make the route for this intent and budget, in line order. */
export function route(stops: Stop[], intent: Intent, budget: Budget): Stop[] {
  const tau = TAU[budget];
  return stops.filter((stop) => relevance(stop, intent) >= tau);
}

/** Stops ranked by relevance, highest first. Ties keep line order. */
export function ranked(stops: Stop[], intent: Intent): Stop[] {
  return stops
    .map((stop, index) => ({ stop, index, score: relevance(stop, intent) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.stop);
}

export function lineConfig(config: RouteConfig, line: LineId): LineConfig {
  const found = config.lines.find((entry) => entry.id === line);
  if (!found) throw new Error(`Unknown line: ${line}`);
  return found;
}

/** The stops on a given line, in line order. */
export function stopsForLine(stops: Stop[], config: RouteConfig, line: LineId): Stop[] {
  const settings = lineConfig(config, line);
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  const ordered = config.order
    .map((id) => byId.get(id))
    .filter((stop): stop is Stop => Boolean(stop));
  return route(ordered, settings.intent, settings.budget);
}

/** The stop ids on a given line. */
export function routeIdsForLine(stops: Stop[], config: RouteConfig, line: LineId): string[] {
  return stopsForLine(stops, config, line).map((stop) => stop.id);
}
