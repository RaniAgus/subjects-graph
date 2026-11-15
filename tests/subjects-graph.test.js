import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import cytoscape from 'cytoscape';
import { SubjectsGraph } from '~/lib/subjects-graph/index.js';
import { DEFAULT_THEME } from '~/lib/subjects-graph/theme.js';
import { config, fullVariant, subjects } from './helpers/common.js';

vi.mock('cytoscape', () => ({ default: vi.fn() }));

/** Minimal owned-subtree DOM double: no document or browser globals needed. */
class ElementDouble {
  /** @param {string} [tagName] */
  constructor(tagName = 'div') { this.tagName = tagName; }
  className = '';
  style = { setProperty: vi.fn(), removeProperty: vi.fn(), display: '', left: '', top: '', cursor: '', backgroundImage: '', backgroundSize: '', backgroundPosition: '' };
  offsetWidth = 800;
  offsetHeight = 600;
  text = '';
  /** @param {string} value */
  set textContent(value) { this.text = value; this.replaceChildren(); }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  /** @type {ElementDouble[]} */
  children = [];
  /** @type {ElementDouble | undefined} */
  parent;
  ownerDocument = { createElement: (/** @type {string} */ tagName) => new ElementDouble(tagName) };
  replaceChildren() { for (const child of this.children) child.parent = undefined; this.children = []; }
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
  /** @type {{type: string, selector?: string, handler: import('cytoscape').EventHandler}[]} */
  listeners = [];
  on = vi.fn((/** @type {string} */ type, /** @type {string | import('cytoscape').EventHandler} */ selector, /** @type {import('cytoscape').EventHandler | undefined} */ handler = undefined) => {
    this.listeners.push(typeof selector === 'string' ? { type, selector, handler: /** @type {import('cytoscape').EventHandler} */ (handler) } : { type, handler: selector });
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
  style = vi.fn((/** @type {import('cytoscape').StylesheetStyle[]} */ _styles) => {});
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
  getElementById(id) {
    return {
      length: this.content.nodes.some(node => node.data.id === id) ? 1 : 0,
      position: (/** @type {{x: number, y: number}} */ value) => { this.node(id).position = value; },
    };
  }
  /** @param {string} type
   * @param {string} [id]
   * @param {{x: number, y: number}} [position]
   */
  emit(type, id, position = { x: 100, y: 150 }) {
    const node = this.content.nodes.find(node => node.data.id === id);
    const edge = this.content.edges.find(edge => edge.data.id === id);
    const element = node ?? edge;
    const target = element ? {
      id: () => id,
      data: (/** @type {string} */ key) => element.data[key],
      position: () => node?.position,
    } : this;
    for (const listener of this.listeners) {
      const selector = listener.selector;
      if (!listener.type.split(' ').includes(type)) continue;
      if (selector && !(selector === 'node' && node) && !(selector === 'edge' && edge)
        && !(node && selector === `node[nodeType="${node.data.nodeType}"]`)) continue;
      listener.handler(/** @type {import('cytoscape').EventObject} */ (/** @type {unknown} */ ({ target, position, renderedPosition: position })));
    }
  }
  /** @param {string} id */
  tap(id) {
    this.emit('tap', id);
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
    graph.setEditable(true);
    graph.setEditable(false);
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

describe('SubjectsGraph editing interactions', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('toggles locks, connector styles and local grid without changing progress, viewport, or subscriptions', () => {
    const { graph, renderer, container } = mount({ plan: makePlan() });
    const before = graph.getProgress();
    const subscriptions = renderer.on.mock.calls.length;
    renderer.zoomValue = 2;
    renderer.panValue = { x: -35, y: 60 };
    graph.setEditable(true);
    expect(container.children[0].className).toBe('subjects-graph subjects-graph-editable');
    expect(renderer.content.nodes.every(node => node.locked === false)).toBe(true);
    const styles = /** @type {import('cytoscape').StylesheetStyle[]} */ (renderer.style.mock.calls.at(-1)?.[0]);
    expect(styles.find(style => style.selector === 'node[?isInvisible]')?.style).toMatchObject({ opacity: 0.5 });
    const surface = container.children[0].children[0];
    expect(surface.style.backgroundSize).toBe('100% 100%, 200px 200px, 200px 200px');
    expect(surface.style.backgroundPosition).toBe('0 60px, -35px 60px, -35px 60px');
    graph.setEditable(false);
    expect(renderer.content.nodes.every(node => node.locked)).toBe(true);
    expect(surface.style.backgroundImage).toBe('');
    expect(surface.style.backgroundSize).toBe('');
    expect(surface.style.backgroundPosition).toBe('');
    expect(surface.style.cursor).toBe('grab');
    expect(container.children[0].className).toBe('subjects-graph');
    expect(graph.getProgress()).toEqual(before);
    expect(renderer.zoomValue).toBe(2);
    expect(renderer.panValue).toEqual({ x: -35, y: 60 });
    expect(renderer.on).toHaveBeenCalledTimes(subscriptions);
    expect(renderer.fit).toHaveBeenCalledTimes(1);
  });

  it('emits only the editable request shapes, snapshots world positions, and suppresses pending status taps', () => {
    const plan = makePlan();
    const { graph, renderer } = mount({ plan });
    const requests = vi.fn();
    const statuses = vi.fn();
    graph.addEventListener('editrequest', requests);
    graph.addEventListener('statusrequest', statuses);
    const subjectId = plan.subjects[0].id;
    const connectorId = renderer.content.nodes.find(node => node.data.nodeType === 'connector')?.data.id;
    const edge = renderer.content.edges[0];
    if (!connectorId || !edge.data.id) throw new Error('Missing fixture connections');
    for (const id of [subjectId, connectorId, edge.data.id, undefined]) renderer.emit('dbltap', id);
    expect(requests).not.toHaveBeenCalled();
    graph.setEditable(true);
    renderer.tap(subjectId);
    renderer.emit('dbltap', subjectId);
    renderer.emit('dbltap', connectorId);
    const position = { x: -12.5, y: 42.25 };
    renderer.emit('dbltap', edge.data.id, position);
    renderer.emit('dbltap', undefined, position);
    position.x = 999;
    expect(requests.mock.calls.map(([event]) => event.detail)).toEqual([
      { kind: 'subject', nodeId: subjectId },
      { kind: 'connector', nodeId: connectorId },
      { kind: 'connection', sourceId: edge.data.source, targetId: edge.data.target, position: { x: -12.5, y: 42.25 } },
      { kind: 'background', position: { x: -12.5, y: 42.25 } },
    ]);
    vi.runOnlyPendingTimers();
    expect(statuses).not.toHaveBeenCalled();
  });

  it('settles ignored subject and connector drags at authoritative plan positions and copies request coordinates', () => {
    const plan = makePlan();
    const { graph, renderer } = mount({ plan });
    const listener = vi.fn();
    graph.addEventListener('nodepositionrequest', listener);
    const subjectId = plan.subjects[0].id;
    renderer.emit('dragfree', subjectId);
    expect(listener).not.toHaveBeenCalled();
    graph.setEditable(true);
    const connector = plan.edges.find(edge => renderer.content.nodes.some(node => node.data.id === edge.id));
    if (!connector) throw new Error('Missing fixture connector');
    for (const definition of [plan.subjects[0], connector]) {
      const dragged = { x: 7.25, y: -8.5 };
      renderer.node(definition.id).position = dragged;
      renderer.emit('dragfree', definition.id);
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { nodeId: definition.id, position: { x: 7.25, y: -8.5 } } }));
      dragged.x = 999;
      expect(listener.mock.calls.at(-1)?.[0].detail.position).toEqual({ x: 7.25, y: -8.5 });
      expect(renderer.node(definition.id).position).toEqual(definition.position);
    }
    graph.setTheme({});
    expect(renderer.node(subjectId).position).toEqual(plan.subjects[0].position);
  });

  it('settles accepted drags at the replacement plan position and permits synchronous destruction', () => {
    const plan = makePlan();
    const { graph, renderer } = mount({ plan, editable: true });
    const subject = plan.subjects[0];
    graph.addEventListener('nodepositionrequest', event => {
      subject.position = { x: Math.round(event.detail.position.x), y: Math.round(event.detail.position.y) };
      graph.setPlan(plan);
    }, { once: true });
    renderer.node(subject.id).position = { x: 10.6, y: 20.3 };
    renderer.emit('dragfree', subject.id);
    expect(renderer.node(subject.id).position).toEqual({ x: 11, y: 20 });
    graph.addEventListener('nodepositionrequest', () => graph.destroy());
    const lookup = vi.spyOn(renderer, 'getElementById');
    renderer.emit('dragfree', subject.id);
    expect(lookup).not.toHaveBeenCalled();
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
  });

  it('tracks pan, zoom, resize and render in the grid, with axes only inside the surface', () => {
    const { graph, renderer, container } = mount({ plan: makePlan(), editable: true });
    const surface = container.children[0].children[0];
    expect(surface.style.backgroundSize).toBe('100% 100%, 100% 100%, 80px 80px, 80px 80px');
    renderer.zoomValue = 1.5;
    renderer.panValue = { x: 900, y: -10 };
    renderer.emit('pan');
    expect(surface.style.backgroundSize).toBe('150px 150px, 150px 150px');
    expect(surface.style.backgroundPosition).toBe('900px -10px, 900px -10px');
    surface.offsetWidth = 1000;
    ResizeObserverDouble.instances[0].notify();
    expect(surface.style.backgroundSize).toBe('100% 100%, 150px 150px, 150px 150px');
    renderer.zoomValue = 2.5;
    renderer.emit('zoom');
    expect(surface.style.backgroundSize).toContain('250px 250px');
    graph.setProgress({});
    expect(surface.style.backgroundPosition).toBe('900px 0, 900px -10px, 900px -10px');
    expect(renderer.zoomValue).toBe(2.5);
    expect(renderer.panValue).toEqual({ x: 900, y: -10 });
  });

  it('leaves no callbacks or DOM effects after destruction, including already queued renderer handlers', () => {
    const { graph, renderer, container } = mount({ plan: makePlan(), editable: true });
    const handlers = [...renderer.listeners];
    const listener = vi.fn();
    graph.addEventListener('editrequest', listener);
    graph.addEventListener('nodepositionrequest', listener);
    const root = container.children[0];
    graph.destroy();
    const before = structuredClone(root.children.map(child => child.style.backgroundImage));
    for (const { handler } of handlers) handler(/** @type {import('cytoscape').EventObject} */ (/** @type {unknown} */ ({ target: renderer, position: { x: 0, y: 0 } })));
    ResizeObserverDouble.instances[0].notify();
    vi.runOnlyPendingTimers();
    expect(listener).not.toHaveBeenCalled();
    expect(root.children.map(child => child.style.backgroundImage)).toEqual(before);
    expect(container.children).toEqual([]);
  });
});

