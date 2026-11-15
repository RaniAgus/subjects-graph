/**
 * Public contracts for the subjects graph library. The host UI owns inputs and
 * persistence; implementations snapshot inputs and never mutate caller data.
 *
 * @typedef {import('./core.js').Status} Status
 * @typedef {import('./core.js').Availability} Availability
 * @typedef {import('./core.js').Edge} Edge
 * @typedef {import('./core.js').Position} Position
 * @typedef {Omit<import('./core.js').Subject, 'status'> & {status?: string}} PlanSubject
 * @typedef {Record<string, string>} Progress
 * @typedef {Record<string, string>} Theme
 *
 * @typedef {object} Plan
 * @property {string} name
 * @property {Status[]} statuses
 * @property {Availability[]} availabilities
 * @property {PlanSubject[]} subjects
 * @property {Edge[]} edges
 * @property {{position?: {vertical: 'top' | 'bottom', horizontal: 'left' | 'right'}}} [progress] Host UI metadata.
 *
 * @typedef {object} SubjectsGraphOptions
 * @property {Plan} plan
 * @property {Progress} [progress] Defaults to an empty map.
 * @property {Theme} [theme] Overrides the default palette.
 * @property {boolean} [editable] Defaults to false.
 *
 * @typedef {object} SetPlanOptions
 * @property {Progress} [progress] Defaults to an empty map.
 *
 * @typedef {object} PNGOptions
 * @property {number} [scale]
 * @property {string} [bg]
 * @property {boolean} [full]
 *
 * @typedef {{kind: 'subject' | 'connector', nodeId: string} |
 *   {kind: 'connection', sourceId: string, targetId: string, position: Position} |
 *   {kind: 'background', position: Position}} EditRequest
 *
 * @typedef {object} SubjectsGraphEventMap
 * @property {CustomEvent<{subjectId: string, nextStatusId: string}>} statusrequest
 * @property {CustomEvent<{nodeId: string, position: Position}>} nodepositionrequest
 * @property {CustomEvent<EditRequest>} editrequest
 */

/**
 * @template {keyof SubjectsGraphEventMap} K
 * @callback SubjectsGraphEventListener
 * @param {SubjectsGraphEventMap[K]} event
 * @returns {void}
 */

/**
 * @typedef {<K extends keyof SubjectsGraphEventMap>(type: K, listener: SubjectsGraphEventListener<K>, options?: boolean | AddEventListenerOptions) => void} AddSubjectsGraphEventListener
 * @typedef {<K extends keyof SubjectsGraphEventMap>(type: K, listener: SubjectsGraphEventListener<K>, options?: boolean | EventListenerOptions) => void} RemoveSubjectsGraphEventListener
 *
 * @typedef {object} SubjectsGraphAPI
 * @property {(plan: Plan, options?: SetPlanOptions) => void} setPlan Replaces the plan and progress, preserving the viewport.
 * @property {() => Progress} getProgress Returns a copy of the full effective progress.
 * @property {(progress: Progress) => void} setProgress Replaces progress; missing subjects use their plan status or the first status catalog entry.
 * @property {(theme: Theme) => void} setTheme Replaces overrides on the default palette.
 * @property {(editable: boolean) => void} setEditable
 * @property {() => void} fit
 * @property {(options?: PNGOptions) => Promise<Blob>} exportPNG
 * @property {() => void} destroy Idempotently releases the instance.
 * @property {AddSubjectsGraphEventListener} addEventListener Supports standard listener options, including AbortSignal.
 * @property {RemoveSubjectsGraphEventListener} removeEventListener
 *
 * @typedef {new (container: HTMLElement, options: SubjectsGraphOptions) => SubjectsGraphAPI} SubjectsGraphConstructor
 */

import cytoscape from 'cytoscape';
import { Graph } from './core.js';
import { CytoscapeDrawer } from './cytoscape-drawer.js';
import { buildStylesheet } from './cytoscape-styles.js';
import { mergeTheme, resolveColor } from './theme.js';

/** A graph view whose DOM, renderer, and palette belong to this instance.
 * @implements {SubjectsGraphAPI}
 */
export class SubjectsGraph {
  /** @type {Plan} */
  #plan;
  /** @type {Progress} */
  #progress;
  /** @type {Theme} */
  #theme;
  /** @type {boolean} */
  #editable;
  /** @type {HTMLDivElement} */
  #root;
  /** @type {HTMLDivElement} */
  #surface;
  /** @type {HTMLDivElement} */
  #tooltip;
  /** @type {Graph | undefined} */
  #graph;
  /** @type {string | undefined} */
  #hoveredSubjectId;
  /** @type {Position | undefined} */
  #pointer;
  /** @type {import('cytoscape').Core} */
  #cy;
  /** @type {ResizeObserver} */
  #resizeObserver;
  #events = new EventTarget();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #tapTimer;
  #destroyed = false;

