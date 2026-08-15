# Contributing to git-size

Thanks for helping improve git-size. Keep changes focused, local-only, and
cross-platform. New behavior should have a meaningful test, especially when it
touches Git parsing or filenames.

Before opening a pull request, run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Please do not add telemetry, network calls, or dependencies that are not
necessary for the CLI.