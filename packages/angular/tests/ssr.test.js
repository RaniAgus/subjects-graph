// @vitest-environment node
import '@angular/compiler';
import { expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { SubjectsGraphComponent } from '../dist/index.js';
const { construct } = vi.hoisted(() => ({ construct: vi.fn() }));
vi.mock('@raniagus/subjects-graph', () => ({ SubjectsGraph: class { constructor() { construct(); throw new Error('Renderer must not run on server'); } } }));
it('renders on the server without constructing the browser graph', async () => {
  class Host { plan = { name: 'test', statuses: [], availabilities: [], subjects: [], edges: [] }; }
  Component({ selector: 'app-root', standalone: true, imports: [SubjectsGraphComponent], template: '<subjects-graph [plan]="plan" />' })(Host);
  const html = await renderApplication(context => bootstrapApplication(Host, {}, context), { document: '<app-root></app-root>', url: 'http://localhost/', allowedHosts: ['localhost'] });
  expect(html).toContain('<subjects-graph');
  expect(construct).not.toHaveBeenCalled();
});
