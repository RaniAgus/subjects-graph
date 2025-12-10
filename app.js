// Main Application
(function() {
  'use strict';

  // Status constants
  const STATUS = {
    INACTIVE: 'INACTIVE',
    IN_PROGRESS: 'IN_PROGRESS',
    FINAL_EXAM_PENDING: 'FINAL_EXAM_PENDING',
    APPROVED: 'APPROVED'
  };

  // Status colors (FILL)
  const STATUS_COLORS = {
    [STATUS.INACTIVE]: '#111827',           // Neutral dark gray
    [STATUS.IN_PROGRESS]: '#374151',        // Neutral medium gray
    [STATUS.FINAL_EXAM_PENDING]: '#2255d4', // Medium-deep blue
    [STATUS.APPROVED]: '#3b82f6'            // 100% light blue
  };

  // Border/edge colors (~1% darker versions)
  // Note: Using slightly different colors than fill to work around a Cytoscape.js bug
  // where identical fill and border colors get swapped when using stylesheet selectors
  const BORDER_COLORS = {
    DEFAULT: '#323b48',                     // ~1% darker than IN_PROGRESS
    FINAL_PENDING_READY: '#2050c8',         // ~1% darker than FINAL_EXAM_PENDING
    APPROVED_READY: '#387dd9'               // ~1% darker than APPROVED
  };

  // Status cycle order
  const STATUS_ORDER = [
    STATUS.INACTIVE,
    STATUS.IN_PROGRESS,
    STATUS.FINAL_EXAM_PENDING,
    STATUS.APPROVED
  ];

  // State management
  let cy; // Cytoscape instance
  let currentSubjects = [];
  let currentLinks = [];

  // Save current data to localStorage
  function saveData() {
    const data = {
      subjects: currentSubjects.map(s => {
        const node = cy.$(`#${s.id}`);
        return { ...s, status: node ? node.data('status') : s.status || STATUS.INACTIVE };
      }),
      links: currentLinks
    };
    localStorage.setItem('graphData', JSON.stringify(data));
  }

  // Load saved data from localStorage or use default
  function loadData() {
    const saved = localStorage.getItem('graphData');
    return saved ? JSON.parse(saved) : defaultData;
  }

  // Initialize the application
  function init() {
    const data = loadData();
    currentSubjects = data.subjects;
    currentLinks = data.links;
    initGraph();
    setupEventListeners();
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
        status: subject.status || STATUS.INACTIVE,
        borderState: 'default',
        position: subject.position
      },
      position: subject.position ? { x: subject.position.x, y: subject.position.y } : undefined,
      locked: true  // Subject nodes are not draggable
    }));

    // Add static connector nodes from links array
    const connectorNodes = currentLinks.map(link => {
      const isInvisible = link.sources && link.destinations && 
                          link.sources.length === 1 && link.destinations.length === 1;
      return {
        data: {
          id: link.id,
          label: 'Y',
          nodeType: 'connector',
          isInvisible: isInvisible,
          borderState: 'default',
          sources: link.sources || [],
          destinations: link.destinations || []
        },
        position: link.position ? { x: link.position.x, y: link.position.y } : undefined
      };
    });

    nodes.push(...connectorNodes);

    // Build edges based on prerequisites
    const edges = [];
    const processedConnections = new Set(); // Track which connections we've made through connectors

    // First, process all connections through connectors
    currentLinks.forEach(link => {
      if (link.sources && link.destinations) {
        // Check if this is an "invisible" connector (1 source + 1 destination)
        const isInvisible = link.sources.length === 1 && link.destinations.length === 1;
        
        if (isInvisible) {
          // For invisible connectors: draw source -> connector and connector -> destination
          // But the connector node itself won't be visible, creating the effect of - () ->
          link.sources.forEach(sourceId => {
            edges.push({
              data: {
                id: `${sourceId}-${link.id}`,
                source: sourceId,
                target: link.id,
                toInvisible: true  // Mark edge going to invisible connector
              }
            });
          });
          
          link.destinations.forEach(destId => {
            edges.push({
              data: {
                id: `${link.id}-${destId}`,
                source: link.id,
                target: destId
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

    // Then, add direct connections for prerequisites not going through connectors
    currentSubjects.forEach(subject => {
      if (subject.prerequisites && subject.prerequisites.length > 0) {
        subject.prerequisites.forEach(prereqId => {
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
      }
    });

    // Initialize Cytoscape
    cy = cytoscape({
      container: document.getElementById('cy'),
      
      elements: {
        nodes: nodes,
        edges: edges
      },

      style: [
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
            'background-color': STATUS_COLORS[STATUS.INACTIVE],
            'transition-property': 'background-color, border-color',
            'transition-duration': '0.3s'
          }
        },

        // Status-specific styles for subject nodes
        {
          selector: 'node[status="INACTIVE"]',
          style: { 'background-color': STATUS_COLORS[STATUS.INACTIVE] }
        },
        {
          selector: 'node[status="IN_PROGRESS"]',
          style: { 'background-color': STATUS_COLORS[STATUS.IN_PROGRESS] }
        },
        {
          selector: 'node[status="FINAL_EXAM_PENDING"]',
          style: { 'background-color': STATUS_COLORS[STATUS.FINAL_EXAM_PENDING] }
        },
        {
          selector: 'node[status="APPROVED"]',
          style: { 'background-color': STATUS_COLORS[STATUS.APPROVED] }
        },

        // Border color styles based on dependency readiness
        {
          selector: 'node[borderState="default"]',
          style: { 'border-color': BORDER_COLORS.DEFAULT }
        },
        {
          selector: 'node[borderState="finalPending"]',
          style: { 'border-color': BORDER_COLORS.FINAL_PENDING_READY }
        },
        {
          selector: 'node[borderState="approved"]',
          style: { 'border-color': BORDER_COLORS.APPROVED_READY }
        },

        // Connector node style (rhombus/diamond)
        {
          selector: 'node[nodeType="connector"]',
          style: {
            'width': 15,
            'height': 15,
            'shape': 'diamond',
            'label': '',
            'background-color': 'transparent',
            'border-width': 3,
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
            'line-color': BORDER_COLORS.DEFAULT,
            'target-arrow-color': BORDER_COLORS.DEFAULT,
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
      ],

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
      // Helper: check if status is at least FINAL_EXAM_PENDING
      const isFinalPendingOrAbove = (status) => 
        status === STATUS.FINAL_EXAM_PENDING || status === STATUS.APPROVED;
      
      // Helper: check if status is APPROVED
      const isApproved = (status) => status === STATUS.APPROVED;

      // Helper: get status of a node by id
      const getNodeStatus = (nodeId) => {
        const node = cy.getElementById(nodeId);
        return node.data('status');
      };

      // Helper: recursively check if all dependencies (and their dependencies) are APPROVED
      const allDependenciesApproved = (subjectId, visited = new Set()) => {
        if (visited.has(subjectId)) return true; // Avoid cycles
        visited.add(subjectId);
        
        const subjectData = currentSubjects.find(s => s.id === subjectId);
        if (!subjectData || !subjectData.prerequisites || subjectData.prerequisites.length === 0) {
          return true; // No prerequisites means this branch is OK
        }
        
        return subjectData.prerequisites.every(prereqId => {
          // The prerequisite itself must be APPROVED
          if (!isApproved(getNodeStatus(prereqId))) return false;
          // And all of its dependencies must also be APPROVED (recursive)
          return allDependenciesApproved(prereqId, visited);
        });
      };

      // Helper: check if direct prerequisites are at least FINAL_EXAM_PENDING,
      // AND all of their dependencies are APPROVED
      const canBeFinalPendingPlus = (subjectId) => {
        const subjectData = currentSubjects.find(s => s.id === subjectId);
        if (!subjectData || !subjectData.prerequisites || subjectData.prerequisites.length === 0) {
          return true; // No prerequisites means OK
        }
        
        return subjectData.prerequisites.every(prereqId => {
          // The direct prerequisite must be at least FINAL_EXAM_PENDING
          if (!isFinalPendingOrAbove(getNodeStatus(prereqId))) return false;
          // AND all of the prerequisite's dependencies must be APPROVED
          return allDependenciesApproved(prereqId);
        });
      };

      // Update subject node borders based on their prerequisites (recursively)
      cy.nodes('[nodeType="subject"]').forEach(node => {
        const subjectData = currentSubjects.find(s => s.id === node.id());
        if (!subjectData || !subjectData.prerequisites || subjectData.prerequisites.length === 0) {
          // No prerequisites - automatically ready
          node.data('borderState', 'approved');
          return;
        }

        // Check recursively if all dependencies are APPROVED
        const allApproved = allDependenciesApproved(node.id());
        // Check if direct prereqs are FINAL_EXAM_PENDING+ and their deps are APPROVED
        const finalPendingReady = canBeFinalPendingPlus(node.id());

        if (allApproved) {
          node.data('borderState', 'approved');
        } else if (finalPendingReady) {
          node.data('borderState', 'finalPending');
        } else {
          node.data('borderState', 'default');
        }
      });

      // Update connector node borders based on their sources (recursively)
      cy.nodes('[nodeType="connector"]').forEach(node => {
        const sources = node.data('sources') || [];
        if (sources.length === 0) return;

        // Check if all sources and their dependencies are APPROVED
        const allApproved = sources.every(sourceId => 
          isApproved(getNodeStatus(sourceId)) && allDependenciesApproved(sourceId)
        );
        // Check if all sources are FINAL_EXAM_PENDING+ and their deps are APPROVED
        const finalPendingReady = sources.every(sourceId => 
          isFinalPendingOrAbove(getNodeStatus(sourceId)) && allDependenciesApproved(sourceId)
        );

        if (allApproved) {
          node.data('borderState', 'approved');
        } else if (finalPendingReady) {
          node.data('borderState', 'finalPending');
        } else {
          node.data('borderState', 'default');
        }
      });

      // Update edge colors based on source node (recursively checking all dependencies)
      cy.edges().forEach(edge => {
        const sourceNode = edge.source();
        const sourceType = sourceNode.data('nodeType');
        
        let edgeColor = BORDER_COLORS.DEFAULT;

        if (sourceType === 'connector') {
          // For connectors: check all source subjects and their dependencies
          const sources = sourceNode.data('sources') || [];
          
          const allApproved = sources.every(sourceId => 
            isApproved(getNodeStatus(sourceId)) && allDependenciesApproved(sourceId)
          );
          const finalPendingReady = sources.every(sourceId => 
            isFinalPendingOrAbove(getNodeStatus(sourceId)) && allDependenciesApproved(sourceId)
          );

          if (allApproved) {
            edgeColor = BORDER_COLORS.APPROVED_READY;
          } else if (finalPendingReady) {
            edgeColor = BORDER_COLORS.FINAL_PENDING_READY;
          }
        } else if (sourceType === 'subject') {
          // For subjects: check the source node's status AND all its dependencies must be APPROVED
          const sourceId = sourceNode.id();
          const sourceStatus = sourceNode.data('status');
          
          const sourceApproved = isApproved(sourceStatus) && allDependenciesApproved(sourceId);
          const sourceFinalPendingReady = isFinalPendingOrAbove(sourceStatus) && allDependenciesApproved(sourceId);
          
          if (sourceApproved) {
            edgeColor = BORDER_COLORS.APPROVED_READY;
          } else if (sourceFinalPendingReady) {
            edgeColor = BORDER_COLORS.FINAL_PENDING_READY;
          }
        }

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
      let finalPendingPlusCount = 0;

      cy.nodes('[nodeType="subject"]').forEach(node => {
        const status = node.data('status');
        if (status === STATUS.APPROVED) {
          approvedCount++;
          finalPendingPlusCount++;
        } else if (status === STATUS.FINAL_EXAM_PENDING) {
          finalPendingPlusCount++;
        }
      });

      const approvedPercent = Math.round((approvedCount / totalSubjects) * 100);
      const finalPendingPlusPercent = Math.round((finalPendingPlusCount / totalSubjects) * 100);

      // Update text
      document.getElementById('progress-percentage').textContent = `${approvedPercent}%`;
      document.getElementById('progress-pending-text').textContent = `${finalPendingPlusPercent}%`;

      // Update circles (circumference = 2 * PI * 45 ≈ 283)
      const circumference = 283;
      const approvedOffset = circumference - (circumference * approvedPercent / 100);
      const pendingOffset = circumference - (circumference * finalPendingPlusPercent / 100);

      document.getElementById('progress-approved').style.strokeDashoffset = approvedOffset;
      document.getElementById('progress-pending').style.strokeDashoffset = pendingOffset;
    }

    // Initial update
    updateDependentStyles();

    // Cursor styles
    const container = document.getElementById('cy');
    cy.on('mouseover', 'node[nodeType="subject"]', function() {
      container.style.cursor = 'pointer';
    });
    cy.on('mouseover', 'node[nodeType="connector"]', function() {
      container.style.cursor = 'move';
    });
    cy.on('mouseout', 'node', function() {
      container.style.cursor = 'default';
    });
  }

  // Setup event listeners
  function setupEventListeners() {
    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
      localStorage.removeItem('graphData');
      location.reload();
    });

    // Fit button
    document.getElementById('fit-btn').addEventListener('click', () => {
      cy.fit(50);
    });

    // Export button
    document.getElementById('export-btn').addEventListener('click', () => {
      const data = localStorage.getItem('graphData');
      if (!data) {
        alert('No hay datos para exportar.');
        return;
      }
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'frba-subjects-progress.json';
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
            if (!data.subjects || !data.links) {
              throw new Error('Formato de datos inválido');
            }
            localStorage.setItem('graphData', JSON.stringify(data));
            location.reload();
          } catch (err) {
            alert('Error al importar: ' + err.message);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  // Start the application when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
