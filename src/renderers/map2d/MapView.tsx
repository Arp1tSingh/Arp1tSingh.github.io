/**
 * The network map.
 *
 * The blueprint's second rendering of the same dataset: "skills drawn as
 * transfer lines on the map; picking a skill filters stops. Lets an engineer
 * navigate by technology, not by order."
 *
 * Five rules hold this file together.
 *
 *   1. The line is the route. `route.order` is the physical order of the
 *      stations, so the stations sit along the spine in that order and
 *      nowhere else. A stop the order misses is still drawn, at the end,
 *      because nothing on the map is ever dropped.
 *   2. The skills are transfer lines. One hairline per skill, connecting the
 *      stations that carry it. They stay faint so the network reads as a
 *      background; picking a skill lifts exactly one of them into the accent
 *      and dims the stations that do not carry it.
 *   3. The labels are HTML, not SVG text. The drawing scales with the
 *      viewport, the type does not. That is what keeps the map legible at
 *      360px and at 1920px without a second layout, and it is why the labels
 *      are positioned over the SVG rather than inside it.
 *   4. Express is solid and larger, local is hollow and smaller. The
 *      distinction is shape, not colour, so it survives greyscale.
 *   5. Nothing is hard-coded. Every title, station, stack, count, period and
 *      link is read from the content.
 *
 * The component reads no globals and touches no DOM, so it renders the same
 * way on the server and in the browser.
 */

