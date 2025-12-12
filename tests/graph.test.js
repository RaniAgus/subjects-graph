import { describe, it, expect } from 'vitest';
import { Graph } from '../docs/graph.js';
import data from '../docs/data.json';

// Load config from default variant
const variant = data.variants[data.defaultVariant];
const config = {
  statuses: variant.statuses,
  availabilities: variant.availabilities,
};

// Utility: get subject by id with a given status
function subject(id, status) {
  const subjectData = variant.subjects.find(s => s.id === id);
  if (!subjectData) throw new Error(`Subject ${id} not found`);
  return { ...subjectData, status };
}

// Utility: get edge by id
function edge(id) {
  const edgeData = variant.edges.find(e => e.id === id);
  if (!edgeData) throw new Error(`Edge ${id} not found`);
  return { ...edgeData };
}

// Mock drawer that collects all shapes
function createMockDrawer() {
  const shapes = {
    circles: [],
    diamonds: [],
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
    drawArrow(params) {
      shapes.arrows.push(params);
    },
  };
}

describe('Graph', () => {
  it('renders two subjects linked by an arrow (I1 -> I2)', () => {
    const subjects = [
      subject('I1', 'APPROVED'),
      subject('I2', 'INACTIVE'),
    ];

    const graph = new Graph(config, subjects, []);
    const drawer = createMockDrawer();
    graph.render(drawer);

    // Should draw 2 circles (one per subject)
    expect(drawer.shapes.circles).toHaveLength(2);
    expect(drawer.shapes.circles).toContainEqual({
      label: 'I1',
      tooltip: 'Inglés I',
      position: { x: 400, y: 100 },
      fillColor: '#3b82f6',
      borderColor: '#387dd9',
    });
    expect(drawer.shapes.circles).toContainEqual({
      label: 'I2',
      tooltip: 'Inglés II',
      position: { x: 500, y: 100 },
      fillColor: '#111827',
      borderColor: '#387dd9',
    });

    // Should draw 1 arrow from I1 to I2
    expect(drawer.shapes.arrows).toHaveLength(1);
    expect(drawer.shapes.arrows).toContainEqual({
      id: 'I1-I2',
      from: 'I1',
      to: 'I2',
      color: '#387dd9',
    });
  });
});
