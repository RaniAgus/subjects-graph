# Ejemplos HTML desde npm

Ambos consumen `@raniagus/subjects-graph@0.3.0` y su CSS desde unpkg.
No usan las fuentes de `public/`, ni requieren instalar dependencias o compilar.
Necesitan Internet, esa versión publicada y un navegador moderno que admita
`import plan from './plan.json' with { type: 'json' }`.

Desde la raíz del repositorio:

```bash
python3 -m http.server 8001 -d examples/cdn
```

Abrí http://localhost:8001 y elegí un ejemplo:

- [Mínimo](minimal/): quickstart con tres materias del K23. Sólo carga la biblioteca,
  el CSS y el plan, crea la instancia y acepta cambios de estado.
- [Completo](complete/): ocho materias de la rama de software del K23, con tabla
  sincronizada con el grafo, temas, edición y exportación PNG.

Cada subcarpeta se puede copiar y servir por separado. Los planes conservan los IDs,
estados y correlativas de `public/data.json`, con posiciones adaptadas y sin
conectores de presentación. El progreso queda en memoria hasta recargar.
`pnpm start` sirve únicamente la aplicación de `public/`.
