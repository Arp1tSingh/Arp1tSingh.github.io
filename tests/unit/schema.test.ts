import { describe, expect, it } from 'vitest';

import {
  DOMAINS,
  PLACEHOLDER,
  ROLES,
  TIERS,
  unwrap,
  validateProfile,
  validateRouteConfig,
  validateStop,
  validateStrict,
} from '../../src/core/schema';
import type { Stop } from '../../src/core/types';

function validStop(overrides: Partial<Stop> = {}): Record<string, unknown> {
  return {
    id: 'slot-01',
    kind: 'project',
    title: 'MeshStream',
    oneLiner: 'Live video streaming where the viewers become the CDN.',
    tier: 'express',
    domain: 'systems',
    role: 'solo',
    stack: ['TypeScript', 'WebRTC'],
    claim: 'Turns concurrent viewers into a self-organising P2P mesh.',
    proof: {
      metrics: ['16 KB DataChannel chunks'],
      media: [
        {
          src: 'media/path-tracer.png',
          width: 800,
          height: 533,
          alt: 'A path-traced render',
          kind: 'image',
        },
      ],
      architecture: 'WHIP in, LL-HLS out.',
    },
    links: {
      repo: 'https://github.com/Arp1tSingh/meshstream',
      demo: '',
      caseStudy: '',
    },
    period: { start: '2026-10', end: 'present' },
    station: 'Kurla',
    prop: 'signal mast',
    badge: '01 / EXPRESS',
    ...overrides,
  };
}

