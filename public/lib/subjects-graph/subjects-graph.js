/**
 * Public contracts for the subjects graph library. The host UI owns inputs and
 * persistence; implementations snapshot inputs and never mutate caller data.
 *
 * @typedef {import('../../graph.js').Status} Status
 * @typedef {import('../../graph.js').Availability} Availability
 * @typedef {import('../../graph.js').Edge} Edge
 * @typedef {import('../../graph.js').Position} Position
 * @typedef {Omit<import('../../graph.js').Subject, 'status'> & {status?: string}} PlanSubject
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

export {};
