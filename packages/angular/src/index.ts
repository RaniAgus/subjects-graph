import { Component, ElementRef, NgZone, afterNextRender, effect, inject, input, model, output, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { SubjectsGraph, type Plan, type Progress, type Theme, type ProgressGaugeOptions, type PNGOptions, type EditRequest, type SubjectsGraphAPI, type SubjectsGraphEventMap } from '@raniagus/subjects-graph';

@Component({
  selector: 'subjects-graph', standalone: true, template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host { display: block; }'],
})
export class SubjectsGraphComponent {
  readonly plan = input.required<Plan>();
  readonly progress = model<Progress>({});
  readonly theme = input<Theme>({});
  readonly editable = input(false);
  readonly readOnly = input(false);
  readonly viewportLocked = input(false);
  readonly progressGauge = input<boolean | ProgressGaugeOptions>(false);
  readonly autoUpdateProgress = input(true);
  readonly statusRequest = output<SubjectsGraphEventMap['statusrequest']['detail']>();
  readonly nodePositionRequest = output<SubjectsGraphEventMap['nodepositionrequest']['detail']>();
  readonly editRequest = output<EditRequest>();
  readonly ready = output<void>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly instance = signal<SubjectsGraphAPI | undefined>(undefined);
  private previous?: { plan: Plan; progress: Progress; theme: Theme; editable: boolean; readOnly: boolean; viewportLocked: boolean; gauge: boolean | ProgressGaugeOptions };

  constructor() {
    const cleanup: (() => void)[] = [];
    const pending = afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        const state = this.state();
        const graph = new SubjectsGraph(this.host.nativeElement, { ...state, progressGauge: state.gauge });
        this.previous = state;
        const status = (event: SubjectsGraphEventMap['statusrequest']) => this.zone.run(() => {
          const detail = { ...event.detail };
          if (this.autoUpdateProgress()) {
            const progress = { ...graph.getProgress(), [detail.subjectId]: detail.nextStatusId };
            this.zone.runOutsideAngular(() => graph.setProgress(progress));
            this.previous = { ...this.previous!, progress };
            this.progress.set(progress);
          }
          this.statusRequest.emit(detail);
        });
        const position = (event: SubjectsGraphEventMap['nodepositionrequest']) => this.zone.run(() => this.nodePositionRequest.emit(structuredClone(event.detail)));
        const edit = (event: SubjectsGraphEventMap['editrequest']) => this.zone.run(() => this.editRequest.emit(structuredClone(event.detail)));
        graph.addEventListener('statusrequest', status);
        graph.addEventListener('nodepositionrequest', position);
        graph.addEventListener('editrequest', edit);
        cleanup.push(() => {
          graph.removeEventListener('statusrequest', status);
          graph.removeEventListener('nodepositionrequest', position);
          graph.removeEventListener('editrequest', edit);
          graph.destroy();
        });
        this.instance.set(graph);
      });
      this.zone.run(() => this.ready.emit());
    });
    effect(() => {
      const graph = this.instance();
      const state = this.state();
      const old = this.previous;
      if (!graph || !old) return;
      this.zone.runOutsideAngular(() => {
        if (state.plan !== old.plan) graph.setPlan(state.plan, { progress: state.progress });
        else if (state.progress !== old.progress) graph.setProgress(state.progress);
        if (state.theme !== old.theme) graph.setTheme(state.theme);
        if (state.readOnly !== old.readOnly) graph.setReadOnly(state.readOnly);
        if (state.viewportLocked !== old.viewportLocked) graph.setViewportLocked(state.viewportLocked);
        if (state.editable !== old.editable) graph.setEditable(state.editable);
        if (state.gauge !== old.gauge) graph.setProgressGauge(state.gauge);
      });
      this.previous = state;
    });
    inject(DestroyRef).onDestroy(() => {
      pending.destroy();
      this.zone.runOutsideAngular(() => cleanup.forEach(dispose => dispose()));
      this.instance.set(undefined);
    });
  }
  private state() { return { plan: this.plan(), progress: this.progress(), theme: this.theme(), editable: this.editable(), readOnly: this.readOnly(), viewportLocked: this.viewportLocked(), gauge: this.progressGauge() }; }
  private graph(): SubjectsGraphAPI {
    const graph = this.instance();
    if (!graph) throw new Error('SubjectsGraph is unavailable: wait for ready and do not use after destruction.');
    return graph;
  }
  fit(): void { this.zone.runOutsideAngular(() => this.graph().fit()); }
  getProgress(): Progress { return this.graph().getProgress(); }
  async exportPNG(options?: PNGOptions): Promise<Blob> { return this.zone.runOutsideAngular(() => this.graph().exportPNG(options)); }
}
