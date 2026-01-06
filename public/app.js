import cytoscape from 'https://unpkg.com/cytoscape@3.33.1/dist/cytoscape.esm.mjs';
import { Graph } from "./graph.js";

class CytoscapeDrawer {
  constructor(draggable = false) {
    this.nodes = [];
    this.edges = [];
    this.positions = new Set();
    this.draggable = draggable;
  }
  drawCircle({ id, label, tooltip, position: { x, y }, fillColor, borderColor, textColor, status }) {
    this.nodes.push({
      data: {
        id,
        label,
        name: tooltip,
        nodeType: 'subject',
        status,
        fillColor,
        borderColor,
        textColor,
      },
      position: { x, y },
      locked: !this.draggable,
    });
    this.#addPosition({ x, y });
  }
  drawDiamond({ id, position: { x, y }, borderColor }) {
    this.nodes.push({
      data: {
        id,
        nodeType: 'connector',
        isInvisible: false,
        borderColor,
      },
      position: { x, y },
      locked: !this.draggable,
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
      locked: !this.draggable,
    });
    this.#addPosition({ x, y });
  }
  drawArrow({ id, from, to, color }) {
    const fromNode = this.nodes.find(n => n.data.id === from);
    if (!fromNode) {
      console.warn(`Edge ${id} has invalid from node ${from}`);
      return;
    }
    const toNode = this.nodes.find(n => n.data.id === to);
    if (!toNode) {
      console.warn(`Edge ${id} has invalid to node ${to}`);
      return;
    }
    this.edges.push({
      data: {
        id,
        source: from,
        target: to,
        toInvisible: toNode.data.isInvisible ?? false,
        color,
      },
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

class GraphApp {

  constructor() {
    // DOM element references
    this.variantSelect = document.getElementById('variant-select');
    this.themeSelect = document.getElementById('theme-select');
    this.resetBtn = document.getElementById('reset-btn');
    this.fitBtn = document.getElementById('fit-btn');
    this.editModeBtn = document.getElementById('edit-mode-btn');
    this.exportBtn = document.getElementById('export-btn');
    this.importBtn = document.getElementById('import-btn');
    this.screenshotBtn = document.getElementById('screenshot-btn');
    this.statusLegend = document.getElementById('status-legend');
    this.borderLegend = document.getElementById('border-legend');
    this.progressPercentage = document.getElementById('progress-percentage');
    this.progressPendingText = document.getElementById('progress-pending-text');
    this.legendItems = document.querySelector('.legend-items');
    this.cyContainer = document.getElementById('cy');
    this.progressApproved = document.getElementById('progress-approved');
    this.progressPending = document.getElementById('progress-pending');

    // State
    this.cy = null;
    this.graph = null;
    this.appData = null;
    this.currentVariant = null;
    this.currentTheme = null;
    this.config = null;
    this.themeColors = null;
    this.isCustomVariant = false;
    this.isEditMode = false;
    this.VARIANT_STORAGE_KEY = 'selectedVariant';
    this.VARIANT_PARAM = 'variant';
    this.THEME_STORAGE_KEY = 'selectedTheme';
    this.CUSTOM_VARIANT_KEY = 'customVariant';
    this.CUSTOM_VARIANT_ID = 'custom';
  }

  connect() {
    this.initEventListeners();
    this.init();
  }

  initEventListeners() {
    this.variantSelect.addEventListener('change', this.onVariantChange.bind(this));
    this.themeSelect.addEventListener('change', this.onThemeChange.bind(this));
    this.resetBtn.addEventListener('click', this.reset.bind(this));
    this.fitBtn.addEventListener('click', this.fit.bind(this));
    this.editModeBtn.addEventListener('click', this.toggleEditMode.bind(this));
    this.exportBtn.addEventListener('click', this.export.bind(this));
    this.importBtn.addEventListener('click', this.import.bind(this));
    this.screenshotBtn.addEventListener('click', this.screenshot.bind(this));
    window.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt.bind(this));
  }

  async init() {
    try {
      const response = await fetch('data.json');
      this.appData = await response.json();
    } catch (err) {
      console.error('Error loading data.json:', err);
      return;
    }

    // Load custom variant from storage if exists
    this.loadCustomVariant();

    if (this.variantSelect) {
      this.variantSelect.innerHTML = '';
      Object.entries(this.appData.variants).forEach(([id, variant]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = variant.name;
        this.variantSelect.appendChild(option);
      });

      // Add custom plan option
      const customOption = document.createElement('option');
      customOption.value = this.CUSTOM_VARIANT_ID;
      customOption.textContent = '📝 Plan Personalizado';
      this.variantSelect.appendChild(customOption);

      const variantInStorage = localStorage.getItem(this.VARIANT_STORAGE_KEY);
      // Check if stored variant is custom or a valid variant
      if (variantInStorage === this.CUSTOM_VARIANT_ID) {
        this.currentVariant = this.CUSTOM_VARIANT_ID;
        this.isCustomVariant = true;
      } else {
        this.currentVariant = (variantInStorage && this.appData.variants[variantInStorage])
          ? variantInStorage
          : this.appData.defaultVariant;
      }
      this.variantSelect.value = this.currentVariant;
      this.variantSelect.classList.remove('skeleton');
      this.variantSelect.style.display = 'block';
    }

    document.querySelectorAll('.header-skeleton').forEach(el => el.style.display = 'none');


    const savedTheme = localStorage.getItem(this.THEME_STORAGE_KEY);
    this.currentTheme = (savedTheme && window.THEMES[savedTheme])
      ? savedTheme
      : window.DEFAULT_THEME;

    const theme = window.THEMES[this.currentTheme];
    this.themeColors = theme?.colors ?? {};

    if (this.themeSelect) {
      this.themeSelect.innerHTML = '';
      Object.entries(window.THEMES).forEach(([id, theme]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = theme.name;
        this.themeSelect.appendChild(option);
      });
      this.themeSelect.value = this.currentTheme;
      this.themeSelect.style.display = 'block';
    }

    const variantData = this.appData.variants[this.currentVariant];

    this.config = {
      statuses: variantData.statuses.map(s => ({
        ...s,
        color: this.resolveCssColor(s.color),
        textColor: this.resolveCssColor(s.textColor),
        leafTextColor: s.leafTextColor ? this.resolveCssColor(s.leafTextColor) : null,
      })),
      availabilities: variantData.availabilities.map(a => ({ ...a, color: this.resolveCssColor(a.color) })),
    };

    this.generateLegend();

    if (this.legendItems) {
      this.legendItems.classList.remove('skeleton');
    }

    this.renderGraph();
    this.updateEditModeUI();
    this.registerServiceWorker();
    lucide.createIcons();
  }

  renderGraph() {
    const variantData = this.getVariantData();
    if (!variantData) {
      console.error('No variant data found');
      return;
    }
    this.config = {
      statuses: variantData.statuses.map(s => ({
        ...s,
        color: this.resolveCssColor(s.color),
        textColor: this.resolveCssColor(s.textColor),
        leafTextColor: s.leafTextColor ? this.resolveCssColor(s.leafTextColor) : null,
      })),
      availabilities: variantData.availabilities.map(a => ({ ...a, color: this.resolveCssColor(a.color) })),
    };
    this.generateLegend();
    const savedStatuses = this.loadStatuses();
    const defaultStatus = this.config.statuses[0].id;
    const subjects = variantData.subjects.map(s => ({
      ...s,
      status: savedStatuses[s.id] || s.status || defaultStatus,
    }));
    this.graph = new Graph(this.config, subjects, variantData.edges);
    const drawer = new CytoscapeDrawer(this.isEditMode);
    this.graph.render(drawer);
    this.initCytoscape(drawer.getElements());
  }

  /**
   * Get variant data for current variant (handles custom variant)
   */
  getVariantData() {
    if (this.currentVariant === this.CUSTOM_VARIANT_ID) {
      if (!this.appData.variants[this.CUSTOM_VARIANT_ID]) {
        this.initializeCustomVariant();
      }
      return this.appData.variants[this.CUSTOM_VARIANT_ID];
    }
    return this.appData.variants[this.currentVariant];
  }

  onVariantChange(e) {
    const newVariant = e.target.value;
    if (newVariant === this.CUSTOM_VARIANT_ID) {
      this.currentVariant = this.CUSTOM_VARIANT_ID;
      this.isCustomVariant = true;
      this.isEditMode = false; // Start with edit mode off
      localStorage.setItem(this.VARIANT_STORAGE_KEY, this.CUSTOM_VARIANT_ID);
      // Initialize custom variant if it doesn't exist
      if (!this.appData.variants[this.CUSTOM_VARIANT_ID]) {
        this.initializeCustomVariant();
      }
      this.renderGraph();
      this.updateEditModeUI();
    } else if (this.appData.variants[newVariant]) {
      this.currentVariant = newVariant;
      this.isCustomVariant = false;
      this.isEditMode = false;
      localStorage.setItem(this.VARIANT_STORAGE_KEY, newVariant);
      this.renderGraph();
      this.updateEditModeUI();
    }
  }

  toggleEditMode() {
    if (!this.isCustomVariant) return;
    this.isEditMode = !this.isEditMode;
    this.renderGraph();
    this.updateEditModeUI();
  }

  onThemeChange(e) {
    const newThemeId = e.target.value;
    const newTheme = window.THEMES[newThemeId];
    if (newTheme) {
      this.currentTheme = newThemeId;
      this.themeColors = newTheme.colors;
      this.applyTheme(newTheme);
      localStorage.setItem(this.VARIANT_STORAGE_KEY, newThemeId);
      this.renderGraph();
    }
  }

  /**
   * Load custom variant from localStorage into appData
   */
  loadCustomVariant() {
    const saved = localStorage.getItem(this.CUSTOM_VARIANT_KEY);
    if (saved) {
      try {
        const customVariant = JSON.parse(saved);
        this.appData.variants[this.CUSTOM_VARIANT_ID] = customVariant;
      } catch (err) {
        console.error('Error loading custom variant:', err);
      }
    }
  }

  /**
   * Initialize custom variant from the default variant
   */
  initializeCustomVariant() {
    const defaultVariant = this.appData.variants[this.appData.defaultVariant];
    const customVariant = JSON.parse(JSON.stringify(defaultVariant)); // Deep clone
    customVariant.name = 'Variante Personalizada';
    this.appData.variants[this.CUSTOM_VARIANT_ID] = customVariant;
    this.saveCustomVariant();
  }

  /**
   * Save custom variant to localStorage
   */
  saveCustomVariant() {
    const customVariant = this.appData.variants[this.CUSTOM_VARIANT_ID];
    if (customVariant) {
      localStorage.setItem(this.CUSTOM_VARIANT_KEY, JSON.stringify(customVariant));
    }
  }

  /**
   * Update UI elements based on edit mode state
   */
  updateEditModeUI() {
    // Show/hide edit mode button based on whether we're on custom variant
    if (this.isCustomVariant) {
      this.editModeBtn.style.display = 'flex';
      if (this.isEditMode) {
        this.editModeBtn.classList.add('active');
        this.editModeBtn.title = 'Desactivar Modo Edición';
        this.exportBtn.innerHTML = '<i data-lucide="upload"></i> Exportar Plan';
        this.importBtn.innerHTML = '<i data-lucide="download"></i> Importar Plan';
        this.exportBtn.title = 'Exportar Plan Personalizado';
        this.importBtn.title = 'Importar Plan Personalizado';
        this.cyContainer.classList.add('edit-mode');
      } else {
        this.editModeBtn.classList.remove('active');
        this.editModeBtn.title = 'Activar Modo Edición';
        this.exportBtn.innerHTML = '<i data-lucide="upload"></i> Exportar';
        this.importBtn.innerHTML = '<i data-lucide="download"></i> Importar';
        this.exportBtn.title = 'Exportar Progreso';
        this.importBtn.title = 'Importar Progreso';
        this.cyContainer.classList.remove('edit-mode');
      }
    } else {
      this.editModeBtn.style.display = 'none';
      this.exportBtn.innerHTML = '<i data-lucide="upload"></i> Exportar';
      this.importBtn.innerHTML = '<i data-lucide="download"></i> Importar';
      this.exportBtn.title = 'Exportar Progreso';
      this.importBtn.title = 'Importar Progreso';
      this.cyContainer.classList.remove('edit-mode');
    }
    lucide.createIcons();
  }

  /**
   * Update node position in custom variant and save
   */
  updateNodePosition(nodeId, position) {
    if (!this.isEditMode) return;

    const customVariant = this.appData.variants[this.CUSTOM_VARIANT_ID];
    if (!customVariant) return;

    // Update subject position
    const subject = customVariant.subjects.find(s => s.id === nodeId);
    if (subject) {
      subject.position = { x: Math.round(position.x), y: Math.round(position.y) };
      this.saveCustomVariant();
      return;
    }

    // Update edge (connector) position
    const edge = customVariant.edges.find(e => e.id === nodeId);
    if (edge) {
      edge.position = { x: Math.round(position.x), y: Math.round(position.y) };
      this.saveCustomVariant();
    }
  }

  resolveCssColor(varName) {
    return this.themeColors?.[varName] ?? '#000000';
  }

  applyTheme(theme) {
    if (!theme?.colors) return;
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([varName, value]) => {
      root.style.setProperty(varName, value);
    });
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme && theme.colors['--bg-primary']) {
      metaTheme.content = theme.colors['--bg-primary'];
    }
  }

  getStorageKey() {
    return `graphStatus-${this.currentVariant}`;
  }

  loadStatuses() {
    const saved = localStorage.getItem(this.getStorageKey());
    return saved ? JSON.parse(saved) : {};
  }

  saveStatuses() {
    const statuses = {};
    const defaultStatus = this.config.statuses[0].id;
    this.cy.nodes('[nodeType="subject"]').forEach(node => {
      const status = node.data('status');
      if (status !== defaultStatus) {
        statuses[node.id()] = status;
      }
    });
    localStorage.setItem(this.getStorageKey(), JSON.stringify(statuses));
  }

  generateLegend() {
    if (!this.statusLegend || !this.borderLegend) return;
    this.statusLegend.innerHTML = '';
    this.borderLegend.innerHTML = '';
    this.config.statuses.forEach(status => {
      if (status.name) {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
          <div class="legend-color" style="background: ${status.color}"></div>
          <span>${status.name}</span>
        `;
        this.statusLegend.appendChild(item);
      }
    });
    this.config.availabilities.forEach(avail => {
      if (avail.name) {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
          <div class="legend-color legend-border" style="border-color: ${avail.color}"></div>
          <span>${avail.name}</span>
        `;
        this.borderLegend.appendChild(item);
      }
    });
  }

  initCytoscape(elements) {
    this.cy = cytoscape({
      container: this.cyContainer,
      elements: elements,
      style: this.buildStylesheet(),
      layout: {
        name: 'preset',
        fit: true,
        padding: 50
      },
      minZoom: 0.3,
      maxZoom: 3,
    });
    this.updateProgress();
    this.cy.on('tap', 'node[nodeType="subject"]', evt => {
      const node = evt.target;
      this.graph.toggleStatus(node.id());
      this.reRenderGraph();
      this.saveStatuses();
    });

    // Drag event for edit mode - update positions
    if (this.isEditMode) {
      this.cy.on('dragfree', 'node', evt => {
        const node = evt.target;
        const position = node.position();
        this.updateNodePosition(node.id(), position);
      });
    }

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'cy-tooltip';
    this.cyContainer.appendChild(tooltip);
    this.cy.on('mouseover', 'node[nodeType="subject"]', e => {
      this.cyContainer.style.cursor = this.isEditMode ? 'move' : 'pointer';
      tooltip.textContent = e.target.data('name');
      tooltip.style.display = 'block';
    });
    this.cy.on('mousemove', 'node[nodeType="subject"]', e => {
      const pos = e.renderedPosition;
      tooltip.style.left = (pos.x + 15) + 'px';
      tooltip.style.top = (pos.y + 15) + 'px';
    });
    this.cy.on('mouseout', 'node', () => {
      this.cyContainer.style.cursor = this.isEditMode ? 'move' : 'grab';
      tooltip.style.display = 'none';
    });
  }

  buildStylesheet() {
    return [
      {
        selector: 'node[nodeType="subject"]',
        style: {
          'width': 60,
          'height': 60,
          'shape': 'ellipse',
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': 'data(textColor)',
          'font-size': '16px',
          'font-weight': 'bold',
          'font-family': 'Open Sans, -apple-system, BlinkMacSystemFont, sans-serif',
          'border-width': 4,
          'border-opacity': 1,
          'background-color': 'data(fillColor)',
          'border-color': 'data(borderColor)',
          'transition-property': 'background-color, border-color',
          'transition-duration': '0.3s'
        }
      },
      {
        selector: 'node[nodeType="connector"]',
        style: {
          'width': 15,
          'height': 15,
          'shape': 'diamond',
          'label': '',
          'background-opacity': 0,
          'border-width': 4,
          'border-color': 'data(borderColor)',
          'transition-property': 'border-color',
          'transition-duration': '0.3s',
          'events': this.isEditMode ? 'yes' : 'no',
        }
      },
      {
        selector: 'node[?isInvisible]',
        style: {
          'opacity': this.isEditMode ? 0.5 : 0,
          'width': this.isEditMode ? 15 : 0.0001,
          'height': this.isEditMode ? 15 : 0.0001,
          'border-width': this.isEditMode ? 2 : 0,
          'border-color': 'var(--accent-color)',
          'border-style': 'dashed',
          'events': this.isEditMode ? 'yes' : 'no',
          'label': '',
        }
      },
      {
        selector: 'node[?isInvisible][?withGap]',
        style: {
          'width': 20,
          'height': 20
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 4,
          'line-color': 'data(color)',
          'target-arrow-color': 'data(color)',
          'target-arrow-shape': 'vee',
          'curve-style': 'bezier',
          'arrow-scale': 1.5,
          'transition-property': 'line-color, target-arrow-color',
          'transition-duration': '0.3s',
          'events': 'no',
        }
      },
      {
        selector: 'edge[?toInvisible]',
        style: {
          'target-arrow-shape': 'none'
        }
      }
    ];
  }

  reRenderGraph() {
    const drawer = new CytoscapeDrawer();
    this.graph.render(drawer);
    const elements = drawer.getElements();
    this.cy.batch(() => {
      elements.nodes.forEach(newNode => {
        const cyNode = this.cy.getElementById(newNode.data.id);
        if (cyNode.length) {
          cyNode.data('status', newNode.data.status);
          cyNode.data('fillColor', newNode.data.fillColor);
          cyNode.data('borderColor', newNode.data.borderColor);
          cyNode.data('textColor', newNode.data.textColor);
        }
      });
      elements.edges.forEach(newEdge => {
        const cyEdge = this.cy.getElementById(newEdge.data.id);
        if (cyEdge.length) {
          cyEdge.data('color', newEdge.data.color);
        }
      });
    });
    this.updateProgress();
  }

  updateProgress() {
    const totalSubjects = this.cy.nodes('[nodeType="subject"]').length;
    let approvedCount = 0;
    let pendingCount = 0;
    const approvedIndex = this.config.statuses.length - 1;
    const pendingIndex = this.config.statuses.length - 2;
    this.cy.nodes('[nodeType="subject"]').forEach(node => {
      const status = node.data('status');
      const statusIndex = this.config.statuses.findIndex(s => s.id === status);
      if (statusIndex >= approvedIndex) approvedCount++;
      if (statusIndex >= pendingIndex) pendingCount++;
    });
    const approvedPercent = Math.round((approvedCount / totalSubjects) * 100);
    const pendingPercent = Math.round((pendingCount / totalSubjects) * 100);
    if (this.progressPercentage) {
      this.progressPercentage.textContent = `${approvedPercent}%`;
    }
    if (this.progressPendingText) {
      this.progressPendingText.textContent = `${pendingPercent}%`;
    }
    const circumference = 283;
    if (this.progressApproved) {
      this.progressApproved.style.strokeDashoffset = circumference - (circumference * approvedPercent / 100);
    }
    if (this.progressPending) {
      this.progressPending.style.strokeDashoffset = circumference - (circumference * pendingPercent / 100);
    }
  }

  reset(e) {
    if (this.isCustomVariant && this.isEditMode) {
      if (confirm('¿Estás seguro de que querés reiniciar el plan personalizado? Se perderán todos los cambios de posiciones.')) {
        localStorage.removeItem(this.CUSTOM_VARIANT_KEY);
        delete this.appData.variants[this.CUSTOM_VARIANT_ID];
        this.initializeCustomVariant();
        localStorage.removeItem(this.getStorageKey());
        this.renderGraph();
      }
    } else {
      localStorage.removeItem(this.getStorageKey());
      this.renderGraph();
    }
  }

  fit(e) {
    this.cy.fit(50);
  }

  export(e) {
    if (this.isCustomVariant && this.isEditMode) {
      // Export custom variant/plan
      const customVariant = this.appData.variants[this.CUSTOM_VARIANT_ID];
      if (!customVariant) {
        alert('No hay plan personalizado para exportar.');
        return;
      }
      const blob = new Blob([JSON.stringify(customVariant, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'custom-plan.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Export progress statuses
      const statuses = this.loadStatuses();
      if (Object.keys(statuses).length === 0) {
        alert('No hay progreso para exportar.');
        return;
      }
      const exportData = { variant: this.currentVariant, statuses };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `progress-${this.currentVariant}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  import(e) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);

          if (this.isCustomVariant && this.isEditMode) {
            // Import custom variant/plan
            if (!data.subjects || !data.statuses || !data.availabilities) {
              throw new Error('Formato de plan inválido. Debe contener subjects, statuses y availabilities.');
            }
            this.appData.variants[this.CUSTOM_VARIANT_ID] = data;
            this.saveCustomVariant();
            this.renderGraph();
            alert('Plan personalizado importado correctamente.');
          } else {
            // Import progress statuses
            if (!data.statuses || typeof data.statuses !== 'object') {
              throw new Error('Formato de datos inválido');
            }
            localStorage.setItem(this.getStorageKey(), JSON.stringify(data.statuses));
            this.renderGraph();
          }
        } catch (err) {
          alert('Error al importar: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  screenshot(e) {
    try {
      const scale = 4;
      const png = this.cy.png({
        output: 'blob',
        scale: scale,
        bg: 'transparent',
        full: true
      });
      const img = new Image();
      img.onload = () => {
        const paddingX = img.width * 0.1;
        const paddingY = img.height * 0.05;
        const canvas = document.createElement('canvas');
        canvas.width = img.width + paddingX * 2;
        canvas.height = img.height + paddingY * 2;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, paddingX, paddingY);
        this.drawProgressGauge(ctx);
        this.drawWatermark(ctx);
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `subjects-graph-${this.currentVariant}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      img.src = URL.createObjectURL(png);
    } catch (err) {
      console.error('Screenshot error:', err);
      alert('Error al capturar pantalla: ' + err.message);
    }
  }

  drawProgressGauge(ctx) {
    const minDimension = Math.min(ctx.canvas.width, ctx.canvas.height);
    const gaugeScale = minDimension / 600;
    const size = 120 * gaugeScale;
    const offset = 30 * gaugeScale;
    const x = ctx.canvas.width - size - offset;
    const y = ctx.canvas.height - size - offset;
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const radius = 45 * gaugeScale;
    const strokeWidth = 8 * gaugeScale;
    const approvedPercent = this.progressPercentage ? parseInt(this.progressPercentage.textContent) : 0;
    const pendingPercent = this.progressPendingText ? parseInt(this.progressPendingText.textContent) : 0;
    const bgColor = this.themeColors['--bg-secondary'] || '#161b22';
    const trackColor = this.themeColors['--bg-tertiary'] || '#21262d';
    const pendingColor = this.themeColors['--fill-color-3'] || '#2255d4';
    const approvedColor = this.themeColors['--fill-color-4'] || '#3b82f6';
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
    if (pendingPercent > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pendingPercent / 100));
      ctx.strokeStyle = pendingColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    if (approvedPercent > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * approvedPercent / 100));
      ctx.strokeStyle = approvedColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.fillStyle = approvedColor;
    ctx.font = `700 ${1.5 * 16 * gaugeScale}px 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${approvedPercent}%`, centerX, centerY - 6 * gaugeScale);
    ctx.fillStyle = pendingColor;
    ctx.font = `600 ${0.75 * 16 * gaugeScale}px 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(`${pendingPercent}%`, centerX, centerY + 12 * gaugeScale);
  }

  drawWatermark(ctx) {
    const minDimension = Math.min(ctx.canvas.width, ctx.canvas.height);
    const wmScale = minDimension / 800;
    const text = 'raniagus.github.io/subjects-graph';
    const fontSize = 12 * wmScale;
    const x = ctx.canvas.width / 2;
    const y = 20 * wmScale;
    ctx.font = `600 ${fontSize}px "Open Sans", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3 * wmScale;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = 'white';
    ctx.fillText(text, x, y);
  }

  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  }

  onBeforeInstallPrompt(event) {
    event.preventDefault();
    // Optionally, store the event for later use (e.g., to show a custom install button)
    this.deferredPrompt = event;
    // Example: Show your custom install button here if you want
    // document.getElementById('install-button').style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.graphApp = new GraphApp();
  window.graphApp.connect();
});
