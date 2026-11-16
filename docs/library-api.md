# Referencia de la biblioteca

Para una primera integración, seguí la guía [Usar la biblioteca](../README.md#usar-la-biblioteca).
Esta referencia detalla el plan, los métodos y los eventos de `SubjectsGraph`.
El paquete incluye declaraciones TypeScript generadas a partir de JSDoc.

La entrada `@raniagus/subjects-graph` exporta `SubjectsGraph`. Si sólo necesitás
la lógica del grafo, `@raniagus/subjects-graph/core` exporta `Graph`, `SubjectNode`
y `EdgeNode`, sin depender del DOM. El CSS de la vista se carga por separado.

## Plan y progreso

`plan` define el catálogo de estados, disponibilidades, materias, correlativas,
posiciones y conectores (`edges`). Por ejemplo:

```js
const plan = {
  name: 'Plan mínimo',
  statuses: [
    { id: 'PENDING', name: 'Pendiente', color: '--fill-color-1', textColor: '--text-primary' },
    { id: 'APPROVED', name: 'Aprobada', color: '--fill-color-4', textColor: '--bg-primary' }
  ],
  availabilities: [
    { id: 'BLOCKED', name: 'Bloqueada', color: '--border-color-2' },
    { id: 'READY', name: 'Disponible', color: '--border-color-4' }
  ],
  subjects: [
    { id: '1', name: 'Álgebra', shortName: 'A', position: { x: 0, y: 0 }, prerequisites: [] },
    { id: '2', name: 'Análisis', shortName: 'AM', position: { x: 200, y: 0 },
      prerequisites: [{ availabilityId: 'READY', dependencies: [{ statusId: 'APPROVED', subjects: ['1'] }] }] }
  ],
  edges: []
};
const progress = { '1': 'APPROVED' };
```

`progress` es el mapa personal de ID de materia (string) a ID de estado; `plan.statuses`
es el catálogo y su orden define el avance y el ciclo al siguiente estado al hacer click.
El orden de `plan.availabilities` define los niveles de disponibilidad: la evaluación
se detiene ante el primer nivel cuyos requisitos no se cumplen.
Para materias omitidas se usa `subject.status` si existe, o el primer
estado del catálogo. `setProgress(progress)` reemplaza el mapa completo; `{}` vuelve
a esos valores iniciales. `getProgress()` devuelve una copia completa del progreso
efectivo, no un porcentaje. La biblioteca toma copias de sus entradas.

## Métodos y temas

`new SubjectsGraph(container, options)`
crea una instancia y ajusta inicialmente el grafo al contenedor.

`container` debe ser un elemento HTML con ancho y alto disponibles. La instancia
crea sus propios elementos dentro de él y observa sus cambios de tamaño.

| Opción | Descripción | Valor inicial |
| --- | --- | --- |
| `plan` | Catálogos, materias, correlativas y posiciones. | Obligatorio. |
| `progress` | Mapa de ID de materia a ID de estado. | `{}`; usa los estados iniciales del plan. |
| `theme` | Personalizaciones de colores por token. | `{}`; paleta Default Dark. |
| `editable` | Permite arrastrar nodos y solicitar edición con doble clic. | `false`. |

El clic para cambiar el estado de una materia funciona también con `editable: false`.
La biblioteca copia el plan y el progreso recibidos: modificar los objetos originales
no actualiza el grafo; para eso se usan los setters.

| Método | Comportamiento |
| --- | --- |
| `setPlan(plan, options)` | Reemplaza plan y progreso, conservando pan y zoom. |
| `getProgress()` | Devuelve una copia del mapa completo de estados de las materias. |
| `setProgress(progress)` | Reemplaza el progreso. |
| `setTheme(theme)` | Reemplaza las personalizaciones sobre la paleta Default Dark. |
| `setEditable(boolean)` | Habilita solicitudes de edición y movimiento. |
| `fit()` | Ajusta explícitamente el grafo al contenedor. |
| `exportPNG(options)` | Devuelve `Promise<Blob>` del grafo, sin controles de la web. |
| `addEventListener(type, listener, options)` | Escucha solicitudes con opciones estándar, incluyendo `once` y `signal`. |
| `removeEventListener(type, listener, options)` | Quita un listener con las opciones estándar. |
| `destroy()` | Libera los recursos y elementos HTML de la instancia; se puede llamar más de una vez. |

Los demás métodos lanzan un error después de `destroy()`. Reemplazar el plan o destruir
la instancia cancela cualquier clic pendiente de procesamiento.

`setPlan` conserva el encuadre actual. Si querés encuadrar el nuevo plan, llamá
a `fit()` después. Omitir `progress` al reemplazar el plan restaura sus estados
iniciales. Para conservar el avance:

```js
graph.setPlan(plan, { progress: graph.getProgress() });
```

En `exportPNG`, `scale` controla la resolución, `bg` el color de fondo y `full`
si se captura todo el grafo (`true`) o sólo la vista actual (`false`). La promesa
devuelve un `Blob` con tipo `image/png`; no inicia una descarga por sí misma.

Las opciones de `exportPNG` son opcionales:

| Opción | Valor por defecto |
| --- | --- |
| `scale` | `4` |
| `bg` | `'transparent'` |
| `full` | `true` |

Un tema es un mapa de tokens a colores CSS. Por ejemplo:

```js
graph.setTheme({
  '--fill-color-4': '#24b47e'
});
```

Los tokens omitidos conservan
exactamente la paleta Default Dark definida en `theme.js`; cada llamada reemplaza
las personalizaciones anteriores. Los colores de estados y disponibilidades aceptan
tokens como `--fill-color-4`, `var(--fill-color-4)` o colores literales como `#24b47e`.
Las variables se aplican al elemento de cada instancia, sin modificar `document.documentElement`.

La tipografía también se puede configurar por instancia con `--font-family`:

```js
graph.setTheme({
  '--font-family': 'Georgia, serif',
  '--fill-color-4': '#24b47e'
});
```

La fuente se aplica a las etiquetas del grafo y a sus tooltips. Por defecto usa
la tipografía del sistema. Si elegís una fuente web, tu app debe cargarla antes
de crear el grafo o aplicar el tema. Este token está disponible en las fuentes
del repositorio; para consumirlo desde npm hace falta una versión que lo incluya.

## Estado controlado y eventos

Los eventos son **solicitudes de cambio**, no avisos de un cambio ya aplicado.
La app conserva el plan y el progreso y decide qué aceptar mediante `setProgress`
o `setPlan`. Los setters no vuelven a emitir solicitudes, por lo que actualizar
una tabla y el grafo desde el mismo estado no genera un ciclo de eventos.

Registrá los listeners en la instancia de `SubjectsGraph`, no en el contenedor HTML:

```js
import { SubjectsGraph } from '@raniagus/subjects-graph';

// Parte del plan definido arriba y un contenedor con dimensiones.
let ownedPlan = plan;
const graph = new SubjectsGraph(document.querySelector('#graph'), { plan: ownedPlan });
```

Los ejemplos siguientes usan esa instancia. Cada listener recibe un `CustomEvent`
con el nombre en `event.type` y los datos de la solicitud en `event.detail`.
Los eventos no se propagan por el DOM y no exponen el evento de Cytoscape.
`preventDefault()` no acepta ni rechaza cambios: la aceptación depende de que
la app aplique el nuevo estado mediante un setter.

| Evento | Cuándo se emite | `event.detail` |
| --- | --- | --- |
| `statusrequest` | Clic o tap en una materia, en ambos modos. | `{ subjectId, nextStatusId }` |
| `nodepositionrequest` | Al soltar una materia o un conector arrastrado, con edición habilitada. | `{ nodeId, position: { x, y } }` |
| `editrequest` | Doble clic o doble tap en un elemento o el fondo, con edición habilitada. | Depende de `kind`; ver abajo. |

Los IDs son strings. Las posiciones están en coordenadas del grafo, independientes
del pan y del zoom; no son píxeles relativos a la pantalla.

### Cambiar estados: `statusrequest`

`subjectId` identifica una materia de `plan.subjects`. `nextStatusId` es el estado
siguiente según el orden de `plan.statuses`; después del último vuelve al primero.
La solicitud no impide avanzar un estado por tener correlativas pendientes:
si tu app necesita esa restricción, debe decidir si acepta el cambio.

```js
function acceptStatus(event) {
  const { subjectId, nextStatusId } = event.detail;
  graph.setProgress({
    ...graph.getProgress(),
    [subjectId]: nextStatusId
  });

  // Desde acá, la app también puede actualizar su tabla o persistir el progreso.
  console.log(graph.getProgress());
}

graph.addEventListener('statusrequest', acceptStatus);
```

Se combina con el progreso actual porque `setProgress` reemplaza el mapa completo.
Si no registrás un listener o éste decide no llamar al setter, el estado se mantiene.
Un clic en un conector no solicita un cambio de estado.

En modo edición el clic se demora brevemente para distinguirlo del doble clic.
Una solicitud de edición cancela el clic pendiente, y `setPlan` y `destroy` también
lo cancelan. No conviene depender de un tiempo exacto para sincronizar la UI:
respondé al evento cuando llegue.

Para actualizar desde otra vista, aplicá el progreso directamente:

```js
// Por ejemplo, al elegir un estado en la tabla de materias de tu app.
graph.setProgress({ ...graph.getProgress(), '1': 'APPROVED' });
```

Eso actualiza el grafo sin emitir `statusrequest`. Tu app debe actualizar ambas
vistas desde su estado compartido; no hay un evento adicional de «progreso cambiado».

### Guardar posiciones: `nodepositionrequest`

Activá el movimiento con `graph.setEditable(true)`. Al soltar un nodo, el evento
incluye su ID y la posición propuesta. Puede ser una materia de `plan.subjects`
o un conector de `plan.edges`.

```js
graph.setEditable(true);

graph.addEventListener('nodepositionrequest', event => {
  const { nodeId, position } = event.detail;
  ownedPlan = {
    ...ownedPlan,
    subjects: ownedPlan.subjects.map(node =>
      node.id === nodeId ? { ...node, position } : node),
    edges: ownedPlan.edges.map(node =>
      node.id === nodeId ? { ...node, position } : node)
  };
  graph.setPlan(ownedPlan, { progress: graph.getProgress() });
});
```

Pasar el progreso a `setPlan` evita que vuelva a los estados iniciales. La app puede
ajustar la posición antes de guardarla, por ejemplo redondeándola a una grilla.

**Aplicá la posición durante el listener si querés que el nodo permanezca donde
se soltó.** Al terminar la entrega del evento, la biblioteca restaura la posición
del plan vigente. Si ignorás la solicitud, el nodo vuelve a su lugar anterior.
Si esperás una operación asíncrona antes de llamar a `setPlan`, vuelve primero
al lugar anterior y se mueve a la nueva posición cuando aplicás el plan.

### Abrir un editor: `editrequest`

Sólo se emite con edición habilitada. `detail.kind` identifica qué se quiere editar:

| `kind` | Campos restantes | Significado |
| --- | --- | --- |
| `subject` | `nodeId` | Materia de `plan.subjects`. |
| `connector` | `nodeId` | Conector definido en `plan.edges`. |
| `connection` | `sourceId`, `targetId`, `position` | Flecha entre dos nodos; sus extremos pueden ser materias o conectores. |
| `background` | `position` | Punto vacío del grafo, por ejemplo para crear una materia. |

`connector` identifica un nodo de conexión; `connection` identifica una flecha.
Para una flecha, `position` es el lugar del doble clic, no la posición de sus extremos.
El evento no incluye un editor ni modifica el plan por sí mismo.

Por ejemplo, este listener permite cambiar el nombre de una materia con un diálogo
del navegador. Ignora las demás clases de solicitudes:

```js
graph.addEventListener('editrequest', event => {
  const request = event.detail;
  if (request.kind !== 'subject') return;

  const subject = ownedPlan.subjects.find(node => node.id === request.nodeId);
  if (!subject) return;
  const name = window.prompt('Nombre de la materia', subject.name);
  if (!name?.trim()) return;

  ownedPlan = {
    ...ownedPlan,
    subjects: ownedPlan.subjects.map(node =>
      node.id === request.nodeId ? { ...node, name: name.trim() } : node)
  };
  graph.setPlan(ownedPlan, { progress: graph.getProgress() });
});
```

Una app puede abrir su propio formulario, validarlo y llamar a `setPlan` al guardar.
Cerrar el formulario sin aplicar el plan deja el grafo sin cambios. Para agregar
o eliminar elementos, la app debe mantener consistentes sus IDs y correlativas.

### Registrar y quitar listeners

`addEventListener(type, listener, options)` y
`removeEventListener(type, listener, options)` usan las reglas de `EventTarget`.
El valor de retorno no es una función para desuscribirse; guardá la referencia
al callback o usá un `AbortController`.

Para quitar un listener, pasá **la misma función** usada al registrarlo:

```js
graph.removeEventListener('statusrequest', acceptStatus);

// Se puede volver a habilitar más tarde.
graph.addEventListener('statusrequest', acceptStatus);
```

Crear otra función flecha con el mismo cuerpo no quita la anterior. Registrar
otra vez el mismo callback para el mismo evento y valor de `capture` no lo duplica.

Las opciones pueden ser un booleano (`capture`) o un objeto:

| Opción | Uso |
| --- | --- |
| `once: true` | Ejecuta el listener una sola vez y luego lo quita. |
| `signal` | Quita el listener cuando se aborta el `AbortController`. Una señal ya abortada no registra el listener. |
| `capture` | Forma parte de la identidad del registro; debe coincidir al quitarlo. No hay propagación por un árbol DOM en estos eventos. |
| `passive` | Opción estándar; no es necesaria para aceptar solicitudes de la biblioteca. |

Ejemplo de un listener que observa sólo la siguiente solicitud; no la acepta:

```js
graph.addEventListener('statusrequest', event => {
  console.log('Primera solicitud observada:', event.detail);
}, { once: true });
```

Para liberar varios listeners juntos al desmontar una vista:

```js
const controller = new AbortController();
const options = { signal: controller.signal };

graph.addEventListener('statusrequest', event => {
  console.log('Solicitud de estado:', event.detail);
}, options);
graph.addEventListener('editrequest', event => {
  console.log('Solicitud de edición:', event.detail);
}, options);

// Al desmontar la vista:
controller.abort();
graph.destroy();
```

Abortar esos listeners no destruye el grafo ni quita otros listeners registrados
sin esa señal. `destroy()` libera la instancia y todos sus listeners; después no
se pueden registrar ni quitar listeners en ella. Para volver a mostrar el grafo,
creá una instancia nueva.

Podés registrar varios listeners de un mismo evento, por ejemplo uno para aceptar
el cambio y otro para registrarlo. Los callbacks se ejecutan sincrónicamente al
entregar la solicitud; su valor de retorno no se usa y no se espera una promesa
retornada por un listener `async`.

### Tipos de los eventos

Las declaraciones del paquete relacionan el nombre del evento con su `detail`.
En TypeScript, o JavaScript con chequeo de tipos, el listener infiere los campos:

```js
graph.addEventListener('statusrequest', event => {
  const { subjectId, nextStatusId } = event.detail; // Ambos son string.
  console.log(subjectId, nextStatusId);
});

graph.addEventListener('editrequest', event => {
  if (event.detail.kind === 'connection') {
    // TypeScript reconoce los campos de esta clase de solicitud.
    console.log(event.detail.sourceId, event.detail.targetId);
  }
});
```

## Responsabilidades de la app

La biblioteca no usa almacenamiento ni registra service workers. La app implementa
selectores, tabla, indicador de progreso, editor, importación y exportación JSON,
y persistencia según sus necesidades. `exportPNG` captura el grafo; la app decide
cómo descargar o mostrar el Blob resultante.

Los [ejemplos CDN](../examples/cdn/README.md) muestran una integración mínima y otra
con todos estos flujos en una app HTML.

Para aplicaciones Angular, consultá la [API del adaptador Angular](angular-api.md)
y su [ejemplo ejecutable](../examples/angular/README.md).
