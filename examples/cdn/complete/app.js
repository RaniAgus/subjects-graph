import initialPlan from './plan.json' with { type: 'json' };

const $ = selector => document.querySelector(selector);
const theme = {
  '--bg-primary': '#10141d', '--fill-color-1': '#334155',
  '--fill-color-2': '#3b82f6', '--fill-color-3': '#f59e0b',
  '--fill-color-4': '#22c55e', '--text-primary': '#f8fafc',
  '--accent-color': '#a78bfa', '--border-color-2': '#64748b',
  '--border-color-4': '#22c55e'
};

// The host owns the plan and progress. Both views read this same state.
let plan = structuredClone(initialPlan);
let progress = {};
let graph;
let listeners;
let SubjectsGraph;
const events = [];
const statusSelectors = new Map();

function report(text) { $('#message').textContent = text; }
function record(type, detail) {
  events.unshift({ type, ...detail });
  events.splice(10);
  $('#events').textContent = JSON.stringify(events, null, 2);
}

function syncProgress() {
  progress = graph.getProgress();
  for (const [id, select] of statusSelectors) select.value = progress[id];
  const approved = Object.values(progress).filter(status => status === 'APPROVED').length;
  $('#count').textContent = `· ${approved}/${plan.subjects.length} aprobadas`;
  $('#progress').textContent = JSON.stringify(progress, null, 2);
}

function applyProgress(next) {
  graph.setProgress(next);
  syncProgress();
}

