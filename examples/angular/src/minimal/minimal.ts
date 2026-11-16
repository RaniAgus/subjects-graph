import { Component, signal } from '@angular/core';
import { SubjectsGraphComponent } from '@raniagus/subjects-graph-angular';
import type { Plan, Progress } from '@raniagus/subjects-graph';
import initialPlan from './plan.json';

@Component({
  selector: 'app-minimal', imports: [SubjectsGraphComponent],
  template: `
    <h1>K23 · Quickstart</h1>
    <p>Hacé clic en las materias para cambiar su estado.</p>
    <subjects-graph [plan]="plan" [(progress)]="progress" style="height: 70vh" />
  `,
})
export class MinimalComponent {
  readonly plan: Plan = structuredClone(initialPlan);
  readonly progress = signal<Progress>({});
}
