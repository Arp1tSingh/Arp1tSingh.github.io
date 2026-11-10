/**
 * Runs after `vite build` to make the output GitHub Pages friendly.
 *
 *   node scripts/postbuild.mjs
 *
 * Two things GitHub Pages wants that Vite does not write:
 *
 *   dist/.nojekyll   stops Jekyll from eating files that start with an
 *                    underscore. Without it the build silently loses assets.
 *   dist/404.html   the page served for a missing path. The site is a single
 *                    page app, so a copy of index.html is the right answer:
 *                    the client router takes over from the hash.
 *
 * Plain ESM on purpose: this runs with bare `node`, no loader, no build step.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** How many files ended up in dist/, for the closing line. */
function countFiles(directory) {
  let total = 0;
  let entries = [];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) total += countFiles(join(directory, entry.name));
    else total += 1;
  }
  return total;
}

function main() {
  if (!existsSync(dist)) {
    mkdirSync(dist, { recursive: true });
    console.log('postbuild: dist/ was missing, created it (nothing to publish yet)');
  } else {
    console.log('postbuild: dist/ found');
  }

  const nojekyll = join(dist, '.nojekyll');
  if (existsSync(nojekyll)) {
    console.log('postbuild: dist/.nojekyll already exists');
  } else {
    writeFileSync(nojekyll, '', 'utf8');
    console.log('postbuild: created dist/.nojekyll');
  }

  const indexHtml = join(dist, 'index.html');
  const notFoundHtml = join(dist, '404.html');
  if (existsSync(notFoundHtml)) {
    console.log('postbuild: dist/404.html already exists, left it alone');
  } else if (existsSync(indexHtml)) {
    copyFileSync(indexHtml, notFoundHtml);
    console.log('postbuild: copied dist/index.html to dist/404.html');
  } else {
    console.log('postbuild: dist/index.html not found, skipped dist/404.html');
  }

  console.log(`postbuild: done (${countFiles(dist)} file(s) in dist/)`);
}

try {
  main();
} catch (error) {
  console.error(`postbuild: failed - ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
