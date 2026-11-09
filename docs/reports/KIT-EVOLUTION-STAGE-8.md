# Etapa 8 — aceptación y documentación

Entrada: etapa 7 con 376/376 pruebas y validación aprobadas. Esta entrega verifica la implementación local; no declara terminadas las conexiones reales o los productos comerciales con brechas.

## Archivos

Nuevos: `scripts/composition/acceptance.js`, `tests/kit/acceptance.test.js`, `tests/kit/channels.test.js`, guías en `docs/architecture`, `docs/security`, `docs/tutorials`; índice de etapas y este informe. Modificados: esquema de memoria (evidencia opcional compatible con manifiestos previos), CLI compartida, pruebas generadas business (compras, conocimiento, respuestas rápidas, automatización, protección último admin), timeout IA, combinación C con roles, package.json, README y capacidades. La evidencia JSON se guarda tras ejecución final.

## Aceptación ejecutable

`npm run kit:composition -- acceptance --json` genera A–I más la solicitud integrada en diez destinos temporales mediante KIT-FIRST. No recibe rutas de proyectos existentes ni ejecuta sus scripts. Usa el Node existente, pruebas propias conocidas, entorno reducido, SQLite y HTTP loopback. Valida contratos/Compose, conserva huellas de archivos antes/después y registra resultados en revisiones encadenadas de memoria.

Demostración: productos/inventario, compras/proveedores, venta/caja/outbox/CRM, roles y aislamiento, pipeline/asignación/handoff, conocimiento y respuestas, citas, reglas de etiquetado, suscripción/cuotas/alertas, pedidos y borradores comerciales. Chatbot y payloads Meta son fixtures simulados, nunca cuentas reales. Los casos agrupados ejecutan las ramas correspondientes a los módulos seleccionados, no 52 integraciones distintas.

La memoria inicial permanece `not-run`. Solo la aceptación explícita de su propio proyecto temporal agrega evidencia local `passed/failed`, host/runtime, pruebas, huella y alcance. Marca un subconjunto de funciones locales probado y mantiene módulos externos/comerciales parciales pendientes. Una prueba local aprobada no equivale a producción o certificación de terceros. Ejecuciones manuales de proyectos personalizados aún no se importan automáticamente en memoria.

## Pruebas y resultados

`npm run test:kit`: **382/382 aprobadas**, cero fallos, cancelaciones u omisiones. `npm run kit:validate`, comprobación de sintaxis de 12 archivos JS/CJS del runtime y `git diff --check`: aprobados. La aceptación final aprobó **52/52 pruebas agrupadas**, diez destinos, cero fallos/omisiones. [Evidencia JSON](KIT-EVOLUTION-ACCEPTANCE-MACOS-ARM64.json): macOS ARM64, Node v25.2.1; sin certificación de Windows/Linux u otros runtimes. Cada puerto WhatsApp/Messenger/Instagram tiene prueba separada de deshabilitación, firma, parsing y cuenta; TikTok rechaza banderas de activación no verificadas. Regresiones de continuidad v1 y personalizaciones se mantienen en la suite.

## Estado y pendientes

README es el índice de instalación/comandos, español, agentes, herramientas, tecnologías, arquitecturas, generadores, composición, paquetes, CRM, combinaciones, referencias, Docker, SaaS, seguridad, pruebas, continuidad, monetización, ejemplos y roadmap. Mantiene banner y contenido existente. Catálogo: 25 capacidades, tres adaptadores de negocio, 20 paquetes (14 parciales, seis planificados, cero productos completos).

Pendientes: conexiones Meta/TikTok/IA verificadas, envío y estados/plantillas, recordatorios automáticos, cobros, facturación fiscal, OIDC/identidad de producción, interfaz administrativa completa, paginación/retención/backup/HA, reconciliadores v2/Python y pruebas nativas Windows/Linux. MCP se prueba con cliente de protocolo, no con clientes Codex/Claude instalados y configurados. Compose tiene validación de esquema, sin imágenes o motor ejecutados. No se instalaron dependencias ni modificaron proyectos ajenos; sin commits, push o despliegues.
