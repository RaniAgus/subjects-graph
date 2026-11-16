import assert from 'node:assert/strict';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();
const errors = new WeakMap();
const themes = new WeakMap();

Given('the application is loaded without PWA', async ({ page }) => {
  errors.set(page, []);
  page.on('pageerror', (error) => errors.get(page).push(error.message));
  await page.goto('/?pwa=off');
  await page.waitForFunction(
    () => window.graphApp?.graph && document.querySelector('#cy canvas'),
  );
});

When('I change the theme and reload the application', async ({ page }) => {
  const state = await page.evaluate(() => {
    const app = window.graphApp;
    const variantKey = localStorage.getItem('selectedVariant');
    const nextTheme = Object.keys(window.THEMES).find(
      (id) => id !== app.currentTheme,
    );
    const state = { variant: app.currentVariant, theme: nextTheme };
    app.onThemeChange({ target: { value: nextTheme } });
    if (
      localStorage.getItem('selectedTheme') !== nextTheme ||
      localStorage.getItem('selectedVariant') !== variantKey
    ) {
      throw new Error('Theme storage changed the variant key');
    }
    return state;
  });
  themes.set(page, state);
  await page.reload();
  await page.waitForFunction(
    () => window.graphApp?.graph && document.querySelector('#cy canvas'),
  );
});

Then(
  'the chosen theme persists without changing the variant',
  async ({ page }) => {
    const state = themes.get(page);
    assert.equal(
      await page.evaluate(() => window.graphApp.currentTheme),
      state.theme,
    );
    assert.equal(
      await page.evaluate(() => window.graphApp.currentVariant),
      state.variant,
    );
  },
);

