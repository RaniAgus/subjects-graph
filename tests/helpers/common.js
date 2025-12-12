import data from '../../docs/data.json';

// Load config from default variant
const variant = data.variants[data.defaultVariant];
export const config = {
  statuses: variant.statuses,
  availabilities: variant.availabilities,
};

// Utility: get subject by id with a given status
export function subject(id, status) {
  const subjectData = variant.subjects.find(s => s.id === id);
  if (!subjectData) throw new Error(`Subject ${id} not found`);
  return { ...subjectData, status };
}

// Utility: get multiple subjects, filtering dependencies to only include listed subjects
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

// Utility: get edge by id, filtering to only include specified subjects
export function edge(id, subjectIds) {
  const edgeData = variant.edges.find(e => e.id === id);
  if (!edgeData) throw new Error(`Edge ${id} not found`);
  return {
    ...edgeData,
    dependencies: edgeData.dependencies.filter(d => subjectIds.includes(d)),
    targets: edgeData.targets.filter(t => subjectIds.includes(t)),
  };
}

// Helper to get color for a status/availability
export const statusColor = (statusId) => config.statuses.find(s => s.id === statusId).color;
export const availabilityColor = (availId) => config.availabilities.find(a => a.id === availId).color;
