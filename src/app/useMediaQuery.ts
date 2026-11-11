import { useEffect, useState } from 'react';

/**
 * A media query as a hook.
 *
 * The gate covers the whole screen on a narrow one, so there is no point in
 * paying for the scene behind it on a phone. This is the one place the layout
 * decides what the visitor pays for.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
