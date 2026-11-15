/** @typedef {import('./core.js').Drawer} Drawer */

/** @implements {Drawer} */
export class CytoscapeDrawer {
  /** @param {boolean} [draggable] */
  constructor(draggable = false) {
    /** @type {import('cytoscape').NodeDefinition[]} */
    this.nodes = [];
    /** @type {import('cytoscape').EdgeDefinition[]} */
    this.edges = [];
    this.positions = new Set();
    this.draggable = draggable;
  }
  /** @param {import('./core.js').Circle} params */
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
  /** @param {import('./core.js').Diamond} params */
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
  /** @param {import('./core.js').Hidden} params */
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
  /** @param {import('./core.js').Arrow} params */
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
  /** @param {import('./core.js').Position} position */
  #addPosition({ x, y }) {
    this.positions.add(`${x},${y}`);
  }
  /** @param {import('./core.js').Position} position */
  #hasPosition({ x, y }) {
    return this.positions.has(`${x},${y}`);
  }
}
