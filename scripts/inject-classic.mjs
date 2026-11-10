/**
 * Splice the prerendered classic view into the built `index.html`.
 *
 * The placeholder lives inside a `<noscript>` block, so the copy is inert
 * while scripting is on and becomes the page when scripting is off.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const distDir = join(root, 'dist');
const indexFile = join(distDir, 'index.html');
const fragmentFile = join(distDir, 'classic-fragment.html');
const PLACEHOLDER = '__CLASSIC_HTML__';

if (!existsSync(indexFile)) {
  console.error('inject-classic: dist/index.html is missing. Did the build run?');
  process.exit(1);
}

if (!existsSync(fragmentFile)) {
  console.error('inject-classic: dist/classic-fragment.html is missing. Did the prerender run?');
  process.exit(1);
}

const html = readFileSync(indexFile, 'utf8');
const fragment = readFileSync(fragmentFile, 'utf8');

if (!html.includes(PLACEHOLDER)) {
  console.error(`inject-classic: the placeholder ${PLACEHOLDER} is not in dist/index.html`);
  process.exit(1);
}

writeFileSync(indexFile, html.replace(PLACEHOLDER, () => fragment), 'utf8');

console.log(`inject-classic: spliced ${fragment.length} bytes into dist/index.html`);
