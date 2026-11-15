import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import cytoscape from 'cytoscape';
import { SubjectsGraph } from '~/lib/subjects-graph/index.js';
import { DEFAULT_THEME } from '~/lib/subjects-graph/theme.js';
import { config, fullVariant, subjects } from './helpers/common.js';

vi.mock('cytoscape', () => ({ default: vi.fn() }));

/** Minimal owned-subtree DOM double: no document or browser globals needed. */
class ElementDouble {
  className = '';
  style = { setProperty: vi.fn(), removeProperty: vi.fn() };
  /** @type {ElementDouble[]} */
  children = [];
  /** @type {ElementDouble | undefined} */
  parent;
  ownerDocument = { createElement: () => new ElementDouble() };
  /** @param {ElementDouble} child */
  append(child) { this.children.push(child); child.parent = this; }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = undefined;
  }
}

class ResizeObserverDouble {
  /** @type {ResizeObserverDouble[]} */
  static instances = [];
  observe = vi.fn();
  disconnect = vi.fn();
  /** @param {ResizeObserverCallback} callback */
  constructor(callback) { this.callback = callback; ResizeObserverDouble.instances.push(this); }
  notify() { this.callback([], /** @type {ResizeObserver} */ (/** @type {unknown} */ (this))); }
}

/** Renderer boundary double; graph logic, drawer, and palette stay real. */
class RendererDouble {
  /** @param {import('cytoscape').CytoscapeOptions} options */
  constructor(options) {
    this.options = options;
    this.content = /** @type {import('cytoscape').ElementsDefinition} */ (options.elements);
  }
  zoomValue = 0.8;
  panValue = { x: 10, y: 20 };
  zoom = () => this.zoomValue;
  pan = () => this.panValue;
  viewport = vi.fn((/** @type {{zoom: number, pan: {x: number, y: number}}} */ value) => {
    this.zoomValue = value.zoom;
    this.panValue = value.pan;
  });
  elements = () => ({ remove: () => { this.content = { nodes: [], edges: [] }; } });
  add = vi.fn((/** @type {import('cytoscape').ElementsDefinition} */ elements) => { this.content = elements; });
  batch = (/** @type {() => void} */ callback) => callback();
  style = vi.fn();
  fit = vi.fn();
  resize = vi.fn(() => { this.panValue = { x: 0, y: 0 }; this.zoomValue = 1; });
  destroy = vi.fn();
  png = vi.fn(() => new Blob(['graph'], { type: 'image/png' }));
  /** @param {string} id */
  node(id) {
    const node = this.content.nodes.find(node => node.data.id === id);
    if (!node) throw new Error(`Missing rendered node ${id}`);
    return node;
  }
}

/** @returns {import('~/lib/subjects-graph/index.js').Plan} */
function makePlan() {
  return structuredClone({ name: 'Real curriculum', ...config, ...fullVariant });
}

/** @type {RendererDouble[]} */
let renderers;
/** @type {SubjectsGraph[]} */
let graphs;
/** @param {import('~/lib/subjects-graph/index.js').SubjectsGraphOptions} options
 * @param {ElementDouble} [container]
 */
function mount(options, container = new ElementDouble()) {
  const graph = new SubjectsGraph(/** @type {HTMLElement} */ (/** @type {unknown} */ (container)), options);
  graphs.push(graph);
  return { graph, container, renderer: renderers[renderers.length - 1] };
}

