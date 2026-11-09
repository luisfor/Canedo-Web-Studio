# Entrega de fase E — modo manual

Fecha: 2026-11-02. Alcance autorizado: fase E. La implementación se detiene antes de la fase F.

## Resultado

El kit genera comandos revisables y no los ejecuta. Hay una política explícita de modalidades: manual disponible, asistida reservada y deshabilitada. `install apply` rechaza ejecución incluso con una aprobación histórica; el API público tampoco llama a los motores conservados.

Se conservan 14 skills, 24 perfiles, 80 herramientas, el doctor, el planificador D, los formatos de snapshots oficiales y los motores internos anteriores. Los tests de esos motores usan exclusivamente archivos sintéticos en directorios temporales; no son instalaciones reales ni habilitan el ejecutor público.

Cinco adaptadores: Homebrew, winget, apt, dnf y archivos oficiales. Cobertura inicial: 8 herramientas con receta —Node, Go, Python, Git, Java, .NET, Terraform y Docker—, npm incluido con Node y 71 entradas sin receta manual. No se proponen instalaciones globales de frameworks ni se inventan versiones de paquetes.

Los planes muestran fuentes, versión objetivo/paquete, dependencias, permisos, espacio desconocido cuando no hay datos, riesgos y verificación. Si hay incompatibilidades/exclusiones se retiran comandos de cambio; herramientas compatibles se reutilizan y las preexistentes que requieren revisión no reciben comandos de reinstalación nativa. Los snapshots oficiales siguen permitiendo describir una carpeta nueva, sin tocar las anteriores.

Docker tiene recetas de comandos para Desktop o Engine y consultas separadas para CLI, Engine, Desktop, Compose y Buildx. No se ejecutan esas consultas desde el generador. No hay arranque de daemon/contenedores, descarga de imágenes o eliminación de datos.

## Archivos de esta entrega

Nuevos:

- [catalog/install-recipes/manifest.json](../../catalog/install-recipes/manifest.json): recetas declarativas versionadas.
- [schemas/install-recipes.schema.json](../../schemas/install-recipes.schema.json): esquema de recetas.
- [schemas/command-plan.schema.json](../../schemas/command-plan.schema.json): planes manuales de esquema 3.
- [scripts/commands/catalog.js](../../scripts/commands/catalog.js): validación y cobertura.
- [scripts/commands/plan.js](../../scripts/commands/plan.js): selección de método, pasos, riesgos y reconstrucción.
- [scripts/commands/render.js](../../scripts/commands/render.js): argumentos POSIX/PowerShell.
- [scripts/commands/policy.js](../../scripts/commands/policy.js): modalidades y rechazo de ejecución.
- [scripts/commands/schema.js](../../scripts/commands/schema.js): carga del esquema.
- [tests/kit/manual-commands.test.js](../../tests/kit/manual-commands.test.js): pruebas del modo manual.
- [docs/COMMAND-INSTALLATION.md](../COMMAND-INSTALLATION.md) y este informe.

Actualizados:

- [scripts/kit.js](../../scripts/kit.js): comandos, visualización, validación y bloqueo de apply.
- [scripts/installers/index.js](../../scripts/installers/index.js): ejecución pública deshabilitada; APIs de consulta conservadas.
- [tests/kit/archive-installers.test.js](../../tests/kit/archive-installers.test.js): fixtures históricos pasan por el motor interno, separado del API público bloqueado.
- [package.json](../../package.json): incorpora las pruebas manuales, sin nuevas dependencias.
- [README.md](../../README.md), [INSTALACION.md](../../INSTALACION.md), [docs/CAPACIDADES.md](../CAPACIDADES.md), [docs/TOOL-INSTALLERS.md](../TOOL-INSTALLERS.md), [docs/INSTALLATION-PLANNER.md](../INSTALLATION-PLANNER.md), [docs/TOOL-CATALOG.md](../TOOL-CATALOG.md) y [CHANGELOG.md](../../CHANGELOG.md).

La carpeta ya contenía cambios locales de fases anteriores. Este informe no atribuye esos cambios a la entrega actual ni crea un commit.

## Verificación

- `npm run test:kit`: **218 pruebas aprobadas**, 0 fallos y 0 omitidas. Base anterior: 160; 58 pruebas nuevas del modo manual.
- `npm run kit:validate`: aprobado; 14 skills, 24 perfiles, 80 herramientas y 8 recetas manuales válidas.
- `git diff --check`: aprobado, sin errores de formato.
- Comprobación de enlaces locales y búsqueda de patrones de credenciales en archivos nuevos, sin mostrar valores privados.

Pruebas reales en el host macOS ARM64: CLI de generación/validación, bloqueo de ejecución y renderizado POSIX, además de las pruebas existentes y fixtures temporales. No se instalaron SDK reales, se cambiaron configuraciones globales ni se ejecutaron comandos de los gestores. Para esta entrega la generación manual no consultó red/gestores; las fuentes de documentación se leyeron para revisar sintaxis y precondiciones.

Pruebas simuladas: matrices Homebrew/winget/apt/dnf, distribuciones, arquitectura y renderizado PowerShell, snapshots oficiales y sus hashes. No se certifica instalación nativa en Windows/Linux ni macOS Intel a partir de ellas. Los motores históricos se verifican con artefactos sintéticos locales.

## Riesgos y límites conocidos

- Las versiones y paquetes pueden no estar disponibles en el repositorio concreto. `review-ready` no equivale a disponibilidad ni a autorización.
- Los gestores pueden resolver dependencias, cambiar enlaces o activar servicios cuando el usuario ejecute los comandos; deben revisarse transacciones y permisos.
- `--repository-ready` es una declaración del usuario, no una comprobación criptográfica del repositorio.
- Homebrew no fija parches históricos: una comprobación fallida de versión exige detenerse. Los keg-only pueden requerir una ruta explícita.
- La equivalencia sintáctica de versión de paquete/runtime no demuestra el contenido real del paquete; los metapaquetes pueden no ser utilizables con ese adaptador.
- Espacio instalado/descargado y compatibilidad sin regla declarada se muestran como desconocidos, no se inventan.
- El flujo oficial manual exige revisar el índice del archivo antes de extraer. Conserva comprobación de tamaño/hash, pero no automatiza rollback ni la inspección estructural del motor interno. Una ejecución manual interrumpida puede dejar archivos parciales.
- Una huella no es firma, autorización ni prueba de autenticidad de un diagnóstico externo. La validación no vuelve a comprobar el equipo.
- Los módulos internos conservan código de ejecución para evolución futura; no son una interfaz soportada ni un aislamiento frente a invocaciones deliberadas fuera del API público.

## Pendiente después de fase E

Fase F: diagnóstico operativo Docker, configuración y versiones/dependencias por proyecto. Fases G–H: generación Dockerfile/Compose, perfiles, comandos de servicios, actualización/recuperación y reproducción. Fase I: verificaciones nativas en plataformas disponibles. La configuración por proyecto no se adelanta a esta entrega.

No se habilita ejecución asistida, se añaden repositorios, se cambia PATH, se instala Docker ni se inicia ningún servicio. No se hicieron commits, push ni despliegues. Se requiere autorización para comenzar la fase F.
