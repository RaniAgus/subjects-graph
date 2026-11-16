import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home', imports: [RouterLink],
  template: `
    <h1>Subjects Graph · Ejemplos Angular</h1>
    <p>Ambos ejemplos consumen los paquetes Subjects Graph y su adaptador Angular del workspace.</p>
    <ul>
      <li><a routerLink="/minimal/">Quickstart mínimo</a>: componente Angular, plan JSON y cambios de estado.</li>
      <li><a routerLink="/complete/">Integración completa</a>: tabla sincronizada, temas, edición, PNG y ciclo de vida.</li>
    </ul>
  `,
})
export class HomeComponent {}
