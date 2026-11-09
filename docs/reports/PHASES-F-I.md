# Entrega conjunta F–I — Canedo Studio Kit

Fecha: 2026-11-02. Autorización: continuar las fases F–I secuencialmente sin pausas intermedias. Modalidad manual conservada; ejecución asistida deshabilitada.

## Funciones entregadas

| Fase | Implementación | Verificación al cerrar la fase |
|---|---|---|
| F | Diagnóstico Docker por componente y contexto; planes de versiones/dependencias para seis stacks, escritura exclusiva | 234 pruebas aprobadas |
| G | Diez perfiles optativos, Compose para cinco motores de datos y cinco backends /health, secretos externos, redes/volúmenes/límites | 252 pruebas aprobadas |
| H | Comandos de operación manual, confirmaciones destructivas, drift, export/restore/compare/update/repair de configuración | 273 pruebas aprobadas |
| I | Flujos integrados, verificador por host y matriz CI definida para cuatro runners | 301 pruebas tras ampliación I; validaciones externas aún pendientes |

Los 14 skills, 24 perfiles de diagnóstico, 80 herramientas y las recetas manuales anteriores se conservan. Los diez perfiles nuevos son de preparación de proyectos, no reemplazan los de diagnóstico. La fase E mantiene ocho herramientas con recetas de comandos, npm incluido y 71 entradas sin receta. No se habilitó un ejecutor ni se completaron ficticiamente esas recetas pendientes.

## Archivos nuevos

- [catalog/profiles/manifest.json](../../catalog/profiles/manifest.json).
- [scripts/docker/doctor.js](../../scripts/docker/doctor.js), [generate.js](../../scripts/docker/generate.js), [backends.js](../../scripts/docker/backends.js) y [operations.js](../../scripts/docker/operations.js).
- [scripts/workspace/files.js](../../scripts/workspace/files.js), [project.js](../../scripts/workspace/project.js), [profiles.js](../../scripts/workspace/profiles.js), [environment.js](../../scripts/workspace/environment.js), [verify.js](../../scripts/workspace/verify.js) y [cli.js](../../scripts/workspace/cli.js).
- [tests F](../../tests/kit/workspace-f.test.js), [G](../../tests/kit/workspace-g.test.js), [H](../../tests/kit/workspace-h.test.js) e [I](../../tests/kit/workspace-i.test.js).
- [workflow CI](../../.github/workflows/kit-validation.yml), [guía operativa](../WORKSPACE-OPERATIONS.md) e informes [F](PHASE-F.md), [G](PHASE-G.md), [H](PHASE-H.md) e [I](PHASE-I.md).

Actualizados: scripts/kit.js, package.json, tests/kit/manual-commands.test.js, README.md, INSTALACION.md, CHANGELOG.md y documentación de capacidades/instalación/planificación para reflejar el estado actual. No se añadieron dependencias ni se modificó package-lock.json. Se respetaron los cambios locales de fases anteriores; no se atribuyen a esta entrega ni se hizo commit.

## Resultados finales

- `npm run test:kit`: **301 pruebas aprobadas**, 0 fallos, 0 omitidas en macOS ARM64 tras ampliar I; se conservan las 282 anteriores.
- `npm run kit:validate`: aprobado; 14 skills, 24 perfiles de diagnóstico, 80 herramientas, ocho recetas manuales y diez perfiles de preparación.
- `npm run kit:verify -- runtime --json`: 25 controles aprobados.
- `npm run kit:verify -- runtime --docker --server --json`: controles de código aprobados, Docker no disponible; resultado no listo, salida 1 esperada. No se instaló para alterar el resultado.
- Sintaxis Node y Python generada: válida; Python se analizó con AST sin ejecutar servidor. Las pruebas originales usaron HTTP simulado; la ampliación I probó Node/Python/Java en 127.0.0.1 con puertos efímeros y procesos cerrados.
- `git diff --check`: sin errores de formato; comprobación de enlaces y revisión de patrones sensibles en archivos nuevos.

La evidencia queda en la sesión y en los informes por fase; no se copian rutas personales o salidas de aplicaciones privadas al repositorio.

## Límites y riesgos pendientes

- Real en esta sesión: macOS ARM64, pruebas del kit, generación de archivos y handler Node simulado. Las pruebas iniciales no abrieron puertos; la ampliación I sí ejecutó procesos de prueba locales temporales, cerrados al terminar.
- Docker ausente: no hay validación nativa de Compose, builds o contenedores, credenciales o persistencia real. No se instaló para suplir esa ausencia.
- Windows/Linux/macOS Intel: matriz preparada, no ejecutada; sus pruebas de formato/decisiones se simulan en la suite actual. No se certifica compatibilidad nativa a partir de ella.
- Backends son ejemplos /health sin aplicación de negocio, autenticación o integración de datos. Java sí compilado y ejecutado en la ampliación I con JDK 21.0.7; Go/.NET e imágenes no compilados/verificados aquí.
- No hay desinstalación de herramientas globales: el modo manual no acredita qué paquetes existentes pertenecen al kit. Las actualizaciones/recuperación entregadas se refieren a planes y configuración de proyecto, no a migración automática del sistema operativo.
- Restaurar reproduce configuración inicial: no copia código modificado, lockfiles, SDKs, imágenes, secretos o datos. Se requieren repositorio, backups, migraciones y lockfiles revisados aparte.
- Los tags de imágenes son mutables. Las referencias deben existir y ser compatibles con arquitectura/stack; los digests tampoco demuestran disponibilidad en el host sin comprobarla.
- Secretos locales necesitan permisos compatibles con el UID del servicio; Compose no sustituye un almacén de secretos cifrado.
- up no recrea ni descarga/compila implícitamente. down sí elimina capas escribibles del contenedor aunque preserve volúmenes; se exige confirmación del proyecto. remove-volumes exige además confirmación de pérdida de datos. No se eliminan imágenes o recursos globales.
- Contexto/nombre Compose delimitan comandos, no certifican propiedad de recursos existentes. El usuario revisa antes de ejecutar; el kit no ejecuta los comandos generados.
- Cambios detectados en archivos bloquean propuestas de mutación; las consultas de reparación siguen disponibles. No se sobrescriben carpetas existentes ni se limpian automáticamente escrituras parciales.

La ampliación I añade [evidencia nativa local](PHASE-I-NATIVE-MACOS-ARM64.json), [informe actualizado](PHASE-I.md) e [inventario de CI](PHASE-I-CI-FILES.json). No se hicieron instalaciones globales, cambios de PATH/JAVA_HOME, arranque de contenedores, descargas de imágenes, commits, push ni despliegues.
