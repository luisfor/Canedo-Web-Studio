# Universalización: cierre de mejoras 1–3

## Recuperación del trabajo

Se inspeccionó el working tree y se conservaron los cambios anteriores. Git incluye numerosos archivos previos sin seguimiento; no se interpretaron todos como cambios de esta reanudación ni se hizo reset. La implementación interrumpida ya contenía la carga diferida, la huella técnica separada, la conexión de recursos y diez pruebas nuevas. Las primeras comprobaciones de recuperación aprobaron 23 pruebas (13 anteriores de planificación y diez de recursos).

Estado al recuperar: código principal avanzado y funcional; registro de las pruebas nuevas en npm, documentación y regresión completa pendientes. Durante el cierre se corrigieron dos casos: `Path` de Windows no debe desaparecer por diferencias de mayúsculas, y una selección bloqueada no debe producir archivos de configuración para un runtime excluido. Se añadieron pruebas y una comprobación del CLI con reporte guardado.

## Capacidades verificadas

1. El plan técnico carga catálogos, reglas y funciones del núcleo sin importar compositor, generadores, paquetes o esquemas comerciales. La normalización textual pasa a un helper compartido; la carga de las rutas anteriores se difiere hasta usarlas. Los ejemplos y generadores se conservan.
2. La solicitud se conecta con el planificador existente de herramientas/dependencias, restricciones de OS, reglas de versión, perfiles, preparadores y recetas manuales. React utiliza la dependencia Node declarada; FastAPI utiliza Python. PostgreSQL distingue cliente de la decisión de despliegue del servidor. Android/iOS y ESP32 remiten a registros ya existentes; no se amplía el vocabulario de tipos de software en esta entrega.
3. Los perfiles son candidatos y no instalan sus sugerencias. Una versión exacta puede producir configuración de runtime en memoria mediante los preparadores existentes. Un conflicto del conjunto bloquea esa preparación. Frameworks, nombres/versiones de paquetes y lockfiles siguen requiriendo revisión.
4. `--diagnose` solicita consultas de versión mediante el doctor existente. Sin esa opción no se ejecutan procesos. `--report` conserva una instantánea aportada, valida su esquema, descarta valores adicionales y recomputa compatibilidad. Al validar un plan no se reejecuta el diagnóstico.
5. Las recetas y su validador producen instrucciones manuales revisables en `resources.manualCommands`; no se ejecutan instalaciones. Una receta disponible no certifica un paquete publicado o una instalación compatible.
6. KIT-FIRST técnico liga evidencia al destino y al código/catálogos realmente utilizados. `requireTechnicalCurrent` rechaza evidencia alterada/caducada. La evidencia consultiva no puede sustituir la evidencia completa del escritor. El plan no concede permisos de generación, instalación o despliegue.

## Archivos del alcance

Nuevos respecto a la etapa de planificación anterior:

- `scripts/tools/text.js`: helper textual compartido.
- `scripts/terminal/resources.js`: conexión con funciones existentes, sin otro catálogo de herramientas.
- `tests/kit/universal-resources.test.js`: pruebas de recursos, aislamiento y CLI.
- `docs/reports/UNIVERSAL-IMPROVEMENTS-1-3.md`: este informe.
- `docs/reports/UNIVERSAL-IMPROVEMENTS-1-3-RESULTS.json`: resultados, host y huella técnica de la entrega.

Modificados o completados desde la implementación iniciada:

- `scripts/composition/catalog.js`: conserva API y reutiliza helper compartido.
- `scripts/planner/plan.js`: expone la normalización existente de observaciones para reutilización.
- `scripts/kit-first/discovery.js`, `scripts/kit-first/service.js`: huellas separadas y revalidación técnica.
- `scripts/terminal/interpret.js`, `scripts/terminal/service.js`, `scripts/terminal/technical.js`: carga diferida, recursos y reconstrucción canónica del plan.
- `scripts/devkit.js`: opciones revisables de versión, gestor, reporte y diagnóstico.
- `schemas/technical-plan.schema.json`: salida de recursos sin permiso de ejecución.
- `package.json`: pruebas nuevas incluidas en `test:universal` y `test:kit`; sin cambios de dependencias.
- `README.md`, `docs/CAPACIDADES.md`, `docs/cli/README.md`, `docs/cli/universal-planning.md`, `docs/kit-first/README.md`: uso, estados y límites actuales.

