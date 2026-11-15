# Grafo de Materias

Aplicación web interactiva para visualizar correlativas de materias universitarias como un grafo
dirigido.

![Graph Visualization](https://img.shields.io/badge/Graph-Cytoscape.js-blue)
![License](https://img.shields.io/badge/License-BSD%203--Clause-green)

![Application Interface](image.png)

## Funcionalidades

- **Grafo interactivo** que permite configurar los estados de las materias con un click
- **Indicador de progreso** que muestra el avance por estado
- **Pan y zoom** para ver y recorrer desde dispositivos móviles
- **Autoguardado** en local storage para cada plan de estudio
- **Screenshots** para capturar el grafo en una imagen y subirlo en tu CV o perfil de GitHub
- **Selector de temas** para personalizar los colores del grafo
- **Import/Export** en JSON para respaldar y restaurar tu progreso
- **Progressive Web App (PWA)** para poder modificar el grafo offline desde cualquier dispositivo
  como si fuera una app nativa
- **Configuración extensible** de variantes de planes de estudio mediante un mismo archivo JSON
- **Modo edición** para agregar materias electivas o ingresar nuevos planes de forma más sencilla

## Aportes

¡Los aportes son bienvenidos! Podés ayudar:

- **Agregando nuevos planes de estudio** - Sumándolos a `data.json`
- **Reportando bugs** - Abrí un issue si algo no funciona como esperabas
- **Feature requests** - Cualquier idea que tengas para extender la app, también mediante issues

## Personalización

### Planes de estudio

El grafo soporta múltiples variantes de planes de estudio, cada una con su propia configuración de
materias, estados y disponibilidades:

```json
{
  "variants": {
    "tu-plan": {
      "name": "Universidad - Carrera - Plan",
      "progress": {...},
      "statuses": [...],
      "availabilities": [...],
      "subjects": [...],
      "edges": [...]
    },
    ...
  }
}
```

### Gráfico de progreso

Bajo el campo `progress` se puede configurar cómo se va a ver el gráfico de progreso.
Ejemplo:

```jsonc
"progress": {
  "position": {
    "vertical": "bottom", // o "top"
    "horizontal": "right" // o "left"
  }
}
```

### Estados de Materias

Los estados se configuran a nivel general en `statuses`. Ejemplo:

```json
"statuses": [
  { "id": "PENDING", "name": "Pendiente", "color": "--fill-color-1", "textColor": "--text-primary", "leafTextColor": "--accent-color" },
  { "id": "IN_PROGRESS", "name": "En curso", "color": "--fill-color-2", "textColor": "--text-primary", "leafTextColor": "--accent-color" },
  { "id": "FINAL_EXAM_PENDING", "name": "Cursada", "color": "--fill-color-3", "textColor": "--text-primary" },
  { "id": "APPROVED", "name": "Aprobada", "color": "--fill-color-4", "textColor": "--bg-primary" }
]
```

### Disponibilidad de Materias

Los bordes y flechas indican la disponibilidad y se configuran en `availabilities`. Ejemplo:

```json
"availabilities": [
  { "id": "NOT_AVAILABLE", "name": "No disponible", "color": "--border-color-2" },
  { "id": "ENROLL_AVAILABLE", "name": "Disponible para cursar", "color": "--border-color-3" },
  { "id": "FINAL_EXAM_AVAILABLE", "name": "Disponible para aprobar", "color": "--border-color-4" }
]
```

### Materias y correlativas

Las materias combinan estados y disponibilidades mediante correlativas. Cada materia tiene un
array de `prerequisites` que define cómo varía su disponibilidad basándose en el status de sus
dependencias.

Ejemplo de una materia con correlativas:

```json
{
  "id": "23",
  "name": "Economía",
  "shortName": "E",
  "position": { "x": 300, "y": 200 },
  "prerequisites": [
    {
      "availabilityId": "ENROLL_AVAILABLE",
      "dependencies": [
        { "statusId": "FINAL_EXAM_PENDING", "subjects": ["12"] },
        { "statusId": "APPROVED", "subjects": ["4", "5"] }
      ]
    },
    {
      "availabilityId": "FINAL_EXAM_AVAILABLE",
      "dependencies": [
        { "statusId": "APPROVED", "subjects": ["12"] }
      ]
    }
  ]
}
```

Esto indica que la materia "Economía" estará disponible para cursar si "Análisis de Sistemas" está
en estado "Cursada" y tanto "Algoritmos y Estructuras de Datos" como "Sistemas y Organizaciones"
están "Apobadas".

Las correlativas se evalúan en orden, es decir que para que "Economía" esté disponible para rendir
final es necesario cumplir con todos los requisitos anteriores y además tener "Análisis de Sistemas"
aprobada.

### Conectores

Los conectores permiten juntar las correlativas de varias materias en un solo nodo, que se simboliza
con forma de diamante. Se definen en `edges` y pueden encadenarse para rutas complejas.

Ejemplo de conector:

```json
{
  "id": "AM1,AGA:AM2,PyE",
  "position": { "x": 900, "y": 200 },
  "dependencies": ["1", "2"],
  "targets": ["10", "17"]
}
```

> Como normalmente los IDs de cada materia son numéricos, es recomendable que el ID del conector
> incluya los `shortName`s de las materias para poder identificarlos más fácil en el grafo.

Los conectores pueden encadenarse para mejorar la legibilidad del grafo.
Ejemplo:

```json
{ "id": "F2:TdC:1", "dependencies": ["F2"], "targets": ["F2:TdC:2"], ... },
{ "id": "F2:TdC:2", "dependencies": ["F2:TdC:1"], "targets": ["30"], ... }
```

> Los conectores que solamente tengan un origen y un destino se renderizan como
> **nodos invisibles**.

## Tech Stack

- **HTML5**, **CSS3** y **JavaScript Vanilla** (ES6+) - Núcleo de la aplicación
- **LocalStorage** - Persistencia de progreso en tiempo real en el navegador
- [**Cytoscape.js**](https://js.cytoscape.org/) - Biblioteca de renderizado de grafos
- [**Lucide**](https://lucide.dev/) - Iconos de UI
- [**Github Corners**](https://github.com/tholman/github-corners) - Banner "Fork me on GitHub"

La web no usa frameworks ni requiere compilación: se sirve directamente desde `public/`.
El mismo código del grafo se distribuye también como biblioteca ESM para integrar en otras webs.

## Infraestructura

- **Progressive Web App (PWA)** - Soporte offline y experiencia nativa
- **Vitest y TypeScript** - Pruebas y comprobación de JavaScript con JSDoc
- **esbuild** - Empaquetado de la biblioteca y declaraciones `.d.ts` generadas desde JSDoc
- **GitHub Actions** - Verificación de tests, tipos y build de la biblioteca

## Getting Started

### Instalación

```bash
git clone https://github.com/RaniAgus/subjects-graph.git
cd subjects-graph
```

### Estructura de archivos

```txt
subjects-graph/
├── public/
│   ├── index.html           # HTML principal
│   ├── app.js               # Lógica de aplicación (UI, eventos)
│   ├── graph.js             # Reexportación compatible del núcleo puro
│   ├── styles.css           # Estilos
│   ├── data.json            # Variantes y datos de cada plan de estudio
│   ├── lib/subjects-graph/  # Biblioteca, núcleo puro, renderer privado y CSS
│   └── icons/               # Iconos de la app
├── tests/                   # Pruebas unitarias (Vitest)
│   ├── bugs/                # Pruebas de regresión sobre bugs reportados
│   └── graph.test.js        # Pruebas de la lógica del grafo
├── README.md
└── LICENSE
```

### Ejecutar Localmente

Levantar la carpeta `public/` con cualquier servidor de archivos estáticos:

- Con Python 3:

```bash
python -m http.server 8000 -d public
```

- Con Node.js (serve):

```bash
npx serve public
```

- Con [VS Code Live Server Extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer),
abrir `public/index.html` y hacer click en "Go Live".

Para desarrollar sin registrar el service worker, abrir
[http://localhost:8000/?pwa=off](http://localhost:8000/?pwa=off) y mantener `pwa=off` en la URL.
Las demás URLs conservan el comportamiento PWA habitual.

Si ya usaste la app localmente con PWA, hacer una única limpieza manual en DevTools:
en **Application > Service Workers**, pulsar **Unregister** para el service worker de esta app
y luego recargar. Recargar por sí solo no elimina el registro. Si hace falta, borrar también
las cachés `subjects-graph-cache-*` en **Application > Cache Storage**. Conservar Local Storage
para mantener el progreso, el tema y los planes personalizados.

### Ejecutar Unit Tests

Primero debemos instalar las dependencias con [pnpm](https://pnpm.io/):

```bash
pnpm install --frozen-lockfile
```

Luego podemos correr las pruebas directamente desde el IDE o con:

```bash
pnpm test
pnpm typecheck
pnpm build:lib
```

`pnpm start` sirve `public/` en el puerto 8000. No hay servidor de desarrollo Vite,
build de la web ni demo separada. `build:lib` genera ESM, CSS y declaraciones en
`dist/` (ignorado por Git); no modifica la web. El paquete incluye `dist/`, README,
LICENSE y los metadatos npm. `prepack` ejecuta ese build automáticamente; si tu
configuración omite scripts, para empaquetar este proyecto conocido usá
`npm pack --ignore-scripts=false`. No hace falta habilitar scripts globalmente.

## Usar la biblioteca

El paquete `@raniagus/subjects-graph` exporta `SubjectsGraph` como export nombrado y el
núcleo puro por `@raniagus/subjects-graph/core`. Su CSS se importa explícitamente:

```js
import { SubjectsGraph } from '@raniagus/subjects-graph';
import '@raniagus/subjects-graph/styles.css';

const graph = new SubjectsGraph(document.querySelector('#graph'), { plan });
```

El contenedor debe tener dimensiones, por ejemplo `height: 600px`. Para usar las
fuentes directamente en HTML servido desde `public/`:

```html
<link rel="stylesheet" href="./lib/subjects-graph/styles.css">
<div id="graph" style="height: 600px"></div>
<script type="importmap">
{"imports":{"cytoscape":"https://unpkg.com/cytoscape@3.33.1/dist/cytoscape.esm.mjs"}}
</script>
<script type="module">
  import { SubjectsGraph } from './lib/subjects-graph/index.js';
  const data = await fetch('./data.json').then(response => response.json());
  const graph = new SubjectsGraph(document.querySelector('#graph'), {
    plan: data.variants['frba-k08']
  });
</script>
```

### Plan y progreso

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

### API y temas

`new SubjectsGraph(container, { plan, progress = {}, theme = {}, editable = false })`
crea una instancia y ajusta inicialmente el grafo al contenedor.

| Método | Comportamiento |
| --- | --- |
| `setPlan(plan, { progress = {} } = {})` | Reemplaza plan y progreso, conservando pan y zoom. |
| `getProgress()` | Devuelve una copia del mapa efectivo completo. |
| `setProgress(progress)` | Reemplaza el progreso. |
| `setTheme(theme)` | Reemplaza las personalizaciones sobre la paleta Default Dark. |
| `setEditable(boolean)` | Habilita solicitudes de edición y movimiento. |
| `fit()` | Ajusta explícitamente el grafo al contenedor. |
| `exportPNG({ scale = 4, bg = 'transparent', full = true } = {})` | Devuelve `Promise<Blob>` del grafo, sin controles de la web. |
| `addEventListener(type, listener, options)` | Escucha solicitudes con opciones estándar, incluyendo `once` y `signal`. |
| `removeEventListener(type, listener, options)` | Quita un listener con las opciones estándar. |
| `destroy()` | Libera renderer, observadores, listeners y DOM de la instancia; es idempotente. |

Los demás métodos lanzan un error después de `destroy()`. Reemplazar el plan o destruir
la instancia cancela el tap pendiente con `clearTimeout`.

Un tema es un mapa de tokens a colores CSS, por ejemplo
`graph.setTheme({ '--fill-color-4': '#24b47e' })`. Los tokens omitidos conservan
exactamente la paleta Default Dark definida en `theme.js`; cada llamada reemplaza
las personalizaciones anteriores. Los colores de estados y disponibilidades aceptan
tokens como `--fill-color-4`, `var(--fill-color-4)` o colores literales como `#24b47e`.
Las variables se aplican al elemento de cada instancia, sin modificar `document.documentElement`.

### Estado controlado y eventos

El consumidor decide si acepta cada solicitud y conserva su estado:

```js
let ownedPlan = plan;
let ownedProgress = {};
const graph = new SubjectsGraph(document.querySelector('#graph'), { plan: ownedPlan });
graph.addEventListener('statusrequest', event => {
  const { subjectId, nextStatusId } = event.detail;
  ownedProgress = { ...ownedProgress, [subjectId]: nextStatusId };
  graph.setProgress(ownedProgress);
});

graph.addEventListener('nodepositionrequest', event => {
  const { nodeId, position } = event.detail;
  ownedPlan = { ...ownedPlan,
    subjects: ownedPlan.subjects.map(node => node.id === nodeId ? { ...node, position } : node),
    edges: ownedPlan.edges.map(node => node.id === nodeId ? { ...node, position } : node)
  };
  graph.setPlan(ownedPlan, { progress: ownedProgress });
});
```

Si se ignora una solicitud de movimiento, el nodo vuelve a la posición del plan. Un `statusrequest` ignorado
conserva el estado actual. En modo editable, `editrequest` identifica el elemento
para abrir la UI propia del consumidor:

| `event.detail.kind` | Otros campos de `detail` |
| --- | --- |
| `subject` o `connector` | `nodeId` |
| `connection` | `sourceId`, `targetId`, `position` |
| `background` | `position` |

El consumidor aplica las ediciones mediante un plan actualizado y `setPlan`; ignorar
la solicitud deja el plan intacto. Las declaraciones TypeScript infieren `event.detail`
por nombre de evento. Los setters no emiten solicitudes de vuelta.

La biblioteca no usa almacenamiento ni registra service workers. La aplicación en
`app.js` conserva selectores, indicador de progreso, leyenda, editor, importación y
exportación JSON, almacenamiento, capturas y PWA.

## Licencia

Licencia BSD 3-Clause - ver [LICENSE](LICENSE)

---

Made with :heart: by [@RaniAgus](https://github.com/RaniAgus)
