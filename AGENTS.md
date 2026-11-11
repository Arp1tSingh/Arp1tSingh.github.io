Never use CI as the test loop. Reproduce and fix failures locally on all
configured browsers first, then push once. After a push, use
`gh run watch --exit-status` instead of sleeping, and read the logs with
`gh run view --log-failed` only after the run finishes. Batch known fixes
into a single push.