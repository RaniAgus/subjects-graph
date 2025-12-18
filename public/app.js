import cytoscape from 'https://unpkg.com/cytoscape@3.33.1/dist/cytoscape.esm.mjs';
import { Graph } from './components/graph.js';
import {
  EventBus,
  Storage,
  VariantSelector,
  ThemeSelector,
  ProgressGauge,
  Legend,
  ScreenshotExporter,
  DataExporter,
  DataImporter,
  CytoscapeRenderer,
} from './components/index.js';

/**
 * Adapter that converts Graph render calls to Cytoscape elements.
 */
class CytoscapeDrawer {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.positions = new Set();
  }

  drawCircle({ id, label, tooltip, position: { x, y }, fillColor, borderColor, textColor }) {
    this.nodes.push({
      data: { id, label, name: tooltip, nodeType: 'subject', fillColor, borderColor, textColor },
      position: { x, y },
      locked: true,
    });
    this.#addPosition({ x, y });
  }

  drawDiamond({ id, position: { x, y }, borderColor }) {
    this.nodes.push({
      data: { id, nodeType: 'connector', isInvisible: false, borderColor },
      position: { x, y },
      locked: true,
    });
    this.#addPosition({ x, y });
  }

  drawEdge({ id, position: { x, y } }) {
    this.nodes.push({
      data: {
        id,
        nodeType: 'connector',
        isInvisible: true,
        withGap: this.#hasPosition({ x, y }),
        borderColor: '#FFFFFF',
      },
      position: { x, y },
      locked: true,
    });
    this.#addPosition({ x, y });
  }

  drawArrow({ id, from, to, color }) {
    const fromNode = this.nodes.find(n => n.data.id === from);
    const toNode = this.nodes.find(n => n.data.id === to);
    if (!fromNode || !toNode) {
      console.warn(`Edge ${id} has invalid nodes: from=${from}, to=${to}`);
      return;
    }
    this.edges.push({
      data: { id, source: from, target: to, toInvisible: toNode.data.isInvisible ?? false, color },
    });
  }

  getElements() {
    return { nodes: this.nodes, edges: this.edges };
  }

  #addPosition({ x, y }) {
    this.positions.add(`${x},${y}`);
  }

  #hasPosition({ x, y }) {
    return this.positions.has(`${x},${y}`);
  }
}

/**
 * Main application coordinator.
 * Wires up components and manages event flow.
 */
class GraphApp {
  #eventBus;
  #storage;
  #variantSelector;
  #themeSelector;
  #progressGauge;
  #legend;
  #renderer;
  #screenshotExporter;
  #dataExporter;
  #dataImporter;

  #appData = null;
  #graph = null;
  #config = null;

