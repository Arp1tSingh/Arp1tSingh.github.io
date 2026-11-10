/**
 * The one vocabulary the whole project speaks.
 *
 * These types are the seam between the three layers described in the blueprint:
 * content is validated into these shapes at build time, `core/` turns a scroll
 * position into a route position using nothing but these types, and the three
 * renderers (scene3d, map2d, classic) draw them without ever copying a value.
 *
 * Nothing in this file may import the DOM, React or three.js.
 */

export type Tier = 'express' | 'local';
export type Domain = 'web' | 'ai' | 'systems' | 'hardware' | 'tools';
export type Role = 'solo' | 'lead' | 'contributor';

/**
 * What a stop *is*, as opposed to what it is about.
 * `project` stops are the nine evidence slots. The other three are the fixed
 * stations of the line: the role, the about card and the terminus.
 */
export type StopKind = 'project' | 'experience' | 'about' | 'terminus';

export type MediaKind = 'image' | 'video' | 'diagram';

export interface MediaItem {
  src: string;
  /** Describes what the media shows, not that it is a screenshot. */
  alt: string;
  kind: MediaKind;
  caption?: string;
  /**
   * The intrinsic pixel size. Optional, but when it is present the renderer
   * can reserve the space and the page does not shift as the image loads.
   */
  width?: number;
  height?: number;
}

/** The back of a ticket: everything a visitor can check. */
export interface Proof {
  metrics: string[];
  media: MediaItem[];
  architecture: string;
}

/** The next action. `repo` is the only link every project stop must carry. */
export interface Links {
  repo: string;
  demo: string;
  caseStudy: string;
}

export interface Period {
  /** `YYYY-MM` */
  start: string;
  /** `YYYY-MM`, or `present` */
  end: string;
}

export interface Stop {
  id: string;
  kind: StopKind;
  title: string;
  /** What it does, in one sentence. */
  oneLiner: string;
  tier: Tier;
  domain: Domain;
  role: Role;
  stack: string[];
  /** The result, in one sentence, with a number if there is one. */
  claim: string;
  proof: Proof;
  links: Links;
  period: Period;
  /** The Mumbai local this stop is named after. */
  station: string;
  /** The diorama prop for this stop, chosen from the project's domain. */
  prop: string;
  /** Short label for the dot-matrix board, e.g. `01 / EXPRESS`. */
  badge: string;
}

export interface SocialLinks {
  github: string;
  linkedin: string;
  repos: string;
}

export interface Profile {
  name: string;
  handle: string;
  role: string;
  location: string;
  email: string;
  social: SocialLinks;
  /** Path to the one-page resume PDF served from `public/`. */
  resume: string;
  /** The ten-second contract, in one sentence. */
  summary: string;
}

/** Visitor intent. Drives which evidence a route keeps. */
export type Intent = 'skim' | 'verify' | 'explore';

/** Time budget. The threshold falls as the budget grows. */
export type Budget = 'short' | 'medium' | 'long';

/** The three entry gates. */
export type LineId = 'express' | 'all' | 'map';

export interface LineConfig {
  id: LineId;
  label: string;
  blurb: string;
  intent: Intent;
  budget: Budget;
}

export interface PacingConfig {
  /** Scroll lengths, in viewport heights, spent dwelling at a stop. */
  dwell: { express: number; local: number };
  /** Scroll length spent travelling between two stops. */
  travel: number;
  /** In Express mode a local stop's dwell collapses to zero: the train passes through. */
  expressZeroesLocalDwell: boolean;
}

export interface RouteConfig {
  defaultLine: LineId;
  lines: LineConfig[];
  /** Stop ids in line order. This is the physical order of the stations. */
  order: string[];
  pacing: PacingConfig;
}

/** Everything a renderer needs. Assembled once, read everywhere. */
export interface SiteContent {
  profile: Profile;
  route: RouteConfig;
  /** Stops in line order. */
  stops: Stop[];
}
