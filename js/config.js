/* ============================================================
   config.js — editable content. Single source of truth.

   The visible work panels in index.html are cut to one line each on
   purpose. These are the full descriptions, and ⌘K is where the depth
   went rather than a footnote nobody reads.
   ============================================================ */

export const CONFIG = {
  name: 'Arpit Singh',
  handle: '@Arp1tSingh',
  email: 'arpitsingh8534@gmail.com',

  social: {
    github: 'https://github.com/Arp1tSingh',
    linkedin: 'https://www.linkedin.com/in/rpitsingh',
    repos: 'https://github.com/Arp1tSingh?tab=repositories',
  },
};

export const NAV_ITEMS = [
  { label: 'Work',    href: '#work',    icon: 'search' },
  { label: 'Toolkit', href: '#toolkit', icon: 'search' },
  { label: 'Journey', href: '#journey', icon: 'search' },
  { label: 'Contact', href: '#contact', icon: 'mail' },
];

export const PROJECTS = [
  { name: 'DeepGuard v2',           desc: 'Deepfake forensics — three detectors with Grad-CAM evidence and PDF reports', cats: ['ai'],           href: 'https://github.com/Arp1tSingh/Deepguard-v2',                     meta: 'source' },
  { name: 'LeetCode Tracker',        desc: 'FSRS-6 scheduler with a paced review queue and automatic sync',       cats: ['web', 'algo'],   href: 'https://leetcode-practice-tracker.vercel.app/',                  meta: 'live' },
  { name: 'P2P File Sharing',       desc: 'BitTorrent-style cross-NAT transfer, Python standard library only',  cats: ['sys'],           href: 'https://p2p-file-sharing-pjgm.onrender.com/',                   meta: 'live' },
  { name: 'CPU Path Tracer',        desc: 'BVH, ten light bounces, dielectric materials — no graphics API',    cats: ['sys'],           href: 'https://github.com/Arp1tSingh/cpp-path-tracer',                      meta: 'source' },
  { name: 'BigOBoard',              desc: 'Infinite-canvas whiteboard for DSA, single file, no dependencies',  cats: ['web', 'algo'],   href: 'https://github.com/Arp1tSingh/BigOBoard',                           meta: 'source' },
  { name: 'Wishlist Keeper',        desc: 'Sharable wishlists with Supabase auth, RLS and budget tracking',    cats: ['web'],           href: 'https://shopping-wishlist-three.vercel.app',                      meta: 'live' },
  { name: 'E-Waste Passport',       desc: 'Gamified awareness campaign app — localStorage, no backend',         cats: ['web'],           href: 'https://ewaste-quiz.vercel.app',                                meta: 'live' },
  { name: 'Bus Route Planner',      desc: 'TSP solver in C — brute force against branch and bound',             cats: ['algo', 'sys'],   href: 'https://github.com/Arp1tSingh/Bus-Route-Planner-TSP',            meta: 'source' },
  { name: 'OS Log Analyzer',        desc: 'Reads syslog, groups by process, flags the outliers',                cats: ['sys'],           href: 'https://github.com/Arp1tSingh/os-log-analyzer',                   meta: 'source' },
  { name: 'LeetCode Archive',       desc: 'Every problem solved, continuously synced',                          cats: ['algo'],          href: 'https://github.com/Arp1tSingh/LeetCode',                          meta: 'source' },
];

export const GITHUB_STATS = { repos: 16, since: 'October 2025' };