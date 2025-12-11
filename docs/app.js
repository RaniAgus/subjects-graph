// Main Application
(function() {
  'use strict';

  // Status configuration (loaded from variant data)
  let statusConfig = [];       // Full status objects from data.json
  let STATUS_ORDER = [];       // Status IDs in order
  let STATUS_COLORS = {};      // Status ID -> fill color
  let STATUS_BORDER_COLORS = {}; // Status ID -> border color

  // Variant storage key
  const VARIANT_STORAGE_KEY = 'selectedVariant';

  // State management
  let cy; // Cytoscape instance
  let appData = null; // Loaded from data.json
  let currentVariant = null;
  let currentSubjects = [];
  let currentLinks = [];

  // Get storage key for current variant
  function getStorageKey() {
    return `graphStatus-${currentVariant}`;
  }

  // Save subject statuses to localStorage (keyed by variant)
  function saveData() {
    const statuses = {};
    currentSubjects.forEach(s => {
      const node = cy.$(`#${s.id}`);
      const status = node ? node.data('status') : s.status || STATUS_ORDER[0];
      if (status !== STATUS_ORDER[0]) {
        statuses[s.id] = status; // Only save non-inactive statuses
      }
    });
    localStorage.setItem(getStorageKey(), JSON.stringify(statuses));
  }

  // Load subject statuses from localStorage
  function loadStatuses() {
    const saved = localStorage.getItem(getStorageKey());
    return saved ? JSON.parse(saved) : {};
  }

  // Initialize the application
  async function init() {
    // Fetch data.json
    try {
      const response = await fetch('data.json');
      appData = await response.json();
    } catch (err) {
      console.error('Error loading data.json:', err);
      alert('Error al cargar datos');
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

    // Load selected variant from localStorage or use default
    const savedVariant = localStorage.getItem(VARIANT_STORAGE_KEY);
    currentVariant = (savedVariant && appData.variants[savedVariant])
      ? savedVariant
      : appData.defaultVariant;

    // Set dropdown to current variant
    variantSelect.value = currentVariant;

    // Load graph structure from variant data
    const variantData = appData.variants[currentVariant];
    currentSubjects = variantData.subjects.map(s => ({ ...s }));
    currentLinks = variantData.links;

    // Load status configuration from variant data
    statusConfig = variantData.statuses;
    STATUS_ORDER = statusConfig.map(s => s.id);
    STATUS_COLORS = Object.fromEntries(statusConfig.map(s => [s.id, s.color]));
    STATUS_BORDER_COLORS = Object.fromEntries(statusConfig.map(s => [s.id, s.borderColor]));

    // Apply saved statuses
    const savedStatuses = loadStatuses();
    currentSubjects.forEach(s => {
      if (savedStatuses[s.id]) {
        s.status = savedStatuses[s.id];
      }
    });

    initGraph();
    setupEventListeners();
    registerServiceWorkerIfInstalled();
  }

  // Detect whether the app is running as an installed PWA
  function isInstalled() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = window.navigator.standalone === true;
    const isAndroidWebAPK = /android/.test(navigator.userAgent) && document.referrer && document.referrer.startsWith('android-app://');
    const persisted = localStorage.getItem('pwaInstalled') === 'true';
    return isStandalone || isIosStandalone || isAndroidWebAPK || persisted;
  }

  // Register service worker only when in installed mode (Option A)
  async function registerServiceWorkerIfInstalled() {
    if (!('serviceWorker' in navigator)) return;
    if (!isInstalled()) return; // Only register for installed PWA
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('Service Worker registered (installed PWA):', reg);
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  }

  // Build dynamic stylesheet based on status configuration
  function buildStylesheet() {
    const defaultBorderColor = STATUS_BORDER_COLORS[STATUS_ORDER[0]];

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
          'color': '#ffffff',
          'font-size': '12px',
          'font-weight': 'bold',
          'text-outline-color': '#000',
          'text-outline-width': 1,
          'border-width': 3,
          'border-opacity': 1,
          'background-color': STATUS_COLORS[STATUS_ORDER[0]],
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
          'border-color': defaultBorderColor,
          'transition-property': 'border-color',
          'transition-duration': '0.3s'
        }
      },

      // Invisible connector style (for 1-to-1 connectors)
      {
        selector: 'node[?isInvisible]',
        style: {
          'opacity': 0,
          'width': 1,
          'height': 1,
          'label': ''
        }
      },

      // Edges
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': defaultBorderColor,
          'target-arrow-color': defaultBorderColor,
          'target-arrow-shape': 'vee',
          'curve-style': 'bezier',
          'arrow-scale': 1.5,
          'transition-property': 'line-color, target-arrow-color',
          'transition-duration': '0.3s'
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

    // Generate status-specific fill color styles
    statusConfig.forEach(status => {
      styles.push({
        selector: `node[status="${status.id}"]`,
        style: { 'background-color': status.color }
      });
    });

    // Generate border color styles for each status (used as borderState)
    statusConfig.forEach(status => {
      styles.push({
        selector: `node[borderState="${status.id}"]`,
        style: { 'border-color': status.borderColor }
      });
    });

    return styles;
  }

  // Initialize Cytoscape graph
  function initGraph() {
    // Prepare subject nodes
    const nodes = currentSubjects.map(subject => ({
      data: {
        id: subject.id,
        label: subject.id,
        name: subject.name,
        nodeType: 'subject',
        status: subject.status || STATUS_ORDER[0],
        borderState: STATUS_ORDER[0],
        position: subject.position
      },
      position: subject.position ? { x: subject.position.x, y: subject.position.y } : undefined,
      locked: true  // Subject nodes are not draggable
    }));

    // Helper to check if an ID is a link (connector) ID
    const linkIds = new Set(currentLinks.map(l => l.id));
    const isLinkId = (id) => linkIds.has(id);

    // Add static connector nodes from links array
    const connectorNodes = currentLinks.map(link => {
      // Invisible if: 1 source + 1 destination, OR connects to/from another link
      const connectsToLink = link.destinations?.some(id => isLinkId(id));
      const connectsFromLink = link.sources?.some(id => isLinkId(id));
      const isInvisible = (link.sources?.length === 1 && link.destinations?.length === 1) ||
                          connectsToLink || connectsFromLink;
      return {
        data: {
          id: link.id,
          label: 'Y',
          nodeType: 'connector',
          isInvisible: isInvisible,
          borderState: STATUS_ORDER[0],
          sources: link.sources || [],
          destinations: link.destinations || []
        },
        position: link.position ? { x: link.position.x, y: link.position.y } : undefined,
        locked: true
      };
    });

    nodes.push(...connectorNodes);

    // Build edges based on prerequisites
    const edges = [];
    const processedConnections = new Set(); // Track which connections we've made through connectors

    // First, process all connections through connectors
    currentLinks.forEach(link => {
      if (link.sources && link.destinations) {
        // Check if this connector should be invisible
        const connectsToLink = link.destinations.some(id => isLinkId(id));
        const connectsFromLink = link.sources.some(id => isLinkId(id));
        const isInvisible = (link.sources.length === 1 && link.destinations.length === 1) ||
                            connectsToLink || connectsFromLink;

        if (isInvisible) {
          // For invisible connectors: draw source -> connector and connector -> destination
          // But the connector node itself won't be visible, creating the effect of - () ->
          link.sources.forEach(sourceId => {
            const sourceIsLink = isLinkId(sourceId);
            edges.push({
              data: {
                id: `${sourceId}-${link.id}`,
                source: sourceId,
                target: link.id,
                toInvisible: true,  // Mark edge going to invisible connector
                fromInvisible: sourceIsLink  // Mark if coming from another invisible connector
              }
            });
          });

          link.destinations.forEach(destId => {
            const destIsLink = isLinkId(destId);
            edges.push({
              data: {
                id: `${link.id}-${destId}`,
                source: link.id,
                target: destId,
                toInvisible: destIsLink  // Mark if going to another invisible connector
              }
            });
          });

          // Mark connections as processed
          link.sources.forEach(sourceId => {
            link.destinations.forEach(destId => {
              processedConnections.add(`${sourceId}-${destId}`);
            });
          });
        } else {
          // For visible connectors: draw both source -> connector and connector -> destination
          // Connect each source to the connector
          link.sources.forEach(sourceId => {
            edges.push({
              data: {
                id: `${sourceId}-${link.id}`,
                source: sourceId,
                target: link.id
              }
            });

            // Mark these connections as processed for each destination
            link.destinations.forEach(destId => {
              processedConnections.add(`${sourceId}-${destId}`);
            });
          });

          // Connect the connector to each destination
          link.destinations.forEach(destId => {
            edges.push({
              data: {
                id: `${link.id}-${destId}`,
                source: link.id,
                target: destId
              }
            });
          });
        }
      }
    });

    // Helper: get ultimate subject destinations from a link (follows link chains)
    const getUltimateDestinations = (linkId, visited = new Set()) => {
      if (visited.has(linkId)) return [];
      visited.add(linkId);

      const linkData = currentLinks.find(l => l.id === linkId);
      if (!linkData || !linkData.destinations) return [];

      const subjectDests = [];
      linkData.destinations.forEach(destId => {
        if (isLinkId(destId)) {
          subjectDests.push(...getUltimateDestinations(destId, visited));
        } else {
          subjectDests.push(destId);
        }
      });
      return subjectDests;
    };

    // Helper: get ultimate subject sources from a link (follows link chains)
    const getUltimateSources = (linkId, visited = new Set()) => {
      if (visited.has(linkId)) return [];
      visited.add(linkId);

      const linkData = currentLinks.find(l => l.id === linkId);
      if (!linkData || !linkData.sources) return [];

      const subjectSources = [];
      linkData.sources.forEach(sourceId => {
        if (isLinkId(sourceId)) {
          subjectSources.push(...getUltimateSources(sourceId, visited));
        } else {
          subjectSources.push(sourceId);
        }
      });
      return subjectSources;
    };

    // Mark all ultimate source-destination pairs through link chains as processed
    currentLinks.forEach(link => {
      const ultimateSources = getUltimateSources(link.id);
      const ultimateDests = getUltimateDestinations(link.id);
      ultimateSources.forEach(sourceId => {
        ultimateDests.forEach(destId => {
          processedConnections.add(`${sourceId}-${destId}`);
        });
      });
    });

    // Helper: get all prerequisite IDs for a subject (flattened from all status groups)
    const getAllPrereqIds = (subjectId) => {
      const subject = currentSubjects.find(s => s.id === subjectId);
      if (!subject || !subject.prerequisites) return [];
      return Object.values(subject.prerequisites).flat();
    };

    // Helper: check if targetId is transitively reachable from sourceId
    const isTransitivelyReachable = (sourceId, targetId, visited = new Set()) => {
      if (visited.has(sourceId)) return false;
      visited.add(sourceId);

      const prereqs = getAllPrereqIds(sourceId);
      for (const prereqId of prereqs) {
        if (prereqId === targetId) return true;
        if (isTransitivelyReachable(prereqId, targetId, visited)) return true;
      }
      return false;
    };

    // Then, add direct connections for prerequisites not going through connectors
    // Skip transitive edges (if A→B→C exists, don't draw A→C)
    currentSubjects.forEach(subject => {
      const allPrereqIds = getAllPrereqIds(subject.id);

      // Filter out transitive prerequisites
      // A prereq is transitive if it's reachable through another prereq
      const directPrereqs = allPrereqIds.filter(prereqId => {
        // Check if any OTHER prereq has this prereqId in its transitive closure
        return !allPrereqIds.some(otherPrereqId =>
          otherPrereqId !== prereqId && isTransitivelyReachable(otherPrereqId, prereqId)
        );
      });

      directPrereqs.forEach(prereqId => {
        const connectionKey = `${prereqId}-${subject.id}`;

        // Only add direct edge if not already connected through a connector
        if (!processedConnections.has(connectionKey)) {
          edges.push({
            data: {
              id: connectionKey,
              source: prereqId,
              target: subject.id
            }
          });
        }
      });
    });

    // Initialize Cytoscape
    cy = cytoscape({
      container: document.getElementById('cy'),

      elements: {
        nodes: nodes,
        edges: edges
      },

      style: buildStylesheet(),

      layout: {
        name: 'preset',
        positions: function(node) {
          const data = node.data();
          if (data.position) {
            return { x: data.position.x, y: data.position.y };
          }
          // For connector nodes, position them automatically
          return undefined;
        },
        fit: true,
        padding: 50
      },

      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.2
    });

    updateDependentStyles();

    // Click handler to cycle through statuses
    cy.on('tap', 'node[nodeType="subject"]', function(evt) {
      const node = evt.target;
      const currentStatus = node.data('status');
      const currentIndex = STATUS_ORDER.indexOf(currentStatus);
      const nextIndex = (currentIndex + 1) % STATUS_ORDER.length;
      const nextStatus = STATUS_ORDER[nextIndex];

      node.data('status', nextStatus);
      updateDependentStyles();
      saveData();
    });

    // Update borders and edge colors based on dependency statuses
    function updateDependentStyles() {
      // Helper: get status index in order (higher = more complete)
      const getStatusIndex = (status) => STATUS_ORDER.indexOf(status);
      const lastStatusId = STATUS_ORDER[STATUS_ORDER.length - 1];
      const defaultStatusId = STATUS_ORDER[0];

      // Helper: check if status meets minimum requirement
      const statusMeetsMinimum = (status, minStatus) =>
        getStatusIndex(status) >= getStatusIndex(minStatus);

      // Helper: get status of a node by id
      const getNodeStatus = (nodeId) => {
        const node = cy.getElementById(nodeId);
        return node.data('status');
      };

      // Helper: find highest status level where all prerequisites are satisfied
      // Returns the status ID to use for borderState, or defaultStatusId if none met
      const getHighestSatisfiedStatus = (subjectData) => {
        const prereqs = subjectData.prerequisites || {};
        const hasPrereqs = Object.keys(prereqs).length > 0;
        if (!hasPrereqs) return lastStatusId; // No prerequisites = fully satisfied

        // First check: do all subjects meet their MINIMUM required status?
        let allMinimumsMet = true;
        for (const [requiredStatus, subjectIds] of Object.entries(prereqs)) {
          const groupMet = subjectIds.every(id =>
            statusMeetsMinimum(getNodeStatus(id), requiredStatus)
          );
          if (!groupMet) {
            allMinimumsMet = false;
            break;
          }
        }

        if (!allMinimumsMet) return defaultStatusId; // Can't even start

        // All minimums met - now find the highest level where ALL prereqs are satisfied
        // (i.e., find the minimum status among all prereq subjects)
        let minStatusIndex = STATUS_ORDER.length - 1;
        for (const subjectIds of Object.values(prereqs)) {
          for (const id of subjectIds) {
            const statusIndex = getStatusIndex(getNodeStatus(id));
            minStatusIndex = Math.min(minStatusIndex, statusIndex);
          }
        }

        return STATUS_ORDER[minStatusIndex];
      };

      // Update subject node borders based on their prerequisites
      cy.nodes('[nodeType="subject"]').forEach(node => {
        const subjectData = currentSubjects.find(s => s.id === node.id());
        const satisfiedStatus = getHighestSatisfiedStatus(subjectData);
        node.data('borderState', satisfiedStatus || defaultStatusId);
      });

      // Helper: get ultimate subject sources from a connector (follows link chains)
      const getUltimateSubjectSources = (linkId, visited = new Set()) => {
        if (visited.has(linkId)) return []; // Avoid cycles
        visited.add(linkId);

        const linkData = currentLinks.find(l => l.id === linkId);
        if (!linkData || !linkData.sources) return [];

        const subjectSources = [];
        linkData.sources.forEach(sourceId => {
          const isLink = currentLinks.some(l => l.id === sourceId);
          if (isLink) {
            subjectSources.push(...getUltimateSubjectSources(sourceId, visited));
          } else {
            subjectSources.push(sourceId);
          }
        });
        return subjectSources;
      };

      // Helper: get highest satisfied status for a set of source subjects
      const getSourcesSatisfiedStatus = (sourceIds) => {
        if (sourceIds.length === 0) return null;

        // Find the minimum satisfied status across all sources
        let minSatisfiedIndex = STATUS_ORDER.length - 1;

        for (const id of sourceIds) {
          const subjectData = currentSubjects.find(s => s.id === id);
          const sourceStatus = getNodeStatus(id);
          const prereqSatisfied = getHighestSatisfiedStatus(subjectData);

          // The source's effective status is the minimum of its own status and its prereq satisfaction
          const sourceIndex = getStatusIndex(sourceStatus);
          const prereqIndex = prereqSatisfied ? getStatusIndex(prereqSatisfied) : -1;
          const effectiveIndex = Math.min(sourceIndex, prereqIndex);

          minSatisfiedIndex = Math.min(minSatisfiedIndex, effectiveIndex);
        }

        return minSatisfiedIndex >= 0 ? STATUS_ORDER[minSatisfiedIndex] : null;
      };

      // Update connector node borders based on their sources
      cy.nodes('[nodeType="connector"]').forEach(node => {
        const ultimateSources = getUltimateSubjectSources(node.id());
        if (ultimateSources.length === 0) return;

        const satisfiedStatus = getSourcesSatisfiedStatus(ultimateSources);
        node.data('borderState', satisfiedStatus || defaultStatusId);
      });

      // Update edge colors based on source node
      cy.edges().forEach(edge => {
        const sourceNode = edge.source();
        const sourceType = sourceNode.data('nodeType');

        let satisfiedStatus = null;

        if (sourceType === 'connector') {
          const ultimateSources = getUltimateSubjectSources(sourceNode.id());
          satisfiedStatus = getSourcesSatisfiedStatus(ultimateSources);
        } else if (sourceType === 'subject') {
          satisfiedStatus = getSourcesSatisfiedStatus([sourceNode.id()]);
        }

        const edgeColor = STATUS_BORDER_COLORS[satisfiedStatus] || STATUS_BORDER_COLORS[defaultStatusId];
        edge.style({
          'line-color': edgeColor,
          'target-arrow-color': edgeColor
        });
      });

      // Update progress circle
      updateProgress();
    }

    // Update progress percentages
    function updateProgress() {
      const totalSubjects = currentSubjects.length;
      let approvedCount = 0;
      let pendingCount = 0;

      // Progress thresholds based on position in status array
      // Approved = last status, Pending = second-to-last and above
      const approvedThreshold = STATUS_ORDER.length - 1;
      const pendingThreshold = STATUS_ORDER.length - 2;

      cy.nodes('[nodeType="subject"]').forEach(node => {
        const status = node.data('status');
        const statusIndex = STATUS_ORDER.indexOf(status);
        if (statusIndex >= approvedThreshold) approvedCount++;
        if (statusIndex >= pendingThreshold) pendingCount++;
      });

      const approvedPercent = Math.round((approvedCount / totalSubjects) * 100);
      const pendingPercent = Math.round((pendingCount / totalSubjects) * 100);

      // Update text
      document.getElementById('progress-percentage').textContent = `${approvedPercent}%`;
      document.getElementById('progress-pending-text').textContent = `${pendingPercent}%`;

      // Update circles (circumference = 2 * PI * 45 ≈ 283)
      const circumference = 283;
      const approvedOffset = circumference - (circumference * approvedPercent / 100);
      const pendingOffset = circumference - (circumference * pendingPercent / 100);

      document.getElementById('progress-approved').style.strokeDashoffset = approvedOffset;
      document.getElementById('progress-pending').style.strokeDashoffset = pendingOffset;
    }

    // Initial update
    updateDependentStyles();

    // Cursor styles and tooltip
    const container = document.getElementById('cy');

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'cy-tooltip';
    container.appendChild(tooltip);

    cy.on('mouseover', 'node[nodeType="subject"]', function(e) {
      container.style.cursor = 'pointer';
      tooltip.textContent = e.target.data('name');
      tooltip.style.display = 'block';
    });
    cy.on('mouseover', 'node[nodeType="connector"]', function() {
      container.style.cursor = 'default';
    });
    cy.on('mousemove', 'node[nodeType="subject"]', function(e) {
      const pos = e.renderedPosition;
      tooltip.style.left = (pos.x + 15) + 'px';
      tooltip.style.top = (pos.y + 15) + 'px';
    });
    cy.on('mouseout', 'node', function() {
      container.style.cursor = 'default';
      tooltip.style.display = 'none';
    });

    // Handle appinstalled event and update UX accordingly
    window.addEventListener('appinstalled', () => {
      const installBtn = document.getElementById('install-button');
      if (installBtn) installBtn.style.display = 'none';
      try {
        localStorage.setItem('pwaInstalled', 'true');
      } catch (err) {
        // ignore storage errors
      }
      // Register SW on installed app
      registerServiceWorkerIfInstalled();
      console.log('App installed (appinstalled event)');
    });
  }

  // Setup event listeners
  function setupEventListeners() {
    // Variant selector
    document.getElementById('variant-select').addEventListener('change', (e) => {
      const newVariant = e.target.value;
      if (appData.variants[newVariant]) {
        localStorage.setItem(VARIANT_STORAGE_KEY, newVariant);
        location.reload();
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
          const paddingX = 150 * scale; // Horizontal padding
          const paddingY = 50 * scale;  // Vertical padding
          const canvas = document.createElement('canvas');
          canvas.width = img.width + paddingX * 2;
          canvas.height = img.height + paddingY * 2;
          const ctx = canvas.getContext('2d');

          // Draw cytoscape graph centered with padding
          ctx.drawImage(img, paddingX, paddingY);

          // Draw progress gauge in bottom-right corner (in padding area)
          drawProgressGauge(ctx, scale);

          // Draw watermark
          drawWatermark(ctx, scale);

          // Download the composited image
          canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = 'subjects-graph.png';
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
    function drawProgressGauge(ctx, scale) {
      const size = 120 * scale;
      const padding = 10 * scale;
      const x = ctx.canvas.width - size - 30 * scale;
      const y = ctx.canvas.height - size - 30 * scale;
      const centerX = x + size / 2;
      const centerY = y + size / 2;
      const radius = 45 * scale;
      const strokeWidth = 8 * scale;

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
      ctx.font = `700 ${1.5 * 16 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${approvedPercent}%`, centerX, centerY - 6 * scale);

      // Draw pending percentage text
      ctx.fillStyle = '#2255d4';
      ctx.font = `600 ${0.75 * 16 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(`${pendingPercent}%`, centerX, centerY + 12 * scale);
    }

    // Draw watermark on canvas
    function drawWatermark(ctx, scale) {
      const text = 'raniagus.github.io/subjects-graph';
      const fontSize = 12 * scale;
      const x = ctx.canvas.width / 2;
      const y = 20 * scale;

      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Draw black stroke
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3 * scale;
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
