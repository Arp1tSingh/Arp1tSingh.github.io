import type { Profile } from '../core/types';

interface FooterProps {
  profile: Profile;
}

/**
 * The footer. It is also the terminus's mail-to-a-list action: the wallet
 * summary and the contact details together.
 */
export function Footer({ profile }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="site-footer__line">
          <span className="site-footer__label mono">Arpit Singh</span>
          <span className="site-footer__sep" aria-hidden="true">
            /
          </span>
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </p>
        <ul className="site-footer__links">
          <li>
            <a href={profile.social.github} rel="noopener noreferrer" target="_blank">
              GitHub
            </a>
          </li>
          <li>
            <a href={profile.social.linkedin} rel="noopener noreferrer" target="_blank">
              LinkedIn
            </a>
          </li>
          <li>
            <a href={profile.social.repos} rel="noopener noreferrer" target="_blank">
              Repositories
            </a>
          </li>
        </ul>
        <p className="site-footer__note mono">
          Built as one dataset and three renderers.
        </p>
      </div>
    </footer>
  );
}
