# Integración completa

Serví esta carpeta con `python3 -m http.server 8001` y abrí http://localhost:8001.
También se puede abrir desde el índice de `examples/cdn`.

La app es dueña de `plan` y `progress`; usa exclusivamente la API pública de la
biblioteca, sin acceder a su renderer. El grafo y la tabla comparten ese estado:

- Clic en el grafo → `statusrequest` → `setProgress` → actualización de la tabla.
- Selector de la tabla → `setProgress` → actualización del grafo.
- `getProgress` devuelve todos los estados para el contador y la vista JSON.
- El selector de plan llama a `setPlan` y reinicia el progreso. La vista conserva
  pan y zoom; `fit` permite encuadrar el nuevo plan.
- El selector de tema usa `setTheme`; Default Dark pasa `{}` para restaurar la paleta.
- El modo edición llama a `setEditable`. Los movimientos se aceptan mediante
  `nodepositionrequest`, actualizando el plan y llamando a `setPlan` con el progreso.
- `editrequest` abre el editor JSON con el contexto de la materia, conector, flecha
  o fondo. Editá el plan y aplicalo para aceptar cambios; cerrarlo sin aplicar los ignora.
  El editor permite agregar, cambiar o quitar materias, conectores y correlativas.
  Valida IDs, referencias, posiciones y ciclos antes de aplicar el plan.
- PNG usa `exportPNG({ scale: 2, bg: '#10141d', full: true })` y descarga el Blob.
- Desactivar «Aceptar clics» llama a `removeEventListener`; volver a activarlo llama
  a `addEventListener`. Las solicitudes se siguen mostrando en el registro.
- Destruir instancia cancela listeners con `AbortController` y llama a `destroy`.
  Recrearla restaura el estado de la app en una instancia nueva.

No persiste datos ni registra un service worker. Cambiar de plan descarta las
ediciones del plan anterior. Los selectores y el registro son UI de esta app;
la biblioteca sólo se ocupa del grafo.
