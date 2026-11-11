import { renderToStaticMarkup } from 'react-dom/server';

import { ClassicView } from './ClassicView';
import type { SiteContent } from '../../core/types';

/**
 * The classic view as a string of markup.
 *
 * Called at build time by the prerender script and by the tests, in Node with
 * no DOM. The markup is exactly what `ClassicView` renders.
 *
 * It lives in its own module on purpose: `react-dom/server` is a hundred and
 * eighty kilobytes of machinery for rendering on a server, and a browser
 * that never renders on a server has no business carrying it.
 */
export function renderClassicHtml(content: SiteContent): string {
  return renderToStaticMarkup(<ClassicView content={content} />);
}
