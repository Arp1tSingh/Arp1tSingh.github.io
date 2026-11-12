/**
 * The gate.
 *
 * The first screen has one job: answer "who is this and how do I reach them"
 * inside ten seconds, then ask the one question the whole site is built on -
 * where to?
 *
 * Everything here is read from `profile` and `lines`. Nothing is invented.
 * The email is a real `mailto:` anchor so it works with the keyboard, with a
 * screen reader and with the right-click menu, and it is visible without any
 * interaction at all.
 *
 * The route choices sit before the location and contact facts on purpose: on
 * a phone the first scroll should reach the decision, not the small print.
 */

import { useId, useState } from 'react';
import type { LineConfig, LineId, Profile } from '../core/types';

import './ui.css';

export interface GateProps {
  lines: LineConfig[];
  profile: Profile;
  onSelect: (line: LineId) => void;
  /**
   * The line the journey is currently on. Optional: the gate also remembers
   * the line the visitor picked, so the marker is correct either way.
   */
  currentLine?: LineId;
}

export function Gate({ lines, profile, onSelect, currentLine }: GateProps) {
  const nameId = useId();
  const [picked, setPicked] = useState<LineId | null>(null);

  // The current line: the one the journey is on, or the one the visitor
  // picked, or the first line on the board - the one the route departs from
  // by default. Exactly one button is marked, always.
  const active: LineId | null = currentLine ?? picked ?? lines[0]?.id ?? null;

  const choose = (line: LineId) => {
    setPicked(line);
    onSelect(line);
  };

  return (
    <section className="gate" aria-labelledby={nameId}>
      <div className="gate__identity">
        <p className="gate__handle mono">{profile.handle}</p>

        <h1 className="gate__name" id={nameId}>
          {profile.name}
        </h1>

        <p className="gate__role">{profile.role}</p>

        <p className="gate__summary">{profile.summary}</p>
      </div>

      <nav className="gate__choose" aria-labelledby={`${nameId}-ask`}>
        <h2 className="gate__ask" id={`${nameId}-ask`}>
          Where to?
        </h2>

        <ul className="gate__lines">
          {lines.map((line) => (
            <li className="gate__line-item" key={line.id}>
              <button
                type="button"
                className="gate__line"
                aria-current={active === line.id ? 'true' : undefined}
                onClick={() => choose(line.id)}
              >
                <span className="gate__line-label">{line.label}</span>
                <span className="gate__line-blurb">{line.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <dl className="gate__facts">
        <div className="gate__fact">
          <dt className="gate__fact-label mono">Based in</dt>
          <dd className="gate__fact-value">{profile.location}</dd>
        </div>
        <div className="gate__fact">
          <dt className="gate__fact-label mono">Email</dt>
          <dd className="gate__fact-value">
            <a className="gate__email" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
          </dd>
        </div>
        {profile.resume ? (
          <div className="gate__fact">
            <dt className="gate__fact-label mono">Résumé</dt>
            <dd className="gate__fact-value">
              <a className="gate__resume" href={profile.resume} download>
                Download the PDF
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
