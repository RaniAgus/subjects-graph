# AGENTS.md

## Project overview

Static PWA that visualizes university subject prerequisite graphs. The **entire app lives in
`public/`** and is served as-is — no build step, no bundler, no framework. `package.json` exists
only for dev tooling (Vitest + TypeScript type-checking).

## Commands

```bash
pnpm test          # vitest run (one-shot, no watch)
pnpm typecheck     # tsc -p jsconfig.json --noEmit (JS files only, no transpilation)
```

No `build`, `lint`, or `format` scripts exist. To serve the app locally, point any static file
server at `public/`:

```bash
python -m http.server 8000 -d public
# or: npx serve public
```

## Architecture

- **`public/graph.js`** — pure graph logic, zero DOM dependency. `Graph`, `SubjectNode`, `EdgeNode`.
  The only file covered by type-checking and unit tests.
- **`public/app.js`** — UI orchestrator. Imports Cytoscape from unpkg CDN
  (`https://unpkg.com/cytoscape@3.33.1/dist/cytoscape.esm.mjs`). `GraphApp` class wires DOM;
  `CytoscapeDrawer` implements the `Drawer` interface used by `graph.js`.
- **`public/data.json`** — curriculum data (variants, subjects, edges). Colors in here are CSS
  variable names (`--fill-color-1`), not hex values. `GraphApp.resolveCssColor()` resolves them at
  runtime via `window.THEMES`.
- **`public/sw.js`** — contains the literal string `{{COMMIT_SHA}}` which CI replaces via `sed`
  before deploying. The placeholder is intentional; do not remove it.

## Type-checking scope

`jsconfig.json` only includes `public/graph.js` and `tests/**/*.js`. Changes to `app.js` or
`index.html` are **not type-checked**.

## Testing

```bash
pnpm test                         # run all tests
pnpm test -- tests/graph.test.js  # run a single file
```

Tests use `tests/helpers/common.js` which imports `data.json` and exposes the `frba-k08` variant as
fixtures. Tests never hardcode prerequisite logic — they pull real subject data. The `~` alias
resolves to `./public/` (configured in both `vite.config.js` and `jsconfig.json`).

Mock drawer pattern: `createMockDrawer()` returns
`{ drawCircle, drawDiamond, drawEdge, drawArrow, shapes }` — assert on `shapes.circles`,
`shapes.arrows`, etc.

## Key non-obvious conventions

- **Two-phase render**: `graph.render(drawer)` calls `renderNode()` then `renderLinks()` for all
  nodes — links are a separate pass so arrows render on top of nodes in Cytoscape.
- **Transitive deduplication**: `Graph` removes redundant direct edges (if A→B→C exists, A→C is
  dropped). This is intentional and tested.
- **Availability is ordered and short-circuits**: `getAvailability()` uses a procedural loop that
  stops at first unmet prerequisite level. Using `findLast` or reversing the order breaks the
  regression test in `tests/bugs/01-all-inactive-shows-approved.test.js`.
- **Leaf nodes**: After graph construction, `calculateLeafDependencies()` marks nodes with no
  dependents. Leaf nodes use `leafTextColor` instead of `textColor` for their label.
- **LocalStorage keys**: progress per variant is stored under `graphStatus-{variantId}`; custom plan
  JSON is stored under `customVariant`.

## CI / Deploy

GitHub Actions (`.github/workflows/github-pages.yml`) deploys `public/` directly to GitHub Pages on
push to `main` affecting `public/**`. The only CI step beyond checkout is injecting the commit SHA
into `sw.js`.
