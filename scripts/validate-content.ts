#!/usr/bin/env tsx
/**
 * Validates the whole content directory and the seams between the files.
 *
 *   npx tsx scripts/validate-content.ts            # placeholders are tolerated
 *   npx tsx scripts/validate-content.ts --strict   # a single TBD fails the run
 *
 * Three layers of checking happen here:
 *
 *   1. Shape.    Every file is run through the validators in `src/core/schema.ts`.
 *   2. Seams.    The route and the stop files have to agree with each other:
 *                every id in `route.order` needs a stop, every stop needs a
 *                place in `route.order`, ids are unique and the fixed stations
 *                (experience / about / terminus) exist exactly once each.
 *   3. Launch.   With `--strict` a remaining `TBD` placeholder is an error.
 *
 * The script never throws: a broken content directory is reported, not crashed on.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateProfile,
  validateRouteConfig,
  validateStop,
  validateStrict,
} from '../src/core/schema.ts';
import type { RouteConfig, Stop, StopKind, Tier } from '../src/core/types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'content');
const STOPS_DIR = join(CONTENT_DIR, 'stops');
const PROFILE_FILE = join(CONTENT_DIR, 'profile.json');
const ROUTE_FILE = join(CONTENT_DIR, 'route.json');

/** The number of evidence slots the line is built around. */
const EXPECTED_PROJECTS = 9;

/** The fixed stations, and how many of each the line must carry. */
const FIXED_STATIONS: ReadonlyArray<{ kind: StopKind; count: number }> = [
  { kind: 'experience', count: 1 },
  { kind: 'about', count: 1 },
  { kind: 'terminus', count: 1 },
];

const TIERS: readonly Tier[] = ['express', 'local'];

const strict = process.argv.slice(2).some((arg) => arg === '--strict');

/** A single problem, split into the two halves the report prints. */
interface Issue {
  path: string;
  message: string;
}

/** A stop as it was read, valid or not, so the seams can be checked anyway. */
interface StopRecord {
  file: string;
  id: string;
  kind: StopKind | null;
  tier: Tier | null;
  title: string;
  station: string;
  valid: boolean;
}

const issues: Issue[] = [];
const placeholderPaths: string[] = [];

function addIssue(path: string, message: string): void {
  issues.push({ path, message });
}

/** True when something was already reported for this exact path. */
function hasIssueFor(path: string): boolean {
  return issues.some((issue) => issue.path === path);
}

/**
 * The validators report `"<path> <message>"`. Split that apart so the report
 * can print `ERROR <path>: <message>`.
 */
function addValidatorErrors(errors: readonly string[]): void {
  for (const error of errors) {
    const trimmed = error.trim();
    const split = trimmed.indexOf(' ');
    if (split === -1) addIssue(trimmed, 'is invalid');
    else addIssue(trimmed.slice(0, split), trimmed.slice(split + 1));
  }
}

/** Repo relative, forward slashed path - what a person would type. */
function rel(path: string): string {
  return relative(ROOT, path).split(sep).join('/');
}

