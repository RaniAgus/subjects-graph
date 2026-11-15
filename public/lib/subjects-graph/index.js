/**
 * Public library entry point and contracts.
 *
 * @typedef {import('./subjects-graph.js').Status} Status
 * @typedef {import('./subjects-graph.js').Availability} Availability
 * @typedef {import('./subjects-graph.js').Edge} Edge
 * @typedef {import('./subjects-graph.js').Position} Position
 * @typedef {import('./subjects-graph.js').PlanSubject} PlanSubject
 * @typedef {import('./subjects-graph.js').Plan} Plan
 * @typedef {import('./subjects-graph.js').Progress} Progress
 * @typedef {import('./subjects-graph.js').Theme} Theme
 * @typedef {import('./subjects-graph.js').SubjectsGraphOptions} SubjectsGraphOptions
 * @typedef {import('./subjects-graph.js').SetPlanOptions} SetPlanOptions
 * @typedef {import('./subjects-graph.js').PNGOptions} PNGOptions
 * @typedef {import('./subjects-graph.js').EditRequest} EditRequest
 * @typedef {import('./subjects-graph.js').SubjectsGraphEventMap} SubjectsGraphEventMap
 * @typedef {import('./subjects-graph.js').AddSubjectsGraphEventListener} AddSubjectsGraphEventListener
 * @typedef {import('./subjects-graph.js').RemoveSubjectsGraphEventListener} RemoveSubjectsGraphEventListener
 * @typedef {import('./subjects-graph.js').SubjectsGraphAPI} SubjectsGraphAPI
 * @typedef {import('./subjects-graph.js').SubjectsGraphConstructor} SubjectsGraphConstructor
 */

/**
 * @template {keyof SubjectsGraphEventMap} K
 * @typedef {import('./subjects-graph.js').SubjectsGraphEventListener<K>} SubjectsGraphEventListener
 */

export { SubjectsGraph } from './subjects-graph.js';
