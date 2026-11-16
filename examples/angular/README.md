# Ejemplos Angular

Aplicación standalone de Angular 21, zoneless, que replica los dos
[ejemplos CDN](../cdn/) usando `@raniagus/subjects-graph` y
`@raniagus/subjects-graph-angular` del workspace. No necesita publicaciones en npm.

## Ejecutar

Usá Node 22.12+ en la línea 22, o Node 24, y pnpm según el `packageManager` de la raíz.
Desde la raíz del repositorio:

```bash
pnpm install --frozen-lockfile
pnpm build:lib
pnpm --filter @raniagus/subjects-graph-angular build
pnpm --filter subjects-graph-angular-example start
```

Abrí http://127.0.0.1:4200. La ruta base enlaza las dos versiones:

- `/minimal/`: quickstart con el plan K23 de tres materias, el componente y
  `[(progress)]` para aceptar automáticamente los cambios de estado.
- `/complete/`: el mismo plan de ocho materias y diseño del CDN completo,
  tabla sincronizada, selección de plan y tema, aceptación opcional de clics,
  edición JSON, movimiento de nodos, PNG y destrucción/recreación de la instancia.

El ejemplo completo controla explícitamente el progreso con
`[autoUpdateProgress]="false"`: registra todas las solicitudes y acepta los clics
solo cuando la casilla está activada. La tabla sigue habilitada aunque se ignoren
los clics. El editor valida el JSON, sus referencias y ciclos antes de reemplazar
el plan y conserva los estados compatibles. Cambiar de plan reinicia el progreso
sin cambiar el viewport. `@if` crea y destruye el componente y sus listeners;
recrearlo conserva el plan, progreso, tema y modo de edición.

Los datos coinciden con los JSON de cada ejemplo CDN. Todos los cambios viven en
memoria; no hay persistencia ni service worker. Navegar a otra ruta destruye el
componente de la ruta anterior.

El servidor usa Angular CLI; `pnpm start` en la raíz sigue sirviendo únicamente
la PWA de `public/`. Si cambiás la biblioteca o el adaptador, repetí sus builds
antes de reiniciar el ejemplo; Angular CLI observa las fuentes de la app.

## Compilar

Después de compilar ambos paquetes:

```bash
pnpm --filter subjects-graph-angular-example build
```

El build usa AOT, templates estrictos y el linker de Angular. Para alojar el
resultado de `dist/browser`, configurá el servidor con fallback a `index.html`
para que también funcionen los accesos directos a `/minimal/` y `/complete/`.
La salida no forma parte del paquete npm ni del despliegue de la PWA.

## Archivos e integración

- `src/app.ts`, `src/main.ts` y `src/home.ts`: contenedor, rutas e índice.
- `src/minimal/`: componente mínimo y su plan.
- `src/complete/`: componente completo, template, estilos, plan y validación JSON.
- `src/styles.css`: CSS global de la biblioteca.

Para usarlo en otra app, instalá los dos paquetes y reemplazá `workspace:*` por
versiones compatibles. Mantené el CSS global y una altura para `subjects-graph`.
Consultá la [referencia Angular](../../docs/angular-api.md) y la
[API base](../../docs/library-api.md) para los contratos y el formato del plan.
