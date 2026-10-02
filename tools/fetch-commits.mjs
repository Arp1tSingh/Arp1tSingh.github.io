/* ------------------------------------------------------------------
   fetch-commits.mjs — regenerate data/commits.json from real commits
   ------------------------------------------------------------------
   Walks every public repo in the account with the GitHub REST API,
   collects each commit's author date, and writes a per-day histogram.

   Requires the gh CLI to be authenticated:
       gh auth login
   Run:
       node tools/fetch-commits.mjs
   ------------------------------------------------------------------ */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'data', 'commits.json');
const OWNER = 'Arp1tSingh';
const PER_PAGE = 100;

function gh(path) {
  const out = execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.trim() ? JSON.parse(out) : [];
}

function repoNames() {
  return gh(`users/${OWNER}/repos?per_page=100`)
    .filter((r) => !r.fork && r.size >= 0)
    .map((r) => r.name)
    .sort();
}

console.log(`Fetching commits for ${OWNER}…`);
const repos = repoNames();
console.log(`  ${repos.length} repositories`);

const days = Object.create(null);
let total = 0;

for (const name of repos) {
  let count = 0;
  for (let page = 1; ; page++) {
    let batch;
    try {
      batch = gh(`repos/${OWNER}/${name}/commits?per_page=${PER_PAGE}&page=${page}`);
    } catch {
      // Empty repo, or history we can't read — not fatal.
      break;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const c of batch) {
      const iso = c?.commit?.author?.date;
      if (!iso) continue;
      const day = iso.slice(0, 10);
      days[day] = (days[day] || 0) + 1;
      count++;
      total++;
    }
    if (batch.length < PER_PAGE) break;
  }
  console.log(`  ${String(count).padStart(4)}  ${name}`);
}

const sorted = Object.keys(days).sort();
const payload = {
  generated: new Date().toISOString().slice(0, 10),
  owner: OWNER,
  total,
  activeDays: sorted.length,
  first: sorted[0] ?? null,
  last: sorted[sorted.length - 1] ?? null,
  days,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 0) + '\n');

console.log(`\n  total commits : ${total}`);
console.log(`  active days   : ${sorted.length}`);
console.log(`  range         : ${payload.first} → ${payload.last}`);
console.log(`\nWrote ${OUT} (${(JSON.stringify(payload).length / 1024).toFixed(1)} KB)`);