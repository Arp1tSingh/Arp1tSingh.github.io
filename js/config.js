/* ============================================================
   config.js — single source of truth for editable content
   ============================================================ */

export const CONFIG = {
  name: 'Arpit Singh',
  handle: '@Arp1tSingh',

  // Leave empty to hide the email card. Set e.g. 'you@gmail.com'.
  email: '',

  social: {
    github: 'https://github.com/Arp1tSingh',
    linkedin: 'https://www.linkedin.com/in/rpitsingh',
    repos: 'https://github.com/Arp1tSingh?tab=repositories',
  },

  // Roles cycled by the hero typewriter.
  roles: [
    'Full-Stack Developer',
    'AI / ML Explorer',
    'CPU Graphics Programmer',
    'P2P Systems Builder',
    'Relentless Problem Solver',
  ],
};

export const NAV_ITEMS = [
  { label: 'Home',    href: '#hero',    icon: 'home' },
  { label: 'About',   href: '#about',   icon: 'code' },
  { label: 'Skills',  href: '#skills',  icon: 'spark' },
  { label: 'Work',    href: '#work',    icon: 'pulse' },
  { label: 'Journey', href: '#journey', icon: 'pin' },
  { label: 'GitHub',  href: '#pulse',   icon: 'github' },
  { label: 'Contact', href: '#contact', icon: 'mail' },
];

/* Projects mirror the cards in index.html — used by the command palette. */
export const PROJECTS = [
  {
    name: 'DeepGuard v2',
    desc: 'Deepfake forensics — 3 detectors + Grad-CAM evidence, PDF reports',
    cats: ['ai', 'Featured'],
    repo: 'https://github.com/Arp1tSingh/Deepguard-v2',
    href: 'https://github.com/Arp1tSingh/Deepguard-v2',
  },
  {
    name: 'LeetCode Spaced Repetition Tracker',
    desc: 'FSRS-6 scheduler with a paced review queue and auto-sync',
    cats: ['web', 'algo', 'Featured'],
    live: 'https://leetcode-practice-tracker.vercel.app/',
    href: 'https://leetcode-practice-tracker.vercel.app/',
  },
  {
    name: 'P2P File Sharing',
    desc: 'BitTorrent-style cross-NAT transfer, Python stdlib only',
    cats: ['sys'],
    live: 'https://p2p-file-sharing-pjgm.onrender.com/',
    href: 'https://p2p-file-sharing-pjgm.onrender.com/',
  },
  {
    name: 'Multithreaded CPU Path Tracer',
    desc: 'BVH, 10 light bounces, dielectric materials — no graphics API',
    cats: ['sys'],
    href: 'https://github.com/Arp1tSingh/cpp-path-tracer',
  },
  {
    name: 'BigOBoard',
    desc: 'Infinite-canvas whiteboard for DSA, single file, no deps',
    cats: ['web', 'algo'],
    live: 'https://big-o-board.vercel.app',
    href: 'https://big-o-board.vercel.app',
  },
  {
    name: 'Wishlist Keeper',
    desc: 'Sharable wishlists with Supabase auth, RLS and budget tracking',
    cats: ['web'],
    live: 'https://shopping-wishlist-three.vercel.app',
    href: 'https://shopping-wishlist-three.vercel.app',
  },
  {
    name: 'E-Waste Passport',
    desc: 'Gamified awareness campaign app — localStorage, no backend',
    cats: ['web'],
    live: 'https://ewaste-quiz.vercel.app',
    href: 'https://ewaste-quiz.vercel.app',
  },
  {
    name: 'Bus Route Planner',
    desc: 'TSP solver in C — brute force vs branch & bound vs greedy',
    cats: ['algo', 'sys'],
    href: 'https://github.com/Arp1tSingh/Bus-Route-Planner-TSP',
  },
  {
    name: 'LeetCode Solutions Archive',
    desc: 'Every problem solved, continuously synced',
    cats: ['algo'],
    href: 'https://github.com/Arp1tSingh/LeetCode',
  },
];

/* ============================================================
   Real GitHub data — pulled from api.github.com/users/Arp1tSingh
   One entry per repository: created_at + pushed_at.
   Dates drive the activity heatmap and the "active repos" stat.
   ============================================================ */
export const REPOS = [
  { name: 'Bus-Route-Planner-TSP',   created: '2025-10-06', pushed: '2025-10-06' },
  { name: 'erp-backend',             created: '2025-10-15', pushed: '2025-10-29' },
  { name: 'erp-frontend',            created: '2025-10-15', pushed: '2025-10-29' },
  { name: 'os-log-analyzer',         created: '2026-04-09', pushed: '2026-04-09' },
  { name: 'cpp-path-tracer',         created: '2026-04-24', pushed: '2026-04-24' },
  { name: 'Arp1tSingh',              created: '2026-05-14', pushed: '2026-08-22' },
  { name: 'LeetCode',                created: '2026-08-01', pushed: '2026-09-30' },
  { name: 'Leetcode-Practice-Tracker', created: '2026-08-14', pushed: '2026-09-18' },
  { name: 'Deepguard-v2',            created: '2026-09-05', pushed: '2026-09-28' },
  { name: 'Ewaste-Quiz',             created: '2026-09-08', pushed: '2026-09-08' },
  { name: 'Deepguard-deepfake-detector', created: '2026-08-11', pushed: '2026-08-11' },
  { name: 'BigOBoard',               created: '2026-08-22', pushed: '2026-08-29' },
  { name: 'Shopping-Wishlist',       created: '2026-09-16', pushed: '2026-09-30' },
  { name: 'fintech-vit',             created: '2026-09-26', pushed: '2026-09-29' },
  { name: 'p2p-file-sharing',        created: '2026-09-28', pushed: '2026-09-28' },
];

/* Repo-level aggregates shown in the stats cards. */
export const GITHUB_STATS = {
  repos: 15,
  stars: 1,
  followers: 4,
  since: 'Oct 2025',
};