  /** @param {HTMLElement} container
   * @param {SubjectsGraphOptions} options
   */
  constructor(container, { plan, progress = {}, theme = {}, editable = false }) {
    this.#plan = structuredClone(plan);
    this.#progress = structuredClone(progress);
    this.#theme = mergeTheme(theme);
    this.#editable = editable;
    const elements = this.#buildElements();

    this.#root = container.ownerDocument.createElement('div');
    this.#root.className = `subjects-graph${editable ? ' subjects-graph-editable' : ''}`;
    this.#surface = container.ownerDocument.createElement('div');
    this.#surface.className = 'subjects-graph-surface';
    this.#tooltip = container.ownerDocument.createElement('div');
    this.#tooltip.className = 'subjects-graph-tooltip';
    this.#root.append(this.#surface);
    this.#root.append(this.#tooltip);
    this.#applyTheme();
    container.append(this.#root);

    this.#cy = cytoscape({
      container: this.#surface,
      elements,
      style: buildStylesheet(editable, this.#theme),
      layout: { name: 'preset', fit: false },
      minZoom: 0.3,
      maxZoom: 3,
    });
    this.#cy.on('tap', 'node[nodeType="subject"]', event => {
      if (this.#destroyed) return;
      const subjectId = event.target.id();
      this.#cancelPendingTap();
      this.#tapTimer = setTimeout(() => {
        this.#tapTimer = undefined;
        if (this.#destroyed) return;
        const currentStatusId = this.#effectiveProgress()[subjectId];
        const currentIndex = this.#plan.statuses.findIndex(status => status.id === currentStatusId);
        const nextStatusId = this.#plan.statuses[(currentIndex + 1) % this.#plan.statuses.length].id;
        this.#events.dispatchEvent(new CustomEvent('statusrequest', { detail: { subjectId, nextStatusId } }));
      }, this.#editable ? 200 : 0);
    });
    this.#installInteractions();
    this.fit();
    this.#resizeObserver = new ResizeObserver(() => {
      if (this.#destroyed) return;
      this.#preserveViewport(() => this.#cy.resize());
      this.#updateGrid();
      this.#positionTooltip();
    });
    this.#resizeObserver.observe(container);
  }

  /** @param {Plan} plan
   * @param {SetPlanOptions} [options]
   */
  setPlan(plan, { progress = {} } = {}) {
    this.#assertAlive();
    this.#cancelPendingTap();
    this.#plan = structuredClone(plan);
    this.#progress = structuredClone(progress);
    this.#render();
  }

  /** @returns {Progress} */
  getProgress() {
    this.#assertAlive();
    return this.#effectiveProgress();
  }

  /** @param {Progress} progress */
  setProgress(progress) {
    this.#assertAlive();
    this.#progress = structuredClone(progress);
    this.#render();
  }

  /** @template {keyof SubjectsGraphEventMap} K
   * @param {K} type
   * @param {SubjectsGraphEventListener<K>} listener
   * @param {boolean | AddEventListenerOptions} [options]
   */
  addEventListener(type, listener, options) {
    this.#assertAlive();
    this.#events.addEventListener(type, /** @type {EventListener} */ (listener), options);
  }

  /** @template {keyof SubjectsGraphEventMap} K
   * @param {K} type
   * @param {SubjectsGraphEventListener<K>} listener
   * @param {boolean | EventListenerOptions} [options]
   */
  removeEventListener(type, listener, options) {
    this.#assertAlive();
    this.#events.removeEventListener(type, /** @type {EventListener} */ (listener), options);
  }

  /** @param {Theme} theme */
  setTheme(theme) {
    this.#assertAlive();
    for (const property of Object.keys(this.#theme)) this.#root.style.removeProperty(property);
    this.#theme = mergeTheme(theme);
    this.#applyTheme();
    this.#render();
  }

  /** @param {boolean} editable */
  setEditable(editable) {
    this.#assertAlive();
    this.#editable = editable;
    this.#root.className = `subjects-graph${editable ? ' subjects-graph-editable' : ''}`;
    this.#updateCursor();
    this.#render();
  }

  fit() {
    this.#assertAlive();
    this.#cy.fit(undefined, 50);
    this.#updateGrid();
  }

  /** @param {PNGOptions} [options]
   * @returns {Promise<Blob>}
   */
  async exportPNG({ scale = 4, bg = 'transparent', full = true } = {}) {
    this.#assertAlive();
    return this.#cy.png({ output: 'blob', scale, bg, full });
  }

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#cancelPendingTap();
    this.#hoveredSubjectId = undefined;
    this.#pointer = undefined;
    this.#graph = undefined;
    this.#events = new EventTarget();
    this.#resizeObserver.disconnect();
    this.#cy.removeAllListeners();
    this.#cy.destroy();
    this.#root.remove();
  }

  #assertAlive() {
    if (this.#destroyed) throw new Error('SubjectsGraph has been destroyed.');
  }

  #cancelPendingTap() {
    clearTimeout(this.#tapTimer);
    this.#tapTimer = undefined;
  }

  #installInteractions() {
    this.#cy.on('dragfree', 'node', event => {
      if (this.#destroyed || !this.#editable) return;
      const node = event.target;
      if (!['subject', 'connector'].includes(node.data('nodeType'))) return;
      const nodeId = node.id();
      const { x, y } = node.position();
      this.#events.dispatchEvent(new CustomEvent('nodepositionrequest', { detail: { nodeId, position: { x, y } } }));
      if (this.#destroyed) return;
      const position = this.#plan.subjects.find(subject => subject.id === nodeId)?.position
        ?? this.#plan.edges.find(edge => edge.id === nodeId)?.position;
      const currentNode = this.#cy.getElementById(nodeId);
      if (position && currentNode.length) currentNode.position({ ...position });
    });
    for (const kind of /** @type {const} */ (['subject', 'connector'])) {
      this.#cy.on('dbltap', `node[nodeType="${kind}"]`, event => {
        if (this.#destroyed || !this.#editable) return;
        this.#requestEdit({ kind, nodeId: event.target.id() });
      });
    }
    this.#cy.on('dbltap', 'edge', event => {
      if (this.#destroyed || !this.#editable) return;
      this.#requestEdit({
        kind: 'connection', sourceId: event.target.data('source'), targetId: event.target.data('target'),
        position: { x: event.position.x, y: event.position.y },
      });
    });
    this.#cy.on('dbltap', event => {
      if (this.#destroyed || !this.#editable) return;
      if (event.target === this.#cy) {
        this.#requestEdit({ kind: 'background', position: { x: event.position.x, y: event.position.y } });
      }
    });
    this.#cy.on('pan zoom', () => {
      if (!this.#destroyed) this.#updateGrid();
    });
    this.#cy.on('mouseover', 'node[nodeType="subject"]', event => {
      if (this.#destroyed) return;
      this.#hoveredSubjectId = event.target.id();
      this.#pointer = { ...event.renderedPosition };
      this.#updateCursor();
      this.#refreshTooltip();
    });
    this.#cy.on('mousemove', 'node[nodeType="subject"]', event => {
      if (this.#destroyed) return;
      this.#pointer = { ...event.renderedPosition };
      this.#positionTooltip();
    });
    this.#cy.on('mouseout', 'node', () => {
      if (this.#destroyed) return;
      this.#hoveredSubjectId = undefined;
      this.#tooltip.style.display = 'none';
      this.#updateCursor();
    });
  }

  /** @param {EditRequest} detail */
  #requestEdit(detail) {
    if (this.#destroyed || !this.#editable) return;
    this.#cancelPendingTap();
    this.#events.dispatchEvent(new CustomEvent('editrequest', { detail }));
  }

  #updateCursor() {
    this.#surface.style.cursor = this.#editable ? 'move' : this.#hoveredSubjectId ? 'pointer' : 'grab';
  }

  #updateGrid() {
    if (!this.#editable) {
      this.#surface.style.backgroundImage = '';
      this.#surface.style.backgroundSize = '';
      this.#surface.style.backgroundPosition = '';
      return;
    }
    const gridSize = 100 * this.#cy.zoom();
    const { x, y } = this.#cy.pan();
    const gridColor = 'rgba(255, 255, 255, 0.1)';
    const axisColor = 'rgba(255, 255, 255, 0.15)';
    const layers = [];
    const sizes = [];
    const positions = [];
    if (x >= 0 && x <= this.#surface.offsetWidth) {
      layers.push(`linear-gradient(to right, ${axisColor} 1px, transparent 1px)`);
      sizes.push('100% 100%');
      positions.push(`${x}px 0`);
    }
    if (y >= 0 && y <= this.#surface.offsetHeight) {
      layers.push(`linear-gradient(to bottom, ${axisColor} 1px, transparent 1px)`);
      sizes.push('100% 100%');
      positions.push(`0 ${y}px`);
    }
    layers.push(`linear-gradient(to right, ${gridColor} 1px, transparent 1px)`,
      `linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`);
    sizes.push(`${gridSize}px ${gridSize}px`, `${gridSize}px ${gridSize}px`);
    positions.push(`${x}px ${y}px`, `${x}px ${y}px`);
    this.#surface.style.backgroundImage = layers.join(', ');
    this.#surface.style.backgroundSize = sizes.join(', ');
    this.#surface.style.backgroundPosition = positions.join(', ');
  }

  #refreshTooltip() {
    const subject = this.#plan.subjects.find(subject => subject.id === this.#hoveredSubjectId);
    if (!subject) {
      this.#hoveredSubjectId = undefined;
      this.#tooltip.style.display = 'none';
      this.#updateCursor();
      return;
    }
    this.#tooltip.replaceChildren();
    const document = this.#root.ownerDocument;
    const title = document.createElement('strong');
    title.textContent = subject.name;
    this.#tooltip.append(title);
    const hoveredNode = this.#graph?.getNodeById(subject.id);
    for (const prerequisite of subject.prerequisites) {
      const section = document.createElement('div');
      section.className = 'subjects-graph-tooltip-section';
      const availability = document.createElement('span');
      availability.className = 'subjects-graph-tooltip-availability';
      const name = this.#plan.availabilities.find(item => item.id === prerequisite.availabilityId)?.name ?? prerequisite.availabilityId;
      availability.textContent = `${name.replace('Disponible', 'Requisitos')}:`;
      section.append(availability);
      const list = document.createElement('ul');
      for (const dependency of prerequisite.dependencies) {
        const status = this.#plan.statuses.find(item => item.id === dependency.statusId)?.name ?? dependency.statusId;
        for (const subjectId of dependency.subjects) {
          const name = this.#plan.subjects.find(item => item.id === subjectId)?.name ?? subjectId;
          const item = document.createElement('li');
          const label = `${name} (${status})`;
          if (hoveredNode?.satisfies(subjectId, dependency.statusId)) {
            const satisfied = document.createElement('del');
            satisfied.textContent = label;
            item.append(satisfied);
          } else item.textContent = label;
          list.append(item);
        }
      }
      section.append(list);
      this.#tooltip.append(section);
    }
    this.#tooltip.style.display = 'block';
    this.#positionTooltip();
  }

  #positionTooltip() {
    if (!this.#hoveredSubjectId || !this.#pointer) return;
    const { x, y } = this.#pointer;
    const width = this.#tooltip.offsetWidth;
    const height = this.#tooltip.offsetHeight;
    const maxX = Math.max(0, this.#surface.offsetWidth - width);
    const maxY = Math.max(0, this.#surface.offsetHeight - height);
    const left = x + 15 > maxX ? x - 15 - width : x + 15;
    const top = y + 15 > maxY ? y - 15 - height : y + 15;
    this.#tooltip.style.left = `${Math.max(0, Math.min(left, maxX))}px`;
    this.#tooltip.style.top = `${Math.max(0, Math.min(top, maxY))}px`;
  }

  /** @returns {Progress} */
  #effectiveProgress() {
    return Object.fromEntries(this.#plan.subjects.map(subject => [
      subject.id, this.#progress[subject.id] ?? subject.status ?? this.#plan.statuses[0].id,
    ]));
  }

  #applyTheme() {
    for (const [property, value] of Object.entries(this.#theme)) {
      this.#root.style.setProperty(property, value);
    }
  }

  #buildElements() {
    const config = {
      statuses: this.#plan.statuses.map(status => ({
        ...status,
        color: resolveColor(status.color, this.#theme),
        textColor: resolveColor(status.textColor, this.#theme),
        leafTextColor: status.leafTextColor === undefined ? undefined : resolveColor(status.leafTextColor, this.#theme),
      })),
      availabilities: this.#plan.availabilities.map(availability => ({
        ...availability, color: resolveColor(availability.color, this.#theme),
      })),
    };
    const progress = this.#effectiveProgress();
    const subjects = this.#plan.subjects.map(subject => ({
      ...subject,
      status: progress[subject.id],
    }));
    const drawer = new CytoscapeDrawer(this.#editable);
    this.#graph = new Graph(config, subjects, this.#plan.edges);
    this.#graph.render(drawer);
    return drawer.getElements();
  }

  #render() {
    const elements = this.#buildElements();
    this.#preserveViewport(() => {
      this.#cy.batch(() => {
        this.#cy.elements().remove();
        this.#cy.add(elements);
        this.#cy.style(buildStylesheet(this.#editable, this.#theme));
      });
    });
    this.#updateGrid();
    this.#refreshTooltip();
  }

  /** @param {() => void} update */
  #preserveViewport(update) {
    const zoom = this.#cy.zoom();
    const pan = { ...this.#cy.pan() };
    update();
    this.#cy.viewport({ zoom, pan });
  }
}
