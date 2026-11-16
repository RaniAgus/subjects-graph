import { describe, it, expect, vi } from 'vitest';
import { Graph } from '~/lib/subjects-graph/core.js';
import { CytoscapeDrawer } from '~/lib/subjects-graph/cytoscape-drawer.js';
import { buildStylesheet } from '~/lib/subjects-graph/cytoscape-styles.js';
import { DEFAULT_THEME, mergeTheme, resolveColor } from '~/lib/subjects-graph/theme.js';
import { config, fullVariant, subjects, textColor, statusColor } from './helpers/common.js';
import { createMockDrawer } from './helpers/mockDrawer.js';

describe('pure theme resolution', () => {
  it('merges copies on the base without sharing caller or default state', () => {
    const overrides = { '--accent-color': '#abcdef' };
    const merged = mergeTheme(overrides);
    expect(merged['--accent-color']).toBe('#abcdef');
    expect(merged['--bg-primary']).toBe('#060b14');
    merged['--accent-color'] = 'red';
    expect(overrides['--accent-color']).toBe('#abcdef');
    expect(mergeTheme()['--accent-color']).toBe('#e8c760');
    expect(Object.isFrozen(DEFAULT_THEME)).toBe(true);
  });
  it('resolves tokens, keeps literal colors, and preserves the missing-token fallback', () => {
    const theme = mergeTheme();
    expect(resolveColor('--fill-color-1', theme)).toBe('#060b14');
    expect(resolveColor('var(--accent-color)', theme)).toBe('#e8c760');
    expect(resolveColor('--missing', theme)).toBe('#000000');
    for (const color of ['#abc', 'red', 'rgb(1, 2, 3)', 'transparent']) {
      expect(resolveColor(color, theme)).toBe(color);
    }
  });
});

describe('Cytoscape mapping', () => {
  it('maps actual subjects with positions, colors, labels, leaf labels, and lock state', () => {
    const fixture = subjects(['7', 'APPROVED'], ['11', 'PENDING']);
    const drawer = new CytoscapeDrawer();
    new Graph(config, fixture, []).render(drawer);
    expect(drawer.nodes).toHaveLength(2);
    expect(drawer.nodes[0]).toEqual({
      data: { id: '7', label: fixture[0].shortName, name: fixture[0].name,
        nodeType: 'subject', status: 'APPROVED', fillColor: statusColor('APPROVED'),
        borderColor: expect.any(String), textColor: textColor('APPROVED', false) },
      position: fixture[0].position, locked: true,
    });
    expect(drawer.nodes[1].data.textColor).toBe(textColor('PENDING', true));
    expect(drawer.edges).toHaveLength(1);
    expect(drawer.edges[0].data).toMatchObject({ source: '7', target: '11', toInvisible: false });
  });
  it('renders full real fixtures in two passes without losing connector arrows', () => {
    const graph = new Graph(config, fullVariant.subjects.map(s => ({ ...s, status: 'PENDING' })), fullVariant.edges);
    const reference = createMockDrawer();
    graph.render(reference);
    const drawer = new CytoscapeDrawer(true);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      graph.render(drawer);
      expect(warning).not.toHaveBeenCalled();
      expect(drawer.nodes).toHaveLength(reference.shapes.circles.length + reference.shapes.diamonds.length + reference.shapes.edges.length);
      expect(drawer.edges).toHaveLength(reference.shapes.arrows.length);
      expect(drawer.nodes.every(n => n.locked === false)).toBe(true);
      for (const arrow of drawer.edges) {
        const target = drawer.nodes.find(n => n.data.id === arrow.data.target);
        expect(arrow.data.toInvisible).toBe(target?.data.isInvisible ?? false);
      }
      expect(drawer.nodes.some(n => n.data.nodeType === 'connector' && !n.data.isInvisible)).toBe(true);
      expect(drawer.nodes.some(n => n.data.isInvisible)).toBe(true);
    } finally { warning.mockRestore(); }
  });
  it('leaves gaps only at previously occupied coordinates and validates arrow endpoints', () => {
    const drawer = new CytoscapeDrawer();
    drawer.drawDiamond({ id: 'diamond', position: { x: 2, y: 3 }, borderColor: 'red' });
    drawer.drawEdge({ id: 'gap', position: { x: 2, y: 3 } });
    drawer.drawEdge({ id: 'free', position: { x: 3, y: 2 } });
    expect(drawer.nodes.map(n => n.data.withGap)).toEqual([undefined, true, false]);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      drawer.drawArrow({ id: 'bad-source', from: 'missing', to: 'gap', color: 'red' });
      drawer.drawArrow({ id: 'bad-target', from: 'gap', to: 'missing', color: 'red' });
      expect(warning).toHaveBeenCalledTimes(2);
      expect(drawer.edges).toHaveLength(0);
      drawer.drawArrow({ id: 'ok', from: 'diamond', to: 'gap', color: 'red' });
      expect(drawer.getElements().edges[0].data).toEqual({ id: 'ok', source: 'diamond', target: 'gap', color: 'red', toInvisible: true });
    } finally { warning.mockRestore(); }
  });
});

it('keeps graph appearance and resolves editable connector styles from the supplied theme', () => {
  const normal = buildStylesheet();
  const editable = buildStylesheet(true, { '--accent-color': 'orange' });
  const hidden = editable.find(s => s.selector === 'node[?isInvisible]');
  expect(hidden?.style).toMatchObject({ 'border-color': 'orange', opacity: 0.5, width: 15, events: 'yes' });
  expect(normal.find(s => s.selector === 'node[?isInvisible]')?.style).toMatchObject({ 'border-color': '#e8c760', opacity: 0, width: 0.0001, events: 'no' });
  expect(normal.find(s => s.selector === 'edge[?toInvisible]')?.style).toEqual({ 'target-arrow-shape': 'none' });
  expect(normal[0].style).toMatchObject({ width: 60, height: 60, 'background-color': 'data(fillColor)', 'border-color': 'data(borderColor)' });
});

it('applies the instance font family to graph labels', () => {
  const themed = buildStylesheet(false, { '--font-family': 'Georgia, serif' });
  expect(themed[0].style).toMatchObject({ 'font-family': 'Georgia, serif', 'font-weight': 600 });
  expect(buildStylesheet()[0].style).toMatchObject({ 'font-family': DEFAULT_THEME['--font-family'] });
});
