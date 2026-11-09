# Fase F — diagnóstico y versiones de proyecto

2026-11-02. Implementación manual, sin instalaciones ni cambios globales.

Archivos nuevos: scripts/docker/doctor.js, scripts/workspace/files.js, scripts/workspace/project.js, scripts/workspace/cli.js, tests/kit/workspace-f.test.js y docs/WORKSPACE-OPERATIONS.md. Integración en scripts/kit.js y package.json. Las capacidades y documentación final se enlazan en README y docs/CAPACIDADES.md al cerrar F–I.

Resultados: 234 pruebas aprobadas (218 anteriores + 16 nuevas); kit:validate aprobado. Se probaron aislamiento de componentes Docker, protección de contextos remotos, privacidad, seis stacks, dependencias, huellas y escritura exclusiva. No se sobrescribieron configuraciones existentes.

Verificación real macOS ARM64: Docker CLI ausente y Desktop no encontrado. No se instalaron herramientas ni se probaron contenedores reales. Engine, Desktop, Compose y Buildx se prueban con respuestas simuladas, sin atribuirles certificación nativa. Windows/Linux siguen pendientes de ejecución real.

Pendiente al cerrar F: plantillas Docker/Compose y perfiles (G); operación y exportación/restauración (H); matriz de verificación (I). Continúa dentro de la autorización conjunta F–I.
