# Etapa 6 — CRM local y fronteras omnicanal

Base de entrada: etapa 5, 371/371 pruebas. Se amplía el generador con una familia v2 sin modificar el runtime v1 ni proyectos existentes.

Archivos creados: `scripts/composition/business.js`, `business-runtime/{api,auth,validate,repository,channels,app,server,migrate,integration.test}.cjs`, `schema.sql`, `inbox.html`, `inbox.js`; `tests/kit/business.test.js`; guía omnicanal y este informe. Modificados: motor, reconciliador incremental, registros de composición/comercial/vocabulario, pruebas de catálogo/terminal/discovery, package.json y README.

Implementado: CRM persistente, permisos por actor, aislamiento compuesto por empresa, contratos, pipeline, etiquetas/segmentos, asignación/handoff, citas sin solapamiento, reglas literales de etiquetado, conocimiento, respuestas rápidas y auditoría. Interfaz inbox mínima. Reutiliza comercio/transacciones/outbox/inbox. Una migración v1→v2 no se ejecuta como ampliación; se bloquea antes de escribir o adoptar datos incompatibles.

Pruebas nuevas: tres pruebas del generador, que ejecutan cuatro pruebas de la aplicación generada con SQLite y HTTP reales en macOS. Cubren ventas/stock/caja/CRM, idempotencia, aislamiento, permisos, pipeline, agenda, handoff y recepción firmada. Chatbot y payloads Meta son fixtures simulados; no son conexiones reales. Rechazo de destino existente, datos v1 y cambio silencioso de familia.

Resultado: `npm run test:kit` **374/374 aprobadas**, cero fallos/omisiones; `npm run kit:validate` y `git diff --check` aprobados. Ninguna instalación, repositorio descargado, contenedor, commit, push o despliegue.

Límites explícitos: producto comercial sigue parcial. No hay envío remoto, aprobación de plataformas, TikTok operativo, recordatorios automáticos, OIDC, panel completo, HA o certificación de producción. No se confunde un puerto o una firma local con integración real. Estas brechas no se anuncian como terminadas.
