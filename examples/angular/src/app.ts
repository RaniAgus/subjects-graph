import { Component, signal } from '@angular/core';
import { SubjectsGraphComponent } from '@raniagus/subjects-graph-angular';
import type { EditRequest, Plan, Position, Progress, Theme } from '@raniagus/subjects-graph';
import initialPlan from './plan.json';

type StatusRequest = { subjectId: string; nextStatusId: string };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SubjectsGraphComponent],
  templateUrl: './app.html',
})
export class AppComponent {
  readonly plan = signal<Plan>(structuredClone(initialPlan));
  readonly progress = signal<Progress>({});
  readonly theme = signal<Theme>({});
  readonly automatic = signal(true);
  readonly editable = signal(false);
  readonly gauge = signal(true);
  readonly ready = signal(false);
  readonly exporting = signal(false);
  readonly pending = signal<StatusRequest | null>(null);
  readonly message = signal('Hacé clic en una materia para cambiar su estado.');

  requestStatus(request: StatusRequest): void {
    if (!this.automatic()) this.pending.set(request);
    else this.message.set(`Estado actualizado: ${this.subjectName(request.subjectId)}.`);
  }

  acceptStatus(): void {
    const request = this.pending();
    if (!request) return;
    this.progress.update(progress => ({ ...progress, [request.subjectId]: request.nextStatusId }));
    this.pending.set(null);
    this.message.set('Cambio aceptado.');
  }

  toggleMode(): void {
    this.automatic.update(value => !value);
    this.pending.set(null);
  }

  changeStatus(subjectId: string, statusId: string): void {
    this.progress.update(progress => ({ ...progress, [subjectId]: statusId }));
    this.pending.set(null);
  }

  reset(): void {
    this.progress.set({});
    this.pending.set(null);
    this.message.set('Progreso reiniciado.');
  }

  toggleTheme(): void {
    this.theme.update((theme): Theme => Object.keys(theme).length ? {} : {
      '--bg-primary': '#182b35', '--bg-secondary': '#203c48',
      '--fill-color-4': '#62dbb3', '--accent-color': '#8bd6ff',
    });
  }

  moveNode({ nodeId, position }: { nodeId: string; position: Position }): void {
    this.plan.update(plan => ({
      ...plan,
      subjects: plan.subjects.map(node => node.id === nodeId ? { ...node, position } : node),
      edges: plan.edges.map(node => node.id === nodeId ? { ...node, position } : node),
    }));
  }

  edit(request: EditRequest): void {
    if (request.kind !== 'subject') {
      this.message.set(`Solicitud de edición: ${request.kind}. Este ejemplo permite renombrar materias.`);
      return;
    }
    const name = window.prompt('Nombre de la materia', this.subjectName(request.nodeId));
    if (!name?.trim()) return;
    this.plan.update(plan => ({
      ...plan,
      subjects: plan.subjects.map(subject => subject.id === request.nodeId ? { ...subject, name: name.trim() } : subject),
    }));
  }

  subjectName(id: string): string {
    return this.plan().subjects.find(subject => subject.id === id)?.name ?? id;
  }

  statusName(id: string): string {
    return this.plan().statuses.find(status => status.id === id)?.name ?? id;
  }

  async download(graph: SubjectsGraphComponent): Promise<void> {
    this.exporting.set(true);
    try {
      const blob = await graph.exportPNG();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'subjects-graph.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.message.set('Imagen exportada.');
    } catch (error) {
      this.message.set(`No se pudo exportar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.exporting.set(false);
    }
  }
}
