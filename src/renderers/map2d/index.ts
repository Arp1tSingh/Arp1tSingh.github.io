/**
 * The network map renderer.
 *
 * The entry file of the module: it pulls in the stylesheet and re-exports
 * the view.
 *
 * The stylesheet is imported here rather than in `MapView.tsx` so that
 * `MapView.tsx` stays loadable in plain Node - no CSS loader, no DOM - the
 * same reason the classic renderer keeps its stylesheet out of its component
 * file. Import the module through this file in the app so the stylesheet
 * comes with it.
 */

import './map2d.css';

export { MapView } from './MapView';
export type { MapViewProps } from './MapView';