Then(
  'the embedded library passes its existing integration checks',
  async ({ page }) => {
    await page.evaluate(() => {
      const frame = document.createElement('iframe');
      frame.id = 'library-review';
      frame.srcdoc = `<!doctype html><html><head>
      <link rel="stylesheet" href="/lib/subjects-graph/styles.css">
      <script type="importmap">{"imports":{"cytoscape":"/__cytoscape.mjs"}}</script>
      </head><body></body></html>`;
      document.body.append(frame);
    });
    const frame = await page
      .locator('#library-review')
      .elementHandle()
      .then((element) => element.contentFrame());
    await frame.waitForLoadState();
    await frame.evaluate(async (base) => {
      const check = (condition, label) => {
        if (!condition) throw new Error(label);
      };
      const { SubjectsGraph } = await import(
        base + '/lib/subjects-graph/index.js'
      );
      const data = await fetch(base + '/data.json').then((r) => r.json());
      const plan = data.variants['frba-k08'];
      const originalPlan = JSON.stringify(plan);
      const progress = { 1: 'APPROVED' };
      const host = document.createElement('div');
      host.style.cssText = 'width:600px;height:450px';
      const sibling = document.createElement('span');
      sibling.textContent = 'preserve';
      host.append(sibling);
      document.body.append(host);
      const secondHost = document.createElement('div');
      secondHost.style.cssText = 'width:500px;height:400px';
      document.body.append(secondHost);
      const first = new SubjectsGraph(host, { plan, progress });
      const second = new SubjectsGraph(secondHost, { plan });
      const cy = () => host.querySelector('.subjects-graph-surface')._cyreg.cy;
      const secondCy = () =>
        secondHost.querySelector('.subjects-graph-surface')._cyreg.cy;
      check(
        cy().nodes('[nodeType="subject"]').length === plan.subjects.length,
        'Missing subjects',
      );
      check(
        cy().getElementById('1').data('status') === 'APPROVED',
        'Initial progress not applied',
      );
      check(
        secondCy().getElementById('1').data('status') === plan.statuses[0].id,
        'Instance state leaked',
      );
      check(
        !getComputedStyle(document.documentElement).getPropertyValue(
          '--bg-primary',
        ),
        'Global CSS variables changed',
      );
      cy().zoom(1.1);
      cy().pan({ x: 23, y: 37 });
      first.setTheme({ '--fill-color-4': '#ff0000' });
      check(
        cy().getElementById('1').style('background-color') === 'rgb(255,0,0)',
        'Theme override missing',
      );
      check(
        cy().zoom() === 1.1 && cy().pan().x === 23 && cy().pan().y === 37,
        'Theme changed viewport',
      );
      first.setPlan(plan, { progress });
      check(
        cy().zoom() === 1.1 && cy().pan().x === 23 && cy().pan().y === 37,
        'Plan changed viewport',
      );
      check(
        Object.keys(first.getProgress()).length === plan.subjects.length,
        'Progress getter is incomplete',
      );
      const snapshot = first.getProgress();
      snapshot['1'] = 'PENDING';
      check(
        first.getProgress()['1'] === 'APPROVED',
        'Progress getter leaked state',
      );
      const requests = [];
      const record = (event) => requests.push(event.detail);
      first.addEventListener('statusrequest', record);
      cy().getElementById('1').emit('tap');
      await new Promise((resolve) => setTimeout(resolve, 20));
      check(
        requests.length === 1 &&
          requests[0].subjectId === '1' &&
          requests[0].nextStatusId === 'PENDING',
        'Tap request/catalog wrap failed',
      );
      check(
        first.getProgress()['1'] === 'APPROVED' &&
          cy().getElementById('1').data('status') === 'APPROVED',
        'Ignored request applied itself',
      );
      first.setProgress({ 1: 'FINAL_EXAM_PENDING', 2: 'FINAL_EXAM_PENDING' });
      check(requests.length === 1, 'Setter emitted a request');
      check(
        cy().getElementById('10').data('borderColor') === '#6e5d1c',
        'Dependent availability did not update',
      );
      let accepted = 0;
      first.addEventListener(
        'statusrequest',
        (event) => {
          accepted++;
          first.setProgress({
            ...first.getProgress(),
            [event.detail.subjectId]: event.detail.nextStatusId,
          });
        },
        { once: true },
      );
      cy().getElementById('1').emit('tap');
      await new Promise((resolve) => setTimeout(resolve, 20));
      check(
        accepted === 1 && first.getProgress()['1'] === 'APPROVED',
        'Consumer acceptance failed',
      );
      const beforeCancel = requests.length;
      cy().getElementById('1').emit('tap');
      first.setPlan(plan, { progress });
      await new Promise((resolve) => setTimeout(resolve, 20));
      check(
        requests.length === beforeCancel,
        'Plan replacement did not cancel pending tap',
      );
      first.removeEventListener('statusrequest', record);
      const abort = new AbortController();
      let abortedCalls = 0;
      first.addEventListener('statusrequest', () => abortedCalls++, {
        signal: abort.signal,
      });
      abort.abort();
      cy().getElementById('1').emit('tap');
      await new Promise((resolve) => setTimeout(resolve, 20));
      check(
        abortedCalls === 0 &&
          requests.length === beforeCancel &&
          accepted === 1,
        'Abort/remove/once listener cleanup failed',
      );
      first.setProgress({});
      check(
        first.getProgress()['1'] === plan.statuses[0].id,
        'Empty map did not reset initial progress',
      );
      first.setEditable(true);
      check(
        cy()
          .nodes()
          .every((node) => !node.locked()),
        'Editing did not unlock nodes',
      );
      const surface = host.querySelector('.subjects-graph-surface');
      check(!!surface.style.backgroundImage, 'Editing grid missing');
      cy().zoom(2);
      check(
        surface.style.backgroundSize.includes('200px'),
        'Grid did not follow zoom',
      );
      const moves = [];
      const recordMove = (event) => moves.push(event.detail);
      first.addEventListener('nodepositionrequest', recordMove);
      const initialPosition = {
        ...plan.subjects.find((subject) => subject.id === '1').position,
      };
      cy().getElementById('1').position({ x: 111, y: 222 }).emit('dragfree');
      check(
        moves.length === 1 &&
          moves[0].position.x === 111 &&
          moves[0].position.y === 222,
        'Drag request missing world position',
      );
      check(
        cy().getElementById('1').position().x === initialPosition.x,
        'Ignored drag changed authoritative position',
      );
      first.addEventListener(
        'nodepositionrequest',
        (event) => {
          const acceptedPlan = structuredClone(plan);
          acceptedPlan.subjects.find(
            (subject) => subject.id === event.detail.nodeId,
          ).position = { ...event.detail.position };
          first.setPlan(acceptedPlan, { progress: first.getProgress() });
        },
        { once: true },
      );
      cy().getElementById('1').position({ x: 333, y: 444 }).emit('dragfree');
      check(
        cy().getElementById('1').position().x === 333,
        'Accepted drag position was reverted',
      );
      first.removeEventListener('nodepositionrequest', recordMove);
      const edits = [];
      first.addEventListener('editrequest', (event) =>
        edits.push(event.detail),
      );
      let accidentalStatuses = 0;
      first.addEventListener('statusrequest', () => accidentalStatuses++);
      cy().getElementById('1').emit('tap');
      cy().getElementById('1').emit('dbltap');
      cy().getElementById(plan.edges[0].id).emit('dbltap');
      const connection = cy().edges().first();
      connection.emit({ type: 'dbltap', position: { x: 15, y: 25 } });
      cy().emit({ type: 'dbltap', position: { x: 35, y: 45 } });
      await new Promise((resolve) => setTimeout(resolve, 220));
      check(accidentalStatuses === 0, 'Double tap emitted status request');
      check(
        edits.map((edit) => edit.kind).join(',') ===
          'subject,connector,connection,background',
        'Edit request shapes/gating failed',
      );
      check(
        edits[2].sourceId === connection.data('source') &&
          edits[2].position.x === 15,
        'Connection request lost IDs/position',
      );
      first.setProgress({ 1: 'APPROVED', 2: 'APPROVED' });
      cy()
        .getElementById('10')
        .emit({ type: 'mouseover', renderedPosition: { x: 590, y: 440 } });
      const tooltip = host.querySelector('.subjects-graph-tooltip');
      check(
        tooltip.style.display === 'block' &&
          tooltip.textContent.includes('Análisis Matemático II'),
        'Subject tooltip missing',
      );
      check(
        tooltip.querySelectorAll('del').length > 0,
        'Satisfied tooltip requirements not marked',
      );
      first.setProgress({});
      check(
        tooltip.querySelectorAll('del').length === 0,
        'Tooltip did not refresh after progress change',
      );
      cy().getElementById('10').emit('mouseout');
      check(tooltip.style.display === 'none', 'Tooltip did not hide');
      first.setEditable(false);
      const editCount = edits.length;
      cy().getElementById('1').emit('dbltap');
      check(
        edits.length === editCount &&
          !surface.style.backgroundImage &&
          cy()
            .nodes()
            .every((node) => node.locked()),
        'Readonly mode retained editing behavior',
      );
      check(
        getComputedStyle(secondHost.querySelector('.subjects-graph-surface'))
          .backgroundColor === 'rgb(6, 11, 20)',
        'Default Dark not applied locally',
      );
      const png = await first.exportPNG({ scale: 1, full: false });
      check(
        png instanceof Blob && png.type === 'image/png' && png.size > 0,
        'PNG export failed',
      );
      const beforeWidth = cy().width();
      host.style.width = '720px';
      await new Promise((resolve) => setTimeout(resolve, 150));
      check(
        cy().width() > beforeWidth,
        'ResizeObserver did not resize Cytoscape',
      );
      check(
        JSON.stringify(plan) === originalPlan &&
          JSON.stringify(progress) === '{"1":"APPROVED"}',
        'Caller data mutated',
      );
      const oldCy = cy();
      const totalSubjects = oldCy.nodes('[nodeType="subject"]').length;
      first.destroy();
      first.destroy();
      second.destroy();
      check(
        oldCy.destroyed() && !host.querySelector('.subjects-graph'),
        'Renderer resources remain',
      );
      check(host.contains(sibling), 'Host sibling removed');
      return {
        subjects: totalSubjects,
        pngBytes: png.size,
        resize: true,
        isolatedTheme: true,
        preservedViewport: true,
        controlledProgress: true,
        editing: true,
        tooltips: true,
        destroy: true,
      };
    }, new URL(page.url()).origin);
  },
);

