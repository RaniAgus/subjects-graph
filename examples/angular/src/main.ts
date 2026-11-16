import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, type Routes } from '@angular/router';
import { AppComponent } from './app';
import { HomeComponent } from './home';

const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent, title: 'Ejemplos Angular · Subjects Graph' },
  { path: 'minimal', loadComponent: () => import('./minimal/minimal').then(m => m.MinimalComponent), title: 'Subjects Graph · Quickstart Angular' },
  { path: 'complete', loadComponent: () => import('./complete/complete').then(m => m.CompleteComponent), title: 'Subjects Graph · Integración completa' },
  { path: '**', redirectTo: '' },
];

bootstrapApplication(AppComponent, { providers: [provideRouter(routes)] }).catch(error => console.error(error));
