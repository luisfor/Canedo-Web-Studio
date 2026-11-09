# Etapa 7 — SaaS y combinaciones locales

Entrada: etapa 6 con 374/374 pruebas y validación aprobadas.

Archivos nuevos: `business-runtime/saas.cjs`, `saas.sql`, `saas.test.cjs`, `commercial.sql`; registro/esquema/API de combinaciones; `tests/kit/saas.test.js`, documentación de monetización y este informe. Modificados: generador/runtime business (API, permisos, repositorio, aplicación y pruebas), catálogo de composición/comercial, API comercial, CLI compartida, pruebas terminal/discovery/business, package.json, README y guía de paquetes.

Implementado: planes inmutables mientras estén suscritos, suscripciones locales por operador, vencimiento/suspensión, asientos, métricas mensuales, cuotas transaccionales y alertas. Clientes no pueden otorgarse permisos de operador ni aumentar límites. Todo queda separado por empresa, incluidas claves, cuotas, eventos y auditoría. Sin cobros o pasarelas.

Las combinaciones A–I producen código inicial local y contratos/Compose. Reutilizan comercio/CRM: catálogo/pedidos autenticados; intenciones de pago y borradores no fiscales ligados a ventas; contenido/campañas manuales con audiencia consentida. No se presentan como checkout público, marketing IA o facturación autorizada operativos.

Pruebas: generador SaaS ejecuta seis pruebas propias con HTTP/SQLite en macOS, incluyendo flujo de tienda, permisos, cuotas concurrentes, ausencia de doble consumo, suspensión y persistencia tras reinicio. Verificación de planes/contratos/Compose de A–I; ejecución de cada combinación se consolida en etapa 8. Fixtures IA/Meta simulados, redes externas deshabilitadas.

Regresión: `npm run test:kit` **376/376 aprobadas**, cero fallos/omisiones; `npm run kit:validate` y `git diff --check` aprobados. Límites: SQLite local, listas limitadas, identidad bootstrap, sin alta de empresas global, portal SaaS, cobros, impuestos, canales reales, envío automático o HA. El catálogo mantiene productos parciales con brechas explícitas. No se instalaron dependencias ni iniciaron contenedores; sin commits, push, despliegues o cambios ajenos.
