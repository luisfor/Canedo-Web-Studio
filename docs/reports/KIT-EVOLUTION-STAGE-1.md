# Etapa 1 — descubrimiento y KIT-FIRST

Se amplió el kit existente mediante una interfaz estructurada de agentes que consulta catálogos, inspecciona el destino y evalúa reutilización antes de invocar el generador. No se reconstruyó el kit ni se modificaron proyectos ajenos.

## Archivos creados

- [discovery.js](../../scripts/kit-first/discovery.js): versión, huella del código/política y catálogos existentes completos.
- [inspect.js](../../scripts/kit-first/inspect.js): inspección acotada, sin ejecutar código, con privacidad, hashes y señales de procedencia explícita.
- [service.js](../../scripts/kit-first/service.js): evaluación de reutilización y compuertas de planificación, validación y creación.
- [Esquema de evidencia](../../schemas/kit-first.schema.json) y [esquema de solicitud](../../schemas/agent-request.schema.json).
- [Pruebas](../../tests/kit/kit-first.test.js) y [documentación operativa](../kit-first/README.md).
- Este informe.

## Archivos modificados

- [CLI principal](../../scripts/kit.js), [CLI compartida](../../scripts/workspace/cli.js) y [package.json](../../package.json).
- [README](../../README.md) y [capacidades](../CAPACIDADES.md).

## Implementado y reutilizado

`agent discover/inspect/plan/validate/create`, también mediante `npm run kit:agent -- ...`. La evidencia es obligatoria y debe coincidir con el kit/catálogos/destino actuales. No basta con recalcular el hash de una evidencia alterada. La escritura vuelve a comprobar condiciones y usa el escritor exclusivo y el motor de composición existentes. Procesos con fuentes del kit cambiadas deben reiniciarse.

Se reutilizan los 80 registros de herramientas, ocho recetas manuales, diez perfiles de preparación, 14 skills, 24 perfiles de diagnóstico y el catálogo de composición actual. No se ejecuta ningún gestor o script inspeccionado.

La inspección identifica manifiestos JavaScript/PHP, Go, Python, Java/Gradle, .NET y Rust, señales de autenticación/API/persistencia y capacidades declaradas. Distingue declaraciones de inferencias; no las presenta como componentes verificados. Los proyectos existentes se protegen contra regeneración y se muestran candidatos que deben preservarse, capacidades presentes y brechas.

## Pruebas y resultados

La suite de esta etapa incorpora 12 pruebas: descubrimiento, bloqueo anterior al generador, vínculo a versión/catálogos/destino, evaluación de reutilización, exclusión de secretos, cambios y personalizaciones, destinos existentes/enlaces, esquemas, generación segura, transporte CLI JSON sin PATH, manifiestos de varios lenguajes e inspecciones incompletas.

- `npm run test:kit-first`: 12/12 aprobadas.
- `npm run kit:validate`: aprobado, 14 skills y 24 perfiles más catálogos asociados.
- `npm run test:kit`: 333/333 aprobadas, sin fallos ni omisiones; incluye las 321 pruebas previas.

La ejecución corresponde al host macOS ARM64 existente. La regresión de composición incluye HTTP/SQLite locales; los escenarios de instalación de otros sistemas son fixtures, no instalaciones. No se ejecutaron Docker, SDKs ausentes ni plataformas externas.

## Limitaciones y pendientes

El control se aplica a la interfaz de agentes del kit; no certifica identidad del llamador o comprensión del catálogo ni impide escrituras externas. Los protocolos `codex-cli-json` y `generic-cli-json` se comprobaron como interfaces CLI/JSON, no como SDK, MCP o compatibilidad universal.

Los hashes son comparaciones de estado, no firmas. La inspección estática es acotada y sus inferencias necesitan verificación. Registros anteriores se detectan por presencia, sin declararlos válidos por ello. Los proyectos existentes no se modifican: lectores unificados de registros, continuidad y planes incrementales pertenecen a la etapa 2. Esta interfaz usa las capacidades publicadas por el kit; no activa extensiones privadas/proveedores no descubiertos. La API manual conserva las extensiones anteriores.

No se instalaron dependencias, descargaron repositorios, iniciaron contenedores, modificaron configuraciones globales, crearon commits, hicieron push ni despliegues.
