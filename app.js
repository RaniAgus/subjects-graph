// Main Application
(function() {
  'use strict';

  // State management
  let cy; // Cytoscape instance
  let currentSubjects = [];

  // Initialize the application
  function init() {
    currentSubjects = [...subjects];
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

  // Setup event listeners
  function setupEventListeners() {
    // Fit button
    document.getElementById('fit-btn').addEventListener('click', () => {
      cy.fit(50);
    });
  }

  // Start the application when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