import type { JSX, KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { SiteContent, Stop } from '../../core/types';

/* ------------------------------------------------------------------ *
 * The geometry of the drawing
 *
 * These are drawing constants, not content: they decide where the spine
 * runs and how far a transfer line may bow away from it. Nothing here
 * names a station, a skill or a number that comes from the content.
 * ------------------------------------------------------------------ */

/** Width of the drawing in viewBox units. */
const VIEW_W = 560;
/** Where the spine runs, measured from the left edge of the viewBox. */
const SPINE_X = 68;
/** The furthest a transfer line may bow away from the spine. */
const MAX_BULGE = 96;
/** The gap between the widest transfer line and the column of labels. */
const LABEL_GUTTER = 18;
/** Where the column of labels starts, in viewBox units. */
const LABEL_X = SPINE_X + MAX_BULGE + LABEL_GUTTER;
/** Vertical distance between two stations, in viewBox units. */
const STEP_Y = 124;
/** Space above the first station and below the last one. */
const MARGIN_Y = 52;
/**
 * Above this many stops a skill is drawn as one continuous line instead of a
 * row of hops, so a widely used skill stays quiet.
 */
const SMOOTH_THRESHOLD = 6;
/** How far the rail of a widely used skill runs beside the spine. */
const RAIL_OFFSET = 15;

interface Point {
  x: number;
  y: number;
}

/** Two decimals is plenty for a drawing and keeps the markup small. */
function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** `express` reads better as `Express`. */
function titleCase(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

/**
 * Where each station sits on the spine.
 *
 * The spine is a vertical line and the stations are evenly spaced along it:
 * the order is the data's, the spacing is the drawing's.
 */
function spine(count: number): Point[] {
  const points: Point[] = [];
  for (let index = 0; index < count; index += 1) {
    points.push({ x: SPINE_X, y: MARGIN_Y + index * STEP_Y });
  }
  return points;
}

/** The height of the drawing, in viewBox units. */
function drawingHeight(count: number): number {
  return MARGIN_Y * 2 + Math.max(0, count - 1) * STEP_Y;
}

/**
 * The transfer line of one skill.
 *
 * A skill that reaches one station gets a short tick across the spine: that
 * station is still served by a transfer line.
 *
 * A skill that reaches two or a few stations is a chain of arcs, one hop
 * between each pair of the stations it serves. The chain is a single
 * continuous path, so the skill reads as one line and not as a row of
 * separate segments.
 *
 * A skill that reaches more than `SMOOTH_THRESHOLD` stations would be a comb
 * of hops across the whole drawing, so it is drawn as one quiet line instead:
 * a rail that runs beside the spine with a stub into every station it
 * serves. The lane keeps two widely used skills from landing on the same
 * rail.
 */
function transferPath(indexes: number[], points: Point[], lane: number): string {
  if (indexes.length === 0) return '';
  if (indexes.length === 1) {
    const only = points[indexes[0]];
    return `M ${fmt(only.x)} ${fmt(only.y - 11)} L ${fmt(only.x)} ${fmt(only.y + 11)}`;
  }

  const first = points[indexes[0]];
  const last = points[indexes[indexes.length - 1]];

  if (indexes.length > SMOOTH_THRESHOLD) {
    const rail = SPINE_X + RAIL_OFFSET + (lane % 4) * 8;
    const entry = 14;
    let path = `M ${fmt(first.x)} ${fmt(first.y)} Q ${fmt(rail)} ${fmt(first.y)} ${fmt(rail)} ${fmt(first.y + entry)}`;
    path += ` L ${fmt(rail)} ${fmt(last.y - entry)}`;
    path += ` Q ${fmt(rail)} ${fmt(last.y)} ${fmt(last.x)} ${fmt(last.y)}`;
    for (let i = 1; i < indexes.length - 1; i += 1) {
      const at = points[indexes[i]];
      path += ` M ${fmt(rail)} ${fmt(at.y)} L ${fmt(at.x)} ${fmt(at.y)}`;
    }
    return path;
  }

  let path = `M ${fmt(first.x)} ${fmt(first.y)}`;
  for (let i = 1; i < indexes.length; i += 1) {
    const from = points[indexes[i - 1]];
    const to = points[indexes[i]];
    const gap = indexes[i] - indexes[i - 1];
    const bulge = Math.min(MAX_BULGE, 18 + 7 * gap);
    path += ` Q ${fmt(from.x + bulge * 2)} ${fmt((from.y + to.y) / 2)} ${fmt(to.x)} ${fmt(to.y)}`;
  }
  return path;
}

/* ------------------------------------------------------------------ *
 * The content, read
 * ------------------------------------------------------------------ */

interface Skill {
  name: string;
  /** How many stops of the network carry this skill. */
  count: number;
  /** The indexes of those stops, in line order. */
  indexes: number[];
}

/**
 * The whole network, in line order.
 *
 * `route.order` decides where a station sits. The `stops` prop is the whole
 * network, so a stop that is not on the current line is still on the map.
 */
function networkOf(content: SiteContent, stops: Stop[]): Stop[] {
  const byId = new Map<string, Stop>();
  for (const stop of stops) byId.set(stop.id, stop);
  for (const stop of content.stops) if (!byId.has(stop.id)) byId.set(stop.id, stop);

  const ordered: Stop[] = [];
  const placed = new Set<string>();
  for (const id of content.route.order) {
    const stop = byId.get(id);
    if (stop && !placed.has(id)) {
      ordered.push(stop);
      placed.add(id);
    }
  }
  for (const stop of byId.values()) if (!placed.has(stop.id)) ordered.push(stop);
  return ordered;
}

/**
 * Every skill on the network, with the number of stops that carry it.
 *
 * The count is what makes the panel a map of the technology rather than a
 * list of words: a skill on one stop is a detail, a skill on five is a
 * through-line.
 */
function skillsOf(stops: Stop[]): Skill[] {
  const counts = new Map<string, { count: number; indexes: number[] }>();

  stops.forEach((stop, index) => {
    const seen = new Set<string>();
    for (const skill of stop.stack) {
      if (seen.has(skill)) continue;
      seen.add(skill);
      const entry = counts.get(skill);
      if (entry) {
        entry.count += 1;
        entry.indexes.push(index);
      } else {
        counts.set(skill, { count: 1, indexes: [index] });
      }
    }
  });

  return [...counts.entries()]
    .map(([name, entry]) => ({ name, count: entry.count, indexes: entry.indexes }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ *
 * The pieces
 * ------------------------------------------------------------------ */

/** The legend: what the marks on the map mean. */
function Legend(): JSX.Element {
  return (
    <div className="map2d__legend">
      <h3 className="map2d__legend-title">Legend</h3>
      <ul className="map2d__legend-list">
        <li className="map2d__legend-item">
          <svg className="map2d__legend-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <circle cx="10" cy="10" r="6" fill="var(--paper)" />
          </svg>
          <span>
            <strong>Express stop</strong> - solid and larger
          </span>
        </li>
        <li className="map2d__legend-item">
          <svg className="map2d__legend-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <circle cx="10" cy="10" r="3.5" fill="none" stroke="var(--paper)" strokeWidth="1.5" />
          </svg>
          <span>
            <strong>Local stop</strong> - hollow and smaller
          </span>
        </li>
        <li className="map2d__legend-item">
          <svg className="map2d__legend-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <path d="M 4 4 Q 18 10 4 16" fill="none" stroke="var(--grey-dim)" strokeWidth="1" />
          </svg>
          <span>
            <strong>Transfer line</strong> - one per skill, connecting the stops that use it
          </span>
        </li>
        <li className="map2d__legend-item">
          <svg className="map2d__legend-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <circle cx="10" cy="10" r="6" fill="var(--paper)" />
            <circle cx="10" cy="10" r="9" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
          </svg>
          <span>
            <strong>You are here</strong> - the stop you are standing at
          </span>
        </li>
      </ul>
    </div>
  );
}

/** The panel of skills: the filter that turns the map into a technology map. */
function SkillPanel({
  skills,
  activeSkill,
  onFilter,
}: {
  skills: Skill[];
  activeSkill: string | null;
  onFilter: (skill: string | null) => void;
}): JSX.Element {
  return (
    <section className="map2d__panel map2d__skills" aria-labelledby="map2d-skills-title">
      <div className="map2d__panel-head">
        <h3 className="map2d__panel-title" id="map2d-skills-title">
          Skills
        </h3>
        <span className="map2d__panel-count mono">{skills.length}</span>
      </div>

      <p className="map2d__panel-note">
        {activeSkill
          ? `Filtered by ${activeSkill}. Pick it again to clear the filter.`
          : 'Pick a skill to filter the map by technology rather than by order.'}
      </p>

      <ul className="map2d__skill-list">
        {skills.map((skill) => {
          const active = skill.name === activeSkill;
          return (
            <li key={skill.name}>
              <button
                type="button"
                className="map2d__skill"
                aria-pressed={active}
                aria-label={`${skill.name}, ${skill.count} ${skill.count === 1 ? 'stop' : 'stops'}`}
                onClick={() => onFilter(active ? null : skill.name)}
              >
                <span className="map2d__skill-name">{skill.name}</span>
                <span className="map2d__skill-count mono">{skill.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The card of the stop the visitor is standing at. */
function DetailPanel({
  stop,
  activeSkill,
  onFilter,
}: {
  stop: Stop | undefined;
  activeSkill: string | null;
  onFilter: (skill: string | null) => void;
}): JSX.Element {
  const linkKeys = ['repo', 'demo', 'caseStudy'] as const;
  const linkLabels: Record<(typeof linkKeys)[number], string> = {
    repo: 'Repository',
    demo: 'Live demo',
    caseStudy: 'Case study',
  };
  const links = stop
    ? linkKeys.filter((key) => stop.links[key].length > 0).map((key) => ({ key, href: stop.links[key] }))
    : [];

  return (
    <section className="map2d__panel map2d__detail" aria-labelledby="map2d-detail-title">
      <div className="map2d__panel-head">
        <h3 className="map2d__panel-title" id="map2d-detail-title">
          Station card
        </h3>
        {stop ? <span className="map2d__here-chip">you are here</span> : null}
      </div>

      {stop ? (
        <>
          <h4 className="map2d__detail-title">{stop.title}</h4>
          <p className="map2d__detail-station mono">
            {stop.station} / {stop.badge}
          </p>

          <p className="map2d__detail-oneliner">{stop.oneLiner}</p>
          <p className="map2d__detail-claim">{stop.claim}</p>

          <dl className="map2d__facts">
            <dt>Tier</dt>
            <dd>{titleCase(stop.tier)}</dd>

            <dt>Domain</dt>
            <dd>{titleCase(stop.domain)}</dd>

            <dt>Role</dt>
            <dd>{titleCase(stop.role)}</dd>

            <dt>Period</dt>
            <dd>
              <time dateTime={stop.period.start}>{stop.period.start}</time>
              <span className="map2d__sep"> - </span>
              <time dateTime={stop.period.end}>{stop.period.end}</time>
            </dd>
          </dl>

          <h4 className="map2d__subhead">Stack</h4>
          {stop.stack.length > 0 ? (
            <ul className="map2d__stack">
              {stop.stack.map((entry) => (
                <li key={entry}>
                  <button
                    type="button"
                    className="map2d__stack-chip"
                    aria-pressed={entry === activeSkill}
                    onClick={() => onFilter(entry === activeSkill ? null : entry)}
                  >
                    {entry}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="map2d__empty">This station carries no stack.</p>
          )}

          {links.length > 0 ? (
            <>
              <h4 className="map2d__subhead">Links</h4>
              <ul className="map2d__links">
                {links.map((link) => (
                  <li key={link.key}>
                    <a className="map2d__link" href={link.href} target="_blank" rel="noopener noreferrer">
                      {linkLabels[link.key]}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : (
        <p className="map2d__empty">
          No station selected. Pick a station on the map to read its card.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * The view
 * ------------------------------------------------------------------ */

export interface MapViewProps {
  content: SiteContent;
  /** The whole network, not just the current route. */
  stops: Stop[];
  currentId: string | null;
  activeSkill: string | null;
  onJump: (stopId: string) => void;
  onFilter: (skill: string | null) => void;
}

export function MapView(props: MapViewProps): JSX.Element {
  const { content, stops, currentId, activeSkill, onJump, onFilter } = props;

  const network = networkOf(content, stops);
  const points = spine(network.length);
  const height = drawingHeight(network.length);
  const skills = skillsOf(network);
  const current = network.find((stop) => stop.id === currentId);
  const mapLine = content.route.lines.find((line) => line.id === 'map');

  const onKeyDown = (event: ReactKeyboardEvent<SVGGElement>, stopId: string): void => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      onJump(stopId);
    }
  };

  return (
    <section className="map2d" aria-label="Network map">
      <header className="map2d__head">
        <h2 className="map2d__title">{mapLine ? mapLine.label : 'Network map'}</h2>
        <p className="map2d__blurb">{mapLine ? mapLine.blurb : ''}</p>
        <p className="map2d__count mono">
          {network.length} stations / {skills.length} skills
        </p>
      </header>

      <div className="map2d__body">
        <div className="map2d__column">
          <div className="map2d__plot">
            <svg
              className="map2d__svg"
              viewBox={`0 0 ${VIEW_W} ${height}`}
              width="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{ aspectRatio: `${VIEW_W} / ${height}` }}
              role="group"
              aria-label="The line, with a transfer line for every skill"
            >
              <title>The line, with a transfer line for every skill</title>

              <g className="map2d__transfers" aria-hidden="true">
                {skills.map((skill, lane) => {
                  if (skill.name === activeSkill) return null;
                  return (
                    <path
                      key={skill.name}
                      className="map2d__chord"
                      d={transferPath(skill.indexes, points, lane)}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>

              <path
                className="map2d__spine"
                d={`M ${fmt(SPINE_X)} ${fmt(MARGIN_Y - 30)} L ${fmt(SPINE_X)} ${fmt(height - MARGIN_Y + 30)}`}
                vectorEffect="non-scaling-stroke"
              />

              {activeSkill ? (
                <g className="map2d__transfers map2d__transfers--active" aria-hidden="true">
                  {skills
                    .map((skill, lane) => ({ skill, lane }))
                    .filter((entry) => entry.skill.name === activeSkill)
                    .map((entry) => (
                      <path
                        key={entry.skill.name}
                        className="map2d__chord map2d__chord--active"
                        d={transferPath(entry.skill.indexes, points, entry.lane)}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                </g>
              ) : null}

              <g className="map2d__stations">
                {network.map((stop, index) => {
                  const at = points[index];
                  const isCurrent = stop.id === currentId;
                  const carries = activeSkill !== null && stop.stack.includes(activeSkill);
                  const dimmed = activeSkill !== null && !carries;
                  const radius = stop.tier === 'express' ? 12 : 6.5;

                  return (
                    <g
                      key={stop.id}
                      className={[
                        'map2d__station',
                        `map2d__station--${stop.tier}`,
                        dimmed ? 'map2d__station--dim' : '',
                        isCurrent ? 'map2d__station--here' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      role="button"
                      tabIndex={0}
                      aria-label={`${stop.title}, ${stop.station} station, ${titleCase(stop.tier)} stop`}
                      data-stop={stop.id}
                      onClick={() => onJump(stop.id)}
                      onKeyDown={(event) => onKeyDown(event, stop.id)}
                    >
                      <title>{`${stop.title} - ${stop.station}`}</title>
                      <circle className="map2d__hit" cx={at.x} cy={at.y} r={20} />
                      <circle className="map2d__dot" cx={at.x} cy={at.y} r={radius} />
                      {isCurrent ? (
                        <circle
                          className="map2d__here"
                          cx={at.x}
                          cy={at.y}
                          r={radius + 7}
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                    </g>
                  );
                })}
              </g>
            </svg>

            <div className="map2d__labels" aria-hidden="true">
              {network.map((stop, index) => {
                const at = points[index];
                const dimmed = activeSkill !== null && !stop.stack.includes(activeSkill);
                return (
                  <div
                    key={stop.id}
                    className={[
                      'map2d__label',
                      dimmed ? 'map2d__label--dim' : '',
                      stop.id === currentId ? 'map2d__label--here' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      left: `${(LABEL_X / VIEW_W) * 100}%`,
                      top: `${(at.y / height) * 100}%`,
                    }}
                  >
                    <span className="map2d__label-station">{stop.station}</span>
                    <span className="map2d__label-title">{stop.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <Legend />

          {/*
            The text version of the map. It is collapsed, but it is present
            and it is complete: if the drawing fails, or if the visitor never
            sees the picture, every stop is still readable here.
          */}
          <details className="map2d__fallback">
            <summary className="map2d__fallback-summary">
              Every station as text ({network.length})
            </summary>
            <ul className="map2d__fallback-list">
              {network.map((stop) => (
                <li key={stop.id} className="map2d__fallback-item">
                  <button
                    type="button"
                    className="map2d__fallback-button"
                    onClick={() => onJump(stop.id)}
                    aria-current={stop.id === currentId ? 'true' : undefined}
                  >
                    {stop.title}
                  </button>
                  <span className="map2d__fallback-meta mono">
                    {stop.station} / {titleCase(stop.tier)} / {stop.badge}
                  </span>
                  <span className="map2d__fallback-oneliner">{stop.oneLiner}</span>
                  <span className="map2d__fallback-stack mono">
                    {stop.stack.length > 0 ? stop.stack.join(' / ') : '-'}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>

        <aside className="map2d__side">
          <SkillPanel skills={skills} activeSkill={activeSkill} onFilter={onFilter} />
          <DetailPanel stop={current} activeSkill={activeSkill} onFilter={onFilter} />
        </aside>
      </div>
    </section>
  );
}