describe('a valid stop', () => {
  it('passes', () => {
    const result = validateStop(validStop());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.value?.title).toBe('MeshStream');
  });

  it('keeps the media dimensions it was given', () => {
    const result = validateStop(validStop());
    expect(result.value?.proof.media[0]?.width).toBe(800);
    expect(result.value?.proof.media[0]?.height).toBe(533);
  });

  it('allows an empty stack on the about and terminus cards', () => {
    expect(validateStop(validStop({ kind: 'about', stack: [] })).ok).toBe(true);
    expect(validateStop(validStop({ kind: 'terminus', stack: [] })).ok).toBe(true);
  });

  it('refuses an empty stack on a project', () => {
    const result = validateStop(validStop({ stack: [] }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('stack');
  });
});

describe('the required fields', () => {
  const fields = ['id', 'title', 'oneLiner', 'claim', 'station', 'prop', 'badge'];

  for (const field of fields) {
    it(`refuses a stop with no ${field}`, () => {
      const stop = validStop();
      delete stop[field];
      const result = validateStop(stop);
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toContain(field);
    });
  }

  it('refuses a stop with no proof', () => {
    const stop = validStop();
    delete stop.proof;
    expect(validateStop(stop).ok).toBe(false);
  });

  it('refuses a stop with no links', () => {
    const stop = validStop();
    delete stop.links;
    expect(validateStop(stop).ok).toBe(false);
  });

  it('refuses a stop with no period', () => {
    const stop = validStop();
    delete stop.period;
    expect(validateStop(stop).ok).toBe(false);
  });
});

describe('the enums', () => {
  it('refuses a tier that is not one of the two', () => {
    const result = validateStop(validStop({ tier: 'express-ish' as never }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('tier');
  });

  it('accepts exactly the documented values', () => {
    for (const tier of TIERS) {
      expect(validateStop(validStop({ tier })).ok).toBe(true);
    }
    for (const domain of DOMAINS) {
      expect(validateStop(validStop({ domain })).ok).toBe(true);
    }
    for (const role of ROLES) {
      expect(validateStop(validStop({ role })).ok).toBe(true);
    }
  });
});

describe('the dates', () => {
  it('refuses a period that is not YYYY-MM', () => {
    expect(validateStop(validStop({ period: { start: '2026-13', end: 'present' } })).ok).toBe(false);
    expect(validateStop(validStop({ period: { start: 'October 2026', end: 'present' } })).ok).toBe(false);
  });

  it('accepts present as an end', () => {
    expect(validateStop(validStop({ period: { start: '2026-10', end: 'present' } })).ok).toBe(true);
  });
});

describe('the links', () => {
  it('refuses a repository that is not a URL', () => {
    const stop = validStop();
    stop.links = { repo: 'github.com/x', demo: '', caseStudy: '' };
    expect(validateStop(stop).ok).toBe(false);
  });

  it('accepts an empty demo and case study', () => {
    expect(validateStop(validStop()).ok).toBe(true);
  });
});

describe('the media', () => {
  it('refuses a source that escapes the site', () => {
    const stop = validStop();
    stop.proof = {
      metrics: [],
      media: [{ src: '../../etc/passwd', alt: 'x', kind: 'image' }],
      architecture: '',
    };
    expect(validateStop(stop).ok).toBe(false);
  });

  it('accepts a relative path and an absolute URL', () => {
    const stop = validStop();
    stop.proof = {
      metrics: [],
      media: [
        { src: 'media/a.png', alt: 'x', kind: 'image' },
        { src: 'https://example.com/a.png', alt: 'y', kind: 'image' },
      ],
      architecture: '',
    };
    expect(validateStop(stop).ok).toBe(true);
  });

  it('refuses a negative dimension', () => {
    const stop = validStop();
    stop.proof = {
      metrics: [],
      media: [{ src: 'media/a.png', alt: 'x', kind: 'image', width: -1, height: 10 }],
      architecture: '',
    };
    expect(validateStop(stop).ok).toBe(false);
  });

  it('refuses an image with no alt text', () => {
    const stop = validStop();
    stop.proof = {
      metrics: [],
      media: [{ src: 'media/a.png', alt: '', kind: 'image' }],
      architecture: '',
    };
    expect(validateStop(stop).ok).toBe(false);
  });
});

describe('placeholders', () => {
  it('reports a TBD without failing', () => {
    const result = validateStop(validStop({ title: PLACEHOLDER }));
    expect(result.ok).toBe(true);
    expect(result.placeholders.length).toBeGreaterThan(0);
  });

  it('fails under the strict check', () => {
    const result = validateStrict(validStop({ title: PLACEHOLDER }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('placeholder');
  });

  it('passes the strict check when nothing is left', () => {
    expect(validateStrict(validStop()).ok).toBe(true);
  });
});

describe('the profile', () => {
  const profile = {
    name: 'Arpit Singh',
    handle: '@Arp1tSingh',
    role: 'Computer Engineering student',
    location: 'Mumbai, India',
    email: 'arpitsingh8534@gmail.com',
    resume: '',
    summary: 'A one-line summary.',
    social: {
      github: 'https://github.com/Arp1tSingh',
      linkedin: 'https://www.linkedin.com/in/rpitsingh',
      repos: 'https://github.com/Arp1tSingh?tab=repositories',
    },
  };

  it('passes', () => {
    expect(validateProfile(profile).ok).toBe(true);
  });

  it('refuses an address that is not an address', () => {
    expect(validateProfile({ ...profile, email: 'not an email' }).ok).toBe(false);
  });

  it('refuses a social link that is not https', () => {
    expect(
      validateProfile({ ...profile, social: { ...profile.social, github: 'http://x.com' } }).ok,
    ).toBe(false);
  });
});

describe('the route config', () => {
  const config = {
    defaultLine: 'express',
    lines: [
      { id: 'express', label: 'Express', blurb: 'a', intent: 'skim', budget: 'short' },
      { id: 'all', label: 'All stations', blurb: 'b', intent: 'explore', budget: 'long' },
    ],
    order: ['slot-01'],
    pacing: { dwell: { express: 0.6, local: 0.3 }, travel: 1, expressZeroesLocalDwell: true },
  };

  it('passes', () => {
    expect(validateRouteConfig(config).ok).toBe(true);
  });

  it('refuses a default line that is not one of the lines', () => {
    expect(validateRouteConfig({ ...config, defaultLine: 'ghost' }).ok).toBe(false);
  });

  it('refuses two lines with the same id', () => {
    expect(
      validateRouteConfig({
        ...config,
        lines: [...config.lines, config.lines[0]],
      }).ok,
    ).toBe(false);
  });

  it('refuses a negative dwell', () => {
    expect(
      validateRouteConfig({
        ...config,
        pacing: { ...config.pacing, dwell: { express: -1, local: 0.3 } },
      }).ok,
    ).toBe(false);
  });

  it('refuses a travel of zero', () => {
    expect(
      validateRouteConfig({ ...config, pacing: { ...config.pacing, travel: 0 } }).ok,
    ).toBe(false);
  });
});

describe('unwrap', () => {
  it('returns the value when it is good', () => {
    const result = validateStop(validStop());
    expect(unwrap(result, 'a stop').title).toBe('MeshStream');
  });

  it('throws with every reason when it is not', () => {
    const result = validateStop(validStop({ id: 'Bad Id' }));
    expect(() => unwrap(result, 'a stop')).toThrow(/Invalid a stop/);
  });
});
