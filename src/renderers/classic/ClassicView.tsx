/**
 * The classic view.
 *
 * The flat, static, SEO-friendly rendering of the same dataset: the tier 3
 * and tier 4 fallback in the blueprint, and the accessibility surface for
 * everyone who does not want to ride the scene.
 *
 * Three rules hold this file together.
 *
 *   1. Content parity. Every field of every stop is rendered here, because a
 *      visitor reading the HTML has to find exactly what a visitor riding the
 *      scene finds. Nothing is summarised away.
 *   2. Zero JavaScript. No state, no handlers, no effects. Every action on
 *      the page is a link, and the links are real: `#slot-03` navigates with
 *      the browser, natively, with the script turned off.
 *   3. Nothing is hard-coded. Every title, station, stack, metric, number and
 *      link is read from the content the loader already validated.
 *
 * `renderClassicHtml` runs in Node with no DOM: no `window`, no `document`,
 * no `localStorage`, no `navigator`.
 */

import type { JSX } from 'react';

import type { MediaItem, Period, Profile, SiteContent, Stop, StopKind } from '../../core/types';

export interface ClassicViewProps {
  content: SiteContent;
}

/* ------------------------------------------------------------------ *
 * Vocabulary
 *
 * The content model speaks in lowercase enums. These tables turn those enums
 * into words a visitor can read. None of it is content: it is the language of
 * the interface, and it covers every value the enums allow.
 * ------------------------------------------------------------------ */

const DOMAIN_LABELS: Record<Stop['domain'], string> = {
  web: 'Web',
  ai: 'AI',
  systems: 'Systems',
  hardware: 'Hardware',
  tools: 'Tools',
};

const KIND_LABELS: Record<StopKind, string> = {
  project: 'Project',
  experience: 'Experience',
  about: 'About',
  terminus: 'Terminus',
};

/** The name of the group a kind of stop forms when the stops of a kind sit together. */
const GROUP_LABELS: Record<StopKind, string> = {
  project: 'Projects',
  experience: 'Experience',
  about: 'About',
  terminus: 'Terminus',
};

const LINK_LABELS: Record<keyof Stop['links'], string> = {
  repo: 'Repository',
  demo: 'Live demo',
  caseStudy: 'Case study',
};

