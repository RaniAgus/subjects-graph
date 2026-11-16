# Browser integration tests

The checks previously in `review.mjs` and `offline.mjs` now run with Playwright
and English Gherkin, without extending their coverage. All step definitions are
JavaScript. CI is unchanged.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:integration
```

Playwright starts the test server and creates isolated browser contexts; no
manually launched Chrome or CDP port is needed.

- `review.feature` / `review.steps.mjs`: the original theme, embedded library,
  progress, JSON, screenshot and custom-plan editing checks.
- `offline.feature` / `offline.steps.mjs`: the original subdirectory, PWA opt-out,
  precache and offline progress checks.
- `server.mjs`: serves `public/` at both deployment paths. It substitutes the CDN
  URL in test responses with the installed Cytoscape asset, without modifying
  production files or the service worker's commit placeholder.

The original checks retain their renderer events and page-side file interception;
this migration replaces their CDP driver and runner, without rewriting what they
exercise. The custom-plan fixture is reset to empty before the original subject
creation checks, because the application now creates a default subject. The
progress check uses the current gauge element.

To change cases, edit the `.feature` files and matching `.steps.mjs` definitions.
`bddgen` generates Playwright specs automatically before execution; generated
specs and results are ignored by Git. Vitest remains separate under `pnpm test`.

```sh
pnpm test:integration --headed
pnpm test:integration --grep 'offline'
```
