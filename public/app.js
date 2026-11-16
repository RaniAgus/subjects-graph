import { SubjectsGraph } from './lib/subjects-graph/index.js';

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
    this.progressContainer = document.querySelector('.progress-container');
    this.progressCircle = document.querySelector('.progress-circle');
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
    this.nodeEditorSubjects = document.getElementById('node-editor-subjects');
    this.nodeEditorSubjectsTable = document.getElementById('node-editor-subjects-table');

    // State
    this.graph = null;
    this.progress = {};
    this.appData = null;
    this.currentVariant = null;
    this.currentTheme = null;
    this.config = null;
    this.themeColors = null;
    this.isCustomVariant = false;
    this.isEditMode = false;
    this.customVariantTouched = false; // Track if custom variant has been modified
    this.originalVariant = null; // Store original variant before entering edit mode
    this.progressPosition = { vertical: 'bottom', horizontal: 'right' }; // Default progress gauge position
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
    this.progressCircle.addEventListener('click', this.onProgressCircleClick.bind(this));
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
        this.customVariantTouched = true; // Loaded from storage, consider it touched
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
    this.updateProgressPosition(variantData.progress?.position);
    this.progress = this.loadStatuses();
    if (!this.graph) {
      this.graph = new SubjectsGraph(this.cyContainer, {
        plan: variantData,
        progress: this.progress,
        theme: this.themeColors,
        editable: this.isEditMode,
      });
      this.initGraphEventListeners();
    } else {
      this.graph.setPlan(variantData, { progress: this.progress });
      this.graph.setTheme(this.themeColors);
      this.graph.setEditable(this.isEditMode);
      this.graph.fit();
    }
    this.progress = this.graph.getProgress();
    this.updateProgress();
    this.updateResetButton();
  }

  initGraphEventListeners() {
    this.graph.addEventListener('statusrequest', ({ detail: { subjectId, nextStatusId } }) => {
      this.progress[subjectId] = nextStatusId;
      this.graph.setProgress(this.progress);
      this.progress = this.graph.getProgress();
      this.saveStatuses();
      this.updateProgress();
    });
    this.graph.addEventListener('nodepositionrequest', ({ detail: { nodeId, position } }) => {
      this.updateNodePosition(nodeId, position);
    });
    this.graph.addEventListener('editrequest', ({ detail }) => {
      switch (detail.kind) {
        case 'subject':
        case 'connector':
          this.openNodeEditor(detail.nodeId);
          break;
        case 'connection':
          this.openNewEdgeEditor(detail.sourceId, detail.targetId, detail.position);
          break;
        case 'background':
          this.openNewSubjectEditor(detail.position);
          break;
      }
    });
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
      // Don't set originalVariant - user explicitly chose custom plan
      this.originalVariant = null;
      this.currentVariant = this.CUSTOM_VARIANT_ID;
      this.isCustomVariant = true;
      localStorage.setItem(this.VARIANT_STORAGE_KEY, this.CUSTOM_VARIANT_ID);
      // Initialize custom variant if it doesn't exist, and enable edit mode
      if (!this.hasCustomVariant()) {
        this.initializeCustomVariant();
        this.isEditMode = true; // Auto-enable edit mode for new custom plan
        this.customVariantTouched = false; // New plan, not touched yet
      } else {
        this.isEditMode = false; // Start with edit mode off for existing plan
        this.customVariantTouched = true; // Existing plan is considered touched
      }
      this.renderGraph();
      this.updateEditModeUI();
    } else if (this.appData.variants[newVariant]) {
      // If leaving an untouched custom plan, delete it
      if (this.isCustomVariant && !this.customVariantTouched) {
        this.deleteCustomVariant();
      }
      this.currentVariant = newVariant;
      this.isCustomVariant = false;
      this.isEditMode = false;
      this.originalVariant = null;
      localStorage.setItem(this.VARIANT_STORAGE_KEY, newVariant);
      this.renderGraph();
      this.updateEditModeUI();
    }
  }

  toggleEditMode() {
    // If already in custom variant, just toggle edit mode
    if (this.isCustomVariant) {
      if (this.isEditMode && !this.customVariantTouched && this.originalVariant) {
        // Turning off edit mode with no changes AND we came from another variant - auto-delete custom variant
        localStorage.removeItem(this.CUSTOM_VARIANT_KEY);
        localStorage.removeItem(this.getStorageKey());
        this.customVariantData = null;
        this.updateCustomVariantOption();

        // Switch back to original variant
        this.currentVariant = this.originalVariant || this.appData.defaultVariant;
        this.isCustomVariant = false;
        this.isEditMode = false;
        this.originalVariant = null;
        localStorage.setItem(this.VARIANT_STORAGE_KEY, this.currentVariant);
        this.variantSelect.value = this.currentVariant;

        this.renderGraph();
        this.updateEditModeUI();
        return;
      }
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
    this.originalVariant = this.currentVariant; // Store original variant
    this.initializeCustomVariantFrom(this.currentVariant);
    this.currentVariant = this.CUSTOM_VARIANT_ID;
    this.isCustomVariant = true;
    this.isEditMode = true;
    this.customVariantTouched = false; // Reset touched flag
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
      localStorage.setItem(this.THEME_STORAGE_KEY, newThemeId);
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
      progress: JSON.parse(JSON.stringify(defaultVariant.progress || { position: { vertical: 'bottom', horizontal: 'right' } })),
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

    // Copy progress from source variant to custom variant
    const sourceStorageKey = `graphStatus-${variantId}`;
    const sourceProgress = localStorage.getItem(sourceStorageKey);
    if (sourceProgress) {
      const customStorageKey = `graphStatus-${this.CUSTOM_VARIANT_ID}`;
      localStorage.setItem(customStorageKey, sourceProgress);
    }
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
   * Delete custom variant from localStorage
   */
  deleteCustomVariant() {
    localStorage.removeItem(this.CUSTOM_VARIANT_KEY);
    this.customVariantData = null;
    this.updateCustomVariantOption();
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
      this.controlsTitle.textContent = 'Modo edición';
      this.normalModeControls.style.display = 'none';
      this.editModeControls.style.display = 'block';
      this.deletePlanBtn.style.display = 'flex';
      this.roundPositionsBtn.style.display = 'flex';
      this.screenshotBtn.style.display = 'none';
      this.progressCircle.classList.add('editable');
    } else {
      this.editModeBtn.classList.remove('active');
      this.editModeBtn.title = 'Crear Plan Personalizado';
      this.exportBtn.innerHTML = '<i data-lucide="upload"></i> Exportar';
      this.importBtn.innerHTML = '<i data-lucide="download"></i> Importar';
      this.exportBtn.title = 'Exportar Progreso';
      this.importBtn.title = 'Importar Progreso';
      this.controlsTitle.textContent = 'Controles';
      this.normalModeControls.style.display = 'block';
      this.editModeControls.style.display = 'none';
      this.deletePlanBtn.style.display = 'none';
      this.roundPositionsBtn.style.display = 'none';
      this.screenshotBtn.style.display = 'flex';
      this.progressCircle.classList.remove('editable');
    }

    // Regenerate legend to show/hide edit buttons
    this.generateLegend();
    lucide.createIcons();
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
      this.customVariantTouched = true;
      this.saveCustomVariant();
      this.graph.setPlan(this.customVariantData, { progress: this.progress });
      return;
    }

    // Update edge (connector) position
    const edge = this.customVariantData.edges.find(e => e.id === nodeId);
    if (edge) {
      edge.position = { x: Math.round(position.x), y: Math.round(position.y) };
      this.customVariantTouched = true;
      this.saveCustomVariant();
      this.graph.setPlan(this.customVariantData, { progress: this.progress });
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
    this.showNodeEditorModal();
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
    this.showNodeEditorModal();
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
    this.showNodeEditorModal();
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
    this.showNodeEditorModal();
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
    this.showNodeEditorModal();
  }

  /**
   * Open the progress editor modal
   */
  openProgressEditor() {
    if (!this.isEditMode || !this.customVariantData) return;

    this.editingNodeType = 'progress';
    this.editingNodeId = 'progress';
    this.isCreatingNode = false;
    this.nodeEditorTitle.textContent = 'Editar Progreso';
    this.nodeEditorInfo.href = 'https://github.com/RaniAgus/subjects-graph#progreso';
    this.nodeEditorTextarea.value = JSON.stringify(this.customVariantData.progress || { position: { vertical: 'bottom', horizontal: 'right' } }, null, 2);
    this.nodeEditorError.style.display = 'none';
    this.nodeEditorDelete.style.display = 'none';
    this.showNodeEditorModal();
  }

  /**
   * Handle click on progress circle
   */
  onProgressCircleClick() {
    if (this.isEditMode && this.isCustomVariant) {
      this.openProgressEditor();
    }
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
    this.nodeEditorSubjects.removeAttribute('open');
  }

  /**
   * Populate the subjects reference table in the editor modal
   */
  populateSubjectsTable() {
    if (!this.customVariantData) return;

    const tbody = this.nodeEditorSubjectsTable.querySelector('tbody');
    tbody.innerHTML = '';

    // Sort subjects by ID (numeric if possible)
    const sortedSubjects = [...this.customVariantData.subjects].sort((a, b) => {
      const aNum = parseInt(a.id);
      const bNum = parseInt(b.id);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.id.localeCompare(b.id);
    });

    for (const subject of sortedSubjects) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${subject.id}</td>
        <td>${subject.shortName || '-'}</td>
        <td>${subject.name || '-'}</td>
      `;
      tbody.appendChild(row);
    }
  }

  /**
   * Show the node editor modal (common setup)
   */
  showNodeEditorModal() {
    this.populateSubjectsTable();
    this.nodeEditorModal.style.display = 'flex';
    this.nodeEditorTextarea.focus();
    lucide.createIcons();
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
        this.customVariantTouched = true;
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
        this.customVariantTouched = true;
        this.saveCustomVariant();
        this.closeNodeEditor();
        this.renderGraph();
        return;
      } else if (this.editingNodeType === 'progress') {
        // Validate progress
        if (typeof newData !== 'object' || !newData.position) {
          throw new Error('El progreso debe ser un objeto con "position"');
        }

        this.customVariantData.progress = newData;
        this.customVariantTouched = true;
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

      this.customVariantTouched = true;
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

    this.customVariantTouched = true;
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
    const progress = this.graph.getProgress();
    this.getVariantData().subjects.forEach(subject => {
      const status = progress[subject.id];
      if (status !== defaultStatus) {
        statuses[subject.id] = status;
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

  /**
   * Update the progress container position based on variant settings
   * @param {Object} position - e.g. { vertical: 'bottom', horizontal: 'right' }
   */
  updateProgressPosition(position) {
    if (!this.progressContainer) return;

    // Default to bottom-right
    const { vertical = 'bottom', horizontal = 'right' } = position || {};

    // Reset all positions
    this.progressContainer.style.top = '';
    this.progressContainer.style.bottom = '';
    this.progressContainer.style.left = '';
    this.progressContainer.style.right = '';

    // Set vertical position
    if (vertical === 'top') {
      this.progressContainer.style.top = '30px';
    } else {
      this.progressContainer.style.bottom = '30px';
    }

    // Set horizontal position
    if (horizontal === 'left') {
      this.progressContainer.style.left = '30px';
    } else {
      this.progressContainer.style.right = '30px';
    }

    // Adjustment for visualization
    if (vertical === 'bottom' && horizontal === 'left') {
      this.progressContainer.style.bottom = '90px';
    }


    // Store current position for screenshot
    this.progressPosition = { vertical, horizontal };
  }

  getProgressPercentages() {
    const subjects = this.getVariantData().subjects;
    const progress = this.graph.getProgress();
    const totalSubjects = subjects.length;
    let approvedCount = 0;
    let pendingCount = 0;
    const approvedIndex = this.config.statuses.length - 1;
    const pendingIndex = this.config.statuses.length - 2;
    subjects.forEach(subject => {
      const statusIndex = this.config.statuses.findIndex(s => s.id === progress[subject.id]);
      if (statusIndex >= approvedIndex) approvedCount++;
      if (statusIndex >= pendingIndex) pendingCount++;
    });
    const approvedPercent = totalSubjects ? Math.round((approvedCount / totalSubjects) * 100) : 0;
    const pendingPercent = totalSubjects ? Math.round((pendingCount / totalSubjects) * 100) : 0;
    return { approvedPercent, pendingPercent };
  }

  updateProgress() {
    const { approvedPercent, pendingPercent } = this.getProgressPercentages();
    if (this.progressPercentage) {
      this.progressPercentage.textContent = `${approvedPercent}%`;
    }
    if (this.progressPendingText) {
      this.progressPendingText.textContent = `${pendingPercent}%`;
    }
    const circumference = 100;
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

    this.customVariantTouched = true;
    this.saveCustomVariant();
    this.renderGraph();
  }

  /**
   * Delete the custom plan and switch to default variant
   */
  deletePlan() {
    if (!this.isCustomVariant || !this.isEditMode) return;

    if (confirm('¿Estás seguro de eliminar el plan personalizado?')) {
      this.deleteCustomVariant();
      localStorage.removeItem(this.getStorageKey());

      // Switch to default variant
      this.currentVariant = this.appData.defaultVariant;
      this.isCustomVariant = false;
      this.isEditMode = false;
      localStorage.setItem(this.VARIANT_STORAGE_KEY, this.currentVariant);
      this.variantSelect.value = this.currentVariant;

      this.renderGraph();
      this.updateEditModeUI();
    }
  }

  fit(e) {
    this.graph.fit();
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

  async screenshot(e) {
    try {
      await document.fonts.ready;
      const png = await this.graph.exportPNG({ scale: 4, bg: 'transparent', full: true });
      const img = await this.loadImage(png);
      const paddingX = img.width * 0.1;
      const paddingY = img.height * 0.05;
      const canvas = document.createElement('canvas');
      canvas.width = img.width + paddingX * 2;
      canvas.height = img.height + paddingY * 2;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, paddingX, paddingY);
      await this.drawProgressGauge(ctx);
      this.drawWatermark(ctx);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo generar el PNG.')), 'image/png');
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `subjects-graph-${this.currentVariant}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Screenshot error:', err);
      alert('Error al capturar pantalla: ' + err.message);
    }
  }

  async loadImage(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('No se pudo cargar la imagen para la captura.'));
        image.src = url;
      });
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async drawProgressGauge(ctx) {
    // Export the same SVG shown on screen, with resolved styles so it can be
    // rendered without the page's stylesheet or CSS variables.
    const source = this.progressCircle.querySelector('svg');
    const snapshot = source.cloneNode(true);
    const properties = [
      'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-dasharray',
      'stroke-dashoffset', 'font-family', 'font-size', 'font-weight',
      'font-variant-numeric', 'letter-spacing', 'text-anchor', 'dominant-baseline'
    ];
    const originals = [source, ...source.querySelectorAll('*')];
    const copies = [snapshot, ...snapshot.querySelectorAll('*')];
    originals.forEach((element, index) => {
      const computed = getComputedStyle(element);
      for (const property of properties) copies[index].style.setProperty(property, computed.getPropertyValue(property));
      // Export final progress even if the on-screen ring is mid-transition.
      if (element.style.strokeDashoffset) copies[index].style.strokeDashoffset = element.style.strokeDashoffset;
    });
    snapshot.setAttribute('width', '108');
    snapshot.setAttribute('height', '108');
    const svg = new Blob([new XMLSerializer().serializeToString(snapshot)], { type: 'image/svg+xml;charset=utf-8' });
    const image = await this.loadImage(svg);
    const gaugeScale = Math.min(ctx.canvas.width, ctx.canvas.height) / 600;
    const size = 108 * gaugeScale;
    const offset = 30 * gaugeScale;
    const { vertical = 'bottom', horizontal = 'right' } = this.progressPosition || {};
    const x = horizontal === 'left' ? offset : ctx.canvas.width - size - offset;
    const y = vertical === 'top' ? offset : ctx.canvas.height - size - offset;
    ctx.drawImage(image, x, y, size, size);
  }

  drawWatermark(ctx) {
    const minDimension = Math.min(ctx.canvas.width, ctx.canvas.height);
    const wmScale = minDimension / 800;
    const text = 'raniagus.github.io/subjects-graph';
    const fontSize = 12 * wmScale;
    const x = ctx.canvas.width / 2;
    const y = 20 * wmScale;
    ctx.font = `500 ${fontSize}px ${getComputedStyle(document.body).fontFamily}`;
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
    if (new URLSearchParams(location.search).get('pwa') === 'off') return;
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
