import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { SubjectsGraphComponent } from '../dist/index.js';

const { instances } = vi.hoisted(() => ({ instances: [] }));
vi.mock('@raniagus/subjects-graph', () => ({ SubjectsGraph: class {
  listeners = new Map();
  setPlan = vi.fn((plan, options) => { this.progress = { ...options.progress }; });
  setProgress = vi.fn(progress => { this.progress = { ...progress }; });
  setTheme = vi.fn(); setEditable = vi.fn(); setProgressGauge = vi.fn();
  fit = vi.fn(); exportPNG = vi.fn(async () => new Blob(['png'])); destroy = vi.fn();
  constructor(container, options) { this.container = container; this.options = options; this.progress = { ...options.progress }; instances.push(this); }
  getProgress() { return { a: 'initial', ...this.progress }; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  emit(type, detail) { this.listeners.get(type)?.({ detail }); }
} }));

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
const plan = { name: 'test', statuses: [], availabilities: [], subjects: [], edges: [] };
afterEach(() => { TestBed.resetTestingModule(); instances.length = 0; });
async function mount(inputs = {}) {
  const fixture = TestBed.createComponent(SubjectsGraphComponent);
  fixture.componentRef.setInput('plan', plan);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, component: fixture.componentInstance, graph: instances.at(-1) };
}

describe('Angular adapter', () => {
  it('creates once, synchronizes inputs without feedback, and tears down', async () => {
    const { fixture, component, graph } = await mount();
    const changed = vi.fn(); component.progress.subscribe(changed);
    const nextPlan = { ...plan, name: 'replacement' }; const progress = { a: 'approved' };
    fixture.componentRef.setInput('plan', nextPlan);
    fixture.componentRef.setInput('progress', progress);
    fixture.componentRef.setInput('theme', { '--bg-primary': 'red' });
    fixture.componentRef.setInput('editable', true);
    fixture.componentRef.setInput('progressGauge', true);
    fixture.detectChanges(); await fixture.whenStable();
    expect(graph.setPlan).toHaveBeenCalledExactlyOnceWith(nextPlan, { progress });
    expect(graph.setTheme).toHaveBeenCalledWith({ '--bg-primary': 'red' });
    expect(graph.setEditable).toHaveBeenCalledWith(true);
    expect(graph.setProgressGauge).toHaveBeenCalledWith(true);
    expect(changed).not.toHaveBeenCalled(); expect(instances).toHaveLength(1);
    component.fit(); expect(graph.fit).toHaveBeenCalledOnce();
    expect(await component.exportPNG()).toBeInstanceOf(Blob);
    fixture.destroy(); expect(graph.destroy).toHaveBeenCalledOnce(); expect(graph.listeners.size).toBe(0);
    expect(() => component.getProgress()).toThrow('unavailable');
    await expect(component.exportPNG()).rejects.toThrow('unavailable');
  });
  it('updates bidirectional state before notifying requests, including successive clicks', async () => {
    const { fixture, component, graph } = await mount();
    const events = [];
    component.progress.subscribe(value => events.push(['progress', value]));
    component.statusRequest.subscribe(value => events.push(['request', value]));
    graph.emit('statusrequest', { subjectId: 'b', nextStatusId: 'passed' });
    graph.emit('statusrequest', { subjectId: 'a', nextStatusId: 'passed' });
    expect(component.progress()).toEqual({ a: 'passed', b: 'passed' });
    expect(events.map(([type]) => type)).toEqual(['progress', 'request', 'progress', 'request']);
    fixture.detectChanges(); await fixture.whenStable();
    expect(graph.setProgress).toHaveBeenCalledTimes(2);
  });
  it('supports manual acceptance and switching back to automatic updates', async () => {
    const { fixture, component, graph } = await mount({ autoUpdateProgress: false });
    const changed = vi.fn(); const requested = vi.fn();
    component.progress.subscribe(changed); component.statusRequest.subscribe(requested);
    graph.emit('statusrequest', { subjectId: 'a', nextStatusId: 'passed' });
    expect(requested).toHaveBeenCalledWith({ subjectId: 'a', nextStatusId: 'passed' });
    expect(changed).not.toHaveBeenCalled(); expect(graph.setProgress).not.toHaveBeenCalled();
    fixture.componentRef.setInput('progress', { a: 'passed' });
    fixture.componentRef.setInput('autoUpdateProgress', true);
    fixture.detectChanges(); await fixture.whenStable();
    expect(graph.setProgress).toHaveBeenCalledWith({ a: 'passed' });
    graph.emit('statusrequest', { subjectId: 'a', nextStatusId: 'initial' });
    expect(changed).toHaveBeenCalledOnce();
  });
  it('forwards editing payloads without accepting them', async () => {
    const { component, graph } = await mount();
    const edit = vi.fn(); const position = vi.fn();
    component.editRequest.subscribe(edit); component.nodePositionRequest.subscribe(position);
    graph.emit('editrequest', { kind: 'subject', nodeId: 'a' });
    graph.emit('nodepositionrequest', { nodeId: 'a', position: { x: 1, y: 2 } });
    expect(edit).toHaveBeenCalledWith({ kind: 'subject', nodeId: 'a' });
    expect(position).toHaveBeenCalledWith({ nodeId: 'a', position: { x: 1, y: 2 } });
    expect(graph.setPlan).not.toHaveBeenCalled();
  });
  it('does not initialize when destroyed before rendering', () => {
    const fixture = TestBed.createComponent(SubjectsGraphComponent);
    expect(() => fixture.componentInstance.fit()).toThrow('unavailable');
    fixture.destroy(); expect(instances).toHaveLength(0);
  });
  it('binds progress into a consuming component without Zone.js', async () => {
    class Host { plan = plan; progress = {}; }
    Component({ standalone: true, imports: [SubjectsGraphComponent], template: '<subjects-graph [plan]="plan" [(progress)]="progress" />' })(Host);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges(); await fixture.whenStable();
    instances.at(-1).emit('statusrequest', { subjectId: 'a', nextStatusId: 'passed' });
    await fixture.whenStable();
    expect(fixture.componentInstance.progress).toEqual({ a: 'passed' });
  });
});
