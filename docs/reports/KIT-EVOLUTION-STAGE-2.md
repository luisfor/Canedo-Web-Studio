# Etapa 2 — memoria y continuidad

La etapa 1 cerró con 333/333 pruebas y validación aprobada antes de iniciar esta etapa. Se incorporó continuidad sobre los lectores/generadores existentes, sin reconstruirlos.

## Archivos

Nuevos: [store.js](../../scripts/memory/store.js), [enhance.js](../../scripts/memory/enhance.js), [esquema versionado](../../schemas/project-memory.schema.json), [pruebas](../../tests/kit/memory.test.js), [guía](../continuity/README.md) y este informe.

Modificados: [servicio KIT-FIRST](../../scripts/kit-first/service.js), [inspector](../../scripts/kit-first/inspect.js), [esquema de inspección](../../schemas/kit-first.schema.json), [CLI principal](../../scripts/kit.js), [CLI compartida](../../scripts/workspace/cli.js), [package.json](../../package.json), [README](../../README.md), [capacidades](../CAPACIDADES.md) y [guía KIT-FIRST](../kit-first/README.md).

## Funcionalidades y reutilización

- `.devkit/project.json` inmutable e historial de revisiones encadenadas; lectura del último estado, esquemas y detección de alteraciones, bifurcaciones y revisiones huérfanas.
- Lectura/adopción de registros previos de proyecto, Docker y composición, conservándolos sin cambios. Se registran contratos, procedencia, versiones, dependencias sanitizadas, archivos y propiedad, módulos generados/observados, pendientes, decisiones y estado de pruebas.
- Los proyectos creados por `agent create` reciben memoria automáticamente. Proyectos arbitrarios pueden inspeccionarse/adoptarse sin declarar sus funciones verificadas ni imponer otro stack.
- Plan incremental para ampliar composiciones v1: calcula diferencias con el generador existente y solo reemplaza archivos propios intactos. Conserva permisos y documentos personalizados; código/contratos personalizados o cambios tardíos bloquean la operación.
- `memory adopt/status/enhance/validate/apply`, reutilizando KIT-FIRST, escritor seguro, hashes, renderizado/configuraciones y generador existentes. Las capacidades ya presentes producen una operación sin cambios.
- Aplicación explícita mediante ID exacto del plan, bloqueo local, copias antes/después y revisiones adicionales, sin regenerar carpetas, borrar datos o ejecutar migraciones. Fallos parciales conservan copias y exigen reconciliación antes de otra operación.

## Pruebas ejecutadas

- `npm run test:memory`: 12 casos incorporados, todos aprobados dentro de la regresión final.
- `npm run test:kit`: **345/345 aprobadas**, sin fallos ni omisiones (333 previas + 12 de memoria).
- `npm run kit:validate`: aprobado.
- `git diff --check`: sin errores.

Las pruebas cubren manifiestos, privacidad, tres clases de registros anteriores, personalizaciones, conflictos, alteración de planes, cambios tardíos, confirmación explícita, historial, operaciones sin cambios, fallo parcial, rechazo de cambios tecnológicos implícitos y CLI. Un proyecto temporal de inventario + CRM se amplió con ventas/caja/WhatsApp/chatbot y ejecutó las cinco pruebas completas de HTTP/SQLite con cero omisiones. Los proveedores son adaptadores de prueba, no conexiones reales.

## Límites y pendientes

El reconciliador inicial es para composiciones propias v1 Node/SQLite; no hay modificación automática de aplicaciones arbitrarias o migraciones entre frameworks/motores. Esa selección se bloquea en lugar de generar otro sistema paralelo. La memoria y sus esquemas son independientes del runtime; nuevos reconciliadores requieren pruebas específicas.

La revisión API es append-only, pero no constituye firma o almacenamiento inviolable frente al propietario del filesystem. El bloqueo coordina al kit, no editores externos; no se promete atomicidad de todos los archivos. Operaciones parciales quedan visibles y bloqueadas para revisión. Las copias locales están excluidas mediante `.devkit/.gitignore`.

La presencia/generación de código no llena `implemented` ni marca pruebas aprobadas: las mejoras quedan `not-run` hasta registrar una ejecución verificable en etapas posteriores. Los registros viejos describen su versión inicial y pueden mostrar diferencias tras una mejora; `memory status` representa el estado vigente.

No hubo instalaciones, descargas de repositorios, contenedores, cambios globales, commits, push, despliegues ni modificaciones de otros proyectos. Las pruebas se ejecutaron en macOS ARM64; otros sistemas y proveedores reales siguen sin verificarse aquí.
