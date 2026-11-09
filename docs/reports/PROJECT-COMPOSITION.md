# Entrega del motor de composición — 2026-11-02

Implementación local autorizada sobre la arquitectura existente. No hubo commits, push, despliegues, instalaciones de dependencias/SDK, descarga de repositorios, arranque de contenedores o modificación de aplicaciones de clientes. Se conservaron las funcionalidades y cambios locales anteriores del kit.

## Fase 1: catálogo, interpretación y planificación

Archivos incorporados:

- [Catálogo de composición](../../catalog/composition/registry.json).
- [Esquema de catálogo](../../schemas/composition-catalog.schema.json), [esquema de plan](../../schemas/composition-plan.schema.json) y [subconjunto OpenAPI](../../schemas/composition-openapi.schema.json).
- [Catálogo/validación](../../scripts/composition/catalog.js), [intenciones](../../scripts/composition/intents.js), [planificador](../../scripts/composition/planner.js), [contratos](../../scripts/composition/contracts.js) y [motor](../../scripts/composition/engine.js).
- [Pruebas de catálogo y planificación](../../tests/kit/composition-planner.test.js).

Funciones: nueve capacidades con dependencias, dos arquetipos iniciales y dos referencias arquitectónicas; consulta de todos los registros; interpretación local en español, negaciones básicas y términos desconocidos; conflictos de tecnologías, dependencias y arquitectura; selección justificada; procedencia/licencia separada de permisos de importación. La ampliación del catálogo reconoce también nuevos nombres de lenguajes/frameworks/motores registrados. El registro de generadores exige declarar capacidades reales; la metadata no habilita ejecución.

Frontera de proveedores semánticos configurable mediante API local, con autorización explícita y resultados validados/revisables. El proveedor predeterminado no usa red o servicios pagos. No se repiten llamadas externas al validar un plan ya producido.

Resultado final: **13 pruebas de planificación aprobadas**. Incluyen las ocho categorías obligatorias de selección comercial/comunicaciones/combinada, conflictos, contratos, no sobrescritura, licencias/procedencia y validación, además de extensiones y controles de proveedores. Las comprobaciones de flujo reales se detallan en la fase 2.

Límites: interpretación acotada por vocabulario/reglas, no comprensión semántica universal. Una solicitud ambigua/desconocida queda bloqueada. No se activa una IA remota ni se importa código externo por registrar una referencia.

## Fase 2: proyecto funcional y comunicación

Archivos incorporados:

- [Generador](../../scripts/composition/generate.js).
- Runtime original: [base de datos/transacciones](../../scripts/composition/runtime/db.cjs), [comercio](../../scripts/composition/runtime/commerce.cjs), [CRM](../../scripts/composition/runtime/crm.cjs), [adaptadores](../../scripts/composition/runtime/adapters.cjs), [puertos HTTP](../../scripts/composition/runtime/http-ports.cjs), [validación](../../scripts/composition/runtime/validate.cjs), [aplicación HTTP](../../scripts/composition/runtime/app.cjs), [servidor](../../scripts/composition/runtime/server.cjs) y [comando de migración](../../scripts/composition/runtime/migrate.cjs).
- [Migración comercio](../../scripts/composition/runtime/migrations/commerce.sql) y [migración CRM](../../scripts/composition/runtime/migrations/crm.sql).
- [Pruebas incluidas en cada proyecto](../../scripts/composition/runtime/integration.test.cjs) y [pruebas del generador/runtime](../../tests/kit/composition-runtime.test.js).

El proyecto generado incluye estructura, módulos, endpoints, dos bases SQLite por dominio, migraciones, OpenAPI, esquema de evento, interfaces TypeScript, configuración de pruebas, variables de ejemplo, procedencia, documentación y Compose optativo. Se reutilizan el escritor seguro, renderizador de comandos, generador de políticas Docker y validador oficial Compose existentes. No se sustituyen los módulos anteriores.

Se comprobó con persistencia y HTTP locales reales:

- Venta de dos unidades a 1299 centavos: stock inicial 10 → 8, ingreso único en caja de 2598 y una actividad comercial en CRM.
- Repetición idempotente sin duplicar venta, caja o stock; cambio de carga con igual clave devuelve conflicto.
- Stock insuficiente y entradas inválidas no dejan una venta parcial; organizaciones y credenciales se aíslan.
- Persistencia conservada al cerrar y reabrir la aplicación.
- Outbox/inbox con deduplicación, fallo de entrega, recuperación y límite de intentos sin eliminar registros agotados.
- Contratos por HTTP real entre procesos lógicos de comercio/CRM, con token de servicio separado y rechazo de eventos inválidos/no autorizados.
- Compras y proveedores con movimiento de stock y rollback ante referencia inválida.
- WhatsApp/IA deshabilitados por defecto. Los adaptadores de prueba explícitos comprueban cola/envío solicitado, consentimiento, respuesta de chatbot e idempotencia sin contactar proveedores reales.
- Un adaptador inyectado pero deshabilitado no se ejecuta; un proveedor que no responde tiene timeout acotado.