function readJson(file: string): { raw?: unknown; error?: string } {
  try {
    return { raw: JSON.parse(readFileSync(file, 'utf8')) as unknown };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asKind(value: unknown): StopKind | null {
  const kinds: StopKind[] = ['project', 'experience', 'about', 'terminus'];
  return kinds.includes(value as StopKind) ? (value as StopKind) : null;
}

function asTier(value: unknown): Tier | null {
  return TIERS.includes(value as Tier) ? (value as Tier) : null;
}

/* ------------------------------------------------------------------ */
/* 1. Shape                                                            */
/* ------------------------------------------------------------------ */

function readProfile(): void {
  const path = rel(PROFILE_FILE);
  if (!existsSync(PROFILE_FILE)) {
    addIssue(path, 'is missing');
    return;
  }
  const { raw, error } = readJson(PROFILE_FILE);
  if (error !== undefined) {
    addIssue(path, `is not valid JSON (${error})`);
    return;
  }
  const result = validateProfile(raw, path);
  addValidatorErrors(result.errors);
  placeholderPaths.push(...result.placeholders);
  if (strict) {
    for (const field of result.placeholders) addIssue(field, 'is still a placeholder');
  }

  /*
   * The résumé.
   *
   * The field is empty until there is a PDF, and the terminus renders no
   * action while it is empty. The moment it is not empty, the file has to be
   * there: a download link that 404s is worse than no download link.
   */
  const resume = asString((raw as Record<string, unknown>).resume);
  if (resume.length > 0) {
    const target = join(ROOT, 'public', resume.replace(/^\/+/, ''));
    if (!existsSync(target)) {
      addIssue(`${path}.resume`, `points at ${resume}, which is not in public/`);
    }
  }
}

function readRoute(): { raw?: Record<string, unknown>; value?: RouteConfig } {
  const path = rel(ROUTE_FILE);
  if (!existsSync(ROUTE_FILE)) {
    addIssue(path, 'is missing');
    return {};
  }
  const { raw, error } = readJson(ROUTE_FILE);
  if (error !== undefined) {
    addIssue(path, `is not valid JSON (${error})`);
    return {};
  }
  const result = validateRouteConfig(raw, path);
  addValidatorErrors(result.errors);
  placeholderPaths.push(...result.placeholders);
  if (strict) {
    for (const field of result.placeholders) addIssue(field, 'is still a placeholder');
  }
  return { raw: asRecord(raw), value: result.value };
}

function readStops(): { records: StopRecord[]; stops: Stop[] } {
  const records: StopRecord[] = [];
  const stops: Stop[] = [];

  if (!existsSync(STOPS_DIR)) {
    addIssue(rel(STOPS_DIR), 'is missing - there are no stops to route');
    return { records, stops };
  }

  const files = readdirSync(STOPS_DIR)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort();

  for (const name of files) {
    const full = join(STOPS_DIR, name);
    const path = rel(full);
    const { raw, error } = readJson(full);
    if (error !== undefined) {
      addIssue(path, `is not valid JSON (${error})`);
      records.push({
        file: path,
        id: '',
        kind: null,
        tier: null,
        title: '',
        station: '',
        valid: false,
      });
      continue;
    }

    const result = strict ? validateStrict(raw, path) : validateStop(raw, path);
    addValidatorErrors(result.errors);
    placeholderPaths.push(...result.placeholders);

    const record = asRecord(raw);
    const value = result.value;
    const id = value ? value.id : asString(record?.id);
    records.push({
      file: path,
      id,
      kind: value ? value.kind : asKind(record?.kind),
      tier: value ? value.tier : asTier(record?.tier),
      title: value ? value.title : asString(record?.title),
      station: value ? value.station : asString(record?.station),
      valid: Boolean(value),
    });
    if (value) stops.push(value);
  }

  return { records, stops };
}

/* ------------------------------------------------------------------ */
/* 2. Seams                                                            */
/* ------------------------------------------------------------------ */

function checkSeams(
  routeRaw: Record<string, unknown> | undefined,
  records: StopRecord[],
): void {
  const routePath = rel(ROUTE_FILE);
  const order = Array.isArray(routeRaw?.order) ? (routeRaw.order as unknown[]).map(String) : [];
  const orderPath = `${routePath}.order`;

  const byId = new Map<string, StopRecord[]>();
  for (const record of records) {
    if (!record.id) continue;
    const bucket = byId.get(record.id);
    if (bucket) bucket.push(record);
    else byId.set(record.id, [record]);
  }

  // Every id on the route must resolve to a stop.
  for (const id of order) {
    if (!byId.has(id)) {
      addIssue(orderPath, `"${id}" has no stop file (expected content/stops/${id}.json)`);
    }
  }

  // Every stop file must have a place on the route.
  for (const record of records) {
    if (!record.id) continue;
    if (!order.includes(record.id)) {
      addIssue(record.file, `stop "${record.id}" is not listed in ${orderPath}`);
    }
  }

  // Ids must be unique, in the files and on the route.
  for (const [id, bucket] of byId) {
    if (bucket.length > 1) {
      const files = bucket.map((record) => record.file).join(', ');
      for (const record of bucket) {
        addIssue(record.file, `duplicate stop id "${id}" (also in ${files})`);
      }
    }
  }
  const seenOrder = new Set<string>();
  for (const id of order) {
    if (seenOrder.has(id)) addIssue(orderPath, `"${id}" appears more than once`);
    seenOrder.add(id);
  }

  // Exactly one experience, one about, one terminus, nine projects.
  const kindCounts = new Map<StopKind, number>();
  for (const record of records) {
    if (!record.kind) continue;
    kindCounts.set(record.kind, (kindCounts.get(record.kind) ?? 0) + 1);
  }
  for (const { kind, count } of FIXED_STATIONS) {
    const found = kindCounts.get(kind) ?? 0;
    if (found !== count) {
      addIssue(
        rel(STOPS_DIR),
        `expected exactly ${count} stop of kind "${kind}", found ${found}`,
      );
    }
  }
  const projects = kindCounts.get('project') ?? 0;
  if (projects !== EXPECTED_PROJECTS) {
    addIssue(
      rel(STOPS_DIR),
      `expected exactly ${EXPECTED_PROJECTS} project stops, found ${projects}`,
    );
  }

  // Every stop has to sit on a real tier.
  for (const record of records) {
    if (!record.tier) {
      const tierPath = `${record.file}.tier`;
      if (!hasIssueFor(tierPath)) {
        addIssue(tierPath, `must be "express" or "local"`);
      }
    }
  }

  // The default line has to be one of the lines on the board.
  const lines = Array.isArray(routeRaw?.lines) ? (routeRaw.lines as unknown[]) : [];
  const lineIds = lines
    .map((line) => asString(asRecord(line)?.id))
    .filter((id) => id.length > 0);
  const defaultLine = asString(routeRaw?.defaultLine);
  if (defaultLine.length > 0 && lineIds.length > 0 && !lineIds.includes(defaultLine)) {
    addIssue(`${routePath}.defaultLine`, `"${defaultLine}" is not one of ${routePath}.lines`);
  }

  // Pacing has to leave a stop long enough to be read.
  const pacing = asRecord(routeRaw?.pacing);
  const dwell = asRecord(pacing?.dwell);
  for (const key of ['express', 'local']) {
    const value = Number(dwell?.[key]);
    const path = `${routePath}.pacing.dwell.${key}`;
    if (!Number.isFinite(value) || value <= 0) {
      if (!hasIssueFor(path)) addIssue(path, 'must be greater than 0');
    }
  }
  const travel = Number(pacing?.travel);
  const travelPath = `${routePath}.pacing.travel`;
  if (!Number.isFinite(travel) || travel <= 0) {
    if (!hasIssueFor(travelPath)) addIssue(travelPath, 'must be greater than 0');
  }
}

/* ------------------------------------------------------------------ */
/* 3. Report                                                           */
/* ------------------------------------------------------------------ */

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function printStationBoard(records: StopRecord[], order: string[]): void {
  const byId = new Map<string, StopRecord>();
  for (const record of records) {
    if (record.id && !byId.has(record.id)) byId.set(record.id, record);
  }

  const ordered: StopRecord[] = [];
  for (const id of order) {
    const record = byId.get(id);
    if (record) ordered.push(record);
  }
  for (const record of records) {
    if (!ordered.includes(record)) ordered.push(record);
  }
  if (ordered.length === 0) return;

  console.log('');
  console.log('Station board');
  const idWidth = Math.max(2, ...ordered.map((r) => r.id.length));
  const stationWidth = Math.max(7, ...ordered.map((r) => r.station.length));
  const tierWidth = Math.max(4, ...ordered.map((r) => (r.tier ?? '?').length));
  const titleWidth = Math.max(5, ...ordered.map((r) => r.title.length));
  console.log(
    `  ${pad('#', 3)}${pad('ID', idWidth)}  ${pad('STATION', stationWidth)}  ${pad(
      'TIER',
      tierWidth,
    )}  ${pad('TITLE', titleWidth)}`,
  );
  console.log(
    `  ${'-'.repeat(2)}  ${'-'.repeat(idWidth)}  ${'-'.repeat(stationWidth)}  ${'-'.repeat(
      tierWidth,
    )}  ${'-'.repeat(titleWidth)}`,
  );
  ordered.forEach((record, index) => {
    console.log(
      `  ${pad(String(index + 1), 3)}${pad(record.id || '?', idWidth)}  ${pad(
        record.station || '?',
        stationWidth,
      )}  ${pad(record.tier ?? '?', tierWidth)}  ${record.title || '?'}`,
    );
  });
}

function main(): number {
  console.log('Content validation');
  console.log('==================');
  console.log(`mode: ${strict ? 'strict (placeholders are errors)' : 'relaxed (placeholders allowed)'}`);

  if (!existsSync(CONTENT_DIR)) {
    addIssue(rel(CONTENT_DIR), 'content directory not found - nothing to validate');
    console.log('');
    console.log(`ERROR ${rel(CONTENT_DIR)}: content directory not found - nothing to validate`);
    console.log('Create content/profile.json, content/route.json and content/stops/<id>.json.');
    return 1;
  }

  readProfile();
  const route = readRoute();
  const { records } = readStops();
  checkSeams(route.raw, records);

  const order = Array.isArray(route.raw?.order)
    ? (route.raw.order as unknown[]).map(String)
    : [];

  const tierCounts = new Map<Tier, number>();
  const kindCounts = new Map<StopKind, number>();
  for (const record of records) {
    if (record.tier) tierCounts.set(record.tier, (tierCounts.get(record.tier) ?? 0) + 1);
    if (record.kind) kindCounts.set(record.kind, (kindCounts.get(record.kind) ?? 0) + 1);
  }
  const tierSummary = TIERS.map((tier) => `${tier} ${tierCounts.get(tier) ?? 0}`).join(', ');
  const kindSummary = (['project', 'experience', 'about', 'terminus'] as StopKind[])
    .map((kind) => `${kind} ${kindCounts.get(kind) ?? 0}`)
    .join(', ');

  console.log('');
  console.log(
    `Summary: ${records.length} stop file(s) | tier: ${tierSummary} | kind: ${kindSummary} | route stops: ${order.length}`,
  );

  printStationBoard(records, order);

  if (issues.length > 0) {
    console.log('');
    for (const issue of issues) {
      console.log(`ERROR ${issue.path}: ${issue.message}`);
    }
  }

  if (!strict && placeholderPaths.length > 0) {
    const shown = placeholderPaths.slice(0, 20);
    const rest = placeholderPaths.length - shown.length;
    console.log('');
    console.log(
      `WARN ${placeholderPaths.length} placeholder(s) remaining: ${shown.join(', ')}${
        rest > 0 ? ` (+${rest} more)` : ''
      }`,
    );
  }

  console.log('');
  if (issues.length > 0) {
    console.log(`FAILED: ${issues.length} error(s).`);
    return 1;
  }
  console.log('OK: content is valid.');
  return 0;
}

process.exitCode = main();
