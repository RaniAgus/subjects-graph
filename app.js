// Main Application
(function() {
  'use strict';

  // State management
  let cy; // Cytoscape instance
  let currentSubjects = [];

  // Initialize the application
  function init() {
    loadProgress();
    initGraph();
    updateAvailability();
    updateProgress();
    setupEventListeners();
  }

  // Load progress from LocalStorage
  function loadProgress() {
    const saved = localStorage.getItem('subjectProgress');
    if (saved) {
      try {
        const savedStates = JSON.parse(saved);
        currentSubjects = subjects.map(subject => {
          const savedState = savedStates[subject.id];
          return {
            ...subject,
            state: savedState || subject.state
          };
        });
      } catch (e) {
        console.error('Error loading progress:', e);
        currentSubjects = [...subjects];
      }
    } else {
      currentSubjects = [...subjects];
    }
  }

  // Save progress to LocalStorage
  function saveProgress() {
    const states = {};
    currentSubjects.forEach(subject => {
      states[subject.id] = subject.state;
    });
    localStorage.setItem('subjectProgress', JSON.stringify(states));
  }

  // Initialize Cytoscape graph
  function initGraph() {
    // Prepare subject nodes
    const nodes = currentSubjects.map(subject => ({
      data: {
        id: subject.id,
        label: subject.id,
        name: subject.name,
        state: subject.state,
        isFinalProject: subject.isFinalProject || false,
        unlocksFinal: subject.unlocksFinal || false,
        nodeType: 'subject',
        position: subject.position
      },
      position: subject.position ? { x: subject.position.x, y: subject.position.y } : undefined
    }));

    // Add static connector nodes from links array
    const connectorNodes = links.map(link => {
      const isInvisible = link.sources && link.destinations && 
                          link.sources.length === 1 && link.destinations.length === 1;
      return {
        data: {
          id: link.id,
          label: 'Y',
          nodeType: 'connector',
          isInvisible: isInvisible,
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
    links.forEach(link => {
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
                target: link.id
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
            'border-opacity': 1
          }
        },

        // Connector node style (rhombus/diamond)
        {
          selector: 'node[nodeType="connector"]',
          style: {
            'width': 30,
            'height': 30,
            'shape': 'diamond',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#ffffff',
            'font-size': '10px',
            'font-weight': 'bold',
            'background-color': '#64748b',
            'border-width': 2,
            'border-color': '#94a3b8',
            'text-outline-color': '#000',
            'text-outline-width': 1
          }
        },

        // Invisible connector style (for 1-to-1 connectors)
        {
          selector: 'node[isInvisible="true"]',
          style: {
            'opacity': 0,
            'width': 1,
            'height': 1,
            'label': ''
          }
        },

        // State: Passed (Aprobada)
        {
          selector: 'node[state="passed"]',
          style: {
            'background-color': '#3b82f6',
            'border-color': '#3b82f6'
          }
        },

        // State: Signed (Firmada)
        {
          selector: 'node[state="signed"]',
          style: {
            'background-color': '#0a1628',
            'border-color': '#3b82f6',
            'border-width': 4
          }
        },

        // State: In Progress (En curso)
        {
          selector: 'node[state="in_progress"]',
          style: {
            'background-color': '#475569',
            'border-color': '#64748b'
          }
        },

        // State: Available to Pass
        {
          selector: 'node[state="available_pass"]',
          style: {
            'background-color': '#10b981',
            'border-color': '#059669'
          }
        },

        // State: Available to Take
        {
          selector: 'node[state="available_take"]',
          style: {
            'background-color': '#0a1628',
            'border-color': '#60a5fa',
            'border-width': 4
          }
        },

        // State: Not Available
        {
          selector: 'node[state="not_available"]',
          style: {
            'background-color': '#334155',
            'border-color': '#475569',
            'opacity': 0.6
          }
        },

        // State: To Take
        {
          selector: 'node[state="to_take"]',
          style: {
            'background-color': '#475569',
            'border-color': '#64748b'
          }
        },

        // Final Project marker
        {
          selector: 'node[isFinalProject="true"]',
          style: {
            'background-color': '#f59e0b',
            'border-color': '#d97706',
            'width': 70,
            'height': 70,
            'font-size': '14px'
          }
        },

        // Edges
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.5
          }
        },

        // Hover effects
        {
          selector: 'node:selected',
          style: {
            'border-width': 5,
            'border-color': '#fbbf24'
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

    // Click handler for nodes (only subject nodes, not connectors)
    cy.on('tap', 'node[nodeType="subject"]', function(evt) {
      const node = evt.target;
      const subjectId = node.id();
      cycleState(subjectId);
    });

    // Hover effects (only for subject nodes)
    cy.on('mouseover', 'node[nodeType="subject"]', function(evt) {
      const node = evt.target;
      node.style('border-width', '5');
      
      // Highlight connected edges
      node.connectedEdges().style({
        'line-color': '#fbbf24',
        'target-arrow-color': '#fbbf24',
        'width': 3
      });
    });

    cy.on('mouseout', 'node[nodeType="subject"]', function(evt) {
      const node = evt.target;
      node.style('border-width', '3');
      
      // Reset edge colors
      node.connectedEdges().style({
        'line-color': '#3b82f6',
        'target-arrow-color': '#3b82f6',
        'width': 2
      });
    });
  }

  // Cycle through states when clicking a node
  function cycleState(subjectId) {
    const subject = currentSubjects.find(s => s.id === subjectId);
    if (!subject) return;

    // Define state cycle
    const stateCycle = [
      STATES.NOT_AVAILABLE,
      STATES.TO_TAKE,
      STATES.IN_PROGRESS,
      STATES.SIGNED,
      STATES.PASSED
    ];

    const currentIndex = stateCycle.indexOf(subject.state);
    const nextIndex = (currentIndex + 1) % stateCycle.length;
    subject.state = stateCycle[nextIndex];

    // Update the graph node
    cy.getElementById(subjectId).data('state', subject.state);

    // Recalculate availability and update UI
    updateAvailability();
    updateProgress();
    saveProgress();
  }

  // Calculate which subjects are available based on prerequisites
  function updateAvailability() {
    currentSubjects.forEach(subject => {
      // Skip if already passed or in progress
      if (subject.state === STATES.PASSED || 
          subject.state === STATES.IN_PROGRESS ||
          subject.state === STATES.SIGNED) {
        return;
      }

      // Check if all prerequisites are met
      if (!subject.prerequisites || subject.prerequisites.length === 0) {
        // No prerequisites - always available
        if (subject.state === STATES.NOT_AVAILABLE) {
          subject.state = STATES.TO_TAKE;
        }
        return;
      }

      // Check prerequisite status
      const allPassed = subject.prerequisites.every(prereqId => {
        const prereq = currentSubjects.find(s => s.id === prereqId);
        return prereq && prereq.state === STATES.PASSED;
      });

      const allSigned = subject.prerequisites.every(prereqId => {
        const prereq = currentSubjects.find(s => s.id === prereqId);
        return prereq && (prereq.state === STATES.PASSED || prereq.state === STATES.SIGNED);
      });

      if (allPassed) {
        // All prerequisites passed - available to pass
        if (subject.state === STATES.NOT_AVAILABLE || subject.state === STATES.TO_TAKE) {
          subject.state = STATES.AVAILABLE_PASS;
        }
      } else if (allSigned) {
        // All prerequisites at least signed - available to take
        if (subject.state === STATES.NOT_AVAILABLE) {
          subject.state = STATES.AVAILABLE_TAKE;
        }
      } else {
        // Prerequisites not met
        if (subject.state !== STATES.TO_TAKE && subject.state !== STATES.IN_PROGRESS) {
          subject.state = STATES.NOT_AVAILABLE;
        }
      }

      // Update node in graph
      cy.getElementById(subject.id).data('state', subject.state);
    });
  }

  // Update progress gauge
  function updateProgress() {
    const total = currentSubjects.length;
    const passed = currentSubjects.filter(s => s.state === STATES.PASSED).length;
    const percentage = Math.round((passed / total) * 100);

    // Update text
    document.getElementById('progress-percentage').textContent = `${percentage}%`;

    // Update circular progress bar
    const circle = document.getElementById('progress-circle');
    const circumference = 2 * Math.PI * 45; // radius = 45
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }

  // Setup event listeners
  function setupEventListeners() {
    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
      if (confirm('¿Estás seguro de que deseas reiniciar todo el progreso?')) {
        resetProgress();
      }
    });

    // Fit button
    document.getElementById('fit-btn').addEventListener('click', () => {
      cy.fit(50);
    });
  }

  // Reset all progress
  function resetProgress() {
    currentSubjects = subjects.map(s => ({
      ...s,
      state: STATES.NOT_AVAILABLE
    }));
    
    localStorage.removeItem('subjectProgress');
    
    // Update graph
    currentSubjects.forEach(subject => {
      cy.getElementById(subject.id).data('state', subject.state);
    });
    
    updateAvailability();
    updateProgress();
  }

  // Start the application when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
