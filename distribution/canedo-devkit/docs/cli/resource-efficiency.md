# Eficiencia local y contexto progresivo

El modo predeterminado es determinista: catálogos, reglas, diagnósticos, planificación técnica y comprobaciones no requieren modelos. No se instala inferencia local. Los proveedores opcionales existentes permanecen optativos.

## CLI

Sustituye `/ruta/proyecto` por un destino explícito:

```sh
node scripts/kit.js efficiency context --project /ruta/proyecto
node scripts/kit.js efficiency context --project /ruta/proyecto --cache disk
node scripts/kit.js efficiency context --project /ruta/proyecto --full
node scripts/kit.js efficiency catalog --project /ruta/proyecto --filter python --limit 5
node scripts/kit.js efficiency evidence --project /ruta/proyecto --cursor 0 --max-bytes 4096
node scripts/kit.js efficiency cache-inspect --project /ruta/proyecto
node scripts/kit.js efficiency cache-clear --project /ruta/proyecto
node scripts/kit.js efficiency validate --project /ruta/proyecto
node scripts/kit.js efficiency validate --project /ruta/proyecto --syntax
node scripts/kit.js efficiency memory-summary --project /ruta/proyecto
node scripts/kit.js efficiency memory-page --project /ruta/proyecto --collection decisions --limit 5
node scripts/kit.js efficiency benchmark
```

`context` devuelve el `inspectionId`. Registrar un checkpoint requiere `checkpoint --project /ruta/proyecto --confirm INSPECTION_ID`; escribe únicamente metadatos `.devkit`, conservando el código. La memoria registra stack, dependencias, decisiones y comprobaciones mediante la cadena de revisiones existente; no guarda historiales completos. Un checkpoint de sintaxis no certifica comportamiento ni compilación del producto.

`--max-bytes` configura entre 2048 y 65536 bytes de JSON, con 8192 por defecto. Las páginas devuelven `nextCursor`. La evidencia completa puede reconstruirse concatenando los fragmentos; su digest permite verificarla. CLI `validate --full` solicita expresamente el informe completo sin ese límite. El presupuesto de respuesta del kit no controla el contexto acumulado de un cliente externo.

## Caché e invalidación

`memory` es efímera y predeterminada; entre procesos CLI usa explícitamente `disk`. `off` y `--full` fuerzan análisis completo. La caché persistente reside en `.devkit-cache/v1`, excluida de inspección y Git. Contiene señales derivadas acotadas; no código fuente, rutas del proyecto, valores de configuración ni credenciales. Las claves incluyen contenido, ruta relativa, destino, versión del analizador y entorno Node/SO/arquitectura. Cambiar manifiestos o archivos invalida sus análisis; el catálogo y los controles de vigencia se verifican nuevamente.

Se vuelven a leer y verificar los bytes incluso con caché: se evita repetir el análisis, no los controles de seguridad. Cambios del mismo tamaño con fecha restaurada siguen detectándose. Las autorizaciones de generación nunca se basan solo en caché. La memoria se limita a 10000 entradas y cada archivo de caché a 4 MiB; el almacenamiento persistente acumulado requiere limpieza manual. Una entrada ajena o inválida impide borrado/sobrescritura automática. No se borran fuentes.

## API y MCP

La API CommonJS `scripts/agents/progressive.js` ofrece la misma sesión usada por MCP. `discoverEfficient` en el servicio KIT-FIRST devuelve evidencia y métricas locales; la interfaz histórica mantiene sus comprobaciones completas.

Inicia el servidor existente con `--compact --max-context-bytes 8192`, además de sus opciones habituales de raíz. `tools/list` admite paginación. Descubre primero `kit_context`; consulta después `kit_catalog_page`, `kit_technical_plan`, `kit_static_validate` y `kit_memory_summary`. Amplía mediante `kit_evidence_chunk`, `kit_plan_chunk`, `kit_validation_chunk` o `kit_memory_page`. `kit_efficiency` informa las métricas de la sesión. Las referencias se limitan a la conexión y al proyecto; un contexto cambiado se rechaza. Los métodos históricos se conservan; el modo compacto también limita sus respuestas. No se duplica la evidencia completa como texto y contenido estructurado en protocolos modernos.

Se probó un cliente STDIO de protocolo, no instalaciones reales de Codex, Gemini o Claude. El uso de descubrimiento progresivo, la retención de contexto y las llamadas adicionales dependen del cliente. Ninguno se declara conectado por disponer de archivos de instrucciones.

## Validación y límites

Las comprobaciones estáticas leen JSON y analizan JavaScript sin ejecutar el proyecto. `--syntax` habilita parsers aislados para Python y ESM usando herramientas ya presentes. No ejecuta scripts del proyecto. TypeScript/JSX, Go, Java, C#, Rust, C/C++, Kotlin, Swift, Dart y SQL pueden quedar pendientes de un validador revisado; reconocerlos no equivale a compilarlos. Los comandos nativos y pruebas de comportamiento requieren un flujo autorizado adicional.

Directorios generados conocidos se excluyen; enlaces, cambios durante lectura o fuentes arbitrariamente grandes siguen bloqueando. Esta distribución excluye los bundles ajenos al núcleo. Un archivo arbitrariamente grande en un proyecto del usuario sigue bloqueando la inspección; no se ignora automáticamente.

La contabilidad opcional distingue tokens reportados por proveedor, estimaciones identificadas y consumo desconocido. No deduce tokens a partir de bytes ni inventa porcentajes de ahorro. Un presupuesto nunca omite comprobaciones de seguridad. El benchmark usa tres archivos sintéticos, mide reutilización y bytes JSON; no representa ahorro monetario ni rendimiento de repositorios completos.
