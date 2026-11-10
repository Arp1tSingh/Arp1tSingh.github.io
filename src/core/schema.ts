/**
 * Content validation.
 *
 * The blueprint's rule: "The build fails if a required field is empty."
 * This module is deliberately dependency-free and DOM-free so that the same
 * validator runs in three places: the build script (Node), the browser loader
 * and the unit tests.
 *
 * Placeholders are a second, stricter matter. A `TBD` is allowed while the
 * content is being written, but the launch gate refuses one. `validate()` is
 * the always-on check; `validateStrict()` adds the placeholder ban.
 */

import type {
  Budget,
  Domain,
  LineConfig,
  LineId,
  MediaItem,
  PacingConfig,
  Profile,
  RouteConfig,
  Role,
  Stop,
  StopKind,
  Tier,
} from './types';

export const TIERS: readonly Tier[] = ['express', 'local'];
export const DOMAINS: readonly Domain[] = ['web', 'ai', 'systems', 'hardware', 'tools'];
export const ROLES: readonly Role[] = ['solo', 'lead', 'contributor'];
export const STOP_KINDS: readonly StopKind[] = ['project', 'experience', 'about', 'terminus'];
export const LINE_IDS: readonly LineId[] = ['express', 'all', 'map'];
export const BUDGETS: readonly Budget[] = ['short', 'medium', 'long'];

/** The token that marks a field the author has not written yet. */
export const PLACEHOLDER = 'TBD';

export interface ValidationResult<T> {
  ok: boolean;
  errors: string[];
  /** Fields that still hold the `TBD` placeholder. Only populated by `validateStrict`. */
  placeholders: string[];
  value?: T;
}

const EMPTY = '';
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === EMPTY;
}

function isPlaceholder(value: string): boolean {
  return value.trim().toUpperCase() === PLACEHOLDER;
}

/**
 * Media may be an absolute URL or a path relative to the document.
 * Relative paths are what let the site run from a domain root, from a
 * subpath and from a plain local file server without a second copy of itself.
 */
