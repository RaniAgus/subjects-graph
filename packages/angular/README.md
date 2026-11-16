# Subjects Graph Angular

Importá `SubjectsGraphComponent` desde `@raniagus/subjects-graph-angular` en los
`imports` de tu componente standalone. Instalá ambos paquetes junto a Angular 21:

```bash
npm install @raniagus/subjects-graph @raniagus/subjects-graph-angular
```

Es un paquete independiente de la librería base. Agregá `@raniagus/subjects-graph/styles.css` a los
estilos globales de tu aplicación y asigná altura al componente.

```html
<subjects-graph style="height: 600px"
  [plan]="plan" [(progress)]="progress" [theme]="theme"
  [editable]="false" [progressGauge]="true" />
```

`plan` es obligatorio. `progress` y `theme` comienzan en `{}`; `editable` y
`progressGauge` en `false`. El indicador también acepta `ProgressGaugeOptions`.
Reemplazá los objetos para actualizar inputs; no se observan mutaciones profundas.

Por defecto, los clics actualizan el progreso y emiten `progressChange` antes de
`statusRequest`. Para validar cada cambio desde tu aplicación:

```html
<subjects-graph style="height: 600px"
  [plan]="plan" [progress]="progress" [autoUpdateProgress]="false"
  (statusRequest)="acceptStatus($event)" />
```

`acceptStatus` recibe `{ subjectId, nextStatusId }`; aceptá la solicitud asignando
`progress = { ...progress, [subjectId]: nextStatusId }`. Los cambios de inputs no
emiten solicitudes ni `progressChange`. Al reemplazar el plan se usa el progreso
actual y se conserva el viewport.

`nodePositionRequest` y `editRequest` entregan el `detail` del evento base. Tu app
acepta esas solicitudes reemplazando el plan, también en modo automático.

Una referencia al componente permite llamar `fit()`, `getProgress()` y
`exportPNG(options?)`. Esperá al output `ready` antes de usarlos. Antes de estar
listo o después de destruirse, los métodos fallan; `exportPNG` rechaza su promesa.
Angular administra la destrucción. En SSR se genera un host vacío y el grafo se
inicializa después del render en el navegador.

## Desarrollo y publicación

Desde la raíz del repositorio:

```bash
pnpm install --frozen-lockfile
pnpm build:lib
pnpm --filter @raniagus/subjects-graph-angular build
pnpm --filter @raniagus/subjects-graph-angular test
```

La compilación genera ESM y declaraciones con compilación parcial Angular en
`packages/angular/dist/`. Las pruebas incluyen TestBed zoneless, SSR y un
consumidor AOT con templates estrictos.

Este paquete y el core se publican juntos mediante `publish.yml` con la misma
versión del tag `v<SemVer>`: estables en `latest`, prereleases en `next`.
Ambos paquetes deben autorizar ese workflow en npm Trusted Publishing/OIDC.
Después de publicar ambos, las versiones estables generan un commit sobre el
último `main`. Ver [el proceso de release](../../docs/releases.md).

El paquete declara Angular 21 y `@raniagus/subjects-graph` compatible con `0.3.0`
como peers requeridos. Angular y las herramientas de prueba viven únicamente en
este workspace. El paquete npm base no cambia sus dependencias ni sus exports.

## API

```ts
import { SubjectsGraphComponent } from '@raniagus/subjects-graph-angular';
import type { Plan, Progress, Theme } from '@raniagus/subjects-graph';
// @Component({ imports: [SubjectsGraphComponent], ... })
```

| Input / output | Tipo / valor inicial |
| --- | --- |
| `plan` | `Plan`, obligatorio |
| `progress` / `progressChange` | `Progress`, `{}`; admite `[(progress)]` |
| `autoUpdateProgress` | `boolean`, `true` |
| `theme` | `Theme`, `{}` |
| `editable` | `boolean`, `false` |
| `progressGauge` | `boolean \| ProgressGaugeOptions`, `false` |
| `statusRequest` | `{ subjectId: string, nextStatusId: string }` |
| `nodePositionRequest` | `{ nodeId: string, position: Position }` |
| `editRequest` | `EditRequest` |
| `ready` | Sin payload |

Los tipos del dominio se importan del paquete base. `getProgress(): Progress`
devuelve el progreso efectivo completo; `fit(): void` ajusta el viewport y
`exportPNG(options?: PNGOptions): Promise<Blob>` exporta la imagen. El componente
funciona con Zone.js y en aplicaciones zoneless.

La [referencia completa de la API Angular](https://github.com/RaniAgus/subjects-graph/blob/main/docs/angular-api.md)
y el [ejemplo ejecutable](https://github.com/RaniAgus/subjects-graph/tree/main/examples/angular)
detallan la integración y los contratos del componente.
