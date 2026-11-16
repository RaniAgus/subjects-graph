import { Component } from '@angular/core';
import { SubjectsGraphComponent } from '@raniagus/subjects-graph-angular';
import type { Plan, Progress, Theme, EditRequest, Position } from '@raniagus/subjects-graph';

@Component({
  standalone: true,
  imports: [SubjectsGraphComponent],
  template: `<subjects-graph #graph [plan]="plan" [(progress)]="progress"
    [theme]="theme" [editable]="true" [progressGauge]="{ labels: { primary: false } }"
    [autoUpdateProgress]="false" (ready)="graph.fit()"
    (statusRequest)="status($event)" (editRequest)="edit($event)"
    (nodePositionRequest)="position($event)" />`,
})
export class Consumer {
  plan: Plan = { name: 'test', statuses: [], availabilities: [], subjects: [], edges: [] };
  progress: Progress = {};
  theme: Theme = {};
  status(request: { subjectId: string; nextStatusId: string }): void {
    this.progress = { ...this.progress, [request.subjectId]: request.nextStatusId };
  }
  edit(_request: EditRequest): void {}
  position(_request: { nodeId: string; position: Position }): void {}
}