function renderTable() {
  statusSelectors.clear();
  $('#subjects').replaceChildren();
  for (const subject of plan.subjects) {
    const row = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = subject.name;
    const cell = document.createElement('td');
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Estado de ${subject.name}`);
    select.dataset.subjectId = subject.id;
    for (const status of plan.statuses) select.add(new Option(status.name, status.id));
    select.addEventListener('change', () => {
      applyProgress({ ...progress, [subject.id]: select.value });
      report(`Estado de ${subject.name} actualizado desde la tabla.`);
    });
    statusSelectors.set(subject.id, select);
    cell.append(select);
    row.append(name, cell);
    $('#subjects').append(row);
  }
  syncProgress();
}

function replacePlan(next, nextProgress = progress) {
  graph.setPlan(next, { progress: nextProgress });
  plan = structuredClone(next);
  renderTable();
  $('#plan-json').value = JSON.stringify(plan, null, 2);
}

function acceptStatus(event) {
  const { subjectId, nextStatusId } = event.detail;
  applyProgress({ ...progress, [subjectId]: nextStatusId });
  report('Estado actualizado desde el grafo; la tabla muestra el mismo progreso.');
}

function createGraph() {
  graph = new SubjectsGraph($('#graph'), {
    plan, progress,
    theme: $('#theme').value === 'custom' ? theme : {},
    editable: $('#editable').checked,
    readOnly: $('#read-only').checked
  });
  listeners = new AbortController();
  const options = { signal: listeners.signal };
  // Logging is separate from acceptance: ignored requests remain visible.
  for (const type of ['statusrequest', 'nodepositionrequest', 'editrequest']) {
    graph.addEventListener(type, event => record(type, event.detail), options);
  }
  if ($('#accept').checked) graph.addEventListener('statusrequest', acceptStatus, options);
  graph.addEventListener('nodepositionrequest', ({ detail: { nodeId, position } }) => {
    replacePlan({
      ...plan,
      subjects: plan.subjects.map(node => node.id === nodeId ? { ...node, position } : node),
      edges: plan.edges.map(node => node.id === nodeId ? { ...node, position } : node)
    });
    report('Posición guardada en el plan de la app.');
  }, options);
  graph.addEventListener('editrequest', ({ detail }) => {
    $('#editor').open = true;
    $('#edit-context').textContent = `Solicitud de edición: ${JSON.stringify(detail)}. Modificá el plan y pulsá Aplicar plan.`;
    $('#plan-json').value = JSON.stringify(plan, null, 2);
    $('#plan-json').focus();
  }, options);
  $('#controls').disabled = false;
  $('#read-only').disabled = typeof graph.setReadOnly !== 'function';
  $('#create').disabled = true;
  $('#apply-plan').disabled = false;
  $('#plan-json').value = JSON.stringify(plan, null, 2);
  renderTable();
  report('Instancia lista. Probá cambiar un estado desde cualquiera de las dos vistas.');
}

// Validate the editable JSON before passing it to the library.
function validatePlan(value) {
  if (!value || typeof value.name !== 'string') throw new Error('El plan necesita un nombre.');
  for (const key of ['statuses', 'availabilities', 'subjects', 'edges']) {
    if (!Array.isArray(value[key])) throw new Error(`${key} debe ser un array.`);
  }
  for (const key of ['statuses', 'availabilities']) {
    if (!value[key].length) throw new Error(`${key} no puede estar vacío.`);
    const ids = new Set();
    for (const entry of value[key]) {
      if (typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)) throw new Error(`ID inválido o repetido en ${key}.`);
      ids.add(entry.id);
      if (typeof entry.name !== 'string' || typeof entry.color !== 'string') throw new Error(`Falta nombre o color en ${key}.`);
      if (key === 'statuses' && typeof entry.textColor !== 'string') throw new Error('Cada estado necesita textColor.');
    }
  }
  const nodes = [...value.subjects, ...value.edges];
  const ids = new Set();
  for (const node of nodes) {
    if (typeof node.id !== 'string' || !node.id || ids.has(node.id)) throw new Error('Los nodos necesitan IDs únicos.');
    ids.add(node.id);
    if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) throw new Error(`Posición inválida: ${node.id}.`);
  }
  const subjects = new Set(value.subjects.map(subject => subject.id));
  const statuses = new Set(value.statuses.map(status => status.id));
  const availabilities = new Set(value.availabilities.map(item => item.id));
  const adjacency = new Map(nodes.map(node => [node.id, []]));
  for (const subject of value.subjects) {
    if (typeof subject.name !== 'string' || typeof subject.shortName !== 'string' || !Array.isArray(subject.prerequisites)) throw new Error(`Materia inválida: ${subject.id}.`);
    if (subject.status !== undefined && !statuses.has(subject.status)) throw new Error(`Estado inválido: ${subject.id}.`);
    for (const prerequisite of subject.prerequisites) {
      if (!availabilities.has(prerequisite.availabilityId) || !Array.isArray(prerequisite.dependencies)) throw new Error(`Correlativa inválida: ${subject.id}.`);
      for (const dependency of prerequisite.dependencies) {
        if (!statuses.has(dependency.statusId) || !Array.isArray(dependency.subjects) || dependency.subjects.some(id => !subjects.has(id))) throw new Error(`Dependencia inválida: ${subject.id}.`);
        adjacency.get(subject.id).push(...dependency.subjects);
      }
    }
  }
  for (const edge of value.edges) {
    if (!Array.isArray(edge.dependencies) || !Array.isArray(edge.targets) || [...edge.dependencies, ...edge.targets].some(id => !ids.has(id))) throw new Error(`Conector inválido: ${edge.id}.`);
    adjacency.get(edge.id).push(...edge.dependencies);
    for (const target of edge.targets) adjacency.get(target).push(edge.id);
  }
  const visited = new Set(), active = new Set();
  function visit(id) {
    if (active.has(id)) throw new Error('El plan contiene dependencias circulares.');
    if (visited.has(id)) return;
    active.add(id);
    for (const dependency of adjacency.get(id)) visit(dependency);
    active.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
}

$('#fit').addEventListener('click', () => graph.fit());
$('#reset').addEventListener('click', () => applyProgress({}));
$('#theme').addEventListener('change', event => graph.setTheme(event.target.value === 'custom' ? theme : {}));
$('#editable').addEventListener('change', event => graph.setEditable(event.target.checked));
$('#read-only').addEventListener('change', event => graph.setReadOnly(event.target.checked));
$('#accept').addEventListener('change', event => {
  if (event.target.checked) graph.addEventListener('statusrequest', acceptStatus, { signal: listeners.signal });
  else graph.removeEventListener('statusrequest', acceptStatus);
  report(event.target.checked ? 'El grafo vuelve a aceptar cambios de estado.' : 'Los clics se registran, pero no cambian el progreso. La tabla sigue habilitada.');
});
$('#plan').addEventListener('change', event => {
  const next = structuredClone(initialPlan);
  if (event.target.value === 'base') {
    next.name = 'K23 · Primer año (reducido)';
    next.subjects = next.subjects.filter(subject => ['5', '6', '8'].includes(subject.id));
  }
  replacePlan(next, {});
  report('Plan reemplazado y progreso reiniciado; se conserva el viewport. Usá Ajustar vista para encuadrarlo.');
});
$('#plan-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const next = JSON.parse($('#plan-json').value);
    validatePlan(next);
    const statusIds = new Set(next.statuses.map(status => status.id));
    const retained = Object.fromEntries(next.subjects.filter(subject => statusIds.has(progress[subject.id])).map(subject => [subject.id, progress[subject.id]]));
    replacePlan(next, retained);
    report('Plan actualizado. La tabla y el grafo muestran las mismas materias.');
  } catch (error) { report(`No se aplicó el plan: ${error.message}`); }
});
$('#png').addEventListener('click', async () => {
  $('#png').disabled = true;
  try {
    const blob = await graph.exportPNG({ scale: 2, bg: '#10141d', full: true });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'k23.png';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    report('PNG exportado.');
  } catch (error) { report(`No se pudo exportar: ${error.message}`); }
  finally { $('#png').disabled = !graph; }
});
$('#destroy').addEventListener('click', () => {
  progress = graph.getProgress();
  listeners.abort();
  graph.destroy();
  graph = undefined;
  $('#controls').disabled = true;
  $('#apply-plan').disabled = true;
  $('#create').disabled = false;
  for (const select of statusSelectors.values()) select.disabled = true;
  report('Instancia destruida y listeners liberados. Podés recrearla conservando el plan y el progreso.');
});
$('#create').addEventListener('click', createGraph);

try {
  ({ SubjectsGraph } = await import('@raniagus/subjects-graph'));
  createGraph();
} catch (error) {
  report('No se pudo cargar la biblioteca. Verificá la conexión y la disponibilidad de 0.4.0 en npm.');
  console.error(error);
}
