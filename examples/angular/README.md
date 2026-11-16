# Ejemplo Angular

Aplicación standalone de Angular 21, zoneless, que consume los paquetes
`@raniagus/subjects-graph` y `@raniagus/subjects-graph-angular` del workspace.
No necesita que estén publicados en npm y no importa fuentes privadas del renderer.

## Ejecutar

Usá Node 22.12+ en la línea 22, o Node 24, y pnpm según el `packageManager` de la raíz.
Desde la raíz del repositorio:

```bash
pnpm install --frozen-lockfile
pnpm build:lib
pnpm --filter @raniagus/subjects-graph-angular build
pnpm --filter subjects-graph-angular-example start
```

Abrí http://127.0.0.1:4200. El servidor del ejemplo usa Angular CLI;
`pnpm start` en la raíz sigue sirviendo únicamente la PWA de `public/`.
Si cambiás la biblioteca o el adaptador, repetí sus builds antes de reiniciar
el ejemplo; Angular CLI observa las fuentes de la app.

## Qué muestra

- `[(progress)]` con un writable signal y tabla de estados sincronizada.
- Modo manual con confirmación para aceptar o rechazar solicitudes.
- Tema por instancia e indicador de progreso opcional.
- Movimiento de nodos y edición del nombre de materias con doble clic.
- `ready`, `fit()` y descarga mediante `exportPNG()`.

La tabla cambia el input directamente, incluso en modo manual; la confirmación
se aplica a los clics del grafo. Si hay una solicitud pendiente, un nuevo clic la
reemplaza. Cambiar de modo, editar desde la tabla o reiniciar cancela esa solicitud.

El plan es el mismo subconjunto de tres materias K23 del ejemplo CDN mínimo,
conservando sus IDs, estados y correlativas. El progreso, nombres y posiciones
quedan en memoria hasta recargar. No hay persistencia ni service worker.

## Compilar

Después de compilar ambos paquetes:

```bash
pnpm --filter subjects-graph-angular-example build
python3 -m http.server 4200 -d examples/angular/dist/browser
```

El build de producción usa AOT, templates estrictos y el linker de Angular para
consumir la distribución compilada del adaptador. Su salida no forma parte del
paquete npm ni del despliegue de la PWA.

## Archivos e integración

- `src/app.ts` y `src/app.html`: estado, bindings y aceptación de solicitudes.
- `src/styles.css`: CSS global de la biblioteca y dimensiones del host.
- `src/plan.json`: datos del plan mínimo.
- `angular.json`: build y servidor de Angular CLI.

Para llevar el ejemplo a otra aplicación, instalá los dos paquetes cuando estén
publicados y reemplazá los `workspace:*` por versiones compatibles. Mantené el CSS
global y una altura explícita para `subjects-graph`.

Consultá la [referencia Angular](../../docs/angular-api.md) para todos los inputs,
outputs, métodos y contratos; la [API base](../../docs/library-api.md) describe el
formato de planes y progreso.
