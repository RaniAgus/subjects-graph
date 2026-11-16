import { Component, computed, signal, viewChild } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SubjectsGraphComponent } from '@raniagus/subjects-graph-angular';
import type { EditRequest, Plan, Position, Progress, Theme } from '@raniagus/subjects-graph';
import initialPlan from './plan.json';
import { validatePlan } from './validate-plan';

const customTheme: Theme = {
  '--bg-primary': '#10141d', '--fill-color-1': '#334155',
  '--fill-color-2': '#3b82f6', '--fill-color-3': '#f59e0b',
  '--fill-color-4': '#22c55e', '--text-primary': '#f8fafc',
  '--accent-color': '#a78bfa', '--border-color-2': '#64748b',
  '--border-color-4': '#22c55e',
};

@Component({
  selector: 'app-complete', imports: [SubjectsGraphComponent, RouterLink, JsonPipe],
  templateUrl: './complete.html', styleUrl: './complete.css',
})
export class CompleteComponent {
  readonly graph = viewChild(SubjectsGraphComponent);
  downloadGraph(): void { const graph = this.graph(); if (graph) void this.download(graph); }

  readonly plan = signal<Plan>(structuredClone(initialPlan));
  readonly progress = signal<Progress>({});
  readonly theme = signal<Theme>(customTheme);
  readonly editable = signal(false);
  readonly accept = signal(true);
  readonly alive = signal(true);
  readonly ready = signal(false);
  readonly exporting = signal(false);
  readonly events = signal<object[]>([]);
  readonly message = signal('Cargando la biblioteca…');
  readonly editorOpen = signal(false);
  readonly editContext = signal('Editá materias, correlativas, conectores y posiciones. Aplicar reemplaza el plan y conserva el progreso de las materias existentes.');
  readonly planJSON = signal(JSON.stringify(this.plan(), null, 2));
  readonly approved = computed(() => Object.values(this.progress()).filter(status => status === 'APPROVED').length);

  record(type: string, detail: object): void {
    this.events.update(events => [{ type, ...detail }, ...events].slice(0, 10));
  }

  onReady(graph: SubjectsGraphComponent): void {
    this.progress.set(graph.getProgress());
    this.ready.set(true);
    this.message.set('Instancia lista. Probá cambiar un estado desde cualquiera de las dos vistas.');
  }

  requestStatus(request: { subjectId: string; nextStatusId: string }): void {
    this.record('statusrequest', request);
    if (!this.accept()) return;
    this.progress.update(progress => ({ ...progress, [request.subjectId]: request.nextStatusId }));
    this.message.set('Estado actualizado desde el grafo; la tabla muestra el mismo progreso.');
  }

  changeStatus(subjectId: string, statusId: string): void {
    this.progress.update(progress => ({ ...progress, [subjectId]: statusId }));
    this.message.set(`Estado de ${this.plan().subjects.find(subject => subject.id === subjectId)?.name} actualizado desde la tabla.`);
  }

  replacePlan(next: Plan, progress: Progress = this.progress()): void {
    const statuses = new Set(next.statuses.map(status => status.id));
    this.progress.set(Object.fromEntries(next.subjects.map(subject => [
      subject.id, statuses.has(progress[subject.id] ?? '') ? progress[subject.id]! : subject.status ?? next.statuses[0]!.id,
    ])));
    this.plan.set(next);
    this.planJSON.set(JSON.stringify(next, null, 2));
  }

  selectPlan(value: string): void {
    const next: Plan = structuredClone(initialPlan);
    if (value === 'base') {
      next.name = 'K23 · Primer año (reducido)';
      next.subjects = next.subjects.filter(subject => ['5', '6', '8'].includes(subject.id));
    }
    this.replacePlan(next, {});
    this.message.set('Plan reemplazado y progreso reiniciado; se conserva el viewport. Usá Ajustar vista para encuadrarlo.');
  }

  reset(): void { this.replacePlan(this.plan(), {}); }
  selectTheme(value: string): void { this.theme.set(value === 'custom' ? customTheme : {}); }
  toggleAccept(value: boolean): void {
    this.accept.set(value);
    this.message.set(value ? 'El grafo vuelve a aceptar cambios de estado.' : 'Los clics se registran, pero no cambian el progreso. La tabla sigue habilitada.');
  }

  moveNode(request: { nodeId: string; position: Position }): void {
    this.record('nodepositionrequest', request);
    const { nodeId, position } = request;
    this.replacePlan({
      ...this.plan(),
      subjects: this.plan().subjects.map(node => node.id === nodeId ? { ...node, position } : node),
      edges: this.plan().edges.map(node => node.id === nodeId ? { ...node, position } : node),
    });
    this.message.set('Posición guardada en el plan de la app.');
  }

  edit(request: EditRequest, textarea: HTMLTextAreaElement): void {
    this.record('editrequest', request);
    this.editorOpen.set(true);
    this.editContext.set(`Solicitud de edición: ${JSON.stringify(request)}. Modificá el plan y pulsá Aplicar plan.`);
    this.planJSON.set(JSON.stringify(this.plan(), null, 2));
    textarea.closest('details')?.setAttribute('open', '');
    textarea.focus();
  }

  applyPlan(event: Event): void {
    event.preventDefault();
    try {
      const next: unknown = JSON.parse(this.planJSON());
      validatePlan(next);
      this.replacePlan(next);
      this.message.set('Plan actualizado. La tabla y el grafo muestran las mismas materias.');
    } catch (error) {
      this.message.set(`No se aplicó el plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  destroy(): void {
    this.alive.set(false);
    this.ready.set(false);
    this.message.set('Instancia destruida y listeners liberados. Podés recrearla conservando el plan y el progreso.');
  }

  async download(graph: SubjectsGraphComponent): Promise<void> {
    this.exporting.set(true);
    try {
      const blob = await graph.exportPNG({ scale: 2, bg: '#10141d', full: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'k23.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.message.set('PNG exportado.');
    } catch (error) {
      this.message.set(`No se pudo exportar: ${error instanceof Error ? error.message : String(error)}`);
    } finally { this.exporting.set(false); }
  }
}
