# Referencia del adaptador Angular

`@raniagus/subjects-graph-angular` es un paquete independiente que exporta
`SubjectsGraphComponent`, un componente standalone con selector `subjects-graph`.
Requiere Angular 21 y la biblioteca base como peers. Tiene versión y publicación
propias; no agrega Angular a `@raniagus/subjects-graph`.

La [referencia de la biblioteca](library-api.md#plan-y-progreso) describe los tipos
compartidos `Plan`, `Progress`, `Theme`, `Position`, `EditRequest`,
`ProgressGaugeOptions` y `PNGOptions`. Se importan desde
`@raniagus/subjects-graph`; el adaptador no redefine el modelo del grafo.

Para probar una aplicación completa, seguí el [ejemplo Angular](../examples/angular/README.md).

## Instalación e integración

En una aplicación Angular 21, instalá ambos paquetes cuando estén publicados:

```bash
npm install @raniagus/subjects-graph @raniagus/subjects-graph-angular
```

El [ejemplo local](../examples/angular/README.md) usa los paquetes del workspace
y no requiere publicarlos. El rango de compatibilidad del peer de la biblioteca
base se declara en el [package.json del adaptador](../packages/angular/package.json).

Importá el componente en `imports` y proporcioná un plan:

```ts
import { Component, signal } from '@angular/core';
import { SubjectsGraphComponent } from '@raniagus/subjects-graph-angular';
import type { Plan, Progress } from '@raniagus/subjects-graph';

@Component({
  selector: 'app-curriculum',
  standalone: true,
  imports: [SubjectsGraphComponent],
  template: `
    <subjects-graph
      style="height: 600px"
      [plan]="plan()"
      [(progress)]="progress"
    />
  `,
})
export class CurriculumComponent {
  readonly plan = signal<Plan>({
    name: 'Plan mínimo',
    statuses: [
      { id: 'PENDING', name: 'Pendiente', color: '--fill-color-1', textColor: '--text-primary' },
      { id: 'APPROVED', name: 'Aprobada', color: '--fill-color-4', textColor: '--bg-primary' },
    ],
    availabilities: [],
    subjects: [
      { id: '1', name: 'Álgebra', shortName: 'A', position: { x: 0, y: 0 }, prerequisites: [] },
    ],
    edges: [],
  });
  readonly progress = signal<Progress>({});
}
```

Cargá el CSS de la biblioteca **globalmente**, por ejemplo en `src/styles.css`:

```css
@import '@raniagus/subjects-graph/styles.css';
```

El host tiene `display: block`, pero no asigna altura. La aplicación debe darle
ancho y alto disponibles. Los estilos globales alcanzan los elementos internos
creados por la biblioteca; cargarlos como estilos encapsulados de otro componente
no reemplaza esa integración.

## Inputs y modelo de progreso

| Binding | Tipo | Valor inicial |
| --- | --- | --- |
| `[plan]` | `Plan` | Obligatorio. |
| `[progress]` / `[(progress)]` | `Progress` | `{}`. |
| `[autoUpdateProgress]` | `boolean` | `true`. |
| `[theme]` | `Theme` | `{}`; paleta Default Dark. |
| `[readOnly]` | `boolean` | `false`. |
| `[viewportLocked]` | `boolean` | `false`. |
| `[editable]` | `boolean` | `false`. |
| `[progressGauge]` | `boolean \| ProgressGaugeOptions` | `false`. |

`progress` es un model signal y genera el output `progressChange`. En una app
consumidora puede enlazarse con un writable signal, como arriba, o una propiedad
`progress: Progress = {}` usando el mismo `[(progress)]="progress"`.

`readOnly` bloquea los cambios por clic y la edición, y tiene prioridad sobre
`editable`. `viewportLocked` bloquea el zoom y el arrastre del fondo. `fit()`
sigue disponible con ambos gestos deshabilitados.

Los inputs de objetos se actualizan por referencia. Reemplazá el objeto o usá
`signal.set` / `signal.update`; modificar una propiedad anidada no sincroniza el
grafo. No hay setters públicos de plan, progreso o tema en el componente.

### Actualización automática

Con `autoUpdateProgress: true`, cada clic o tap en una materia:

1. Obtiene el progreso efectivo completo de la instancia.
2. Reemplaza el estado de la materia por `nextStatusId` y lo aplica al grafo.
3. Actualiza el model y emite `progressChange` con el nuevo mapa.
4. Emite `statusRequest` como notificación del cambio ya aceptado.

`[(progress)]` mantiene actualizado el estado de la aplicación. También podés
escribir el binding explícito:

```html
<subjects-graph
  [plan]="plan()"
  [progress]="progress()"
  (progressChange)="progress.set($event)"
/>
```

El clic funciona con `editable: false` mientras `readOnly` sea `false`. El siguiente estado se calcula según el
orden de `plan.statuses`, volviendo al primero después del último. El avance no
se bloquea automáticamente por correlativas pendientes.

### Aceptación manual

Con `[autoUpdateProgress]="false"`, el clic emite únicamente `statusRequest`:
no cambia el grafo, el model ni emite `progressChange`. La app acepta la solicitud
reemplazando el progreso, o la ignora para mantener el estado anterior.

```html
<subjects-graph
  [plan]="plan()"
  [progress]="progress()"
  [autoUpdateProgress]="false"
  (statusRequest)="acceptStatus($event)"
/>
```

```ts
acceptStatus({ subjectId, nextStatusId }: { subjectId: string; nextStatusId: string }): void {
  this.progress.update(progress => ({ ...progress, [subjectId]: nextStatusId }));
}
```

Podés validar, pedir confirmación o esperar un servidor antes de aplicar el input.
El ejemplo Angular incluye una confirmación con botones para aceptar o rechazar.
En modo automático, el valor de retorno del handler `statusRequest` no revierte
el cambio; usá el modo manual si necesitás decidir antes de aceptarlo.

### Reemplazo y valores iniciales

Actualizar `progress` desde la app reemplaza el mapa completo. Las materias
omitidas usan `subject.status` o el primer estado del catálogo; `{}` restaura esos
valores iniciales. `getProgress()` devuelve una copia con todas las materias.
El model puede seguir siendo un mapa parcial hasta una interacción automática.

Actualizar `plan` conserva la instancia, pan y zoom, y aplica el progreso actual.
Si plan y progreso cambian juntos en una actualización de Angular, se aplican
juntos. Para comenzar otro plan sin conservar avance, reemplazá también el
progreso por `{}`. Para encuadrarlo, llamá a `fit()` después de que Angular haya
sincronizado el input, por ejemplo desde un callback `afterNextRender`.

Los cambios de inputs, la inicialización y el reemplazo de plan no emiten
`progressChange` ni solicitudes. Podés alternar `autoUpdateProgress` en ejecución.

## Tema, edición e indicador

`theme` reemplaza las personalizaciones sobre Default Dark. Un objeto vacío
restaura esa paleta y los tokens omitidos usan sus valores por defecto:

```ts
readonly theme = signal<Theme>({
  '--fill-color-4': '#24b47e',
  '--font-family': 'Georgia, serif',
});
```

```html
<subjects-graph [plan]="plan()" [theme]="theme()" />
```

Los temas se aplican por instancia. La app debe cargar cualquier fuente web antes
de crear el grafo o aplicar el tema. Los colores del plan aceptan tokens CSS y
colores literales, igual que en la biblioteca base.

`editable` habilita arrastre y solicitudes de edición por doble clic. No abre un
editor automáticamente ni aplica cambios al plan.

`progressGauge` acepta `true`, `false` o una configuración:

```html
<subjects-graph
  [plan]="plan()"
  [(progress)]="progress"
  [progressGauge]="{
    position: { vertical: 'top', horizontal: 'right' },
    offset: { x: 24, y: 24 },
    labels: { primary: 'APPROVED', secondary: false }
  }"
/>
```

La posición predeterminada proviene de `plan.progress.position` o de abajo a la
derecha; el offset inicial es `{ x: 30, y: 30 }`. Las etiquetas usan IDs de estados;
`false` permite ocultarlas. El indicador se actualiza con el plan, progreso y tema,
y se incluye en la exportación PNG. Cada configuración reemplaza la anterior.

## Outputs

Los nombres son sensibles a mayúsculas. Los outputs entregan directamente los
datos, **sin `CustomEvent` ni `.detail`**, y no son eventos DOM que hagan bubbling.

| Output | Payload | Cuándo se emite |
| --- | --- | --- |
| `progressChange` | `Progress` | Cambio de progreso aceptado automáticamente. |
| `statusRequest` | `{ subjectId: string, nextStatusId: string }` | Clic/tap en materia, en ambos modos. |
| `nodePositionRequest` | `{ nodeId: string, position: Position }` | Se suelta un nodo con edición habilitada. |
| `editRequest` | `EditRequest` | Solicitud de edición con edición habilitada. |
| `ready` | `void` | Una vez, cuando la instancia del navegador está disponible. |

### Movimiento de nodos

`nodeId` puede identificar una materia o un conector. `position` contiene `x` e
`y` en coordenadas del grafo, independientes del zoom y pan. Para aceptar el
movimiento, reemplazá las posiciones en el plan:

```ts
moveNode({ nodeId, position }: { nodeId: string; position: Position }): void {
  this.plan.update(plan => ({
    ...plan,
    subjects: plan.subjects.map(node => node.id === nodeId ? { ...node, position } : node),
    edges: plan.edges.map(node => node.id === nodeId ? { ...node, position } : node),
  }));
}
```

```html
<subjects-graph [plan]="plan()" [(progress)]="progress"
  [editable]="true" (nodePositionRequest)="moveNode($event)" />
```

Ignorar la solicitud restaura la posición del plan vigente. Angular sincroniza el
nuevo plan durante su actualización reactiva; el nodo puede volver brevemente a
su posición anterior antes de aplicar la nueva. Si esperás una operación asíncrona,
la nueva posición recién se aplica cuando actualizás el input.

### Solicitudes de edición

`editRequest` es una unión discriminada por `kind`:

| `kind` | Campos adicionales | Elemento |
| --- | --- | --- |
| `subject` | `nodeId` | Materia. |
| `connector` | `nodeId` | Nodo conector. |
| `connection` | `sourceId`, `targetId`, `position` | Flecha. |
| `background` | `position` | Fondo del grafo. |
| `progress` | Ninguno. | Indicador de progreso. |

La app abre su formulario, actualiza el plan al guardar y mantiene IDs y
correlativas consistentes. `autoUpdateProgress` no acepta ni modifica solicitudes
de edición o movimiento: sólo controla los cambios de estado de materias.

## Métodos y ciclo de vida

Una referencia de template permite acceder al componente:

```html
<button type="button" [disabled]="!graphReady()" (click)="graph.fit()">Encuadrar</button>
<button type="button" [disabled]="!graphReady()" (click)="download(graph)">Descargar PNG</button>
<subjects-graph #graph style="height: 600px" [plan]="plan()" (ready)="graphReady.set(true)" />
```

La app define `graphReady = signal(false)` y su handler `download`. El
[ejemplo ejecutable](../examples/angular/src/app.ts) muestra cómo descargar el Blob
y liberar el object URL.

| Método | Retorno | Comportamiento |
| --- | --- | --- |
| `fit()` | `void` | Encuadra el grafo. |
| `getProgress()` | `Progress` | Copia del progreso efectivo completo. |
| `exportPNG(options?)` | `Promise<Blob>` | Imagen PNG del grafo con su indicador, si está activo. |

`exportPNG` acepta `PNGOptions`: `scale` (inicialmente `4`), `bg` (`'transparent'`)
y `full` (`true`; `false` captura sólo el viewport). No inicia una descarga.

Esperá `ready` antes de llamar a los métodos. Antes de inicializar o después de
destruir el componente, `fit` y `getProgress` lanzan un error; `exportPNG` rechaza
su promesa. Los métodos no esperan la sincronización de inputs pendientes.

Angular crea la instancia después del render del navegador y libera listeners,
observadores y renderer al destruir el componente. No se expone `destroy()` ni la
instancia privada. Si se destruye antes de inicializar, no se crea el grafo.

El componente funciona con Zone.js y zoneless. El renderer se ejecuta fuera de
`NgZone`, mientras que las actualizaciones de progreso y outputs entran a Angular.
En SSR se genera un host vacío: no se crea el renderer ni se emite `ready` en el
servidor. El grafo se inicializa en el navegador.

## Responsabilidades de la aplicación

La aplicación posee el plan y el progreso, acepta las solicitudes manuales y de
edición, y decide cómo validar, persistir o descargar datos. El adaptador no usa
LocalStorage, no registra service workers ni incluye formularios o selectores.
El [ejemplo Angular](../examples/angular/README.md) muestra una tabla sincronizada,
ambos modos de progreso, edición de nombres y posiciones, temas y exportación PNG.
