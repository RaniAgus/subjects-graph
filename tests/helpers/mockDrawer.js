/** @typedef {import('~/components/graph.js').Drawer} Drawer */
/** @typedef {import('~/components/graph.js').Circle} Circle */
/** @typedef {import('~/components/graph.js').Diamond} Diamond */
/** @typedef {import('~/components/graph.js').Hidden} Hidden */
/** @typedef {import('~/components/graph.js').Arrow} Arrow */

/**
 * @typedef {object} MockShapes
 * @property {Array<Circle>} circles
 * @property {Array<Diamond>} diamonds
 * @property {Array<Hidden>} edges
 * @property {Array<Arrow>} arrows
 */

/**
 * Mock drawer that collects all shapes
 * @returns {Drawer & { shapes: MockShapes }}
 */
export function createMockDrawer() {
  /** @type {MockShapes} */
  const shapes = {
    circles: [],
    diamonds: [],
    edges: [],
    arrows: [],
  };

  return {
    shapes,
    drawCircle(params) {
      shapes.circles.push(params);
    },
    drawDiamond(params) {
      shapes.diamonds.push(params);
    },
    drawEdge(params) {
      shapes.edges.push(params);
    },
    drawArrow(params) {
      shapes.arrows.push(params);
    },
  };
}