function isSafeSrc(src: string): boolean {
  if (/^https?:\/\//.test(src)) return true;
  if (src.startsWith('//')) return false;
  if (src.includes('..')) return false;
  return /^[./\w]/.test(src);
}

function collectPlaceholders(value: unknown, path: string, out: string[]): void {
  if (typeof value === 'string') {
    if (isPlaceholder(value)) out.push(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectPlaceholders(item, `${path}[${i}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectPlaceholders(child, path ? `${path}.${key}` : key, out);
    }
  }
}

function checkString(
  value: unknown,
  path: string,
  errors: string[],
  { required = true, pattern }: { required?: boolean; pattern?: RegExp } = {},
): void {
  if (isBlank(value)) {
    if (required) errors.push(`${path} is required`);
    return;
  }
  if (pattern && !pattern.test(String(value))) {
    errors.push(`${path} must match ${pattern.source}`);
  }
}

function checkOneOf<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  errors: string[],
): void {
  if (isBlank(value)) {
    errors.push(`${path} is required`);
    return;
  }
  if (!allowed.includes(value as T)) {
    errors.push(`${path} must be one of ${allowed.join(', ')} (got "${String(value)}")`);
  }
}

export function validateMediaItem(raw: unknown, path: string, errors: string[]): MediaItem | undefined {
  if (!raw || typeof raw !== 'object') {
    errors.push(`${path} must be an object`);
    return undefined;
  }
  const item = raw as Record<string, unknown>;
  checkString(item.src, `${path}.src`, errors);
  checkString(item.alt, `${path}.alt`, errors);
  if (!isBlank(item.src) && !isSafeSrc(String(item.src))) {
    errors.push(`${path}.src must be an http(s) URL or a relative path (got "${String(item.src)}")`);
  }
  const kind = item.kind ?? 'image';
  if (!['image', 'video', 'diagram'].includes(String(kind))) {
    errors.push(`${path}.kind must be one of image, video, diagram`);
  }
  for (const key of ['width', 'height'] as const) {
    if (item[key] === undefined) continue;
    const size = Number(item[key]);
    if (!Number.isInteger(size) || size <= 0) {
      errors.push(`${path}.${key} must be a positive integer`);
    }
  }
  return {
    src: String(item.src ?? EMPTY),
    alt: String(item.alt ?? EMPTY),
    kind: kind as MediaItem['kind'],
    ...(isBlank(item.caption) ? {} : { caption: String(item.caption) }),
    ...(item.width === undefined ? {} : { width: Number(item.width) }),
    ...(item.height === undefined ? {} : { height: Number(item.height) }),
  };
}

export function validateStop(raw: unknown, path = 'stop'): ValidationResult<Stop> {
  const errors: string[] = [];
  const placeholders: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [`${path} must be an object`], placeholders };
  }
  const s = raw as Record<string, unknown>;

  checkString(s.id, `${path}.id`, errors, { pattern: /^[a-z0-9-]+$/ });
  checkString(s.title, `${path}.title`, errors);
  checkString(s.oneLiner, `${path}.oneLiner`, errors);
  checkString(s.claim, `${path}.claim`, errors);
  checkString(s.station, `${path}.station`, errors);
  checkString(s.prop, `${path}.prop`, errors);
  checkString(s.badge, `${path}.badge`, errors);
  checkOneOf(s.tier, `${path}.tier`, TIERS, errors);
  checkOneOf(s.domain, `${path}.domain`, DOMAINS, errors);
  checkOneOf(s.role, `${path}.role`, ROLES, errors);
  checkOneOf(s.kind ?? 'project', `${path}.kind`, STOP_KINDS, errors);

  // A project or a role has a stack. The About card and the terminus do not
  // - there is nothing to list, and an empty array is the honest answer.
  const kind = (s.kind ?? 'project') as StopKind;
  if (!Array.isArray(s.stack)) {
    errors.push(`${path}.stack must be an array`);
  } else if (kind === 'project' || kind === 'experience') {
    if (s.stack.length === 0) {
      errors.push(`${path}.stack must be a non-empty array`);
    } else if (s.stack.some((entry) => isBlank(entry))) {
      errors.push(`${path}.stack entries must not be blank`);
    }
  }

  const proof = (s.proof ?? {}) as Record<string, unknown>;
  if (!Array.isArray(proof.metrics)) errors.push(`${path}.proof.metrics must be an array`);
  if (!Array.isArray(proof.media)) {
    errors.push(`${path}.proof.media must be an array`);
  } else {
    proof.media.forEach((entry, i) => validateMediaItem(entry, `${path}.proof.media[${i}]`, errors));
  }
  if (proof.architecture === undefined) {
    errors.push(`${path}.proof.architecture is required`);
  }

  const links = (s.links ?? {}) as Record<string, unknown>;
  for (const key of ['repo', 'demo', 'caseStudy'] as const) {
    if (links[key] === undefined) errors.push(`${path}.links.${key} is required`);
  }
  // A link without a scheme would resolve against the site itself, so every
  // link that carries a value has to be an absolute http(s) URL.
  if (!isBlank(links.repo) && !/^https?:\/\/\S+$/.test(String(links.repo))) {
    errors.push(`${path}.links.repo must be an absolute http(s) URL`);
  }
  for (const key of ['demo', 'caseStudy'] as const) {
    if (!isBlank(links[key]) && !/^https?:\/\/\S+$/.test(String(links[key]))) {
      errors.push(`${path}.links.${key} must be an absolute http(s) URL`);
    }
  }

  const period = (s.period ?? {}) as Record<string, unknown>;
  checkString(period.start, `${path}.period.start`, errors, { pattern: MONTH });
  if (!isBlank(period.end) && period.end !== 'present' && !MONTH.test(String(period.end))) {
    errors.push(`${path}.period.end must be YYYY-MM or "present"`);
  }

  const placeholdersEnabled = raw !== undefined;
  if (placeholdersEnabled) collectPlaceholders(raw, path, placeholders);

  if (errors.length > 0) return { ok: false, errors, placeholders };

  return {
    ok: true,
    errors,
    placeholders,
    value: {
      id: String(s.id),
      kind: (s.kind ?? 'project') as StopKind,
      title: String(s.title),
      oneLiner: String(s.oneLiner),
      tier: s.tier as Tier,
      domain: s.domain as Domain,
      role: s.role as Role,
      stack: (s.stack as string[]).map(String),
      claim: String(s.claim),
      proof: {
        metrics: ((proof.metrics as unknown[]) ?? []).map(String),
        media: ((proof.media as unknown[]) ?? []).map((entry, i) =>
          validateMediaItem(entry, `${path}.proof.media[${i}]`, []),
        ) as MediaItem[],
        architecture: String(proof.architecture ?? EMPTY),
      },
      links: {
        repo: String(links.repo ?? EMPTY),
        demo: String(links.demo ?? EMPTY),
        caseStudy: String(links.caseStudy ?? EMPTY),
      },
      period: {
        start: String(period.start),
        end: String(period.end ?? EMPTY),
      },
      station: String(s.station),
      prop: String(s.prop),
      badge: String(s.badge),
    },
  };
}

export function validateProfile(raw: unknown, path = 'profile'): ValidationResult<Profile> {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [`${path} must be an object`], placeholders: [] };
  }
  const p = raw as Record<string, unknown>;
  checkString(p.name, `${path}.name`, errors);
  checkString(p.handle, `${path}.handle`, errors);
  checkString(p.role, `${path}.role`, errors);
  checkString(p.location, `${path}.location`, errors);
  checkString(p.email, `${path}.email`, errors, { pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ });
  checkString(p.summary, `${path}.summary`, errors);
  // The resume is optional: the terminus renders the action only when there
  // is a PDF to point at, so an unreleased resume never becomes a dead link.
  if (p.resume !== undefined && typeof p.resume !== 'string') {
    errors.push(`${path}.resume must be a string`);
  }

  const social = (p.social ?? {}) as Record<string, unknown>;
  for (const key of ['github', 'linkedin', 'repos'] as const) {
    checkString(social[key], `${path}.social.${key}`, errors, { pattern: /^https:\/\// });
  }

  const placeholders: string[] = [];
  collectPlaceholders(raw, path, placeholders);
  if (errors.length > 0) return { ok: false, errors, placeholders };

  return {
    ok: true,
    errors,
    placeholders,
    value: {
      name: String(p.name),
      handle: String(p.handle),
      role: String(p.role),
      location: String(p.location),
      email: String(p.email),
      resume: String(p.resume ?? EMPTY),
      summary: String(p.summary),
      social: {
        github: String(social.github),
        linkedin: String(social.linkedin),
        repos: String(social.repos),
      },
    },
  };
}

export function validatePacingConfig(raw: unknown, path = 'route.pacing'): ValidationResult<PacingConfig> {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [`${path} must be an object`], placeholders: [] };
  }
  const p = raw as Record<string, unknown>;
  const dwell = (p.dwell ?? {}) as Record<string, unknown>;
  for (const key of ['express', 'local'] as const) {
    const n = Number(dwell[key]);
    if (!Number.isFinite(n) || n < 0) errors.push(`${path}.dwell.${key} must be a non-negative number`);
  }
  const travel = Number(p.travel);
  if (!Number.isFinite(travel) || travel <= 0) errors.push(`${path}.travel must be a positive number`);
  if (p.expressZeroesLocalDwell !== undefined && typeof p.expressZeroesLocalDwell !== 'boolean') {
    errors.push(`${path}.expressZeroesLocalDwell must be a boolean`);
  }

  const placeholders: string[] = [];
  collectPlaceholders(raw, path, placeholders);
  if (errors.length > 0) return { ok: false, errors, placeholders };
  return {
    ok: true,
    errors,
    placeholders,
    value: {
      dwell: { express: Number(dwell.express), local: Number(dwell.local) },
      travel,
      expressZeroesLocalDwell: p.expressZeroesLocalDwell !== false,
    },
  };
}

export function validateRouteConfig(raw: unknown, path = 'route'): ValidationResult<RouteConfig> {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [`${path} must be an object`], placeholders: [] };
  }
  const r = raw as Record<string, unknown>;

  const lines = Array.isArray(r.lines) ? (r.lines as LineConfig[]) : [];
  if (lines.length === 0) {
    errors.push(`${path}.lines must list at least one line`);
  }
  for (const line of lines) {
    checkString(line?.id, `${path}.lines[].id`, errors);
    checkOneOf(line?.id, `${path}.lines[].id`, LINE_IDS, errors);
    checkString(line?.label, `${path}.lines[].label`, errors);
    checkString(line?.blurb, `${path}.lines[].blurb`, errors);
    checkOneOf(line?.intent, `${path}.lines[].intent`, ['skim', 'verify', 'explore'] as const, errors);
    checkOneOf(line?.budget, `${path}.lines[].budget`, BUDGETS, errors);
  }
  const ids = lines.map((line) => line?.id);
  if (new Set(ids).size !== ids.length) errors.push(`${path}.lines ids must be unique`);
  checkOneOf(r.defaultLine, `${path}.defaultLine`, LINE_IDS, errors);

  if (!Array.isArray(r.order) || r.order.length === 0) {
    errors.push(`${path}.order must list at least one stop id`);
  } else if (r.order.some((id) => isBlank(id))) {
    errors.push(`${path}.order entries must not be blank`);
  }

  const pacing = validatePacingConfig(r.pacing, `${path}.pacing`);
  errors.push(...pacing.errors);

  const placeholders: string[] = [];
  collectPlaceholders(raw, path, placeholders);
  if (errors.length > 0) return { ok: false, errors, placeholders };
  return {
    ok: true,
    errors,
    placeholders,
    value: {
      defaultLine: r.defaultLine as LineId,
      lines,
      order: (r.order as string[]).map(String),
      pacing: pacing.value as PacingConfig,
    },
  };
}

/**
 * The always-on check. Fails on missing or malformed required fields.
 * `TBD` placeholders are reported but tolerated.
 */
export function validateStopContent(raw: unknown): ValidationResult<Stop> {
  return validateStop(raw);
}

/**
 * Take the value out of a validation result, or throw with every reason.
 * The build script and the loader both use this, so a failure reads the same
 * in the terminal and in the browser.
 */
export function unwrap<T>(result: ValidationResult<T>, what: string): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(
      `Invalid ${what}:\n${result.errors.map((line) => `  - ${line}`).join('\n')}`,
    );
  }
  return result.value;
}

/**
 * The launch gate. Everything a visitor can read must be written.
 * A single remaining `TBD` fails the build.
 */
export function validateStrict(raw: unknown, path = 'stop'): ValidationResult<Stop> {
  const result = validateStop(raw, path);
  if (!result.ok) return result;
  if (result.placeholders.length > 0) {
    return {
      ok: false,
      errors: result.placeholders.map((field) => `${field} is still a placeholder`),
      placeholders: result.placeholders,
      value: result.value,
    };
  }
  return result;
}