describe('SubjectsGraph subject tooltips', () => {
  it('uses literal titles, prerequisite sections and status names, then refreshes satisfaction with progress', () => {
    const plan = makePlan();
    const subject = plan.subjects.find(subject => subject.prerequisites.some(prerequisite => prerequisite.dependencies.some(dependency => dependency.subjects.length)));
    if (!subject) throw new Error('Missing fixture prerequisites');
    subject.name = '<img src=x onerror=alert(1)> & title';
    const dependency = subject.prerequisites[0].dependencies[0];
    const prerequisiteSubject = plan.subjects.find(item => item.id === dependency.subjects[0]);
    if (!prerequisiteSubject) throw new Error('Missing fixture dependency');
    prerequisiteSubject.name = '<script>literal dependency</script>';
    const { graph, renderer, container } = mount({ plan });
    const tooltip = container.children[0].children[1];
    const surface = container.children[0].children[0];
    renderer.emit('mouseover', subject.id);
    expect(tooltip.style.display).toBe('block');
    expect(surface.style.cursor).toBe('pointer');
    expect(tooltip.children[0].tagName).toBe('strong');
    expect(tooltip.children[0].textContent).toBe(subject.name);
    const section = tooltip.children[1];
    expect(section.children[0].textContent).toBe(`${plan.availabilities.find(item => item.id === subject.prerequisites[0].availabilityId)?.name.replace('Disponible', 'Requisitos')}:`);
    expect(section.children[1].children[0].textContent).toBe(`${prerequisiteSubject.name} (${plan.statuses.find(item => item.id === dependency.statusId)?.name})`);
    expect(section.children[1].children[0].children).toEqual([]);
    graph.setProgress(Object.fromEntries(plan.subjects.map(item => [item.id, plan.statuses.at(-1)?.id ?? ''])));
    expect(tooltip.children[1].children[1].children[0].children[0].tagName).toBe('del');
    graph.setProgress({});
    expect(tooltip.children[1].children[1].children[0].children).toEqual([]);
    graph.setEditable(true);
    expect(surface.style.cursor).toBe('move');
    renderer.emit('mouseout', subject.id);
    expect(tooltip.style.display).toBe('none');
    expect(surface.style.cursor).toBe('move');
  });

  it('bounds tooltip placement near the pointer, refreshes replacement names and hides removed subjects', () => {
    const plan = makePlan();
    const subject = plan.subjects[0];
    const { graph, renderer, container } = mount({ plan });
    const tooltip = container.children[0].children[1];
    tooltip.offsetWidth = 200;
    tooltip.offsetHeight = 100;
    renderer.emit('mouseover', subject.id, { x: 790, y: 590 });
    expect(tooltip.style.left).toBe('575px');
    expect(tooltip.style.top).toBe('475px');
    renderer.emit('mousemove', subject.id, { x: -30, y: -20 });
    expect(tooltip.style.left).toBe('0px');
    expect(tooltip.style.top).toBe('0px');
    subject.name = 'Changed live title';
    graph.setPlan(plan);
    expect(tooltip.children[0].textContent).toBe(subject.name);
    graph.setPlan({ ...plan, subjects: [], edges: [] });
    expect(tooltip.style.display).toBe('none');
    expect(container.children[0].children[0].style.cursor).toBe('grab');
  });
});
