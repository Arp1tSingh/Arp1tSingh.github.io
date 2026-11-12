Never use CI as the test loop. Reproduce and fix failures locally on all
configured browsers first, then push once. After a push, use
`gh run watch --exit-status` instead of sleeping, and read the logs with
`gh run view --log-failed` only after the run finishes. Batch known fixes
into a single push.

## 3D overhaul (in progress)

- Art direction: concept palette (`#ffc52e` board, `#fdf3d0` paper, `#101216`
  ink, `#d92d3a` accent); third rail, no catenary and no pantograph.
- Station order: `dadar`, `slot-06` (Sion), `slot-01` (Kurla), `slot-02`
  (Ghatkopar), `slot-03` (Mulund), `slot-04` (Thane), `slot-07` (Diva),
  `slot-05` (Dombivli), `kalyan`, `slot-08` (Ulhasnagar), `slot-09`
  (Ambernath), `badlapur`.
- Phases: 0 content order, 1 ride clock, 2 path/track, 3 camera, 4 metro
  train, 5 sky/palette, 6 docs/verification.
- Status: phases 0-5 done. 161 unit tests and 93 e2e tests (Chromium,
  Firefox, WebKit) pass; typecheck and build pass. Screenshots at
  0/25/50/75/100% desktop, mobile and reduced motion reviewed. The city now
  stands 46 units back from the line's own normal, which removed the flat
  grey wall at Thane.
- Pacing and track: dwell `express 0.4` / `local 0.2`, travel `0.6`.
  Express is 7.4 viewport heights and All stations 10.6, down from 11.8 and
  17.0 (about 60% more route per scroll). The centreline uses four Chaikin
  rounds with a blended tangent: 416 points, max vertex turn 0.052 rad,
  37,512 track triangles in 7 draw calls.
- Latest visual pass: doors are depth-layered so their glass cannot
  z-fight; the train is down to shell, livery, glazing and wheels (6,804
  triangles, 8 draw calls); the track has a ballast bed, profiled rails and
  sleepers laid across the line; sun and moon follow separate world-aligned
  arcs and the stars fade in slowly; the night composer keeps 4x MSAA.
- Ticket: the sticky QR/keep stub is gone. A slim top bar holds the serial
  and Close, and Keep ticket sits in the Actions row, so nothing covers the
  proof while it is read. The QR encoder chunk was deleted.
- Résumé is published at `public/resume.pdf`, wired through
  `content/profile.json`. Remaining: two clips (MeshStream dashboard,
  DictateIt reading), to follow after this push.
- Verify locally: `npm run typecheck`, `npm test`, `npx playwright test`,
  `npm run build`. Review screenshots at 0/25/50/75/100% and mobile.