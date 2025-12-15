// Main Application
import { Graph } from './graph.js';

(function() {
  'use strict';

  const VARIANT_STORAGE_KEY = 'selectedVariant';
  const VARIANT_PARAM = 'variant';

  // State management
  let cy = null; // Cytoscape instance
  let graph = null; // Graph instance
  let appData = null; // Loaded from data.json
  let currentVariant = null;
  let config = null; // { statuses, availabilities }

  // Color lookup from variant's colors property
  let colors = null;

  // Resolve color variable name to hex value
  function resolveCssColor(varName) {
    return colors?.[varName] ?? '#000000';
  }

  // Get storage key for current variant
  function getStorageKey() {
    return `graphStatus-${currentVariant}`;
  }

  // Load subject statuses from localStorage
  function loadStatuses() {
    const saved = localStorage.getItem(getStorageKey());
    return saved ? JSON.parse(saved) : {};
  }

  // Save subject statuses to localStorage
  function saveStatuses() {
    const statuses = {};
    const defaultStatus = config.statuses[0].id;
    cy.nodes('[nodeType="subject"]').forEach(node => {
      const status = node.data('status');
      if (status !== defaultStatus) {
        statuses[node.id()] = status;
      }
    });
    localStorage.setItem(getStorageKey(), JSON.stringify(statuses));
  }

  // CytoscapeDrawer - implements drawer interface for Graph
  class CytoscapeDrawer {
    constructor() {
      this.nodes = [];
      this.edges = [];
      this.positions = new Set();
    }

    drawCircle({ id, label, tooltip, position: { x, y }, fillColor, borderColor, textColor }) {
      this.nodes.push({
        data: {
          id,
          label,
          name: tooltip,
          nodeType: 'subject',
          status: this._getStatusIdByColor(fillColor),  // Keep for cycling logic
          fillColor,
          borderColor,
          textColor,
        },
        position: { x, y },
        locked: true,
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
          borderColor: config.availabilities[0].color,
        },
        position: { x, y },
        locked: true,
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

    _getStatusIdByColor(color) {
      return config.statuses.find(s => s.color === color)?.id ?? config.statuses[0].id;
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

  // Generate legend from status configuration
  function generateLegend() {
    const statusLegend = document.getElementById('status-legend');
    const borderLegend = document.getElementById('border-legend');

    // Clear existing content
    statusLegend.innerHTML = '';
    borderLegend.innerHTML = '';

    // Generate status legend items
    config.statuses.forEach(status => {
      if (status.name) {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
          <div class="legend-color" style="background: ${status.color}"></div>
          <span>${status.name}</span>
        `;
        statusLegend.appendChild(item);
      } else {
        console.warn(`Status ${status.id} has no name to render in references section`);
      }
    });

    // Generate border legend items from availabilities
    config.availabilities.forEach(avail => {
      if (avail.name) {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
          <div class="legend-color legend-border" style="border-color: ${avail.color}"></div>
          <span>${avail.name}</span>
        `;
        borderLegend.appendChild(item);
      } else {
        console.warn(`Availability ${avail.id} has no name to render in references section`);
      }
    });
  }

  // Initialize the application
  async function init() {
    // Fetch data.json
    try {
      const response = await fetch('data.json');
      appData = await response.json();
    } catch (err) {
      console.error('Error loading data.json:', err);
      return;
    }

    // Populate variant dropdown
    const variantSelect = document.getElementById('variant-select');
    variantSelect.innerHTML = '';
    Object.entries(appData.variants).forEach(([id, variant]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = variant.name;
      variantSelect.appendChild(option);
    });

    // Load selected variant from URL query param or use default
    const urlParams = new URLSearchParams(window.location.search);
    const variantParam = urlParams.get(VARIANT_PARAM);
    const variantInStorage = localStorage.getItem(VARIANT_STORAGE_KEY);

    currentVariant = (variantParam && appData.variants[variantParam])
      ? variantParam
      : (variantInStorage && appData.variants[variantInStorage])
        ? variantInStorage
        : appData.defaultVariant;

    if (currentVariant !== variantInStorage) {
      try {
        localStorage.setItem(VARIANT_STORAGE_KEY, currentVariant);
      } catch (err) {
        console.warn('Could not save selected variant to localStorage:', err);
      }
    }

    // Set dropdown to current variant
    variantSelect.value = currentVariant;

    // Load variant data
    const variantData = appData.variants[currentVariant];
    colors = appData.colors;

    // Set up config with resolved CSS colors
    config = {
      statuses: variantData.statuses.map(s => ({ ...s, color: resolveCssColor(s.color) })),
      availabilities: variantData.availabilities.map(a => ({ ...a, color: resolveCssColor(a.color) })),
    };

    // Generate legend
    generateLegend();

    // Load saved statuses from localStorage and merge with subjects
    const savedStatuses = loadStatuses();
    const defaultStatus = config.statuses[0].id;
    const subjects = variantData.subjects.map(s => ({
      ...s,
      status: savedStatuses[s.id] || s.status || defaultStatus,
    }));

    // Create Graph and render
    graph = new Graph(config, subjects, variantData.edges);
    const drawer = new CytoscapeDrawer();
    graph.render(drawer);

    // Initialize Cytoscape with drawer's elements
    initCytoscape(drawer.getElements());
    setupEventListeners();
    registerServiceWorker();
  }

  // Detect whether the app is running as an installed PWA
  function isInstalled() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = window.navigator.standalone === true;
    const isAndroidWebAPK = /android/.test(navigator.userAgent) && document.referrer && document.referrer.startsWith('android-app://');
    const persisted = localStorage.getItem('pwaInstalled') === 'true';
    return isStandalone || isIosStandalone || isAndroidWebAPK || persisted;
  }

  // Register service worker for offline functionality
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('Service Worker registered:', reg);
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  }

  // Build dynamic stylesheet based on config
  function buildStylesheet() {
    const styles = [
      // Base node style (for subject nodes)
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
          'font-size': '18px',
          'font-weight': 'bold',
          'font-family': 'Open Sans, -apple-system, BlinkMacSystemFont, sans-serif',
          'border-width': 3,
          'border-opacity': 1,
          'background-color': 'data(fillColor)',
          'border-color': 'data(borderColor)',
          'transition-property': 'background-color, border-color',
          'transition-duration': '0.3s'
        }
      },

      // Connector node style (rhombus/diamond)
      {
        selector: 'node[nodeType="connector"]',
        style: {
          'width': 15,
          'height': 15,
          'shape': 'diamond',
          'label': '',
          'background-opacity': 0,
          'border-width': 3,
          'border-color': 'data(borderColor)',
          'transition-property': 'border-color',
          'transition-duration': '0.3s',
          'events': 'no',
        }
      },

      // Invisible connector style (for 1-to-1 connectors)
      {
        selector: 'node[?isInvisible]',
        style: {
          'opacity': 0,
          'width': 0.0001,
          'height': 0.0001,
          'border-width': 0,
          'events': 'no',
          'label': '',
        }
      },

      // Invisible connector with gap (larger size)
      {
        selector: 'node[?isInvisible][?withGap]',
        style: {
          'width': 20,
          'height': 20
        }
      },

      // Edges
      {
        selector: 'edge',
        style: {
          'width': 3.5,
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

      // Edges pointing to invisible connectors (no arrow, just a line)
      {
        selector: 'edge[?toInvisible]',
        style: {
          'target-arrow-shape': 'none'
        }
      }
    ];

    return styles;
  }

  // Initialize Cytoscape with elements from drawer
  function initCytoscape(elements) {
    cy = cytoscape({
      container: document.getElementById('cy'),
      elements: elements,
      style: buildStylesheet(),
      layout: {
        name: 'preset',
        fit: true,
        padding: 50
      },
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.2
    });

    // Update progress on initial load
    updateProgress();

    // Click handler to cycle through statuses
    cy.on('tap', 'node[nodeType="subject"]', function(evt) {
      const node = evt.target;
      const currentFillColor = node.data('fillColor');
      const currentStatusObj = config.statuses.find(s => s.color === currentFillColor);
      const currentIndex = config.statuses.indexOf(currentStatusObj);
      const nextIndex = (currentIndex + 1) % config.statuses.length;
      const nextStatus = config.statuses[nextIndex].id;
      const nextFillColor = config.statuses[nextIndex].color;

      // Update status and colors
      node.data('status', nextStatus);
      node.data('fillColor', nextFillColor);
      reRenderGraph();
      saveStatuses();
    });

    // Cursor styles and tooltip
    const container = document.getElementById('cy');
    const tooltip = document.createElement('div');
    tooltip.className = 'cy-tooltip';
    container.appendChild(tooltip);

    cy.on('mouseover', 'node[nodeType="subject"]', function(e) {
      container.style.cursor = 'pointer';
      tooltip.textContent = e.target.data('name');
      tooltip.style.display = 'block';
    });
    cy.on('mousemove', 'node[nodeType="subject"]', function(e) {
      const pos = e.renderedPosition;
      tooltip.style.left = (pos.x + 15) + 'px';
      tooltip.style.top = (pos.y + 15) + 'px';
    });
    cy.on('mouseout', 'node', function() {
      container.style.cursor = 'grab';
      tooltip.style.display = 'none';
    });

    // Handle appinstalled event
    window.addEventListener('appinstalled', () => {
      const installBtn = document.getElementById('install-button');
      if (installBtn) installBtn.style.display = 'none';
      try {
        localStorage.setItem('pwaInstalled', 'true');
      } catch (err) {}
      registerServiceWorker();
    });
  }

  // Re-render graph after status change
  function reRenderGraph() {
    // Collect current statuses from cytoscape
    const statuses = {};
    cy.nodes('[nodeType="subject"]').forEach(node => {
      statuses[node.id()] = node.data('status');
    });

    // Get variant data and merge with current statuses
    const variantData = appData.variants[currentVariant];
    const defaultStatus = config.statuses[0].id;
    const subjects = variantData.subjects.map(s => ({
      ...s,
      status: statuses[s.id] || s.status || defaultStatus,
    }));

    // Re-create graph and render
    graph = new Graph(config, subjects, variantData.edges);
    const drawer = new CytoscapeDrawer();
    graph.render(drawer);

    // Update cytoscape node/edge data
    const elements = drawer.getElements();

    // Update nodes
    elements.nodes.forEach(newNode => {
      const cyNode = cy.getElementById(newNode.data.id);
      if (cyNode.length) {
        cyNode.data('status', newNode.data.status);
        cyNode.data('fillColor', newNode.data.fillColor);
        cyNode.data('borderColor', newNode.data.borderColor);
        cyNode.data('textColor', newNode.data.textColor);
      }
    });

    // Update edges
    elements.edges.forEach(newEdge => {
      const cyEdge = cy.getElementById(newEdge.data.id);
      if (cyEdge.length) {
        cyEdge.data('color', newEdge.data.color);
      }
    });

    updateProgress();
  }

  // Update progress percentages
  function updateProgress() {
    const totalSubjects = cy.nodes('[nodeType="subject"]').length;
    let approvedCount = 0;
    let pendingCount = 0;

    const approvedIndex = config.statuses.length - 1;
    const pendingIndex = config.statuses.length - 2;

    cy.nodes('[nodeType="subject"]').forEach(node => {
      const status = node.data('status');
      const statusIndex = config.statuses.findIndex(s => s.id === status);
      if (statusIndex >= approvedIndex) approvedCount++;
      if (statusIndex >= pendingIndex) pendingCount++;
    });

    const approvedPercent = Math.round((approvedCount / totalSubjects) * 100);
    const pendingPercent = Math.round((pendingCount / totalSubjects) * 100);

    document.getElementById('progress-percentage').textContent = `${approvedPercent}%`;
    document.getElementById('progress-pending-text').textContent = `${pendingPercent}%`;

    const circumference = 283;
    document.getElementById('progress-approved').style.strokeDashoffset = circumference - (circumference * approvedPercent / 100);
    document.getElementById('progress-pending').style.strokeDashoffset = circumference - (circumference * pendingPercent / 100);
  }

  // Setup event listeners
  function setupEventListeners() {
    // Variant selector
    document.getElementById('variant-select').addEventListener('change', (e) => {
      const newVariant = e.target.value;
      if (appData.variants[newVariant]) {
        const url = new URL(window.location);
        url.searchParams.set(VARIANT_PARAM, newVariant);
        window.location.href = url.toString();
      }
    });

    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
      localStorage.removeItem(getStorageKey());
      location.reload();
    });

    // Fit button
    document.getElementById('fit-btn').addEventListener('click', () => {
      cy.fit(50);
    });

    // Export button - exports statuses for current variant
    document.getElementById('export-btn').addEventListener('click', () => {
      const statuses = loadStatuses();
      if (Object.keys(statuses).length === 0) {
        alert('No hay progreso para exportar.');
        return;
      }
      const exportData = { variant: currentVariant, statuses };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `progress-${currentVariant}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import button
    document.getElementById('import-btn').addEventListener('click', () => {
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
            if (!data.statuses || typeof data.statuses !== 'object') {
              throw new Error('Formato de datos inválido');
            }
            localStorage.setItem(getStorageKey(), JSON.stringify(data.statuses));
            location.reload();
          } catch (err) {
            alert('Error al importar: ' + err.message);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // Screenshot button
    document.getElementById('screenshot-btn').addEventListener('click', () => {
      try {
        const scale = 4;
        const png = cy.png({
          output: 'blob',
          scale: scale,
          bg: 'transparent',
          full: true
        });

        // Load the cytoscape image and composite with progress gauge
        const img = new Image();
        img.onload = () => {
          // Padding proportional to image size (10% horizontal, 5% vertical)
          const paddingX = img.width * 0.1;
          const paddingY = img.height * 0.05;
          const canvas = document.createElement('canvas');
          canvas.width = img.width + paddingX * 2;
          canvas.height = img.height + paddingY * 2;
          const ctx = canvas.getContext('2d');

          // Draw cytoscape graph centered with padding
          ctx.drawImage(img, paddingX, paddingY);

          // Draw progress gauge in bottom-right corner (in padding area)
          drawProgressGauge(ctx);

          // Draw watermark
          drawWatermark(ctx);

          // Download the composited image
          canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `subjects-graph-${currentVariant}.png`;
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
    });

    // Draw progress gauge on canvas
    function drawProgressGauge(ctx) {
      // Scale gauge relative to canvas size (15% of smaller dimension)
      const minDimension = Math.min(ctx.canvas.width, ctx.canvas.height);
      const gaugeScale = minDimension / 800;

      const size = 120 * gaugeScale;
      // Position offset scales with gauge size for consistency
      const offset = 30 * gaugeScale;
      const x = ctx.canvas.width - size - offset;
      const y = ctx.canvas.height - size - offset;
      const centerX = x + size / 2;
      const centerY = y + size / 2;
      const radius = 45 * gaugeScale;
      const strokeWidth = 8 * gaugeScale;

      // Get current progress values
      const approvedPercent = parseInt(document.getElementById('progress-percentage').textContent);
      const pendingPercent = parseInt(document.getElementById('progress-pending-text').textContent);

      // Draw background circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#161b22';
      ctx.fill();

      // Draw track circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#21262d';
      ctx.lineWidth = strokeWidth;
      ctx.stroke();

      // Draw pending arc (behind approved)
      if (pendingPercent > 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pendingPercent / 100));
        ctx.strokeStyle = '#2255d4';
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Draw approved arc (on top)
      if (approvedPercent > 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * approvedPercent / 100));
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Draw approved percentage text
      ctx.fillStyle = '#3b82f6';
      ctx.font = `700 ${1.5 * 16 * gaugeScale}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${approvedPercent}%`, centerX, centerY - 6 * gaugeScale);

      // Draw pending percentage text
      ctx.fillStyle = '#2255d4';
      ctx.font = `600 ${0.75 * 16 * gaugeScale}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(`${pendingPercent}%`, centerX, centerY + 12 * gaugeScale);
    }

    // Draw watermark on canvas
    function drawWatermark(ctx) {
      // Scale watermark relative to canvas size
      const minDimension = Math.min(ctx.canvas.width, ctx.canvas.height);
      const wmScale = minDimension / 800;

      const text = 'raniagus.github.io/subjects-graph';
      const fontSize = 12 * wmScale;
      const x = ctx.canvas.width / 2;
      const y = 20 * wmScale;

      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Draw black stroke
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3 * wmScale;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);

      // Draw white fill
      ctx.fillStyle = 'white';
      ctx.fillText(text, x, y);
    }
  }

  // Start the application when DOM is ready
  async function bootstrap() {
    await init();
    lucide.createIcons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
