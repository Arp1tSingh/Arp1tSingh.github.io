/**
 * Prerender the classic view to static HTML.
 *
 * "Tier 4 Plain: No JavaScript - Classic view rendered to static HTML at
 * build time." This is that step. It renders the same React component the app
 * uses, through `react-dom/server`, and writes the markup for the build to
 * splice into `index.html` inside a `<noscript>` block.
 *
 * With scripting on, `<noscript>` content is inert, so there is no duplicated
 * content in the document. With scripting off, the app never boots and the
 * static copy is the page.
 *
 * This file is the entry point for a Vite SSR build:
 *
 *   vite build --ssr scripts/prerender-classic.ts --outDir .prerender
 *   node .prerender/prerender-classic.js
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderClassicHtml } from '../src/renderers/classic/ClassicView';
import { CONTENT } from '../src/data/content';

const root = process.cwd();
const distDir = join(root, 'dist');
const outFile = join(distDir, 'classic-fragment.html');

mkdirSync(distDir, { recursive: true });

const html = renderClassicHtml(CONTENT);

if (!html.includes('<article')) {
  throw new Error('prerender-classic: the classic view rendered no stops');
}

writeFileSync(outFile, html, 'utf8');

const articles = (html.match(/<article/g) ?? []).length;
console.log(`classic: ${articles} stops, ${html.length} bytes -> dist/classic-fragment.html`);
