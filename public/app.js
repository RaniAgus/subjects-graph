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
    this.deletePlanBtn = document.getElementById('delete-plan-btn');
    this.roundPositionsBtn = document.getElementById('round-positions-btn');
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
    this.controlsTitle = document.getElementById('controls-title');
    this.normalModeControls = document.getElementById('normal-mode-controls');
    this.editModeControls = document.getElementById('edit-mode-controls');

    // Node editor modal elements
    this.nodeEditorModal = document.getElementById('node-editor-modal');
    this.nodeEditorTitle = document.getElementById('node-editor-title');
    this.nodeEditorInfo = document.getElementById('node-editor-info');
    this.nodeEditorClose = document.getElementById('node-editor-close');
    this.nodeEditorTextarea = document.getElementById('node-editor-textarea');
    this.nodeEditorError = document.getElementById('node-editor-error');
    this.nodeEditorCancel = document.getElementById('node-editor-cancel');
    this.nodeEditorSave = document.getElementById('node-editor-save');
    this.nodeEditorDelete = document.getElementById('node-editor-delete');

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
    this.editingNodeId = null; // Currently editing node ID
    this.editingNodeType = null; // 'subject' or 'edge'
    this.isCreatingNode = false; // Are we creating a new node?
    this.creatingEdgeSourceId = null; // Source ID when creating edge
    this.creatingEdgeTargetId = null; // Target ID when creating edge
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
    this.deletePlanBtn.addEventListener('click', this.deletePlan.bind(this));
    this.roundPositionsBtn.addEventListener('click', this.roundPositions.bind(this));
    this.exportBtn.addEventListener('click', this.export.bind(this));
    this.importBtn.addEventListener('click', this.import.bind(this));
    this.screenshotBtn.addEventListener('click', this.screenshot.bind(this));
    window.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt.bind(this));

    // Node editor modal events
    this.nodeEditorClose.addEventListener('click', this.closeNodeEditor.bind(this));
    this.nodeEditorCancel.addEventListener('click', this.closeNodeEditor.bind(this));
    this.nodeEditorSave.addEventListener('click', this.saveNodeEdit.bind(this));
    this.nodeEditorDelete.addEventListener('click', this.deleteNode.bind(this));
    this.nodeEditorModal.addEventListener('click', (e) => {
      if (e.target === this.nodeEditorModal) this.closeNodeEditor();
    });
    this.nodeEditorTextarea.addEventListener('input', this.validateNodeJson.bind(this));
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
      customOption.textContent = this.hasCustomVariant()
        ? `📝 ${this.customVariantData.name}`
        : '➕ Crear Plan Personalizado';
      this.variantSelect.appendChild(customOption);

      const variantInStorage = localStorage.getItem(this.VARIANT_STORAGE_KEY);
      // Check if stored variant is custom or a valid variant
      if (variantInStorage === this.CUSTOM_VARIANT_ID && this.hasCustomVariant()) {
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
    this.updateResetButton();
  }

  /**
   * Get variant data for current variant (handles custom variant)
   */
  getVariantData() {
    if (this.currentVariant === this.CUSTOM_VARIANT_ID) {
      if (!this.hasCustomVariant()) {
        this.initializeCustomVariant();
      }
      return this.customVariantData;
    }
    return this.appData.variants[this.currentVariant];
  }

  onVariantChange(e) {
    const newVariant = e.target.value;
    if (newVariant === this.CUSTOM_VARIANT_ID) {
      this.currentVariant = this.CUSTOM_VARIANT_ID;
      this.isCustomVariant = true;
      localStorage.setItem(this.VARIANT_STORAGE_KEY, this.CUSTOM_VARIANT_ID);
      // Initialize custom variant if it doesn't exist, and enable edit mode
      if (!this.hasCustomVariant()) {
        this.initializeCustomVariant();
        this.isEditMode = true; // Auto-enable edit mode for new custom plan
      } else {
        this.isEditMode = false; // Start with edit mode off for existing plan
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
    // If already in custom variant, just toggle edit mode
    if (this.isCustomVariant) {
      this.isEditMode = !this.isEditMode;
      this.renderGraph();
      this.updateEditModeUI();
      return;
    }

    // Starting edit mode from a non-custom variant
    // Ask to override if a custom plan already exists
    if (this.hasCustomVariant()) {
      if (!confirm('Ya existe un plan personalizado. ¿Querés eliminarlo y empezar uno nuevo?')) {
        return;
      }
      // Delete the existing custom plan
      localStorage.removeItem(this.CUSTOM_VARIANT_KEY);
      this.customVariantData = null;
    }

    // Initialize custom plan based on current variant
    this.initializeCustomVariantFrom(this.currentVariant);
    this.currentVariant = this.CUSTOM_VARIANT_ID;
    this.isCustomVariant = true;
    this.isEditMode = true;
    localStorage.setItem(this.VARIANT_STORAGE_KEY, this.CUSTOM_VARIANT_ID);
    this.variantSelect.value = this.CUSTOM_VARIANT_ID;
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
   * Load custom variant from localStorage into appData (but don't add to variants list)
   */
  loadCustomVariant() {
    const saved = localStorage.getItem(this.CUSTOM_VARIANT_KEY);
    if (saved) {
      try {
        this.customVariantData = JSON.parse(saved);
      } catch (err) {
        console.error('Error loading custom variant:', err);
        this.customVariantData = null;
      }
    } else {
      this.customVariantData = null;
    }
  }

  /**
   * Check if a custom variant exists in storage
   */
  hasCustomVariant() {
    return this.customVariantData !== null;
  }

  /**
   * Initialize custom variant with one default subject (for "Crear Plan Personalizado")
   */
  initializeCustomVariant() {
    const defaultVariant = this.appData.variants[this.appData.defaultVariant];
    // Create plan with same statuses and availabilities, and one default subject
    this.customVariantData = {
      name: 'Plan Personalizado',
      statuses: JSON.parse(JSON.stringify(defaultVariant.statuses)),
      availabilities: JSON.parse(JSON.stringify(defaultVariant.availabilities)),
      subjects: [
        {
          id: '1',
          name: 'Nueva Materia',
          shortName: 'NM',
          position: { x: 0, y: 0 },
          prerequisites: []
        }
      ],
      edges: []
    };
    this.saveCustomVariant();
    this.updateCustomVariantOption();
  }

  /**
   * Initialize custom variant by copying from a specific variant
   */
  initializeCustomVariantFrom(variantId) {
    const sourceVariant = this.appData.variants[variantId];
    if (!sourceVariant) {
      // Fallback to default initialization if variant not found
      this.initializeCustomVariant();
      return;
    }
    // Deep clone the source variant
    this.customVariantData = JSON.parse(JSON.stringify(sourceVariant));
    this.customVariantData.name = 'Plan Personalizado';
    this.saveCustomVariant();
    this.updateCustomVariantOption();
  }

  /**
   * Update the custom variant option text in the select
   */
  updateCustomVariantOption() {
    const customOption = this.variantSelect.querySelector(`option[value="${this.CUSTOM_VARIANT_ID}"]`);
    if (customOption) {
      customOption.textContent = this.hasCustomVariant()
        ? `📝 ${this.customVariantData.name}`
        : '➕ Crear Plan Personalizado';
    }
  }

  /**
   * Save custom variant to localStorage
   */
  saveCustomVariant() {
    if (this.customVariantData) {
      localStorage.setItem(this.CUSTOM_VARIANT_KEY, JSON.stringify(this.customVariantData));
    }
  }

  /**
   * Update UI elements based on edit mode state
   */
  updateEditModeUI() {
    // Edit mode button is always visible
    this.editModeBtn.style.display = 'flex';

    if (this.isCustomVariant && this.isEditMode) {
      this.editModeBtn.classList.add('active');
      this.editModeBtn.title = 'Desactivar Modo Edición';
      this.exportBtn.innerHTML = '<i data-lucide="upload"></i> Exportar Plan';
      this.importBtn.innerHTML = '<i data-lucide="download"></i> Importar Plan';
      this.exportBtn.title = 'Exportar Plan Personalizado';
      this.importBtn.title = 'Importar Plan Personalizado';
      this.cyContainer.classList.add('edit-mode');
      this.controlsTitle.textContent = 'Modo edición';
      this.normalModeControls.style.display = 'none';
      this.editModeControls.style.display = 'block';
      this.deletePlanBtn.style.display = 'flex';
      this.roundPositionsBtn.style.display = 'flex';
      this.screenshotBtn.style.display = 'none';
    } else {
      this.editModeBtn.classList.remove('active');
      this.editModeBtn.title = 'Crear Plan Personalizado';
      this.exportBtn.innerHTML = '<i data-lucide="upload"></i> Exportar';
      this.importBtn.innerHTML = '<i data-lucide="download"></i> Importar';
      this.exportBtn.title = 'Exportar Progreso';
      this.importBtn.title = 'Importar Progreso';
      this.cyContainer.classList.remove('edit-mode');
      this.controlsTitle.textContent = 'Controles';
      this.normalModeControls.style.display = 'block';
      this.editModeControls.style.display = 'none';
      this.deletePlanBtn.style.display = 'none';
      this.roundPositionsBtn.style.display = 'none';
      this.screenshotBtn.style.display = 'flex';
      // Clear grid background
      this.cyContainer.style.backgroundImage = '';
      this.cyContainer.style.backgroundSize = '';
      this.cyContainer.style.backgroundPosition = '';
    }

    // Regenerate legend to show/hide edit buttons
    this.generateLegend();
    lucide.createIcons();
  }

  /**
   * Update the edit mode grid based on current pan and zoom
   */
  updateGrid() {
    if (!this.isEditMode || !this.cy) return;

    const zoom = this.cy.zoom();
    const pan = this.cy.pan();
    const gridSize = 100 * zoom;

    // Calculate where origin (0,0) is in rendered coordinates
    const originX = pan.x;
    const originY = pan.y;

    const containerWidth = this.cyContainer.offsetWidth;
    const containerHeight = this.cyContainer.offsetHeight;

    const gridColor = 'rgba(255, 255, 255, 0.1)';
    const axisColor = 'rgba(255, 255, 255, 0.15)';

    // Check if axes are visible within container bounds
    const showYAxis = originX >= 0 && originX <= containerWidth;
    const showXAxis = originY >= 0 && originY <= containerHeight;

    const layers = [];
    const sizes = [];
    const positions = [];

    // Y axis (vertical line at x=0)
    if (showYAxis) {
      layers.push(`linear-gradient(to right, ${axisColor} 1px, transparent 1px)`);
      sizes.push('100% 100%');
      positions.push(`${originX}px 0`);
    }

    // X axis (horizontal line at y=0)
    if (showXAxis) {
      layers.push(`linear-gradient(to bottom, ${axisColor} 1px, transparent 1px)`);
      sizes.push('100% 100%');
      positions.push(`0 ${originY}px`);
    }

    // Grid lines (always visible)
    layers.push(
      `linear-gradient(to right, ${gridColor} 1px, transparent 1px)`,
      `linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`
    );
    sizes.push(`${gridSize}px ${gridSize}px`, `${gridSize}px ${gridSize}px`);
    positions.push(`${originX}px ${originY}px`, `${originX}px ${originY}px`);

    this.cyContainer.style.backgroundImage = layers.join(', ');
    this.cyContainer.style.backgroundSize = sizes.join(', ');
    this.cyContainer.style.backgroundPosition = positions.join(', ');
  }

  /**
   * Update node position in custom variant and save
   */
  updateNodePosition(nodeId, position) {
    if (!this.isEditMode) return;
    if (!this.customVariantData) return;

    // Update subject position
    const subject = this.customVariantData.subjects.find(s => s.id === nodeId);
    if (subject) {
      subject.position = { x: Math.round(position.x), y: Math.round(position.y) };
      this.saveCustomVariant();
      return;
    }

    // Update edge (connector) position
    const edge = this.customVariantData.edges.find(e => e.id === nodeId);
    if (edge) {
      edge.position = { x: Math.round(position.x), y: Math.round(position.y) };
      this.saveCustomVariant();
    }
  }

  /**
   * Open the node editor modal for a specific node
   */
  openNodeEditor(nodeId) {
    if (!this.isEditMode || !this.customVariantData) return;

    // Find the node data (either subject or edge/connector)
    let nodeData = this.customVariantData.subjects.find(s => s.id === nodeId);
    if (nodeData) {
      this.editingNodeType = 'subject';
      this.nodeEditorTitle.textContent = `Editar Materia: ${nodeData.name || nodeData.id}`;
      this.nodeEditorInfo.href = 'https://github.com/RaniAgus/subjects-graph#materias-y-correlativas';
    } else {
      nodeData = this.customVariantData.edges.find(e => e.id === nodeId);
      if (nodeData) {
        this.editingNodeType = 'edge';
        this.nodeEditorTitle.textContent = `Editar Conector: ${nodeId}`;
        this.nodeEditorInfo.href = 'https://github.com/RaniAgus/subjects-graph#conectores';
      }
    }

    if (!nodeData) {
      console.warn('Node not found:', nodeId);
      return;
    }

    this.editingNodeId = nodeId;
    this.isCreatingNode = false;
    this.nodeEditorTextarea.value = JSON.stringify(nodeData, null, 2);
    this.nodeEditorError.style.display = 'none';
    // Show delete button: always for edges, only if more than 1 subject for subjects
    const canDelete = this.editingNodeType === 'edge' || this.customVariantData.subjects.length > 1;
    this.nodeEditorDelete.style.display = canDelete ? 'inline-flex' : 'none';
    this.nodeEditorModal.style.display = 'flex';
    this.nodeEditorTextarea.focus();
    lucide.createIcons();
  }

  /**
   * Open the node editor to create a new subject
   */
  openNewSubjectEditor(position) {
    if (!this.isEditMode || !this.customVariantData) return;

    // Generate a new unique ID
    const existingIds = this.customVariantData.subjects.map(s => parseInt(s.id)).filter(id => !isNaN(id));
    const newId = existingIds.length > 0 ? String(Math.max(...existingIds) + 1) : '1';

    const newSubject = {
      id: newId,
      name: 'Nueva Materia',
      shortName: 'NM',
      position: { x: Math.round(position.x), y: Math.round(position.y) },
      prerequisites: []
    };

    this.editingNodeType = 'subject';
    this.editingNodeId = null; // null means creating new
    this.isCreatingNode = true;
    this.nodeEditorTitle.textContent = 'Crear Nueva Materia';
    this.nodeEditorInfo.href = 'https://github.com/RaniAgus/subjects-graph#materias-y-correlativas';
    this.nodeEditorTextarea.value = JSON.stringify(newSubject, null, 2);
    this.nodeEditorError.style.display = 'none';
    this.nodeEditorDelete.style.display = 'none'; // Hide delete button when creating
    this.nodeEditorModal.style.display = 'flex';
    this.nodeEditorTextarea.focus();
    lucide.createIcons();
  }

  /**
   * Open the node editor to create a new edge/connector
   */
  openNewEdgeEditor(sourceId, targetId, position) {
    if (!this.isEditMode || !this.customVariantData) return;

    // Store source and target for later updating
    this.creatingEdgeSourceId = sourceId;
    this.creatingEdgeTargetId = targetId;

    // Get short names for readable ID
    const sourceNode = this.customVariantData.subjects.find(s => s.id === sourceId);
    const targetNode = this.customVariantData.subjects.find(s => s.id === targetId);
    const sourceEdge = this.customVariantData.edges.find(e => e.id === sourceId);
    const targetEdge = this.customVariantData.edges.find(e => e.id === targetId);
    const sourceName = sourceNode?.shortName || sourceId;
    const targetName = targetNode?.shortName || targetId;

    const newEdge = {
      id: `${sourceName}:${targetName}`,
      position: { x: Math.round(position.x), y: Math.round(position.y) },
      dependencies: [sourceId],
      targets: [targetId]
    };

    this.editingNodeType = 'edge';
    this.editingNodeId = null; // null means creating new
    this.isCreatingNode = true;
    this.nodeEditorTitle.textContent = 'Crear Nuevo Conector';
    this.nodeEditorInfo.href = 'https://github.com/RaniAgus/subjects-graph#conectores';
    this.nodeEditorTextarea.value = JSON.stringify(newEdge, null, 2);
    this.nodeEditorError.style.display = 'none';
    this.nodeEditorDelete.style.display = 'none'; // Hide delete button when creating
    this.nodeEditorModal.style.display = 'flex';
    this.nodeEditorTextarea.focus();
    lucide.createIcons();
  }

  /**
   * Open the statuses editor modal
   */
  openStatusesEditor() {
    if (!this.isEditMode || !this.customVariantData) return;

    this.editingNodeType = 'statuses';
    this.editingNodeId = 'statuses';
    this.isCreatingNode = false;
    this.nodeEditorTitle.textContent = 'Editar Estados';
    this.nodeEditorInfo.href = 'https://github.com/RaniAgus/subjects-graph#estados-de-materias';
    this.nodeEditorTextarea.value = JSON.stringify(this.customVariantData.statuses || {}, null, 2);
    this.nodeEditorError.style.display = 'none';
    this.nodeEditorDelete.style.display = 'none';
    this.nodeEditorModal.style.display = 'flex';
    this.nodeEditorTextarea.focus();
    lucide.createIcons();
  }

  /**
   * Open the availabilities editor modal
   */
  openAvailabilitiesEditor() {
    if (!this.isEditMode || !this.customVariantData) return;

    this.editingNodeType = 'availabilities';
    this.editingNodeId = 'availabilities';
    this.isCreatingNode = false;
    this.nodeEditorTitle.textContent = 'Editar Disponibilidades';
    this.nodeEditorInfo.href = 'https://github.com/RaniAgus/subjects-graph#disponibilidad-de-materias';
    this.nodeEditorTextarea.value = JSON.stringify(this.customVariantData.availabilities || [], null, 2);
    this.nodeEditorError.style.display = 'none';
    this.nodeEditorDelete.style.display = 'none';
    this.nodeEditorModal.style.display = 'flex';
    this.nodeEditorTextarea.focus();
    lucide.createIcons();
  }

  /**
   * Close the node editor modal
   */
  closeNodeEditor() {
    this.nodeEditorModal.style.display = 'none';
    this.editingNodeId = null;
    this.editingNodeType = null;
    this.isCreatingNode = false;
    this.creatingEdgeSourceId = null;
    this.creatingEdgeTargetId = null;
    this.nodeEditorError.style.display = 'none';
  }

  /**
   * Validate JSON in the node editor textarea
   */
  validateNodeJson() {
    try {
      JSON.parse(this.nodeEditorTextarea.value);
      this.nodeEditorError.style.display = 'none';
      return true;
    } catch (err) {
      this.nodeEditorError.textContent = `Error de sintaxis: ${err.message}`;
      this.nodeEditorError.style.display = 'block';
      return false;
    }
  }

  /**
   * Save the edited node data
   */
  saveNodeEdit() {
    if (!this.validateNodeJson()) return;
    if (!this.editingNodeType) return;

    try {
      const newData = JSON.parse(this.nodeEditorTextarea.value);

      // Validate required fields based on node type
      if (this.editingNodeType === 'subject') {
        if (!newData.id || !newData.position) {
          throw new Error('La materia debe tener "id" y "position"');
        }
        if (this.isCreatingNode) {
          // Check for duplicate ID
          if (this.customVariantData.subjects.some(s => s.id === newData.id)) {
            throw new Error(`Ya existe una materia con ID "${newData.id}"`);
          }
          this.customVariantData.subjects.push(newData);
        } else {
          // Find and update the subject
          const index = this.customVariantData.subjects.findIndex(s => s.id === this.editingNodeId);
          if (index !== -1) {
            this.customVariantData.subjects[index] = newData;
          }
        }
      } else if (this.editingNodeType === 'statuses') {
        // Validate statuses
        if (!Array.isArray(newData)) {
          throw new Error('Los estados deben ser un array');
        }

        this.customVariantData.statuses = newData;
        this.saveCustomVariant();
        this.closeNodeEditor();
        this.renderGraph();
        return;
      } else if (this.editingNodeType === 'availabilities') {
        // Validate availabilities
        if (!Array.isArray(newData)) {
          throw new Error('Las disponibilidades deben ser un array');
        }

        this.customVariantData.availabilities = newData;
        this.saveCustomVariant();
        this.closeNodeEditor();
        this.renderGraph();
        return;
      } else if (this.editingNodeType === 'edge') {
        if (!newData.id || !newData.position) {
          throw new Error('El conector debe tener "id" y "position"');
        }
        if (this.isCreatingNode) {
          // Check for duplicate ID
          if (this.customVariantData.edges.some(e => e.id === newData.id)) {
            throw new Error(`Ya existe un conector con ID "${newData.id}"`);
          }
          this.customVariantData.edges.push(newData);

          // Update source edge to point to the new node instead of original target
          if (this.creatingEdgeSourceId) {
            const sourceEdge = this.customVariantData.edges.find(e => e.id === this.creatingEdgeSourceId);
            if (sourceEdge && sourceEdge.targets) {
              const targetIdx = sourceEdge.targets.indexOf(this.creatingEdgeTargetId);
              if (targetIdx !== -1) {
                sourceEdge.targets[targetIdx] = newData.id;
              }
            }
          }

          // Update target edge to point to the new node instead of original source
          if (this.creatingEdgeTargetId) {
            const targetEdge = this.customVariantData.edges.find(e => e.id === this.creatingEdgeTargetId);
            if (targetEdge && targetEdge.dependencies) {
              const sourceIdx = targetEdge.dependencies.indexOf(this.creatingEdgeSourceId);
              if (sourceIdx !== -1) {
                targetEdge.dependencies[sourceIdx] = newData.id;
              }
            }
          }
        } else {
          // Find and update the edge
          const index = this.customVariantData.edges.findIndex(e => e.id === this.editingNodeId);
          if (index !== -1) {
            this.customVariantData.edges[index] = newData;
          }
        }
      }

      this.saveCustomVariant();
      this.closeNodeEditor();
      this.renderGraph();
    } catch (err) {
      this.nodeEditorError.textContent = `Error al guardar: ${err.message}`;
      this.nodeEditorError.style.display = 'block';
    }
  }

  /**
   * Delete the currently editing node
   */
  deleteNode() {
    if (this.isCreatingNode || !this.editingNodeId || !this.editingNodeType) return;

    const nodeType = this.editingNodeType === 'subject' ? 'materia' : 'conector';
    if (!confirm(`¿Estás seguro de eliminar este ${nodeType}?`)) return;

    if (this.editingNodeType === 'subject') {
      const subjectId = this.editingNodeId;
      const index = this.customVariantData.subjects.findIndex(s => s.id === subjectId);
      if (index !== -1) {
        this.customVariantData.subjects.splice(index, 1);

        // Remove references from other subjects' prerequisites
        this.customVariantData.subjects.forEach(subject => {
          if (subject.prerequisites) {
            subject.prerequisites.forEach(prereq => {
              if (prereq.dependencies) {
                prereq.dependencies.forEach(dep => {
                  if (dep.subjects) {
                    dep.subjects = dep.subjects.filter(s => s !== subjectId);
                  }
                });
                // Remove empty dependencies
                prereq.dependencies = prereq.dependencies.filter(dep => dep.subjects && dep.subjects.length > 0);
              }
            });
            // Remove empty prerequisites
            subject.prerequisites = subject.prerequisites.filter(prereq => prereq.dependencies && prereq.dependencies.length > 0);
          }
        });

        // Remove references from edges
        this.customVariantData.edges.forEach(edge => {
          if (edge.dependencies) {
            edge.dependencies = edge.dependencies.filter(d => d !== subjectId);
          }
          if (edge.targets) {
            edge.targets = edge.targets.filter(t => t !== subjectId);
          }
        });

        // Remove edges that have no dependencies or no targets
        this.customVariantData.edges = this.customVariantData.edges.filter(
          edge => edge.dependencies && edge.dependencies.length > 0 && edge.targets && edge.targets.length > 0
        );
      }
    } else if (this.editingNodeType === 'edge') {
      const edgeId = this.editingNodeId;
      const edgeToDelete = this.customVariantData.edges.find(e => e.id === edgeId);

      if (edgeToDelete) {
        // Reconnect: edges pointing TO this edge should now point to this edge's targets
        this.customVariantData.edges.forEach(edge => {
          if (edge.targets && edge.targets.includes(edgeId)) {
            // Replace reference to deleted edge with its targets
            const idx = edge.targets.indexOf(edgeId);
            edge.targets.splice(idx, 1, ...(edgeToDelete.targets || []));
          }
        });

        // Reconnect: edges pointing FROM this edge should now point from this edge's dependencies
        this.customVariantData.edges.forEach(edge => {
          if (edge.dependencies && edge.dependencies.includes(edgeId)) {
            // Replace reference to deleted edge with its dependencies
            const idx = edge.dependencies.indexOf(edgeId);
            edge.dependencies.splice(idx, 1, ...(edgeToDelete.dependencies || []));
          }
        });

        // Now remove the edge
        const index = this.customVariantData.edges.findIndex(e => e.id === edgeId);
        if (index !== -1) {
          this.customVariantData.edges.splice(index, 1);
        }
      }
    }

    this.saveCustomVariant();
    this.closeNodeEditor();
    this.renderGraph();
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
    this.updateResetButton();
  }

  /**
   * Update reset button disabled state based on whether there's saved progress
   */
  updateResetButton() {
    const hasProgress = Object.keys(this.loadStatuses()).length > 0;
    this.resetBtn.disabled = !hasProgress;
  }

  generateLegend() {
    if (!this.statusLegend || !this.borderLegend) return;
    this.statusLegend.innerHTML = '';
    this.borderLegend.innerHTML = '';

    // Add edit button for statuses (visible only in edit mode)
    if (this.isEditMode && this.isCustomVariant) {
      const editBtn = document.createElement('button');
      editBtn.className = 'legend-edit-btn';
      editBtn.innerHTML = '<i data-lucide="pencil"></i>';
      editBtn.title = 'Editar estados';
      editBtn.addEventListener('click', this.openStatusesEditor.bind(this));
      this.statusLegend.appendChild(editBtn);
    }

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

    // Add edit button for availabilities (visible only in edit mode)
    if (this.isEditMode && this.isCustomVariant) {
      const editBtn = document.createElement('button');
      editBtn.className = 'legend-edit-btn';
      editBtn.innerHTML = '<i data-lucide="pencil"></i>';
      editBtn.title = 'Editar disponibilidades';
      editBtn.addEventListener('click', this.openAvailabilitiesEditor.bind(this));
      this.borderLegend.appendChild(editBtn);
    }

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

    // Recreate lucide icons for the edit buttons
    if (this.isEditMode && this.isCustomVariant) {
      lucide.createIcons();
    }
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

    // Tap handling with delay to distinguish single vs double tap
    let tapTimeout = null;

    // Click handler for subject nodes - toggle status (only in non-edit mode)
    this.cy.on('tap', 'node[nodeType="subject"]', evt => {
      // Use timeout to allow double-tap to cancel single tap
      if (tapTimeout) clearTimeout(tapTimeout);
      tapTimeout = setTimeout(() => {
        const node = evt.target;
        this.graph.toggleStatus(node.id());
        this.reRenderGraph();
        this.saveStatuses();
        tapTimeout = null;
      }, this.isEditMode ? 200 : 0);
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

    // Double-click handlers for edit mode
    if (this.isEditMode) {
      // Double-click on subject node to edit
      this.cy.on('dbltap', 'node[nodeType="subject"]', evt => {
        if (tapTimeout) clearTimeout(tapTimeout);
        tapTimeout = null;
        const node = evt.target;
        this.openNodeEditor(node.id());
      });

      // Double-click on connector node to edit
      this.cy.on('dbltap', 'node[nodeType="connector"]', evt => {
        if (tapTimeout) clearTimeout(tapTimeout);
        tapTimeout = null;
        const node = evt.target;
        this.openNodeEditor(node.id());
      });

      // Double-click on edge to create a new connector at that position
      this.cy.on('dbltap', 'edge', evt => {
        if (tapTimeout) clearTimeout(tapTimeout);
        tapTimeout = null;
        const edge = evt.target;
        const position = evt.position;
        this.openNewEdgeEditor(edge.data('source'), edge.data('target'), position);
      });

      // Double-click on background to create a new subject
      this.cy.on('dbltap', evt => {
        // Only trigger if clicking on background (not on a node or edge)
        if (evt.target === this.cy) {
          if (tapTimeout) clearTimeout(tapTimeout);
          tapTimeout = null;
          const position = evt.position;
          this.openNewSubjectEditor(position);
        }
      });

      // Update grid on pan/zoom
      this.updateGrid();
      this.cy.on('pan zoom', () => this.updateGrid());
    }

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
          'events': this.isEditMode ? 'yes' : 'no',
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
    if (confirm('¿Estás seguro de reiniciar el progreso?')) {
      localStorage.removeItem(this.getStorageKey());
      this.renderGraph();
    }
  }

  /**
   * Round all node positions to the nearest hundred
   */
  roundPositions() {
    if (!this.isEditMode || !this.customVariantData) return;

    // Round subject positions
    this.customVariantData.subjects.forEach(subject => {
      if (subject.position) {
        subject.position.x = Math.round(subject.position.x / 100) * 100;
        subject.position.y = Math.round(subject.position.y / 100) * 100;
      }
    });

    // Round edge positions
    this.customVariantData.edges.forEach(edge => {
      if (edge.position) {
        edge.position.x = Math.round(edge.position.x / 100) * 100;
        edge.position.y = Math.round(edge.position.y / 100) * 100;
      }
    });

    this.saveCustomVariant();
    this.renderGraph();
  }

  /**
   * Delete the custom plan and switch to default variant
   */
  deletePlan() {
    if (!this.isCustomVariant || !this.isEditMode) return;

    if (confirm('¿Estás seguro de eliminar el plan personalizado?')) {
      localStorage.removeItem(this.CUSTOM_VARIANT_KEY);
      localStorage.removeItem(this.getStorageKey());
      this.customVariantData = null;
      this.updateCustomVariantOption();

      // Switch to default variant
      this.currentVariant = this.appData.defaultVariant;
      this.isCustomVariant = false;
      this.isEditMode = false;
      localStorage.setItem(this.VARIANT_STORAGE_KEY, this.currentVariant);
      this.variantSelect.value = this.currentVariant;

      // Update custom option text back to "Crear Plan Personalizado"
      const customOption = this.variantSelect.querySelector(`option[value="${this.CUSTOM_VARIANT_ID}"]`);
      if (customOption) {
        customOption.textContent = '➕ Crear Plan Personalizado';
      }

      this.renderGraph();
      this.updateEditModeUI();
    }
  }

  fit(e) {
    this.cy.fit(50);
  }

  export(e) {
    if (this.isCustomVariant && this.isEditMode) {
      // Export custom variant/plan
      if (!this.customVariantData) {
        alert('No hay plan personalizado para exportar.');
        return;
      }
      const blob = new Blob([JSON.stringify(this.customVariantData, null, 2)], { type: 'application/json' });
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
            this.customVariantData = data;
            this.saveCustomVariant();
            this.updateCustomVariantOption();
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
