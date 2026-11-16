import type { Plan } from '@raniagus/subjects-graph';

export function validatePlan(value: any): asserts value is Plan {
  if (!value || typeof value.name !== 'string') throw new Error('El plan necesita un nombre.');
  for (const key of ['statuses', 'availabilities', 'subjects', 'edges']) {
    if (!Array.isArray(value[key])) throw new Error(`${key} debe ser un array.`);
  }
  for (const key of ['statuses', 'availabilities']) {
    if (!value[key].length) throw new Error(`${key} no puede estar vacío.`);
    const ids = new Set<string>();
    for (const entry of value[key]) {
      if (typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)) throw new Error(`ID inválido o repetido en ${key}.`);
      ids.add(entry.id);
      if (typeof entry.name !== 'string' || typeof entry.color !== 'string') throw new Error(`Falta nombre o color en ${key}.`);
      if (key === 'statuses' && typeof entry.textColor !== 'string') throw new Error('Cada estado necesita textColor.');
    }
  }
  const nodes = [...value.subjects, ...value.edges];
  const ids = new Set<string>();
  for (const node of nodes) {
    if (typeof node.id !== 'string' || !node.id || ids.has(node.id)) throw new Error('Los nodos necesitan IDs únicos.');
    ids.add(node.id);
    if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) throw new Error(`Posición inválida: ${node.id}.`);
  }
  const subjects = new Set(value.subjects.map((subject: any) => subject.id));
  const statuses = new Set(value.statuses.map((status: any) => status.id));
  const availabilities = new Set(value.availabilities.map((item: any) => item.id));
  const adjacency = new Map<string, string[]>(nodes.map((node: any) => [node.id, []]));
  for (const subject of value.subjects) {
    if (typeof subject.name !== 'string' || typeof subject.shortName !== 'string' || !Array.isArray(subject.prerequisites)) throw new Error(`Materia inválida: ${subject.id}.`);
    if (subject.status !== undefined && !statuses.has(subject.status)) throw new Error(`Estado inválido: ${subject.id}.`);
    for (const prerequisite of subject.prerequisites) {
      if (!availabilities.has(prerequisite.availabilityId) || !Array.isArray(prerequisite.dependencies)) throw new Error(`Correlativa inválida: ${subject.id}.`);
      for (const dependency of prerequisite.dependencies) {
        if (!statuses.has(dependency.statusId) || !Array.isArray(dependency.subjects) || dependency.subjects.some((id: any) => !subjects.has(id))) throw new Error(`Dependencia inválida: ${subject.id}.`);
        adjacency.get(subject.id)!.push(...dependency.subjects);
      }
    }
  }
  for (const edge of value.edges) {
    if (!Array.isArray(edge.dependencies) || !Array.isArray(edge.targets) || [...edge.dependencies, ...edge.targets].some((id: any) => !ids.has(id))) throw new Error(`Conector inválido: ${edge.id}.`);
    adjacency.get(edge.id)!.push(...edge.dependencies);
    for (const target of edge.targets) adjacency.get(target)!.push(edge.id);
  }
  const visited = new Set<string>(), active = new Set<string>();
  function visit(id: string) {
    if (active.has(id)) throw new Error('El plan contiene dependencias circulares.');
    if (visited.has(id)) return;
    active.add(id);
    for (const dependency of adjacency.get(id)!) visit(dependency);
    active.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
}

