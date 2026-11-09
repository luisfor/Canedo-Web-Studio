# Planificador de herramientas — fase D

Genera propuestas revisables combinando el catálogo con el diagnóstico. No instala, descarga, actualiza ni modifica configuración. El plan D no contiene recetas ejecutables. La [fase E](TOOL-INSTALLERS.md) ofrece propuestas separadas con comandos revisables para cinco adaptadores. La ejecución pública está deshabilitada; el modo asistido queda reservado.

## Uso

```bash
npm run kit:plan -- --tool go
npm run kit:plan -- --profile react --tool git
npm run kit:plan -- --tool go --version go=1.27.3 --manager homebrew --json
node scripts/kit.js doctor --tool go --json > doctor.json
node scripts/kit.js plan --tool go --report doctor.json --json > plan.json
node scripts/kit.js plan validate --file plan.json --json
```

La versión del ejemplo es una selección explícita, no una recomendación ni una comprobación de disponibilidad. No se elige automáticamente una versión exacta. Los archivos de los ejemplos se crean mediante la redirección del shell; el planificador solo lee y escribe su respuesta estándar.

`--tool` se puede repetir y combinar con `--profile`. `--exclude ID` excluye herramientas; excluir una dependencia obligatoria bloquea la propuesta. `--version ID=X.Y.Z` exige una versión numérica exacta de una herramienta seleccionada o requerida. Las dependencias obligatorias se ordenan y deduplican; las opcionales solo entran si se seleccionan explícitamente con `--tool`.

Sin `--report` se ejecutan únicamente los diagnósticos de las herramientas seleccionadas y sus dependencias. Un reporte incompleto produce una inspección pendiente, nunca una falsa ausencia. El reporte externo debe cumplir el esquema 2 del doctor; se recalcula la compatibilidad usando el catálogo actual.

## Decisiones que muestra

| Intención | Significado |
|---|---|
| `reuse` | Versión existente compatible, sin cambio solicitado |
| `install` | Herramienta ausente; intención pendiente de concretar |
| `review-existing` | Instalación existente que requiere revisión; no se reemplaza automáticamente |
| `inspect` | Evidencia insuficiente o paquete por proyecto sin diagnóstico |
| `choose-deployment` | Servicio de base de datos: decidir local, contenedor o remoto |
| `blocked` | Exclusión obligatoria, conflicto, plataforma o versión incompatible |

Un cliente como `psql` no acredita un servidor PostgreSQL instalado. Los paquetes de aplicación se mantienen en alcance de proyecto; las instalaciones de sistema conservan su destino y permisos pendientes. La propiedad de una instalación existente no se atribuye al kit.

Los candidatos actuales son Winget en Windows, Homebrew en macOS, apt/dnf en Linux y gestores de proyecto según el ecosistema. Son candidatos sin receta verificada: su presencia no demuestra que el paquete, versión o arquitectura estén disponibles. No se escoge gestor automáticamente ni se instala uno ausente. `--manager` expresa una preferencia explícita, no concede permiso de ejecución.

## Estados y códigos de salida

- `blocked`: hay impedimentos; salida 1.
- `needs-decisions`: quedan elecciones o detalles; salida 0, o 1 con `--strict`.
- `reviewable`: propuesta sin decisiones pendientes; salida 0. Puede ser una selección reutilizable sin cambios.
- `plan validate`: salida 0 si es coherente con los catálogos actuales, 1 si es inválido u obsoleto.

Cada propuesta conserva `executionAllowed: false`, `approval: not-requested` y `scope: review-only`, incluso si es revisable. En `plan` no existen `apply`, `--yes` ni comandos de instalación. El comando separado `install commands` genera instrucciones manuales y `install apply` está deshabilitado. Antes de ejecutar instrucciones manualmente revisa su receta, origen, integridad, destino, permisos y efectos; el plan D no autoriza cambios.

## Integridad y privacidad

`planId` es una huella SHA-256 del contenido normalizado. Se incluyen huellas del catálogo de herramientas y del catálogo de capacidades. La validación comprueba el esquema, las huellas y reconstruye las decisiones para detectar modificaciones inconsistentes o catálogos obsoletos.

Una huella no es una firma, no autentica un reporte externo y no acredita aprobación. Validar un archivo no vuelve a comprobar el equipo (`environmentRechecked: false`); antes de una ejecución futura habría que diagnosticar de nuevo y aprobar el cambio concreto.

La salida conserva sistema, arquitectura, versiones y estados necesarios; descarta rutas de ejecutables, comandos y valores de entorno del reporte. Revise cualquier archivo antes de compartirlo: el informe original del doctor puede contener más información que el plan normalizado. Los JSON de entrada tienen un límite de 1 MiB.

## Implementación y verificación

- [Planificador](../scripts/planner/plan.js).
- [Esquema de plan](../schemas/tool-plan.schema.json) y [reporte de entrada](../schemas/diagnostic-report.schema.json).
- [Pruebas](../tests/kit/planner.test.js).
- [Catálogo](TOOL-CATALOG.md) y [diagnóstico](ENVIRONMENT-DOCTOR.md).

Se comprueba la lógica con reportes simulados de Windows, macOS y Linux y una ejecución local en macOS ARM64. Esto no certifica instalaciones nativas ni soporte de todos los artefactos o arquitecturas. Las 11 skills, 24 perfiles y 80 entradas del catálogo se conservan.
