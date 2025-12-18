/** @typedef {import('~/components/graph.js').Config} Config */
/** @typedef {import('~/components/graph.js').Variant} Variant */
/** @typedef {import('~/components/graph.js').Subject} Subject */
/** @typedef {import('~/components/graph.js').Edge} Edge */
/** @typedef {import('~/components/graph.js').StatusId} StatusId */
/** @typedef {import('~/components/graph.js').AvailabilityId} AvailabilityId */

import data from '~/data.json';

// Load config from default variant
/** @type {Variant} */
// @ts-ignore - JSON import with dynamic key is safe
const variant = data.variants['frba-k08'];

/** @type {Config} */
export const config = {
  statuses: variant.statuses,
  availabilities: variant.availabilities,
};

/**
 * Utility: get subject by id with a given status
 * @param {string} id
 * @param {StatusId} status
 * @returns {Subject}
 */
export function subject(id, status) {
  const subjectData = variant.subjects.find(s => s.id === id);
  if (!subjectData) throw new Error(`Subject ${id} not found`);
  return { ...subjectData, status };
}

/**
 * Utility: get multiple subjects, filtering dependencies to only include listed subjects
 * @param {Array<[string, StatusId]>} entries
 * @returns {Array<Subject>}
 */
export function subjects(...entries) {
  const ids = entries.map(([id]) => id);
  return entries.map(([id, status]) => {
    const subjectData = variant.subjects.find(s => s.id === id);
    if (!subjectData) throw new Error(`Subject ${id} not found`);

    // Filter prerequisites to only include subjects in the test
    const filteredPrereqs = subjectData.prerequisites.map(prereq => ({
      ...prereq,
      dependencies: prereq.dependencies.map(dep => ({
        ...dep,
        subjects: dep.subjects.filter(s => ids.includes(s)),
      })).filter(dep => dep.subjects.length > 0),
    })).filter(prereq => prereq.dependencies.length > 0);

    return { ...subjectData, status, prerequisites: filteredPrereqs };
  });
}

/**
 * Utility: get edge by id, filtering to only include specified ids (subjects + edges)
 * @param {string} id
 * @param {Array<string>} filterIds
 * @returns {Edge}
 */
export function edge(id, filterIds) {
  const edgeData = variant.edges.find(e => e.id === id);
  if (!edgeData) throw new Error(`Edge ${id} not found`);
  return {
    ...edgeData,
    dependencies: edgeData.dependencies.filter(d => filterIds.includes(d)),
    targets: edgeData.targets.filter(t => filterIds.includes(t)),
  };
}

/**
 * Utility: get multiple edges, auto-filtering to include only specified subjects and edge ids
 * @param {Array<string>} edgeIds
 * @param {Array<string>} subjectIds
 * @returns {Array<Edge>}
 */
export function edges(edgeIds, subjectIds) {
  const allIds = [...subjectIds, ...edgeIds];
  return edgeIds.map(id => edge(id, allIds));
}

/**
 * Helper to get color for a status
 * @param {StatusId} statusId
 * @returns {string}
 */
export const statusColor = (statusId) => config.statuses.find(s => s.id === statusId)?.color ?? '';

/**
 * Helper to get color for an availability
 * @param {AvailabilityId} availId
 * @returns {string}
 */
export const availabilityColor = (availId) => config.availabilities.find(a => a.id === availId)?.color ?? '';

/**
 * Helper to get text color based on status and leaf status
 * @param {StatusId} statusId
 * @param {boolean} isLeaf
 * @returns {string}
 */
export const textColor = (statusId, isLeaf) => {
  const status = config.statuses.find(s => s.id === statusId);
  return status ? (isLeaf ? (status.leafTextColor ?? status.textColor) : status.textColor) : '';
};

// Export full variant data for comprehensive tests
export const fullVariant = {
  subjects: variant.subjects,
  edges: variant.edges,
};
