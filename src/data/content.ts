/**
 * The loader.
 *
 * `content/` is the source of truth. It is read once, validated once, and
 * handed to every renderer as the same immutable object. No renderer ever
 * copies a value out of here, so a fix in the data updates the scene, the map
 * and the classic view at the same time.
 *
 * The build script (`npm run validate`) fails on the same rules before this
 * ever runs, so a broken content file never reaches a browser.
 */

import type { LineId, SiteContent, Stop } from '../core/types';
import { unwrap, validateProfile, validateRouteConfig, validateStop } from '../core/schema';
import { stopsForLine } from '../core/route';
import { PROFILE_RAW, ROUTE_RAW, STOPS_RAW } from './generated';

function buildContent(): SiteContent {
  const profile = unwrap(validateProfile(PROFILE_RAW, 'content/profile.json'), 'content/profile.json');
  const route = unwrap(validateRouteConfig(ROUTE_RAW, 'content/route.json'), 'content/route.json');

  const stops: Stop[] = [];
  for (const [id, raw] of Object.entries(STOPS_RAW)) {
    const result = validateStop(raw, `content/stops/${id}.json`);
    if (!result.ok) {
      throw new Error(
        `Invalid content/stops/${id}.json:\n${result.errors.map((line) => `  - ${line}`).join('\n')}`,
      );
    }
    if (result.value) stops.push(result.value);
  }

  // Line order is decided by route.json, never by the filesystem.
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  const ordered = route.order
    .map((id) => byId.get(id))
    .filter((stop): stop is Stop => Boolean(stop));

  const missing = route.order.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(`Invalid content/route.json:\n  - order references unknown stops: ${missing.join(', ')}`);
  }

  const orphans = stops.filter((stop) => !route.order.includes(stop.id)).map((stop) => stop.id);
  if (orphans.length > 0) {
    throw new Error(`Invalid content/route.json:\n  - stops missing from order: ${orphans.join(', ')}`);
  }

  return {
    profile,
    route,
    stops: ordered,
  };
}

export const CONTENT: SiteContent = buildContent();

const byId = new Map(CONTENT.stops.map((stop) => [stop.id, stop]));

export function getStop(id: string): Stop | undefined {
  return byId.get(id);
}

export function stopIndex(id: string): number {
  return CONTENT.stops.findIndex((stop) => stop.id === id);
}

/** The stops that sit on the given line, in line order. */
export function lineStops(lineId: LineId): Stop[] {
  return stopsForLine(CONTENT.stops, CONTENT.route, lineId);
}
