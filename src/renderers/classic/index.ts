/**
 * The classic renderer.
 *
 * The entry file of the module: it pulls in the stylesheet and re-exports
 * the view and the build-time renderer.
 *
 * The stylesheet is imported here rather than in `ClassicView.tsx` so that
 * `ClassicView.tsx` stays loadable in plain Node - the Vite plugin calls
 * `renderClassicHtml` at build time, where there is no CSS loader and no
 * DOM. Import the module through this file in the app so the stylesheet
 * comes with it.
 */

import './classic.css';

export { ClassicView } from './ClassicView';
export type { ClassicViewProps } from './ClassicView';