Resultado final: **7 pruebas de ejecución del motor aprobadas**, que además ejecutan las cinco pruebas de los proyectos completos y verifican sintaxis del código generado. Los proyectos de inventario/CRM aislados también se ejecutan; omiten explícitamente los escenarios completos que no les corresponden. El ejemplo completo no omite pruebas.

Límites: el generador ejecutable incluido es Node/SQLite. Los contratos y puertos HTTP permiten implementaciones en otros lenguajes, pero no se afirma haber ejecutado PHP/Laravel, TypeScript u otros generadores de aplicación inexistentes. Una solicitud explícita de stack no disponible queda bloqueada, sin migrarla. No se da por compatible la API original de AFPVentas/Vocero sin un mapeo/adaptador y pruebas adicionales. No incluye UI, impuestos, devoluciones, contabilidad completa ni conexiones reales WhatsApp/IA.

## Fase 3: CLI, documentación, regresión y aceptación

Archivos modificados dentro de esta ampliación:

- [CLI principal](../../scripts/kit.js): enrutamiento y validación del nuevo catálogo.
- [CLI de workspace](../../scripts/workspace/cli.js): `composition catalog/plan/validate/create/check/verify`, con opciones estrictas.
- [package.json](../../package.json): comandos y ampliación de la suite, sin dependencias nuevas.
- [README](../../README.md), [capacidades](../CAPACIDADES.md), [demos](../GUIA-DEMOS.md) y [changelog](../../CHANGELOG.md).

Archivos nuevos de entrega:

- [Verificador integral](../../scripts/composition/verify.js).
- [Arquitectura y extensiones](../PROJECT-COMPOSITION.md), [tutorial ejecutable](../../examples/composition/README.md) y [solicitud de tienda](../../examples/composition/tienda-crm.request.json).
- Este informe y [evidencia nativa JSON](COMPOSITION-NATIVE-MACOS-ARM64.json).

Resultados ejecutados:

| Comprobación | Resultado | Alcance |
|---|---|---|
| `npm run kit:validate` | Aprobada | 14 skills, 24 perfiles y catálogos, incluyendo composición |
| `npm run test:kit` | **321/321**, cero fallos/omisiones | 301 pruebas previas + 20 nuevas de composición; las simulaciones de instalación siguen siendo fixtures, no instalaciones reales |
| Código generado | Sintaxis aprobada | Archivos JavaScript de la plantilla |
| `composition verify --json` | **10/10**, cero omisiones | Cinco pruebas por arquitectura: monolito modular y servicios independientes |
| Planes y archivos del ejemplo | Aprobados | 38 archivos por variante, contando su registro de integridad |
| Contratos | Aprobados | Subconjunto OpenAPI generado, referencias y todos los esquemas compilados; prueba HTTP de interfaces |
| Compose | Aprobado por esquema oficial | No se ejecutó Docker CLI/Engine, build o imagen |
| `git diff --check` | Sin errores | Cambios rastreados; no se realizó commit |

La evidencia nativa registra macOS ARM64, Node **25.2.1**, SQLite real y puertos efímeros exclusivamente en `127.0.0.1`. El proyecto declara Node **24.22.2**; esta sesión no ejecutó ese binario exacto ni lo instaló. La evidencia incluye los IDs de plan de ambas variantes, comprobados contra su reconstrucción posterior. Los datos de prueba son sintéticos y temporales; se eliminaron al finalizar.

Las primeras pruebas HTTP encontraron `EPERM` por la restricción del sandbox. Se repitieron con permiso de ejecución local y aprobaron; no se presentaron como aprobadas mientras estuvieron bloqueadas. El runner anidado también se aisló de `NODE_TEST_CONTEXT` para comprobar la salida TAP real y evitar aceptar una ejecución sin resultados visibles.

## Restricciones y pendientes explícitos

No se probaron nativamente Windows, Linux, macOS Intel, Docker Engine/Compose CLI ni el build de imágenes. El workflow existente ahora recoge las nuevas pruebas mediante `test:kit`, pero no fue publicado/ejecutado en GitHub. Las pruebas existentes con fixtures de otros sistemas no acreditan verificación nativa allí.

La validación OpenAPI local cubre el subconjunto emitido, no cualquier documento arbitrario ni un validador oficial completo. Los tags de imágenes requieren revisión/digest y verificación de disponibilidad antes de un build autorizado. Las migraciones se entregan para ejecución explícita; no se aplicaron a datos existentes. Los tokens por organización son un arranque seguro de desarrollo, no administración completa de identidad/roles.

La integración real de proveedores necesita adaptadores revisados, credenciales privadas, firmas, políticas de entrega, privacidad e idempotencia remota. Un timeout no puede deshacer una llamada externa ya recibida: los proveedores deben respetar la señal y la clave idempotente. Los registros pendientes/fallidos se conservan para reconciliación. Estas conexiones continúan deshabilitadas.

El criterio principal queda demostrado dentro del alcance del backend inicial: una sola solicitud combinada genera y valida una tienda integrada con inventario, ventas, caja, CRM y puertos chatbot/WhatsApp, y sus pruebas ejecutan el flujo completo. No se limita a enlazar los repositorios de referencia.