Then(
  'the application passes its existing progress and editing checks',
  async ({ page }) => {
    await page.evaluate(async () => {
      const app = window.graphApp;
      const check = (condition, label) => {
        if (!condition) throw new Error(label);
      };
      const waitFor = async (condition, label) => {
        for (let attempt = 0; attempt < 200; attempt++) {
          if (condition()) return;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error(label);
      };
      const cy = () =>
        document.querySelector('#cy .subjects-graph-surface')._cyreg.cy;
      check(
        !('cy' in app) && typeof app.graph.getProgress === 'function',
        'Web still uses raw renderer',
      );
      const keys = [
        'selectedVariant',
        'selectedTheme',
        'customVariant',
        'graphStatus-frba-k08',
        'graphStatus-frba-k23',
        'graphStatus-custom',
      ];
      const saved = Object.fromEntries(
        keys.map((key) => [key, localStorage.getItem(key)]),
      );
      const originalConfirm = window.confirm,
        originalAlert = window.alert;
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      const originalInputClick = HTMLInputElement.prototype.click;
      const downloads = [],
        alerts = [];
      let importPayload;
      window.confirm = () => true;
      window.alert = (message) => alerts.push(message);
      HTMLAnchorElement.prototype.click = function () {
        if (this.href.startsWith('blob:'))
          downloads.push({
            name: this.download,
            blob: fetch(this.href).then((response) => response.blob()),
          });
        else originalAnchorClick.call(this);
      };
      HTMLInputElement.prototype.click = function () {
        if (this.type !== 'file') return originalInputClick.call(this);
        const transfer = new DataTransfer();
        transfer.items.add(
          new File([JSON.stringify(importPayload)], 'integration.json', {
            type: 'application/json',
          }),
        );
        this.files = transfer.files;
        this.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const selectVariant = (id) => {
        const select = document.getElementById('variant-select');
        select.value = id;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const saveEditor = (data) => {
        const textarea = document.getElementById('node-editor-textarea');
        textarea.value = JSON.stringify(data);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('node-editor-save').click();
      };
      try {
        selectVariant('frba-k08');
        const firstId = app.getVariantData().subjects[0].id;
        const catalog = app.getVariantData().statuses;
        const currentIndex = catalog.findIndex(
          (status) => status.id === app.graph.getProgress()[firstId],
        );
        const expected = catalog[(currentIndex + 1) % catalog.length].id;
        cy().getElementById(firstId).emit('tap');
        await waitFor(
          () => app.graph.getProgress()[firstId] === expected,
          'User status request not accepted',
        );
        check(
          app.progress[firstId] === expected &&
            JSON.parse(localStorage.getItem(app.getStorageKey()))[firstId] ===
              expected,
          'Progress not persisted by host',
        );
        document.getElementById('export-btn').click();
        check(downloads.length === 1, 'Progress export missing');
        const progressExport = JSON.parse(
          await (await downloads[0].blob).text(),
        );
        check(
          progressExport.variant === 'frba-k08' &&
            progressExport.statuses[firstId] === expected,
          'Progress wire format changed',
        );
        importPayload = {
          variant: 'frba-k08',
          statuses: { [firstId]: catalog.at(-1).id },
        };
        document.getElementById('import-btn').click();
        await waitFor(
          () => app.graph.getProgress()[firstId] === catalog.at(-1).id,
          'Progress import failed',
        );
        document.getElementById('reset-btn').click();
        check(
          app.graph.getProgress()[firstId] === catalog[0].id &&
            document.getElementById('reset-btn').disabled,
          'Progress reset failed',
        );
        document.getElementById('screenshot-btn').click();
        await waitFor(
          () => downloads.some((download) => download.name.endsWith('.png')),
          'Screenshot download missing',
        );
        const screenshot = await downloads.find((download) =>
          download.name.endsWith('.png'),
        ).blob;
        check(
          screenshot.type === 'image/png' && screenshot.size > 0,
          'Screenshot composition failed',
        );
        localStorage.removeItem('customVariant');
        localStorage.removeItem('graphStatus-custom');
        app.customVariantData = null;
        selectVariant('custom');
        check(
          app.isCustomVariant &&
            app.isEditMode &&
            document.querySelector('.subjects-graph-gauge text').textContent ===
              '0%',
          'Empty custom plan failed',
        );
        app.customVariantData.subjects = [];
        app.graph.setPlan(app.customVariantData);
        for (const [id, x] of [
          ['1', 100],
          ['2', 300],
        ]) {
          cy().emit({ type: 'dbltap', position: { x, y: 100 } });
          check(
            app.isCreatingNode && app.editingNodeType === 'subject',
            'Background request did not open editor',
          );
          const subject = JSON.parse(
            document.getElementById('node-editor-textarea').value,
          );
          Object.assign(subject, {
            id,
            name: 'Integration subject ' + id,
            shortName: 'I' + id,
            position: { x, y: 100 },
          });
          if (id === '2')
            subject.prerequisites = [
              {
                availabilityId: app.customVariantData.availabilities[1].id,
                dependencies: [
                  {
                    statusId: app.customVariantData.statuses.at(-1).id,
                    subjects: ['1'],
                  },
                ],
              },
            ];
          saveEditor(subject);
        }
        check(
          app.customVariantData.subjects.length === 2 &&
            JSON.parse(localStorage.getItem('customVariant')).subjects
              .length === 2,
          'Subject creation not persisted',
        );
        cy().getElementById('1').emit('dbltap');
        check(app.editingNodeId === '1', 'Subject request did not open editor');
        const edited = JSON.parse(
          document.getElementById('node-editor-textarea').value,
        );
        edited.name = 'Renamed integration subject';
        saveEditor(edited);
        cy().zoom(1.2);
        cy().pan({ x: 31, y: 47 });
        cy()
          .getElementById('1')
          .position({ x: 123.45, y: 222.6 })
          .emit('dragfree');
        check(
          app.customVariantData.subjects[0].position.x === 123 &&
            app.customVariantData.subjects[0].position.y === 223,
          'Drag not rounded/persisted by host',
        );
        check(
          cy().getElementById('1').position().x === 123 &&
            cy().zoom() === 1.2 &&
            cy().pan().x === 31,
          'Accepted drag changed viewport or reverted',
        );
        cy()
          .edges()
          .first()
          .emit({ type: 'dbltap', position: { x: 200, y: 150 } });
        check(
          app.isCreatingNode && app.editingNodeType === 'edge',
          'Connection request did not open editor',
        );
        saveEditor(
          JSON.parse(document.getElementById('node-editor-textarea').value),
        );
        check(
          app.customVariantData.edges.length === 1,
          'Connector creation failed',
        );
        cy().getElementById(app.customVariantData.edges[0].id).emit('dbltap');
        check(
          app.editingNodeType === 'edge',
          'Connector request did not open editor',
        );
        app.closeNodeEditor();
        document.getElementById('round-positions-btn').click();
        check(
          app.customVariantData.subjects[0].position.x === 100 &&
            app.customVariantData.subjects[0].position.y === 200,
          'Position rounding failed',
        );
        document.getElementById('export-btn').click();
        const planDownload = downloads.find(
          (download) => download.name === 'custom-plan.json',
        );
        check(!!planDownload, 'Custom plan export missing');
        const planExport = JSON.parse(await (await planDownload.blob).text());
        check(
          planExport.subjects.length === 2 && planExport.edges.length === 1,
          'Custom plan export changed shape',
        );
        importPayload = { ...planExport, name: 'Imported integration plan' };
        document.getElementById('import-btn').click();
        await waitFor(
          () => app.customVariantData.name === importPayload.name,
          'Custom plan import failed',
        );
        cy().getElementById('2').emit('dbltap');
        document.getElementById('node-editor-delete').click();
        check(
          !app.customVariantData.subjects.some((subject) => subject.id === '2'),
          'Subject deletion failed',
        );
        document.getElementById('delete-plan-btn').click();
        check(
          !app.isCustomVariant &&
            app.currentVariant === app.appData.defaultVariant &&
            !localStorage.getItem('customVariant'),
          'Custom plan deletion failed',
        );
        check(
          !alerts.some((message) => message.toLowerCase().includes('error')),
          'UI reported errors: ' + alerts.join('; '),
        );
        return {
          progressRoundtrip: true,
          customPlanCrud: true,
          editorRequests: true,
          dragAcceptance: true,
          screenshotBytes: screenshot.size,
          downloads: downloads.map((download) => download.name),
        };
      } finally {
        window.confirm = originalConfirm;
        window.alert = originalAlert;
        HTMLAnchorElement.prototype.click = originalAnchorClick;
        HTMLInputElement.prototype.click = originalInputClick;
        for (const [key, value] of Object.entries(saved))
          value === null
            ? localStorage.removeItem(key)
            : localStorage.setItem(key, value);
      }
    });
  },
);

Then('no browser exceptions occurred', async ({ page }) => {
  assert.deepEqual(errors.get(page), []);
});
