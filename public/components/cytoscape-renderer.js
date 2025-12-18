import cytoscape from 'https://unpkg.com/cytoscape@3.33.1/dist/cytoscape.esm.mjs';

/**
 * @typedef {import('cytoscape').Core} Core
 * @typedef {import('cytoscape').NodeDefinition} NodeDefinition
 * @typedef {import('cytoscape').EdgeDefinition} EdgeDefinition
 */

/**
 * Handles all Cytoscape-specific rendering and interactions.
 */
export class CytoscapeRenderer {
  #container;
  #eventBus;
  /** @type {Core | null} */
  #cy = null;
  /** @type {HTMLElement} */
  #tooltip = document.createElement('div');

  /**
   * @param {object} options
   * @param {HTMLElement} options.container
   * @param {import('./event-bus.js').EventBus} options.eventBus
   */
  constructor({ container, eventBus }) {
    this.#container = container;
    this.#eventBus = eventBus;
  }

  /**
   * Initialize cytoscape with elements.
   * @param {{nodes: Array<NodeDefinition>, edges: Array<EdgeDefinition>}} elements
   */
  init(elements) {
    if (this.#cy) {
      this.#cy.destroy();
    }

    this.#cy = cytoscape({
      container: this.#container,
      elements: elements,
      style: this.#buildStylesheet(),
      layout: {
        name: 'preset',
        fit: true,
        padding: 50
      },
      minZoom: 0.3,
      maxZoom: 3,
    });

    this.#cy.on('tap', 'node[nodeType="subject"]', evt => {
      const nodeId = evt.target.id();
      this.#eventBus.emit('node:tapped', { nodeId });
    });

    this.#tooltip.className = 'cy-tooltip';
    this.#container.appendChild(this.#tooltip);

    this.#cy.on('mouseover', 'node[nodeType="subject"]', e => {
      this.#container.style.cursor = 'pointer';
      this.#tooltip.textContent = e.target.data('name');
      this.#tooltip.style.display = 'block';
    });

    this.#cy.on('mousemove', 'node[nodeType="subject"]', e => {
      const pos = e.renderedPosition;
      this.#tooltip.style.left = (pos.x + 15) + 'px';
      this.#tooltip.style.top = (pos.y + 15) + 'px';
    });

    this.#cy.on('mouseout', 'node', () => {
      this.#container.style.cursor = 'grab';
      this.#tooltip.style.display = 'none';
    });
  }

  /** @returns {import('cytoscape').StylesheetJson} */
  #buildStylesheet() {
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
          'transition-duration': 300,
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
          'transition-duration': 300,
          'events': 'no',
        }
      },
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
          'transition-duration': 300,
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

  /**
   * Update node/edge data after re-render.
   * @param {{nodes: Array<NodeDefinition>, edges: Array<EdgeDefinition>}} elements
   */
  updateElements(elements) {
    this.#cy?.batch(() => {
      elements.nodes.forEach(newNode => {
        const cyNode = this.#cy?.getElementById(newNode.data.id ?? '');
        if (cyNode?.length) {
          cyNode.data('status', newNode.data.status);
          cyNode.data('fillColor', newNode.data.fillColor);
          cyNode.data('borderColor', newNode.data.borderColor);
          cyNode.data('textColor', newNode.data.textColor);
        }
      });
      elements.edges.forEach(newEdge => {
        const cyEdge = this.#cy?.getElementById(newEdge.data.id ?? '');
        if (cyEdge?.length) {
          cyEdge.data('color', newEdge.data.color);
        }
      });
    });
  }

  /**
   * Fit the view to show all nodes.
   * @param {number} [padding=50]
   */
  fit(padding = 50) {
    this.#cy?.fit(String(padding));
  }

  /**
   * Get nodes matching a selector.
   * @param {string} selector
   * @returns {any}
   */
  nodes(selector) {
    return this.#cy?.nodes(selector);
  }

  /**
   * Export graph as PNG blob.
   * @param {object} options
   * @returns {Blob | undefined}
   */
  png(options = {}) {
    return this.#cy?.png({
      output: 'blob',
      scale: 4,
      bg: 'transparent',
      full: true,
      ...options
    });
  }

  /** @returns {boolean} */
  get isInitialized() {
    return this.#cy !== null;
  }
}
