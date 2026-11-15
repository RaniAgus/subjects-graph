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

/** A graph view whose DOM, renderer, and palette belong to this instance. */
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
    const surface = container.ownerDocument.createElement('div');
    surface.className = 'subjects-graph-surface';
    this.#root.append(surface);
    this.#applyTheme();
    container.append(this.#root);

    this.#cy = cytoscape({
      container: surface,
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
    this.fit();
    this.#resizeObserver = new ResizeObserver(() => {
      if (!this.#destroyed) this.#preserveViewport(() => this.#cy.resize());
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

  fit() {
    this.#assertAlive();
    this.#cy.fit(undefined, 50);
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
    new Graph(config, subjects, this.#plan.edges).render(drawer);
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
  }

  /** @param {() => void} update */
  #preserveViewport(update) {
    const zoom = this.#cy.zoom();
    const pan = { ...this.#cy.pan() };
    update();
    this.#cy.viewport({ zoom, pan });
  }
}