/** `YYYY-MM`, the shape the schema allows for a month. */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Only an absolute http(s) URL needs `rel="noopener noreferrer"`. */
function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** `express` reads better as `Express`. */
function titleCase(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

/**
 * The stops in line order.
 *
 * `route.order` is the physical order of the stations, so it decides the
 * page. A stop that the order somehow misses is still rendered: nothing on
 * this page is ever dropped.
 */
function lineOrder(content: SiteContent): Stop[] {
  const byId = new Map(content.stops.map((stop) => [stop.id, stop]));
  const ordered: Stop[] = [];

  for (const id of content.route.order) {
    const stop = byId.get(id);
    if (stop) ordered.push(stop);
  }
  for (const stop of content.stops) {
    if (!ordered.includes(stop)) ordered.push(stop);
  }
  return ordered;
}

interface Group {
  kind: StopKind;
  stops: Stop[];
}

/**
 * Consecutive stops of the same kind become one group.
 *
 * The nine project stops sit in a group of their own, and the fixed
 * stations - the role, the about card and the terminus - sit after them in
 * line order. Grouping never reorders anything.
 */
function groupStops(stops: Stop[]): Group[] {
  const groups: Group[] = [];
  for (const stop of stops) {
    const last = groups[groups.length - 1];
    if (last && last.kind === stop.kind) {
      last.stops.push(stop);
    } else {
      groups.push({ kind: stop.kind, stops: [stop] });
    }
  }
  return groups;
}

/* ------------------------------------------------------------------ *
 * The pieces
 * ------------------------------------------------------------------ */

/** A period, with the months marked up as real dates. */
function PeriodRange({ period }: { period: Period }): JSX.Element {
  // `dateTime` is React's name for the `datetime` attribute. The HTML parser
  // lowercases attribute names, so the document ends up with `datetime`.
  const start = <time dateTime={period.start}>{period.start}</time>;
  const end = MONTH.test(period.end) ? <time dateTime={period.end}>{period.end}</time> : period.end;

  return (
    <span className="classic-period">
      {start}
      {period.end ? <span className="classic-period__sep"> – </span> : null}
      {period.end ? end : null}
    </span>
  );
}

/**
 * One piece of proof media: a figure with its image and, when it has one, its
 * caption.
 *
 * The intrinsic pixel size comes from the content, not from this file: every
 * media item may carry its own `width` and `height`. An item without them is
 * rendered without a width and a height rather than with a guess - a wrong
 * number would lie to the browser about the shape of the file.
 */
function MediaFigure({ item }: { item: MediaItem }): JSX.Element {
  const size = item.width && item.height ? { width: item.width, height: item.height } : undefined;

  return (
    <figure className="classic-figure">
      {item.kind === 'video' ? (
        <video className="classic-figure__media" src={item.src} controls preload="metadata" aria-label={item.alt} />
      ) : (
        <img
          className="classic-figure__media"
          src={item.src}
          alt={item.alt}
          loading="lazy"
          decoding="async"
          {...(size ? { width: size.width, height: size.height } : {})}
        />
      )}
      {item.caption ? <figcaption className="classic-figure__caption">{item.caption}</figcaption> : null}
    </figure>
  );
}

/** One station on the line, with everything the stop carries. */
function ClassicStop({ stop, profile }: { stop: Stop; profile: Profile }): JSX.Element {
  const links = (Object.keys(LINK_LABELS) as (keyof Stop['links'])[])
    .filter((key) => stop.links[key].length > 0)
    .map((key) => ({ key, href: stop.links[key], label: LINK_LABELS[key] }));

  const hasProof = stop.proof.metrics.length > 0 || stop.proof.media.length > 0;

  return (
    <article
      id={stop.id}
      className={`classic-stop classic-stop--${stop.kind}`}
      aria-labelledby={`${stop.id}-title`}
    >
      <div className="classic-stop__head">
        <h2 className="classic-stop__title" id={`${stop.id}-title`}>
          {stop.title}
        </h2>

        <p className="classic-stop__meta">
          <span className="classic-chip">{KIND_LABELS[stop.kind]}</span>
          <span className="classic-stop__station">{stop.station}</span>
          <span className={`classic-tier classic-tier--${stop.tier}`}>{titleCase(stop.tier)}</span>
          <span className="classic-stop__code">{stop.badge}</span>
        </p>

        <p className="classic-stop__oneliner">{stop.oneLiner}</p>
      </div>

      <div className="classic-stop__body">
        <p className="classic-stop__claim">
          <strong>{stop.claim}</strong>
        </p>

        <dl className="classic-facts">
          <dt>Station</dt>
          <dd>{stop.station}</dd>

          <dt>Tier</dt>
          <dd>{titleCase(stop.tier)}</dd>

          <dt>Domain</dt>
          <dd>{DOMAIN_LABELS[stop.domain]}</dd>

          <dt>Role</dt>
          <dd>{titleCase(stop.role)}</dd>

          <dt>Period</dt>
          <dd>
            <PeriodRange period={stop.period} />
          </dd>

          <dt>Stack</dt>
          <dd>
            <ul className="classic-stack">
              {stop.stack.length > 0 ? (
                stop.stack.map((entry) => <li key={entry}>{entry}</li>)
              ) : (
                // The fixed stations carry no stack. Say so rather than
                // leaving a blank row.
                <li className="classic-stack__none">—</li>
              )}
            </ul>
          </dd>

          <dt>Prop</dt>
          <dd>{stop.prop}</dd>
        </dl>

        {hasProof ? (
          <section className="classic-proof">
            <h3 className="classic-subhead">Proof</h3>

            {stop.proof.metrics.length > 0 ? (
              <ul className="classic-metrics">
                {stop.proof.metrics.map((metric, index) => (
                  <li key={`${stop.id}-metric-${index}`}>{metric}</li>
                ))}
              </ul>
            ) : null}

            {stop.proof.media.length > 0 ? (
              <div className="classic-figures">
                {stop.proof.media.map((item, index) => (
                  <MediaFigure key={`${stop.id}-media-${index}`} item={item} />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {stop.proof.architecture ? (
          <section className="classic-architecture">
            <h3 className="classic-subhead">Architecture</h3>
            <p className="classic-prose">{stop.proof.architecture}</p>
          </section>
        ) : null}

        {links.length > 0 ? (
          <ul className="classic-links">
            {links.map((link) => (
              <li key={link.key}>
                <a
                  className={link.key === 'demo' ? 'classic-action' : undefined}
                  href={link.href}
                  {...(isExternal(link.href) ? { rel: 'noopener noreferrer' } : {})}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {stop.kind === 'terminus' ? (
          <section className="classic-contact">
            <h3 className="classic-subhead">Get in touch</h3>
            <p className="classic-contact__email">
              <a className="classic-action" href={`mailto:${profile.email}`}>
                {profile.email}
              </a>
            </p>
            <ul className="classic-contact__links">
              <li>
                <a href={profile.social.github} rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
              <li>
                <a href={profile.social.linkedin} rel="noopener noreferrer">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href={profile.social.repos} rel="noopener noreferrer">
                  Repositories
                </a>
              </li>
              {profile.resume ? (
                <li>
                  <a href={profile.resume} download>
                    Résumé
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 * The view
 * ------------------------------------------------------------------ */

/**
 * The classic view.
 *
 * A header, a hidden index of every stop, one article per station in line
 * order, and a footer. No script, no state, no hooks.
 */
export function ClassicView(props: ClassicViewProps): JSX.Element {
  const { content } = props;
  const { profile } = content;
  const stops = lineOrder(content);
  const groups = groupStops(stops);

  return (
    <div className="classic">
      <header className="classic-header" id="top">
        <div className="classic-header__id">
          <h1 className="classic-header__name">{profile.name}</h1>
          <p className="classic-header__handle">{profile.handle}</p>
        </div>

        <div className="classic-header__body">
          <p className="classic-header__role">{profile.role}</p>
          <p className="classic-header__summary">{profile.summary}</p>

          <ul className="classic-header__meta">
            <li className="classic-header__location">{profile.location}</li>
            <li>
              <a className="classic-action" href={`mailto:${profile.email}`}>
                {profile.email}
              </a>
            </li>
          </ul>

          <ul className="classic-header__social">
            <li>
              <a href={profile.social.github} rel="noopener noreferrer">
                GitHub
              </a>
            </li>
            <li>
              <a href={profile.social.linkedin} rel="noopener noreferrer">
                LinkedIn
              </a>
            </li>
            <li>
              <a href={profile.social.repos} rel="noopener noreferrer">
                Repositories
              </a>
            </li>
          </ul>
        </div>
      </header>

      {/*
        The index of the line. It is visually hidden, but it is a real list of
        real links: this is what a screen reader reads out and what a search
        engine crawls. It is never `aria-hidden`.
      */}
      <nav className="classic-nav" aria-label="Stations">
        <ul className="classic-nav__list classic-sr-only">
          {stops.map((stop) => (
            <li key={stop.id}>
              <a href={`#${stop.id}`}>
                {stop.title} — {stop.station}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="classic-main">
        {groups.map((group, index) => {
          const labelId = `classic-group-${group.kind}-${index}`;
          return (
            <section
              key={`${group.kind}-${index}`}
              className={`classic-group classic-group--${group.kind}`}
              aria-labelledby={labelId}
            >
              <p className="classic-group__label" id={labelId}>
                {GROUP_LABELS[group.kind]}
              </p>

              {group.stops.map((stop) => (
                <ClassicStop key={stop.id} stop={stop} profile={profile} />
              ))}
            </section>
          );
        })}
      </main>

      <footer className="classic-footer">
        <a className="classic-footer__top" href="#top">
          Back to the top
        </a>
        <a className="classic-footer__github" href={profile.social.github} rel="noopener noreferrer">
          GitHub — {profile.handle}
        </a>
      </footer>
    </div>
  );
}
