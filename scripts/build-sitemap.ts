#!/usr/bin/env tsx
/**
 * Writes `public/sitemap.xml` for the deployed site.
 *
 *   npx tsx scripts/build-sitemap.ts
 *
 * The site routes with hash deep links (`/#stop-id`), so every stop is a URL
 * on the home page with a fragment. The same fragment is what the classic
 * view's own anchors use, so the link works with no JavaScript at all.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://arp1tsingh.github.io/';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'content');
const STOPS_DIR = join(CONTENT_DIR, 'stops');
const PUBLIC_DIR = join(ROOT, 'public');
const OUT_FILE = join(PUBLIC_DIR, 'sitemap.xml');

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Today, in the local timezone, as `YYYY-MM-DD`. */
function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * The stop ids in line order. `route.order` is the source of truth; if the
 * content is not there yet, fall back to whatever stop files exist.
 */
function collectStopIds(): { ids: string[]; source: string } {
  const route = readJson(join(CONTENT_DIR, 'route.json')) as
    | { order?: unknown }
    | undefined;
  const order = Array.isArray(route?.order) ? (route.order as unknown[]).map(String) : [];
  if (order.length > 0) return { ids: order, source: 'content/route.json' };

  if (!existsSync(STOPS_DIR)) return { ids: [], source: 'none' };

  const ids = readdirSync(STOPS_DIR)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort()
    .map((name) => {
      const raw = readJson(join(STOPS_DIR, name)) as { id?: unknown } | undefined;
      const id = typeof raw?.id === 'string' && raw.id.length > 0 ? raw.id : name.replace(/\.json$/i, '');
      return id;
    });
  return { ids, source: 'content/stops/*.json' };
}

function main(): void {
  const { ids, source } = collectStopIds();

  if (!existsSync(CONTENT_DIR)) {
    console.warn(`WARN content directory not found - writing a sitemap with the home page only.`);
  } else {
    console.log(`Stop ids read from ${source}: ${ids.length}`);
  }

  const lastmod = today();
  const urls: string[] = [SITE, ...ids.map((id) => `${SITE}#${id}`)];

  const body = urls
    .map((url) => {
      const priority = url === SITE ? '1.0' : '0.7';
      return [
        '  <url>',
        `    <loc>${escapeXml(url)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        '    <changefreq>monthly</changefreq>',
        `    <priority>${priority}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    '',
  ].join('\n');

  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(OUT_FILE, xml, 'utf8');

  console.log(`Wrote ${urls.length} URL(s) to public/sitemap.xml (lastmod ${lastmod}).`);
}

main();
