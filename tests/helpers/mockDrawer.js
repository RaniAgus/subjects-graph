// Mock drawer that collects all shapes
export function createMockDrawer() {
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
