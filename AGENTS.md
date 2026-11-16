# AGENTS.md

## Project overview

Static PWA that visualizes university subject prerequisite graphs. The **entire app lives in
`public/`** and is served as-is, with no web build or framework. The reusable graph library
also lives there; `package.json` provides tests, type-checking, and a separate npm library build.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm test          # vitest run (one-shot, no watch)
pnpm typecheck     # tsc -p jsconfig.json --noEmit (JS files only, no transpilation)
pnpm build:lib     # esbuild ESM + JSDoc declarations + CSS in ignored dist/
pnpm start         # python3 static server, public/, port 8000
```

No web `build`, Vite dev server, `lint`, or `format` scripts exist. To serve the app locally, point any static file
server at `public/`:

```bash
python -m http.server 8000 -d public
# or: npx serve public
```

## Architecture

- **`public/lib/subjects-graph/core.js`** — pure graph logic, zero DOM dependency:
  `Graph`, `SubjectNode`, `EdgeNode`. `public/graph.js` is a compatibility reexport.
- **`public/lib/subjects-graph/index.js`** — public `SubjectsGraph` entry and JSDoc contracts.
  `subjects-graph.js` owns each instance's DOM and private Cytoscape renderer; drawer,
  stylesheet, theme and CSS files are colocated. Inputs are copied. The host owns plan,
  progress, persistence and request acceptance; setters do not emit request feedback.
- **`public/app.js`** — `GraphApp` orchestrates UI, selectors, progress, legend, editing,
  JSON import/export, storage and screenshots around the library. `index.html` maps
  `cytoscape` to `https://unpkg.com/cytoscape@3.33.1/dist/cytoscape.esm.mjs`.
- **`public/data.json`** — curriculum data (variants, subjects, edges). Colors in here are CSS
  tokens (`--fill-color-1`). The library resolves these against instance-local theme overrides
  on Default Dark; literal CSS colors also work. Availability uses `color`, not `borderColor`.
  Personal progress is a string subject-ID to status-ID map, separate from `plan.statuses`.
- **`public/sw.js`** — contains the literal string `{{COMMIT_SHA}}` which CI replaces via `sed`
  before deploying. The placeholder is intentional; do not remove it.

## Type-checking scope

`jsconfig.json` includes `public/graph.js`, `public/lib/subjects-graph/**/*.js` and
`tests/**/*.js`, including static type fixtures and the release-helper tests. Node declarations
support tests and CI helper imports. Changes to `app.js` or `index.html` are **not type-checked**.
`tsconfig.lib.json` generates browser declarations from library JSDoc with `types: []`,
so consumers do not need the development Node/Vitest ambient types.

## Testing

```bash
pnpm test                         # run all tests
pnpm test -- tests/graph.test.js  # run a single file
```

Tests use `tests/helpers/common.js` which imports `data.json` and exposes the `frba-k08` variant as
fixtures. Core curriculum tests pull real subject data instead of hardcoding prerequisite logic.
Library tests use renderer-boundary doubles to check ownership, requests and lifecycle; renderer
tests inspect the drawer/style boundary. Small explicit plans cover isolated library behavior.
The `~` alias
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
- **Controlled state**: `setProgress` replaces rather than merges; omissions use subject status
  then the first catalog status. `setPlan` replaces plan and progress while preserving viewport.
  Ignored drag requests revert to plan positions. Pending taps are canceled with `clearTimeout`
  on plan replacement or destroy. The library has no storage or service worker behavior.

## CI / Deploy

`.github/workflows/github-pages.yml` independently deploys `public/` directly to Pages on push
to `main` affecting `public/**`, injecting the commit SHA into `sw.js`.

`.github/workflows/publish.yml` verifies tests, types and library build on main/PRs. Only version
tag pushes (optional `v`) publish npm: stable versions use `latest`, all prereleases use `next`.
The release helper changes the package version only in the job; no version commits or snapshots.
Publishing uses npm Trusted Publishing/OIDC and requires owner-side setup;
do not assume it is configured or the package has been published. No `NPM_TOKEN` or GPG is needed.
`prepack` builds the library. npm packaging includes dist, README, LICENSE and package metadata;
for a known local pack with scripts otherwise disabled, use `npm pack --ignore-scripts=false`
without changing global npm configuration.

## Independent Angular adapter

`packages/angular/` publishes `@raniagus/subjects-graph-angular` independently;
it is not a subpath of the base npm package. Angular dependencies and development
tools belong only to that workspace. Build the base with `pnpm build:lib` first,
then run `pnpm --filter @raniagus/subjects-graph-angular build` and
`pnpm --filter @raniagus/subjects-graph-angular test` (TestBed, SSR, strict AOT
consumer). The adapter uses Angular 21 partial compilation. Its separate workflow
publishes only on `angular-v*` version tags, with its own package version and npm
Trusted Publishing configuration. Keep root package dependencies, exports and
`build:lib` independent of Angular.
