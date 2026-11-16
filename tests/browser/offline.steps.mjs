import assert from 'node:assert/strict';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();
const runs = new WeakMap();

async function navigate(page, url) {
  await page.goto(url);
  await page.waitForFunction(
    () => window.graphApp?.graph && document.querySelector('#cy canvas'),
  );
}

Given(
  'the subdirectory application is loaded with PWA disabled',
  async ({ page }) => {
    const run = { errors: [] };
    runs.set(page, run);
    page.on('pageerror', (error) => run.errors.push(error.message));
    await navigate(page, '/subjects-graph/?pwa=off');
  },
);

Then(
  'no service worker is registered and the graph is visible',
  async ({ page }) => {
    assert.equal(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistrations()).length,
      ),
      0,
    );
    assert(
      await page.evaluate(
        () =>
          window.graphApp.graph.getProgress() &&
          document.querySelector('.subjects-graph-surface').clientHeight > 0,
      ),
    );
  },
);

When(
  'I open the subdirectory application with PWA enabled',
  async ({ page }) => {
    await navigate(page, '/subjects-graph/');
  },
);

Then(
  'the service worker activates and precaches the library',
  async ({ page }) => {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const cache = await caches.open(
        keys.find((key) => key.startsWith('subjects-graph-cache-')),
      );
      return (await cache.keys()).map((request) => request.url);
    });
    const base = new URL('/subjects-graph/', page.url()).href;
    const modules = [
      'index.js',
      'subjects-graph.js',
      'core.js',
      'cytoscape-drawer.js',
      'cytoscape-styles.js',
      'theme.js',
      'styles.css',
    ];
    for (const file of modules) {
      assert(
        cached.includes(base + 'lib/subjects-graph/' + file),
        'Missing precache ' + file + ': ' + JSON.stringify({ base, cached }),
      );
    }
  },
);

When(
  'I change a subject status and navigate offline',
  async ({ page, context }) => {
    runs.get(page).progress = await page.evaluate(async () => {
      const app = window.graphApp;
      const id = app.getVariantData().subjects[0].id;
      document
        .querySelector('.subjects-graph-surface')
        ._cyreg.cy.getElementById(id)
        .emit('tap');
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        id,
        status: app.graph.getProgress()[id],
        variant: app.currentVariant,
      };
    });
    await context.setOffline(true);
    await navigate(page, '/subjects-graph/?offline-review=1');
  },
);

Then(
  'the selected variant and subject progress are retained offline',
  async ({ page }) => {
    const progress = runs.get(page).progress;
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    assert.equal(
      await page.evaluate(() => window.graphApp.currentVariant),
      progress.variant,
    );
    assert.equal(
      await page.evaluate(
        (id) => window.graphApp.graph.getProgress()[id],
        progress.id,
      ),
      progress.status,
    );
  },
);

Then('the offline run has no browser exceptions', async ({ page }) => {
  assert.deepEqual(runs.get(page).errors, []);
});