## Comprobaciones de cierre

Comprobaciones finalizadas:

| Comando/comprobación | Resultado |
|---|---|
| `npm run test:universal` | **25/25 aprobadas**, cero fallos u omisiones |
| `npm run test:kit` | **407/407 aprobadas**, cero fallos, omisiones o cancelaciones |
| `npm run kit:validate` | Aprobado; 14 skills y 24 perfiles conservados |
| `git diff --check` | Aprobado |
| Enlaces locales de README y cinco documentos relacionados | Sin destinos rotos |
| CLI con `--diagnose` y versión exacta Python | Consulta real local, plan válido y destino sin crear |

Consulta nativa realizada: `node scripts/devkit.js plan "Crear API Python FastAPI" --diagnose --version python=3.14.4 --manager pip --json`, usando un destino nuevo no creado. Detectó Python 3.14.4 compatible con la regla actual y reutilizó el perfil backend para preparar `.python-version`, `requirements.txt`, `pyproject.toml` y `.gitignore` en memoria. No ejecutó pip, instalaciones o comandos de los preparadores. El plan permaneció `needs-decisions` por requisitos todavía pendientes.

Host: macOS ARM64, Node v25.2.1 existente. Esa ejecución de Node no certifica cumplimiento de la política del kit (Node 25 sigue fuera de sus majors declarados), ni ejecución nativa Windows/Linux. [Resultados estructurados y huella](UNIVERSAL-IMPROVEMENTS-1-3-RESULTS.json).

**Estado de cierre:** mejoras 1–3 verificadas en su alcance local. No se comenzó ninguna de las mejoras 4–8.

Las pruebas de aislamiento se ejecutan en un proceso nuevo que prohíbe importar módulos comerciales/compositor y leer sus catálogos/esquemas. Las pruebas de Windows/Linux usan observaciones simuladas y no se presentan como ejecución nativa de esos sistemas. A–H se conservan como regresión de planificación; no se desarrolló una aplicación comercial nueva.

## Límites y pendientes

- El intérprete sigue siendo determinista y acotado. Ampliar reconocimiento corresponde a la mejora 4.
- No se cambió el inspector ni la reconciliación. Sus límites y los reconciliadores pendientes corresponden a la mejora 5.
- Las rutas de ejemplo previas conservan su comportamiento; `plan --technical` fuerza el núcleo consultivo. El descubrimiento completo de ejemplos sigue necesitando sus paquetes. El modo técnico es el que funciona sin ellos.
- No se expuso esta salida por nuevos clientes/MCP ni se verificaron Codex, Gemini o Claude: mejora 6 pendiente.
- No hay validación automática universal de código del usuario, migraciones o instalación. Validar aquí verifica planes y contratos del kit; ampliaciones de validación corresponden a la mejora 7.
- Las políticas de versión solo cubren las entradas declaradas. Fuentes oficiales permanecen en el catálogo; no se consultó disponibilidad actual de SDK o paquetes, ni se certificó hardware, otros sistemas operativos o producción.
- Los diagnósticos guardados no son firmas ni certifican procedencia o actualidad. Una huella no es autorización. `executionAllowed: false` impide ejecución de instrucciones preparadas; las consultas de versión requieren la opción explícita.

No se instalaron herramientas/dependencias ni se descargaron repositorios, iniciaron contenedores, realizaron commits/push/despliegues o modificaron otros proyectos. Las mejoras 4–8 quedan detenidas hasta autorización.
