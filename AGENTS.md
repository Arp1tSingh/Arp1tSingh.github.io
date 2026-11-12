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
- Status: phases 0-5 done. 173 unit tests and 111 e2e tests (Chromium,
  Firefox, WebKit) pass; typecheck and build pass. Screenshots at
  0/25/50/75/100% desktop, mobile and reduced motion reviewed. The city now
  stands 46 units back from the line's own normal, which removed the flat
  grey wall at Thane.
- UX pass done (`docs/ux-plan.md`): the terminus hands over to a wallet
  closing screen with one viewport of runway; the map keeps its own
  selection and "Ride here" is the only thing that moves the train; phones
  get a Views menu, a back bar, a filter strip above the plot and a station
  sheet that stays shut until a station is picked; the ticket is a
  non-modal dialog with explicit arrow scrolling and 24px dot targets.
  "Classic" reads as "Text view" and "Pause" as "Pause motion"; the résumé
  is in the header, the menu and the gate.
- Pacing and track: dwell `express 0.4` / `local 0.2`, travel `0.6`.
  Express is 7.4 viewport heights and All stations 10.6, down from 11.8 and
  17.0 (about 60% more route per scroll). The centreline uses four Chaikin
  rounds with a blended tangent: 416 points, max vertex turn 0.052 rad,
  36,556 track triangles in 8 draw calls.
- Latest visual pass: doors are depth-layered so their glass cannot
  z-fight; the train wears the Central Line purple and white with block CR
  marks and is down to shell, livery, glazing and wheels (5,556 triangles,
  8 draw calls); the track has a ballast bed, profiled rails and sleepers
  laid across the line; sun and moon follow separate world-aligned arcs and
  the stars fade in slowly; the night composer keeps 4x MSAA.
- Skyline and platforms: ten towers, three over Dadar tapering to one at
  Thane and none after, drawn as a separate instanced mesh over the
  unchanged small blocks. Platform slabs and their red edges are swept
  along the smoothed line at a constant 2.4-unit edge, so no station cuts
  the train's path at Sion, Ghatkopar, Thane, Dombivli or Ulhasnagar.
- Ticket: the sticky QR/keep stub and the serial are gone. Close sits at
  the far end of the station board and Keep ticket sits in the Actions row,
  so nothing covers the proof while it is read. The QR encoder chunk was
  deleted.
- Résumé is published at `public/resume.pdf`, wired through
  `content/profile.json`. Remaining: two clips (MeshStream dashboard,
  DictateIt reading), to follow after this push.
- Verify locally: `npm run typecheck`, `npm test`, `npx playwright test`,
  `npm run build`. Review screenshots at 0/25/50/75/100% and mobile.