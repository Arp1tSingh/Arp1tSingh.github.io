import { describe, expect, it } from 'vitest';

import { CONTENT } from '../../src/data/content';
import { TAU, lineConfig, ranked, relevance, route, stopsForLine } from '../../src/core/route';
import type { Budget, Intent } from '../../src/core/types';

const projects = CONTENT.stops.filter((stop) => stop.kind === 'project');
const express = CONTENT.stops.filter((stop) => stop.tier === 'express');
const local = CONTENT.stops.filter((stop) => stop.tier === 'local');

describe('the dataset', () => {
  it('holds twelve stops: nine projects and three fixed stations', () => {
    expect(CONTENT.stops).toHaveLength(12);
    expect(projects).toHaveLength(9);
    expect(CONTENT.stops.filter((stop) => stop.kind === 'experience')).toHaveLength(1);
    expect(CONTENT.stops.filter((stop) => stop.kind === 'about')).toHaveLength(1);
    expect(CONTENT.stops.filter((stop) => stop.kind === 'terminus')).toHaveLength(1);
  });

  it('has no stop outside the line order', () => {
    expect(CONTENT.stops.map((stop) => stop.id)).toEqual(CONTENT.route.order);
  });

  it('has no placeholder left in any required field', () => {
    const serialised = JSON.stringify(CONTENT.stops) + JSON.stringify(CONTENT.profile);
    expect(serialised).not.toContain('TBD');
  });

  it('gives every project stop a repository link', () => {
    for (const stop of projects) {
      expect(stop.links.repo).toMatch(/^https:\/\/github\.com\//);
    }
  });

  it('keeps the nine project stops in nine distinct stations', () => {
    const stations = projects.map((stop) => stop.station);
    expect(new Set(stations).size).toBe(9);
  });
});

describe('relevance', () => {
  it('rates an express stop above a local stop for every intent', () => {
    const intents: Intent[] = ['skim', 'verify', 'explore'];
    for (const intent of intents) {
      for (const expressStop of express) {
        for (const localStop of local) {
          expect(relevance(expressStop, intent)).toBeGreaterThan(relevance(localStop, intent));
        }
      }
    }
  });

  it('never leaves the unit interval', () => {
    for (const stop of CONTENT.stops) {
      for (const intent of ['skim', 'verify', 'explore'] as Intent[]) {
        const score = relevance(stop, intent);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('the route function', () => {
  it('keeps every stop on a long budget', () => {
    for (const intent of ['skim', 'verify', 'explore'] as Intent[]) {
      expect(route(CONTENT.stops, intent, 'long')).toHaveLength(12);
    }
  });

  it('drops the local stops on a short budget, which is what Express is', () => {
    const short = route(CONTENT.stops, 'skim', 'short');
    expect(short.length).toBeLessThan(12);
    expect(short.every((stop) => stop.tier === 'express')).toBe(true);
  });

  it('falls as the budget grows', () => {
    const budgets: Budget[] = ['short', 'medium', 'long'];
    const counts = budgets.map((budget) => route(CONTENT.stops, 'skim', budget).length);
    expect(counts[0]).toBeLessThanOrEqual(counts[1]);
    expect(counts[1]).toBeLessThanOrEqual(counts[2]);
  });

  it('keeps the express stops on every line', () => {
    for (const budget of ['short', 'medium', 'long'] as Budget[]) {
      const kept = route(CONTENT.stops, 'skim', budget);
      for (const stop of express) {
        expect(kept.map((entry) => entry.id)).toContain(stop.id);
      }
    }
  });

  it('preserves the line order in the result', () => {
    const order = CONTENT.route.order;
    const result = route(CONTENT.stops, 'explore', 'long');
    const positions = result.map((stop) => order.indexOf(stop.id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('the three lines', () => {
  it('has Express, All stations and a Map', () => {
    expect(CONTENT.route.lines.map((line) => line.id)).toEqual(['express', 'all', 'map']);
    expect(CONTENT.route.defaultLine).toBe('express');
  });

  it('gives each line an intent and a budget', () => {
    for (const line of CONTENT.route.lines) {
      expect(lineConfig(CONTENT.route, line.id)).toBe(line);
      expect(['skim', 'verify', 'explore']).toContain(line.intent);
      expect(['short', 'medium', 'long']).toContain(line.budget);
    }
  });

  it('runs Express with only the flagship stops', () => {
    const stops = stopsForLine(CONTENT.stops, CONTENT.route, 'express');
    expect(stops.every((stop) => stop.tier === 'express')).toBe(true);
    expect(stops.length).toBeGreaterThanOrEqual(5);
  });

  it('runs All stations with everything', () => {
    expect(stopsForLine(CONTENT.stops, CONTENT.route, 'all')).toHaveLength(12);
  });

  it('runs the Map with the whole network', () => {
    expect(stopsForLine(CONTENT.stops, CONTENT.route, 'map')).toHaveLength(12);
  });
});

describe('the threshold', () => {
  it('falls as the budget grows', () => {
    expect(TAU.short).toBeGreaterThan(TAU.medium);
    expect(TAU.medium).toBeGreaterThan(TAU.long);
    expect(TAU.long).toBe(0);
  });
});

describe('ranking', () => {
  it('puts the flagship stops first when verifying', () => {
    const order = ranked(CONTENT.stops, 'verify').map((stop) => stop.id);
    const firstLocal = order.findIndex((id) => CONTENT.stops.find((stop) => stop.id === id)?.tier === 'local');
    const lastExpress = order.map((id) => CONTENT.stops.find((stop) => stop.id === id)?.tier).lastIndexOf('express');
    if (firstLocal !== -1) {
      expect(lastExpress).toBeLessThan(firstLocal);
    }
  });
});