  constructor() {
    this.#eventBus = new EventBus();
    this.#storage = new Storage();

    this.#variantSelector = new VariantSelector({
      element: document.getElementById('variant-select'),
      storage: this.#storage,
      eventBus: this.#eventBus,
    });

    this.#themeSelector = new ThemeSelector({
      element: document.getElementById('theme-select'),
      storage: this.#storage,
      eventBus: this.#eventBus,
    });

    this.#progressGauge = new ProgressGauge({
      percentageEl: document.getElementById('progress-percentage'),
      pendingTextEl: document.getElementById('progress-pending-text'),
      approvedCircle: document.getElementById('progress-approved'),
      pendingCircle: document.getElementById('progress-pending'),
    });

    this.#legend = new Legend({
      statusContainer: document.getElementById('status-legend'),
      borderContainer: document.getElementById('border-legend'),
      wrapperEl: document.querySelector('.legend-items'),
    });

    this.#renderer = new CytoscapeRenderer({
      cytoscape,
      container: document.getElementById('cy'),
      eventBus: this.#eventBus,
    });

    this.#setupEventListeners();
  }

  #setupEventListeners() {
    // React to component events
    this.#eventBus.on('variant:changed', () => this.#renderGraph());
    this.#eventBus.on('theme:changed', () => this.#renderGraph());
    this.#eventBus.on('node:tapped', ({ nodeId }) => this.#onNodeTapped(nodeId));
    this.#eventBus.on('data:imported', () => this.#renderGraph());

    // Button event listeners
    document.getElementById('reset-btn')?.addEventListener('click', () => this.#reset());
    document.getElementById('fit-btn')?.addEventListener('click', () => this.#renderer.fit());

    // PWA install prompt
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferredPrompt = e;
    });
  }

  async connect() {
    await this.#loadAppData();
    this.#initComponents();
    this.#renderGraph();
    this.#registerServiceWorker();
    lucide.createIcons();
  }

  async #loadAppData() {
    try {
      const response = await fetch('data.json');
      this.#appData = await response.json();
    } catch (err) {
      console.error('Error loading data.json:', err);
    }
  }

  #initComponents() {
    // Initialize variant selector
    this.#variantSelector.init(this.#appData.variants, this.#appData.defaultVariant);
    document.querySelectorAll('.header-skeleton').forEach(el => el.style.display = 'none');

    // Initialize theme selector
    this.#themeSelector.init(window.THEMES, window.DEFAULT_THEME);

    // Initialize data export/import
    this.#dataExporter = new DataExporter({
      button: document.getElementById('export-btn'),
      getStatuses: () => this.#loadStatuses(),
      getVariant: () => this.#variantSelector.current,
    });

    this.#dataImporter = new DataImporter({
      button: document.getElementById('import-btn'),
      eventBus: this.#eventBus,
      saveStatuses: (statuses) => this.#saveStatusesToStorage(statuses),
    });

    // Initialize screenshot exporter
    this.#screenshotExporter = new ScreenshotExporter({
      button: document.getElementById('screenshot-btn'),
      getCanvasImage: () => this.#renderer.png(),
      getProgress: () => ({
        approved: this.#progressGauge.getApprovedPercent(),
        pending: this.#progressGauge.getPendingPercent(),
      }),
      getColors: () => this.#themeSelector.getColors(),
      getVariant: () => this.#variantSelector.current,
    });
  }

  #renderGraph() {
    const variantData = this.#variantSelector.getData();
    this.#config = this.#buildConfig(variantData);
    this.#legend.render(this.#config);

    const savedStatuses = this.#loadStatuses();
    const defaultStatus = this.#config.statuses[0].id;
    const subjects = variantData.subjects.map(s => ({
      ...s,
      status: savedStatuses[s.id] || s.status || defaultStatus,
    }));

    this.#graph = new Graph(this.#config, subjects, variantData.edges);
    const drawer = new CytoscapeDrawer();
    this.#graph.render(drawer);
    this.#renderer.init(drawer.getElements());
    this.#updateProgress();
  }

  #buildConfig(variantData) {
    return {
      statuses: variantData.statuses.map(s => ({
        ...s,
        color: this.#themeSelector.resolveColor(s.color),
        textColor: this.#themeSelector.resolveColor(s.textColor),
        leafTextColor: s.leafTextColor ? this.#themeSelector.resolveColor(s.leafTextColor) : null,
      })),
      availabilities: variantData.availabilities.map(a => ({
        ...a,
        color: this.#themeSelector.resolveColor(a.color),
      })),
    };
  }

  #onNodeTapped(nodeId) {
    this.#graph.toggleStatus(nodeId);
    this.#reRenderGraph();
    this.#saveStatuses();
  }

  #reRenderGraph() {
    const drawer = new CytoscapeDrawer();
    this.#graph.render(drawer);
    this.#renderer.updateElements(drawer.getElements());
    this.#updateProgress();
  }

  #updateProgress() {
    const statusBySubject = this.#graph.getStatusBySubject();
    const totalSubjects = Object.keys(statusBySubject).length;

    // Approved = last status, Pending = last two statuses
    const counts = Object.groupBy(Object.values(statusBySubject), status => status);
    const approvedCount = counts[this.#config.statuses.at(-1)?.id]?.length ?? 0;
    const pendingCount = counts[this.#config.statuses.at(-2)?.id]?.length ?? 0;

    const approvedPercent = Math.round((approvedCount / totalSubjects) * 100);
    const pendingPercent = Math.round(((approvedCount + pendingCount) / totalSubjects) * 100);
    this.#progressGauge.update(approvedPercent, pendingPercent);
  }

  #getStorageKey() {
    return `graphStatus-${this.#variantSelector.current}`;
  }

  #loadStatuses() {
    const saved = this.#storage.get(this.#getStorageKey());
    return saved ? JSON.parse(saved) : {};
  }

  #saveStatuses() {
    this.#saveStatusesToStorage(this.#graph.getStatusBySubject());
  }

  #saveStatusesToStorage(statuses) {
    this.#storage.set(this.#getStorageKey(), JSON.stringify(statuses));
  }

  #reset() {
    this.#storage.remove(this.#getStorageKey());
    this.#renderGraph();
  }

  async #registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.graphApp = new GraphApp();
  window.graphApp.connect();
});