beforeEach(() => {
  renderers = [];
  graphs = [];
  ResizeObserverDouble.instances = [];
  vi.stubGlobal('ResizeObserver', ResizeObserverDouble);
  /** @param {import('cytoscape').CytoscapeOptions} [options] */
  const createRenderer = (options = {}) => {
    const renderer = new RendererDouble(options);
    renderers.push(renderer);
    return /** @type {import('cytoscape').Core} */ (/** @type {unknown} */ (renderer));
  };
  vi.mocked(cytoscape).mockImplementation(/** @type {typeof cytoscape} */ (/** @type {unknown} */ (createRenderer)));
});
afterEach(() => {
  for (const graph of graphs) graph.destroy();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('SubjectsGraph mounted view', () => {
  it('renders the effective initial statuses with preset positions and locks the default view', () => {
    const plan = makePlan();
    const subject = plan.subjects.find(subject => subject.id === '11');
    if (!subject) throw new Error('Missing fixture subject');
    subject.status = 'APPROVED';
    const { container, renderer } = mount({ plan, progress: { '7': 'APPROVED' } });
    expect(renderer.node('7').data.status).toBe('APPROVED');
    expect(renderer.node('11').data.status).toBe('APPROVED');
    expect(renderer.node('12').data.status).toBe(plan.statuses[0].id);
    expect(renderer.node('7').position).toEqual(plan.subjects.find(subject => subject.id === '7')?.position);
    expect(renderer.content.nodes.every(node => node.locked)).toBe(true);
    expect(renderer.options.layout).toEqual({ name: 'preset', fit: false });
    expect(renderer.fit).toHaveBeenCalledExactlyOnceWith(undefined, 50);
    expect(container.children).toHaveLength(1);
    expect(container.children[0].className).toBe('subjects-graph');
    expect(renderer.options.container).toBe(container.children[0].children[0]);
    expect(container.children[0].children[0].className).toBe('subjects-graph-surface');
  });

  it('snapshots caller inputs, including nested plan data, while preserving real graph rendering', () => {
    const plan = makePlan();
    const progress = { '7': 'APPROVED' };
    const approvedColor = config.statuses.find(status => status.id === 'APPROVED')?.color;
    if (!approvedColor) throw new Error('Missing approved color');
    const theme = { [approvedColor]: '#123456' };
    const before = structuredClone({ plan, progress, theme });
    const { graph, renderer } = mount({ plan, progress, theme });
    expect({ plan, progress, theme }).toEqual(before);
    const renderedPosition = { ...renderer.node('7').position };
    const connections = renderer.content.edges.map(edge => ({ source: edge.data.source, target: edge.data.target }));
    plan.subjects.find(subject => subject.id === '7')?.prerequisites.splice(0);
    for (const subject of plan.subjects) { subject.position.x = -999; subject.shortName = 'changed'; }
    plan.statuses[0].color = 'pink';
    progress['7'] = 'PENDING';
    theme[approvedColor] = 'red';
    graph.setTheme(theme);
    expect(renderer.node('7').position).toEqual(renderedPosition);
    expect(renderer.node('7').data.status).toBe('APPROVED');
    expect(renderer.node('7').data.label).toBe(before.plan.subjects.find(subject => subject.id === '7')?.shortName);
    expect(renderer.content.edges.map(edge => ({ source: edge.data.source, target: edge.data.target }))).toEqual(connections);
    theme[approvedColor] = 'blue';
    graph.setPlan(before.plan, { progress: before.progress });
    expect(renderer.node('7').position).toEqual(renderedPosition);
    expect(renderer.node('7').data.status).toBe('APPROVED');
    expect(renderer.node('7').data.fillColor).toBe('red');
    expect(renderer.node('12').data.fillColor).toBe(DEFAULT_THEME[before.plan.statuses[0].color]);
  });

  it('isolates palettes per subtree and replaces theme overrides over the default palette', () => {
    const globalStyle = { setProperty: vi.fn() };
    vi.stubGlobal('document', { documentElement: { style: globalStyle } });
    const plan = makePlan();
    const first = mount({ plan, theme: { '--fill-color-1': 'pink', '--accent-color': 'red', '--custom-color': 'gold' } });
    const second = mount({ plan });
    expect(first.renderer.node('7').data.fillColor).toBe('pink');
    expect(second.renderer.node('7').data.fillColor).toBe(DEFAULT_THEME['--fill-color-1']);
    first.graph.setTheme({ '--accent-color': 'orange' });
    expect(first.container.children[0].style.removeProperty).toHaveBeenCalledWith('--custom-color');
    expect(first.renderer.node('7').data.fillColor).toBe(DEFAULT_THEME['--fill-color-1']);
    expect(first.container.children[0].style.setProperty).toHaveBeenLastCalledWith('--accent-color', 'orange');
    expect(second.container.children[0].style.setProperty).toHaveBeenLastCalledWith('--accent-color', '#e8c760');
    expect(first.container.style.setProperty).not.toHaveBeenCalled();
    expect(globalStyle.setProperty).not.toHaveBeenCalled();
  });

  it('replaces plan and progress snapshots and preserves the viewport across updates', () => {
    const { graph, renderer } = mount({ plan: makePlan(), progress: { '7': 'APPROVED' } });
    renderer.zoomValue = 2;
    renderer.panValue = { x: -80, y: 135 };
    const next = makePlan();
    const subject = next.subjects.find(subject => subject.id === '7');
    if (!subject) throw new Error('Missing fixture subject');
    subject.shortName = 'New label';
    const progress = { '11': 'APPROVED' };
    const snapshot = structuredClone(next);
    graph.setPlan(next, { progress });
    expect(next).toEqual(snapshot);
    subject.shortName = 'Caller mutation';
    progress['11'] = 'PENDING';
    graph.setTheme({ '--accent-color': 'red' });
    expect(renderer.node('7').data.label).toBe('New label');
    expect(renderer.node('7').data.status).toBe(next.statuses[0].id);
    expect(renderer.node('11').data.status).toBe('APPROVED');
    expect(renderer.zoomValue).toBe(2);
    expect(renderer.panValue).toEqual({ x: -80, y: 135 });
    expect(renderer.fit).toHaveBeenCalledTimes(1);
    graph.setPlan({ ...makePlan(), subjects: subjects(['7', 'PENDING'], ['11', 'PENDING']), edges: [] });
    expect(renderer.node('11').data.status).toBe(next.statuses[0].id);
    expect(renderer.content.nodes.filter(node => node.data.nodeType === 'subject').map(node => node.data.id)).toEqual(['7', '11']);
    expect(renderer.zoomValue).toBe(2);
    expect(renderer.panValue).toEqual({ x: -80, y: 135 });
  });

  it('fits explicitly, exports graph PNG Blobs with defaults, and accepts export overrides', async () => {
    const { graph, renderer } = mount({ plan: makePlan() });
    graph.fit();
    expect(renderer.fit).toHaveBeenLastCalledWith(undefined, 50);
    const output = graph.exportPNG();
    expect(output).toBeInstanceOf(Promise);
    const blob = await output;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(renderer.png).toHaveBeenLastCalledWith({ output: 'blob', scale: 4, bg: 'transparent', full: true });
    await graph.exportPNG({ scale: 2, bg: 'white', full: false });
    expect(renderer.png).toHaveBeenLastCalledWith({ output: 'blob', scale: 2, bg: 'white', full: false });
  });

  it('applies editable node locks and connector styles at construction', () => {
    const { container, renderer } = mount({ plan: makePlan(), editable: true, theme: { '--accent-color': 'orange' } });
    expect(container.children[0].className).toBe('subjects-graph subjects-graph-editable');
    expect(renderer.content.nodes.every(node => node.locked === false)).toBe(true);
    const styles = /** @type {import('cytoscape').StylesheetStyle[]} */ (renderer.options.style);
    expect(styles.find(style => style.selector === 'node[?isInvisible]')?.style).toMatchObject({ opacity: 0.5, 'border-color': 'orange' });
  });

  it('observes container resize without refitting and destroys only its own subtree once', () => {
    const container = new ElementDouble();
    const sibling = new ElementDouble();
    container.append(sibling);
    const { graph, renderer } = mount({ plan: makePlan() }, container);
    const observer = ResizeObserverDouble.instances[0];
    expect(observer.observe).toHaveBeenCalledExactlyOnceWith(container);
    renderer.zoomValue = 1.5;
    renderer.panValue = { x: 70, y: 90 };
    observer.notify();
    expect(renderer.resize).toHaveBeenCalledTimes(1);
    expect(renderer.zoomValue).toBe(1.5);
    expect(renderer.panValue).toEqual({ x: 70, y: 90 });
    expect(renderer.fit).toHaveBeenCalledTimes(1);
    graph.destroy();
    graph.destroy();
    observer.notify();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
    expect(renderer.resize).toHaveBeenCalledTimes(1);
    expect(container.children).toEqual([sibling]);
  });
});
