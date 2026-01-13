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

```jsonc
{
  "variants": {
    "tu-plan": {
      "name": "Universidad - Carrera - Plan",
      "progress": {
        "position": {
          "vertical": "bottom", // o "top"
          "horizontal": "right" // o "left"
        }
      },
      "statuses": [...],
      "availabilities": [...],
      "subjects": [...],
      "edges": [...]
    },
    ...
  }
}
```

### Estados de Materias

Los estados se configuran a nivel general en `data.json` bajo el campo `statuses`. Ejemplo:

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
  { "id": "NOT_AVAILABLE", "name": "No disponible", "borderColor": "--border-color-2" },
  { "id": "ENROLL_AVAILABLE", "name": "Disponible para cursar", "borderColor": "--border-color-3" },
  { "id": "FINAL_EXAM_AVAILABLE", "name": "Disponible para aprobar", "borderColor": "--border-color-4" }
]
```

### Materias y correlativas

Las materias combinan estados y disponibilidades mediante correlativas. Cada materia tiene un
array de `prerequisites` que define cuándo cambia su disponibilidad basado en el estado de sus
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
},
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

Y eso es todo, sin frameworks ni package managers. Todo el código se encuentra
en la carpeta `public/`.

## Infraestructura

- **Progressive Web App (PWA)** - Soporte offline y experiencia nativa
- **Vitest** - Para pruebas unitarias de la lógica del grafo (por eso hay un `package.json` en la raíz!)
- **GitHub Actions** - CI/CD para despliegue de la carpeta `public/` en GitHub Pages

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
│   ├── graph.js             # Lógica de renderizado de grafo
│   ├── styles.css           # Estilos
│   ├── data.json            # Variantes y datos de cada plan de estudio
│   ├── lib/                 # Bibliotecas de terceros
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

### Ejecutar Unit Tests

Primero debemos instalar las dependencias con [pnpm](https://pnpm.io/):

```bash
pnpm install
```

Luego podemos correr las pruebas directamente desde el IDE o con:

```bash
pnpm test
```

## Licencia

Licencia BSD 3-Clause - ver [LICENSE](LICENSE)

---

Made with :heart: by [@RaniAgus](https://github.com/RaniAgus)
