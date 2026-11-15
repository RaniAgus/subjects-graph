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
  /** @type {{type: string, selector: string, handler: import('cytoscape').EventHandler}[]} */
  listeners = [];
  on = vi.fn((/** @type {string} */ type, /** @type {string} */ selector, /** @type {import('cytoscape').EventHandler} */ handler) => {
    this.listeners.push({ type, selector, handler });
  });
  removeAllListeners = vi.fn(() => { this.listeners = []; });
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
  /** @param {string} id */
  tap(id) {
    const node = this.node(id);
    for (const listener of this.listeners) {
      if (listener.type === 'tap' && listener.selector === `node[nodeType="${node.data.nodeType}"]`) {
        listener.handler(/** @type {import('cytoscape').EventObject} */ ({ target: { id: () => id } }));
      }
    }
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('SubjectsGraph controlled progress and requests', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('returns complete effective snapshots and replaces sparse progress, with an empty map resetting plan defaults', () => {
    const plan = makePlan();
    const [first, second, third] = plan.subjects;
    first.status = plan.statuses[1].id;
    delete third.status;
    const initial = { [second.id]: plan.statuses[2].id };
    const { graph, renderer } = mount({ plan, progress: initial });
    const expected = Object.fromEntries(plan.subjects.map(subject => [subject.id, initial[subject.id] ?? subject.status ?? plan.statuses[0].id]));
    expect(graph.getProgress()).toEqual(expected);
    const copy = graph.getProgress();
    copy[first.id] = plan.statuses[0].id;
    delete copy[second.id];
    initial[second.id] = plan.statuses[0].id;
    expect(graph.getProgress()).toEqual(expected);
    const replacement = { [third.id]: plan.statuses[1].id };
    graph.setProgress(replacement);
    replacement[third.id] = plan.statuses[0].id;
    graph.setTheme({});
    expect(graph.getProgress()[first.id]).toBe(first.status);
    expect(graph.getProgress()[second.id]).toBe(second.status ?? plan.statuses[0].id);
    expect(renderer.node(third.id).data.status).toBe(plan.statuses[1].id);
    graph.setProgress({});
    expect(graph.getProgress()).toEqual(Object.fromEntries(plan.subjects.map(subject => [subject.id, subject.status ?? plan.statuses[0].id])));
    for (const subject of plan.subjects) expect(renderer.node(subject.id).data.status).toBe(graph.getProgress()[subject.id]);
  });

  it('emits snapshot requests only on subject taps and leaves ignored requests unchanged', () => {
    const plan = makePlan();
    const { graph, renderer } = mount({ plan });
    const listener = vi.fn();
    graph.addEventListener('statusrequest', listener);
    const before = structuredClone(renderer.content);
    const progress = graph.getProgress();
    const id = plan.subjects[0].id;
    renderer.tap(id);
    expect(listener).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.detail).toEqual({ subjectId: id, nextStatusId: plan.statuses[1].id });
    event.detail.subjectId = 'caller change';
    event.detail.nextStatusId = 'caller change';
    expect(graph.getProgress()).toEqual(progress);
    expect(renderer.content).toEqual(before);
    const connector = renderer.content.nodes.find(node => node.data.nodeType === 'connector');
    if (!connector?.data.id) throw new Error('Missing fixture connector');
    renderer.tap(connector.data.id);
    vi.runOnlyPendingTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    expect('dispatchEvent' in graph).toBe(false);
  });

  it('lets consumers accept requests through setProgress and rerenders availability and edge colors without moving the viewport', () => {
    const plan = makePlan();
    const dependency = plan.subjects.flatMap(subject => subject.prerequisites.flatMap(prerequisite => prerequisite.dependencies))
      .find(dependency => plan.statuses.findIndex(status => status.id === dependency.statusId) > 0 && dependency.subjects.length);
    if (!dependency) throw new Error('Missing fixture dependency');
    const nextStatus = dependency.statusId;
    const previousStatus = plan.statuses[plan.statuses.findIndex(status => status.id === nextStatus) - 1].id;
    const id = dependency.subjects[0];
    const progress = Object.fromEntries(plan.subjects.map(subject => [subject.id, plan.statuses.at(-1)?.id ?? '']));
    progress[id] = previousStatus;
    const { graph, renderer } = mount({ plan, progress });
    const bordersBefore = renderer.content.nodes.map(node => node.data.borderColor);
    const edgesBefore = renderer.content.edges.map(edge => edge.data.color);
    renderer.zoomValue = 2;
    renderer.panValue = { x: -75, y: 100 };
    const listener = vi.fn((/** @type {import('~/lib/subjects-graph/index.js').SubjectsGraphEventMap['statusrequest']} */ event) => {
      graph.setProgress({ ...graph.getProgress(), [event.detail.subjectId]: event.detail.nextStatusId });
    });
    graph.addEventListener('statusrequest', listener);
    renderer.tap(id);
    vi.runOnlyPendingTimers();
    expect(renderer.node(id).data.status).toBe(nextStatus);
    expect(renderer.content.nodes.map(node => node.data.borderColor)).not.toEqual(bordersBefore);
    expect(renderer.content.edges.map(edge => edge.data.color)).not.toEqual(edgesBefore);
    expect(renderer.zoomValue).toBe(2);
    expect(renderer.panValue).toEqual({ x: -75, y: 100 });
    expect(renderer.fit).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('follows the supplied catalog order and wraps using the latest controlled state', () => {
    const plan = makePlan();
    plan.statuses.reverse();
    const id = plan.subjects[0].id;
    const { graph, renderer } = mount({ plan, progress: { [id]: plan.statuses[0].id } });
    const listener = vi.fn();
    graph.addEventListener('statusrequest', listener);
    for (let index = 0; index < plan.statuses.length; index++) {
      graph.setProgress({ [id]: plan.statuses[index].id });
      renderer.tap(id);
      vi.runOnlyPendingTimers();
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ detail: {
        subjectId: id, nextStatusId: plan.statuses[(index + 1) % plan.statuses.length].id,
      } }));
    }
    expect(listener).toHaveBeenCalledTimes(plan.statuses.length);
  });

  it('does not emit requests from construction or setters', () => {
    const plan = makePlan();
    const { graph } = mount({ plan });
    const listener = vi.fn();
    graph.addEventListener('statusrequest', listener);
    graph.addEventListener('editrequest', listener);
    graph.addEventListener('nodepositionrequest', listener);
    graph.setProgress({ [plan.subjects[0].id]: plan.statuses[1].id });
    graph.setPlan(plan);
    graph.setTheme({ '--accent-color': 'red' });
    vi.runOnlyPendingTimers();
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports once, AbortSignal, removal, capture, and isolated instance subscriptions', () => {
    const plan = makePlan();
    const first = mount({ plan });
    const second = mount({ plan });
    const id = plan.subjects[0].id;
    const once = vi.fn();
    const aborted = vi.fn();
    const removed = vi.fn();
    const captured = vi.fn();
    const other = vi.fn();
    const controller = new AbortController();
    first.graph.addEventListener('statusrequest', once, { once: true });
    first.graph.addEventListener('statusrequest', aborted, { signal: controller.signal });
    first.graph.addEventListener('statusrequest', removed, false);
    first.graph.addEventListener('statusrequest', captured, { capture: true });
    second.graph.addEventListener('statusrequest', other);
    controller.abort();
    first.graph.removeEventListener('statusrequest', removed, { capture: false });
    first.renderer.tap(id);
    vi.runOnlyPendingTimers();
    first.graph.removeEventListener('statusrequest', captured, { capture: true });
    first.renderer.tap(id);
    vi.runOnlyPendingTimers();
    expect(once).toHaveBeenCalledTimes(1);
    expect(captured).toHaveBeenCalledTimes(1);
    expect(aborted).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
    expect(other).not.toHaveBeenCalled();
    second.renderer.tap(id);
    vi.runOnlyPendingTimers();
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('delays editable taps by 200 ms, replaces pending taps, and cancels pending requests when replacing the plan', () => {
    const plan = makePlan();
    const { graph, renderer } = mount({ plan, editable: true });
    const listener = vi.fn();
    graph.addEventListener('statusrequest', listener);
    renderer.tap(plan.subjects[0].id);
    vi.advanceTimersByTime(100);
    renderer.tap(plan.subjects[1].id);
    vi.advanceTimersByTime(199);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ detail: {
      subjectId: plan.subjects[1].id, nextStatusId: plan.statuses[1].id,
    } }));
    renderer.tap(plan.subjects[0].id);
    graph.setPlan(plan);
    vi.runOnlyPendingTimers();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('cancels pending timers and releases renderer and consumer listeners on idempotent destruction', () => {
    const plan = makePlan();
    const { graph, renderer } = mount({ plan, editable: true });
    const listener = vi.fn();
    graph.addEventListener('statusrequest', listener);
    renderer.tap(plan.subjects[0].id);
    const queuedRendererHandler = renderer.listeners[0].handler;
    graph.destroy();
    graph.destroy();
    queuedRendererHandler(/** @type {import('cytoscape').EventObject} */ ({ target: { id: () => plan.subjects[0].id } }));
    vi.runOnlyPendingTimers();
    expect(listener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(renderer.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(renderer.listeners).toEqual([]);
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
  });
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
